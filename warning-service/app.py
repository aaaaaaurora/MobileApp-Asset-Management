import os
import uuid
import datetime
import enum
import requests
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import text

# Assumo la presenza del modulo condiviso come negli altri servizi
from shared_utils.messaging import RabbitMQManager 

app = Flask(__name__)

# Configurazione
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'postgresql://user:pass@db:5432/warning_db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Servizi esterni
ASSET_SERVICE_URL = os.getenv('ASSET_SERVICE_URL', 'http://asset-service:5000')
RABBITMQ_URL = os.getenv('RABBITMQ_URL', 'amqp://guest:guest@rabbitmq-service:5672/')
mq_manager = RabbitMQManager(rabbitmq_url=RABBITMQ_URL)

# ==========================================
# ENUM & MODELS
# ==========================================
class WarningStatus(enum.Enum):
    aperta = 'aperta'
    chiusa = 'chiusa'

class MaintenanceType(enum.Enum):
    preventiva = 'preventiva'
    correttiva = 'correttiva'

class Warning(db.Model):
    __tablename__ = 'warning'
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id = db.Column(UUID(as_uuid=True), nullable=False)
    campus_id = db.Column(UUID(as_uuid=True), nullable=False)
    reporter_id = db.Column(UUID(as_uuid=True), nullable=False)
    description = db.Column(db.Text, nullable=False)
    status = db.Column(db.Enum(WarningStatus), default=WarningStatus.aperta)
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class MaintenanceIntervention(db.Model):
    __tablename__ = 'maintenance_intervention'
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id = db.Column(UUID(as_uuid=True), nullable=False)
    campus_id = db.Column(UUID(as_uuid=True), nullable=False)
    operator_id = db.Column(UUID(as_uuid=True), nullable=False)
    warning_id = db.Column(UUID(as_uuid=True), db.ForeignKey('warning.id'), nullable=True)
    intervention_type = db.Column(db.Enum(MaintenanceType), nullable=False)
    technical_note = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.datetime.utcnow)

# ==========================================
# UTILITIES
# ==========================================
def get_auth_context():
    """Estrae i dati di autorizzazione forniti dal Gateway."""
    return {
        'user_id': request.headers.get('X-User-Id'),
        'role': request.headers.get('X-User-Role'),
        'campus_ids': request.headers.get('X-Campus-Ids', '').split(',') if request.headers.get('X-Campus-Ids') else []
    }

def validate_asset_sync(asset_id, auth_context):
    """
    Comunica sincronicamente con l'Asset Service per validare l'esistenza
    dell'asset e recuperarne il campus_id.
    """
    try:
        headers = {
            'X-User-Id': auth_context['user_id'],
            'X-User-Role': auth_context['role'],
            'X-Campus-Ids': ','.join(auth_context['campus_ids'])
        }
        # Invocazione endpoint Asset Service (Presuppone rotta GET /assets/{id})
        response = requests.get(f"{ASSET_SERVICE_URL}/assets/{asset_id}", headers=headers, timeout=5)
        
        if response.status_code == 200:
            return response.json() # Struttura attesa: { "id": "...", "campus_id": "..." }
        return None
    except requests.RequestException:
        return None

def publish_audit(action, entity_id, actor_id, campus_id, payload_details):
    """Sfrutta il Manager centralizzato per emettere log asincroni."""
    event_data = {
        "azione": action,
        "entita_id": str(entity_id),
        "autore_id": str(actor_id),
        "campus_id": str(campus_id),
        "dettagli": payload_details
    }
    mq_manager.publish_event('system_events', action, str(actor_id), 'warning-service', event_data)

# ============================================================================
# HOOK DI INIZIALIZZAZIONE (Eseguito alla prima richiesta)
# ============================================================================
@app.before_request
def initialize_database():
    """
    Assicura che il database sia pronto.
    Sostituisce il blocco __main__ che viene ignorato da Docker (flask run).
    """
    if getattr(app, '_database_initialized', False):
        return

    try:
        # 1. Abilita l'estensione UUID e l'estensione pgcrypto
        db.session.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'))
        db.session.execute(text('CREATE EXTENSION IF NOT EXISTS "pgcrypto";'))
        db.session.commit()
        
        # 2. Crea le tabelle se non esistono già
        db.create_all()

        print("[WARNING SERVICE] Inizializzazione DB completata con successo.")
            
    except Exception as e:
        # Stampiamo l'errore nel log invece di ignorarlo in silenzio!
        print(f"[WARNING SERVICE] Errore critico in inizializzazione DB: {e}")
        db.session.rollback()
    finally:
        # Segna l'operazione come completata per l'intero ciclo di vita dell'app
        app._database_initialized = True

# ==========================================
# ENDPOINT INFRASTRUTTURALE: Health Check
# ==========================================
@app.route('/health', methods=['GET'])
def health_check():
    """
    Endpoint per i Liveness e Readiness Probe di Kubernetes.
    Restituisce un segnale di Heartbeat.
    """
    return jsonify({"status": "healthy"}), 200


# ==========================================
# ENDPOINT: US 6-1
# ==========================================
@app.route('/warnings', methods=['POST'])
def create_warning():
    """Creazione di una segnalazione pubblica su un asset esistente."""
    auth_ctx = get_auth_context()
    reporter_id = auth_ctx.get('user_id')
    
    if not reporter_id:
        return jsonify({"error": "Utente non autenticato o intestazioni Gateway mancanti"}), 401

    data = request.get_json()
    if not data:
        return jsonify({"error": "Payload mancante"}), 400

    asset_id_str = data.get('asset_id')
    description = data.get('descrizione')

    # Validazione input
    if not description or str(description).strip() == "":
        return jsonify({"error": "La descrizione della segnalazione è obbligatoria"}), 400
        
    if not asset_id_str:
        return jsonify({"error": "L'ID dell'asset è obbligatorio"}), 400

    # Verifica cross-service dell'Asset
    asset_data = validate_asset_sync(asset_id_str, auth_ctx)
    if not asset_data:
        return jsonify({"error": "Asset indicato non esiste o non raggiungibile"}), 404

    campus_id_str = asset_data.get('campus_id')

    try:
        asset_uuid = uuid.UUID(asset_id_str)
        campus_uuid = uuid.UUID(campus_id_str)
        reporter_uuid = uuid.UUID(reporter_id)
    except ValueError:
        return jsonify({"error": "Formato ID non valido"}), 400

    # Creazione record
    new_warning = Warning(
        asset_id=asset_uuid,
        campus_id=campus_uuid,
        reporter_id=reporter_uuid,
        description=description.strip()
    )

    try:
        db.session.add(new_warning)
        db.session.flush() # Ottiene l'ID generato da Postgres prima del commit
        warning_id = str(new_warning.id)
        db.session.commit()

        # Inoltro Evento Asincrono
        publish_audit(
            action="CREATE_WARNING",
            entity_id=warning_id,
            actor_id=reporter_id,
            campus_id=campus_id_str,
            payload_details={"asset_id": str(asset_uuid), "status": "aperta"}
        )

        return jsonify({
            "warning_id": warning_id,
            "status": "aperta"
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Errore interno del server: {str(e)}"}), 500

# ==========================================
# ENDPOINT: US 6-2
# ==========================================
@app.route('/warnings', methods=['GET'])
def get_warnings():
    """
    Recupera l'elenco delle segnalazioni. 
    Applica implicitamente il filtro territoriale in base al ruolo dell'utente.
    """
    auth_ctx = get_auth_context()
    user_role = auth_ctx.get('role')
    authorized_campus_ids = auth_ctx.get('campus_ids', [])

    # Filtri opzionali da query string
    req_campus_id = request.args.get('campus_id')
    req_status = request.args.get('status')

    # Inizializziamo la query di base
    query = Warning.query

    # 1. Filtro territoriale implicito di Sicurezza (RBAC)
    if user_role == 'OPERATORE':
        if not authorized_campus_ids:
            # Operatore configurato come "Zero-Campus": restituisce array vuoto
            return jsonify([]), 200
        
        # Converte le stringhe in UUID per la query su Postgres
        try:
            campus_uuids = [uuid.UUID(c) for c in authorized_campus_ids]
            query = query.filter(Warning.campus_id.in_(campus_uuids))
        except ValueError:
            return jsonify({"error": "Formato ID Campus autorizzati non valido"}), 400

    # 2. Filtro esplicito per Campus richiesto dal client
    if req_campus_id:
        try:
            req_campus_uuid = uuid.UUID(req_campus_id)
            # Se l'operatore richiede un campus, verifichiamo che sia tra quelli a lui assegnati
            if user_role == 'OPERATORE' and req_campus_id not in authorized_campus_ids:
                return jsonify([]), 200
            
            query = query.filter(Warning.campus_id == req_campus_uuid)
        except ValueError:
            return jsonify({"error": "Formato ID Campus richiesto non valido"}), 400

    # 3. Filtro per stato (es. ?status=aperta)
    if req_status:
        try:
            # Mappa la stringa ricevuta sull'Enum
            status_enum = WarningStatus[req_status.lower()]
            query = query.filter(Warning.status == status_enum)
        except KeyError:
            return jsonify({"error": "Stato segnalazione non valido"}), 400

    # Ordina per data di creazione decrescente (le più recenti prima)
    query = query.order_by(Warning.created_at.desc())

    # Esecuzione query
    warnings = query.all()

    # Formattazione della risposta JSON
    result = [{
        "id": str(w.id),
        "asset_id": str(w.asset_id),
        "descrizione": w.description,
        "status": w.status.value,
        "campus_id": str(w.campus_id),
        "created_at": w.created_at.isoformat()
    } for w in warnings]

    return jsonify(result), 200

# ==========================================
# ENDPOINT: US 6-3 (Risoluzione Segnalazione)
# ==========================================
@app.route('/warnings/<warning_id_str>/resolve', methods=['PATCH'])
def resolve_warning(warning_id_str):
    """
    Registra la nota tecnica dell'intervento e chiude formalmente la segnalazione.
    Genera un record immutabile di manutenzione correlato.
    """
    auth_ctx = get_auth_context()
    user_role = auth_ctx.get('role')
    user_id = auth_ctx.get('user_id')
    authorized_campus_ids = auth_ctx.get('campus_ids', [])

    # Solo gli operatori possono chiudere le segnalazioni
    if not user_id or user_role != 'OPERATORE':
        return jsonify({"error": "Operazione riservata agli Operatori"}), 403

    try:
        warning_uuid = uuid.UUID(warning_id_str)
    except ValueError:
        return jsonify({"error": "Formato ID segnalazione non valido"}), 400

    # 1. Recupero della segnalazione
    warning = db.session.get(Warning, warning_uuid)
    if not warning:
        return jsonify({"error": "Segnalazione non trovata"}), 404

    # 2. Controllo Isolamento Territoriale (RBAC)
    if str(warning.campus_id) not in authorized_campus_ids:
        return jsonify({"error": "Non sei autorizzato a operare sugli asset di questo campus"}), 403

    # 3. Controllo Stato Logico
    if warning.status == WarningStatus.chiusa:
        return jsonify({"error": "La segnalazione è già stata chiusa"}), 400

    # 4. Estrazione Payload
    data = request.get_json()
    if not data:
        return jsonify({"error": "Payload mancante"}), 400

    technical_note = data.get('nota_intervento')

    # 5. Validazione Input (Eccezione EMPTY_REPORT definita nello SDA)
    if not technical_note or str(technical_note).strip() == "":
        return jsonify({"error": "EMPTY_REPORT: La nota tecnica dell'intervento è obbligatoria"}), 400

    try:
        # Transazione Atomica: Aggiornamento Segnalazione + Creazione Intervento
        
        # A. Chiusura del ticket pubblico
        warning.status = WarningStatus.chiusa
        # NB: il trigger Postgres "set_warning_updated_at" aggiornerà in automatico la colonna updated_at
        
        # B. Registrazione permanente della manutenzione 
        new_maintenance = MaintenanceIntervention(
            asset_id=warning.asset_id,
            campus_id=warning.campus_id,
            operator_id=uuid.UUID(user_id),
            warning_id=warning.id,
            intervention_type=MaintenanceType.correttiva, # Correttiva in quanto evasa da una segnalazione
            technical_note=technical_note.strip()
        )
        
        db.session.add(new_maintenance)
        db.session.commit()

        # C. Pubblicazione evento RabbitMQ
        publish_audit(
            action="RESOLVE_WARNING",
            entity_id=warning_id_str,
            actor_id=user_id,
            campus_id=str(warning.campus_id),
            payload_details={
                "asset_id": str(warning.asset_id),
                "status_precedente": "aperta",
                "status_nuovo": "chiusa",
                "maintenance_id": str(new_maintenance.id)
            }
        )

        return jsonify({
            "warning_id": warning_id_str,
            "status": "chiusa"
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Errore interno del server: {str(e)}"}), 500
    
# ==========================================
# ENDPOINT: US 4-3 & US 6-3 (Manutenzione Diretta)
# ==========================================
@app.route('/maintenances', methods=['POST'])
def create_maintenance():
    """
    Registra un'attività di manutenzione preventiva o correttiva su un asset,
    senza richiedere la preesistenza di una segnalazione pubblica.
    """
    auth_ctx = get_auth_context()
    user_role = auth_ctx.get('role')
    user_id = auth_ctx.get('user_id')
    authorized_campus_ids = auth_ctx.get('campus_ids', [])

    # Sicurezza: solo gli Operatori possono registrare manutenzioni
    if not user_id or user_role != 'OPERATORE':
        return jsonify({"error": "Operazione riservata agli Operatori"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"error": "Payload mancante"}), 400

    asset_id_str = data.get('asset_id')
    technical_note = data.get('nota_intervento')
    m_type_str = data.get('tipo_intervento', 'preventiva').lower()

    # Validazione campi obbligatori
    if not asset_id_str:
        return jsonify({"error": "L'ID dell'asset è obbligatorio"}), 400
    if not technical_note or str(technical_note).strip() == "":
        return jsonify({"error": "La nota tecnica dell'intervento è obbligatoria"}), 400

    # Validazione Enum tipo intervento
    try:
        m_type_enum = MaintenanceType[m_type_str]
    except KeyError:
        return jsonify({"error": "Tipo intervento non valido. Usa 'preventiva' o 'correttiva'"}), 400

    # 1. Chiamata sincrona all'Asset Service per validare l'esistenza fisica
    asset_data = validate_asset_sync(asset_id_str, auth_ctx)
    if not asset_data:
        return jsonify({"error": "Asset indicato non esiste o non raggiungibile"}), 404
        
    campus_id_str = asset_data.get('campus_id')
    
    # 2. Controllo di Autorizzazione (RBAC) Territoriale
    if campus_id_str not in authorized_campus_ids:
        return jsonify({"error": "Non sei autorizzato a operare sugli asset di questo campus"}), 403

    try:
        asset_uuid = uuid.UUID(asset_id_str)
        campus_uuid = uuid.UUID(campus_id_str)
        operator_uuid = uuid.UUID(user_id)
    except ValueError:
        return jsonify({"error": "Formato ID non valido"}), 400

    # 3. Creazione record (Senza collegamento a warning)
    new_maintenance = MaintenanceIntervention(
        asset_id=asset_uuid,
        campus_id=campus_uuid,
        operator_id=operator_uuid,
        warning_id=None, # Manutenzione diretta
        intervention_type=m_type_enum,
        technical_note=technical_note.strip()
    )

    try:
        db.session.add(new_maintenance)
        db.session.flush() # Forza la generazione dell'ID in Postgres
        maintenance_id = str(new_maintenance.id)
        db.session.commit()

        # 4. Pubblicazione evento RabbitMQ
        publish_audit(
            action="LOG_MAINTENANCE",
            entity_id=maintenance_id,
            actor_id=user_id,
            campus_id=campus_id_str,
            payload_details={
                "asset_id": asset_id_str,
                "tipo_intervento": m_type_enum.value
            }
        )

        return jsonify({
            "maintenance_id": maintenance_id,
            "status": "registrata"
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Errore interno del server: {str(e)}"}), 500