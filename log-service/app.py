import os
import json
import logging
import threading
import time
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.exc import SQLAlchemyError
from marshmallow import Schema, fields, INCLUDE, ValidationError
import csv
import io
from flask import Response
import dateutil.parser

# Importiamo il gestore centralizzato per RabbitMQ (dalla cartella condivisa)
from shared_utils.messaging import RabbitMQManager

# ============================================================================
# 1. CONFIGURAZIONE E SETUP
# ============================================================================

# Configurazione del Logging Strutturato
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger('log-service')

app = Flask(__name__)

# Configurazione PostgreSQL compatibile con Kubernetes e ambiente locale
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://user:pass@127.0.0.1:5433/log_db')
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Ottimizzazioni per il pool di connessioni
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    "pool_pre_ping": True,
    "pool_recycle": 300,
}

db = SQLAlchemy(app)
mq_manager = RabbitMQManager()

# ============================================================================
# 2. UTILITY FUNCTIONS E MIDDLEWARE
# ============================================================================

def get_auth_context():
    """
    Estrae le informazioni di sicurezza propagate dall'API Gateway.
    Il Log Service è passivo e si fida ciecamente di questi header.
    """
    campuses_header = request.headers.get('X-Campus-Ids', '')
    campus_ids = [c.strip() for c in campuses_header.split(',')] if campuses_header else []
    
    return {
        'user_id': request.headers.get('X-User-Id'),
        'role': request.headers.get('X-User-Role'),
        'campus_ids': campus_ids
    }

def error_response(message, status_code):
    return jsonify({"error": message}), status_code

# ============================================================================
# 3. MODELLI DATABASE (Append-Only)
# ============================================================================

class AuditLog(db.Model):
    """
    Modello per la tabella audit_log. 
    Design Append-Only: I record sono eventi storici immutabili. Nessun UPDATE o DELETE.
    """
    __tablename__ = 'audit_log'

    id = db.Column(UUID(as_uuid=True), primary_key=True, server_default=db.text('gen_random_uuid()'))
    correlation_id = db.Column(UUID(as_uuid=True), nullable=True, index=True)
    service_name = db.Column(db.String(50), nullable=False, index=True)
    action = db.Column(db.String(100), nullable=False, index=True)
    actor_id = db.Column(UUID(as_uuid=True), nullable=True, index=True)
    entity_id = db.Column(db.String(100), nullable=True, index=True) 
    
    # JSONB essenziale per query complesse, filtri e dashboard flessibili
    payload = db.Column(JSONB, nullable=False)
    
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), index=True)

    def to_dict(self):
        return {
            "id": str(self.id),
            "correlation_id": str(self.correlation_id) if self.correlation_id else None,
            "service_name": self.service_name,
            "action": self.action,
            "actor_id": str(self.actor_id) if self.actor_id else None,
            "entity_id": str(self.entity_id) if self.entity_id else None,
            "payload": self.payload,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

# ============================================================================
# 4. DTO (Data Transfer Objects)
# ============================================================================

class EventPayloadSchema(Schema):
    """
    Schema di validazione (Marshmallow) per i messaggi in arrivo da RabbitMQ.
    Mappa e valida i campi generati dalla classe condivisa RabbitMQManager.
    """
    class Meta:
        # INCLUDE permette di accettare campi extra non dichiarati, 
        # che andranno a popolare liberamente il nostro JSONB
        unknown = INCLUDE

    service_name = fields.String(required=True)
    azione = fields.String(required=True)
    
    # UUIDs che potrebbero essere stringhe vuote o null se l'evento è di sistema
    autore_id = fields.UUID(allow_none=True, load_default=None)
    correlation_id = fields.UUID(allow_none=True, load_default=None)
    entity_id = fields.String(allow_none=True, load_default=None) 
    
    timestamp = fields.String(allow_none=True)


# ============================================================================
# 5. REPOSITORY LAYER
# ============================================================================

class AuditLogRepository:
    """
    Gestisce l'accesso al database per la tabella audit_log.
    Design Append-Only per le scritture, con metodi avanzati per le letture.
    """
    
    @staticmethod
    def insert(log_entry: AuditLog) -> AuditLog:
        """Salva un nuovo evento nel database in modo transazionale."""
        try:
            db.session.add(log_entry)
            db.session.commit()
            return log_entry
        except SQLAlchemyError as e:
            db.session.rollback()
            logger.error(f"Errore DB durante l'inserimento dell'audit log: {str(e)}")
            raise e

    @staticmethod
    def _build_filter_query(filters: dict):
        """Metodo di utilità interno per applicare i filtri dinamici alla query base."""
        query = db.session.query(AuditLog)

        if filters.get('service_name'):
            query = query.filter(AuditLog.service_name == filters['service_name'])
        if filters.get('action'):
            query = query.filter(AuditLog.action.ilike(f"%{filters['action']}%"))
        if filters.get('actor_id'):
            query = query.filter(AuditLog.actor_id == filters['actor_id'])
        if filters.get('entity_id'):
            query = query.filter(AuditLog.entity_id == filters['entity_id'])

        if filters.get('start_date'):
            query = query.filter(AuditLog.created_at >= filters['start_date'])
        if filters.get('end_date'):
            query = query.filter(AuditLog.created_at <= filters['end_date'])

        campus_ids = filters.get('campus_ids')
        if campus_ids:
            query = query.filter(AuditLog.payload['campus_id'].astext.in_(campus_ids))

        return query.order_by(AuditLog.created_at.desc())

    @staticmethod
    def get_logs(filters: dict, page: int = 1, per_page: int = 50):
        """Recupera i log filtrati e paginati."""
        query = AuditLogRepository._build_filter_query(filters)
        return query.paginate(page=page, per_page=per_page, error_out=False)

    @staticmethod
    def get_all_logs(filters: dict):
        """Recupera l'intero set di log filtrati senza paginazione (Uso: Esportazioni)."""
        query = AuditLogRepository._build_filter_query(filters)
        return query.all()

    @staticmethod
    def find_by_id(log_id: str) -> AuditLog:
        """Recupera un singolo record di log tramite il suo UUID."""
        return db.session.query(AuditLog).filter(AuditLog.id == log_id).first()

    @staticmethod
    def get_dashboard_metrics(filters: dict) -> dict:
        """Calcola KPI generali e distribuzioni principali."""
        base_query = db.session.query(AuditLog)
        
        if filters.get('start_date'):
            base_query = base_query.filter(AuditLog.created_at >= filters['start_date'])
        if filters.get('end_date'):
            base_query = base_query.filter(AuditLog.created_at <= filters['end_date'])
        
        campus_ids = filters.get('campus_ids')
        if campus_ids:
            base_query = base_query.filter(AuditLog.payload['campus_id'].astext.in_(campus_ids))

        assets_count = base_query.filter(AuditLog.action == 'ASSET_CREATED').count()
        tickets_count = base_query.filter(AuditLog.action.in_(['CREATE_WARNING', 'RESOLVE_WARNING'])).count()
        interventions_count = base_query.filter(AuditLog.action.in_(['LOG_MAINTENANCE'])).count()

        category_distribution = db.session.query(
            AuditLog.payload['category_id'].astext.label('category_id'),
            func.count(AuditLog.id)
        ).filter(AuditLog.action == 'ASSET_CREATED')
        
        if campus_ids:
            category_distribution = category_distribution.filter(AuditLog.payload['campus_id'].astext.in_(campus_ids))
            
        category_dist_results = category_distribution.group_by(AuditLog.payload['category_id'].astext).all()
        
        campus_distribution = db.session.query(
            AuditLog.payload['campus_id'].astext.label('campus_id'),
            func.count(AuditLog.id)
        ).filter(AuditLog.action == 'ASSET_CREATED')
        
        if campus_ids:
            campus_distribution = campus_distribution.filter(AuditLog.payload['campus_id'].astext.in_(campus_ids))
            
        campus_dist_results = campus_distribution.group_by(AuditLog.payload['campus_id'].astext).all()

        return {
            "totals": {
                "assets": assets_count,
                "tickets": tickets_count,
                "interventions": interventions_count,
            },
            "distributions": {
                "by_category": {row[0]: row[1] for row in category_dist_results if row[0]},
                "by_campus": {row[0]: row[1] for row in campus_dist_results if row[0]}
            }
        }

    @staticmethod
    def get_dashboard_charts(filters: dict, dynamic_attr: str = None) -> dict:
        """
        Calcola i dati strutturati per i grafici (Serie storiche e attributi custom).
        """
        base_query = db.session.query(AuditLog)
        
        if filters.get('start_date'):
            base_query = base_query.filter(AuditLog.created_at >= filters['start_date'])
        if filters.get('end_date'):
            base_query = base_query.filter(AuditLog.created_at <= filters['end_date'])
            
        campus_ids = filters.get('campus_ids')
        if campus_ids:
            base_query = base_query.filter(AuditLog.payload['campus_id'].astext.in_(campus_ids))

        # 1. Serie Storica: Asset creati per giorno
        time_series_query = db.session.query(
            func.date_trunc('day', AuditLog.created_at).label('creation_day'),
            func.count(AuditLog.id)
        ).filter(AuditLog.action == 'ASSET_CREATED')
        
        if campus_ids:
            time_series_query = time_series_query.filter(AuditLog.payload['campus_id'].astext.in_(campus_ids))
            
        time_series_results = time_series_query.group_by('creation_day').order_by('creation_day').all()
        
        # 2. Distribuzione Dinamica (es. grafico a torta su attributi specifici configurati)
        dynamic_dist_results = []
        if dynamic_attr:
            dynamic_query = db.session.query(
                AuditLog.payload[dynamic_attr].astext.label('attr_val'),
                func.count(AuditLog.id)
            ).filter(AuditLog.action == 'ASSET_CREATED', AuditLog.payload.has_key(dynamic_attr))
            
            if campus_ids:
                dynamic_query = dynamic_query.filter(AuditLog.payload['campus_id'].astext.in_(campus_ids))
                
            dynamic_dist_results = dynamic_query.group_by('attr_val').all()

        return {
            "time_series": [
                {
                    "date": row[0].strftime('%Y-%m-%d') if row[0] else None, 
                    "count": row[1]
                } for row in time_series_results
            ],
            "dynamic_distribution": {
                "attribute": dynamic_attr,
                "data": {row[0]: row[1] for row in dynamic_dist_results if row[0]}
            } if dynamic_attr else None
        }


# ============================================================================
# 6. SERVICE LAYER
# ============================================================================

class PermissionError(Exception):
    pass

class NotFoundError(Exception):
    pass

class LogService:
    """Logica di business e orchestrazione dei dati per il Log Service."""
    
    @staticmethod
    def _extract_filters(query_params: dict) -> dict:
        filters = {
            'service_name': query_params.get('service_name'),
            'action': query_params.get('action'),
            'actor_id': query_params.get('actor_id'),
            'entity_id': query_params.get('entity_id'),
            'start_date': query_params.get('start_date'),
            'end_date': query_params.get('end_date')
        }
        requested_campus = query_params.get('campus_id')
        if requested_campus:
            filters['campus_ids'] = [requested_campus]
        return filters

    @staticmethod
    def get_paginated_logs(auth_context: dict, query_params: dict) -> dict:
        if auth_context.get('role') != 'AMMINISTRATORE':
            raise PermissionError("Accesso negato. Solo gli Amministratori possono consultare lo storico operazioni.")

        filters = LogService._extract_filters(query_params)
        
        try:
            page = int(query_params.get('page', 1))
            per_page = int(query_params.get('limit', 50))
            if per_page > 100:
                per_page = 100
        except ValueError:
            page = 1
            per_page = 50

        pagination = AuditLogRepository.get_logs(filters, page, per_page)
        return {
            "total_items": pagination.total,
            "total_pages": pagination.pages,
            "current_page": pagination.page,
            "items_per_page": per_page,
            "logs": [log.to_dict() for log in pagination.items]
        }

    @staticmethod
    def get_log_detail(auth_context: dict, log_id: str) -> dict:
        if auth_context.get('role') != 'AMMINISTRATORE':
            raise PermissionError("Accesso negato. Solo gli Amministratori possono consultare lo storico operazioni.")
        
        log_entry = AuditLogRepository.find_by_id(log_id)
        if not log_entry:
            raise NotFoundError("Record di audit non trovato.")
            
        return log_entry.to_dict()

    @staticmethod
    def export_csv(auth_context: dict, query_params: dict) -> str:
        if auth_context.get('role') != 'AMMINISTRATORE':
            raise PermissionError("Accesso negato. Solo gli Amministratori possono esportare lo storico.")
        
        filters = LogService._extract_filters(query_params)
        logs = AuditLogRepository.get_all_logs(filters)

        headers = [
            'Data e Ora', 
            'Servizio', 
            'Azione', 
            'Utente', 
            'Oggetto Coinvolto', 
            'Dettagli Aggiuntivi'
        ]

        # 1. DIZIONARI DI TRADUZIONE PER UN LINGUAGGIO NATURALE
        action_map = {
            'UPDATE_OPERATOR_PROFILE': 'Aggiornamento Profilo Operatore',
            '2FA_SUCCESS_LOGIN': 'Accesso con 2FA',
            'GOOGLE_LOGIN_SUCCESS': 'Accesso con Google',
            'CATEGORY_DELETED': 'Eliminazione Categoria',
            'CATEGORY_CREATED': 'Creazione Categoria',
            'ASSET_CREATED': 'Creazione Asset',
            'ASSET_UPDATED': 'Aggiornamento Asset',
            'ASSET_DELETED': 'Eliminazione Asset'
        }
        
        service_map = {
            'auth-service': 'Autenticazione',
            'asset-service': 'Gestione Asset',
            'log-service': 'Audit Log',
            'geozone-service': 'Gestione Mappe',
            'media-service': 'Gestione Media',
            'warning-service': 'Gestione Segnalazioni'
        }

        output = io.StringIO()
        output.write('\ufeff')  # Aggiunge il BOM (Byte Order Mark) per la codifica nativa di Excel
        writer = csv.DictWriter(output, fieldnames=headers, delimiter=';') # Forza il punto e virgola
        writer.writeheader()

        for log in logs:
            payload = log.payload if isinstance(log.payload, dict) else {}
            
            data_ora = log.created_at.strftime('%Y-%m-%d %H:%M:%S') if log.created_at else 'Data Sconosciuta'
            
            # Applichiamo le traduzioni (se non c'è traduzione, formatta il nome originale)
            azione_pulita = action_map.get(log.action, log.action.replace('_', ' ').title())
            servizio_pulito = service_map.get(log.service_name, log.service_name)
            
            utente = payload.get('email') or str(log.actor_id) if log.actor_id else 'Sistema / Sconosciuto'

            oggetto = ''
            if payload.get('campus_name'):
                oggetto += f"Campus: {payload.get('campus_name')} "
            if payload.get('category_name'):
                oggetto += f"Categoria: {payload.get('category_name')} "
            if payload.get('asset_name'):
                oggetto += f"Asset: {payload.get('asset_name')} "
            elif log.entity_id:
                oggetto += f"ID: {str(log.entity_id)[:8]}..." # Mostra solo i primi 8 caratteri
            
            oggetto = oggetto.strip() if oggetto else 'Operazione di Sistema'

            # 2. NASCONDIAMO GLI UUID ILLEGGIBILI DAI DETTAGLI
            keys_to_ignore = {
                'email', 'autore_id', 'actor_id', 'service_name', 'azione', 'action', 
                'timestamp', 'correlation_id', 'entity_id', 'campus_name', 
                'category_name', 'asset_name',
                'campus_id', 'category_id', 'media_id', 'asset_id'  # <--- Nascondiamo i codici lunghi!
            }
            
            dettagli_list = []
            for key, val in payload.items():
                if key not in keys_to_ignore and val not in [None, '', [], {}]:
                    # Rendi dizionari/liste più discorsivi
                    if isinstance(val, dict):
                        clean_val = ", ".join([f"{k}: {v}" for k, v in val.items()])
                    elif isinstance(val, list):
                        clean_val = ", ".join(map(str, val))
                    else:
                        clean_val = str(val)
                    
                    clean_key = key.replace('_', ' ').title()
                    dettagli_list.append(f"{clean_key}: {clean_val}")

            dettagli_stringa = " | ".join(dettagli_list) if dettagli_list else "-"

            row = {
                'Data e Ora': data_ora,
                'Servizio': servizio_pulito,
                'Azione': azione_pulita,
                'Utente': utente,
                'Oggetto Coinvolto': oggetto,
                'Dettagli Aggiuntivi': dettagli_stringa
            }
            writer.writerow(row)

        return output.getvalue()

    @staticmethod
    def get_dashboard_stats(auth_context: dict, query_params: dict) -> dict:
        if auth_context.get('role') != 'AMMINISTRATORE':
            raise PermissionError("Accesso negato. Solo gli Amministratori possono visualizzare la dashboard.")
            
        filters = {
            'start_date': query_params.get('start_date'),
            'end_date': query_params.get('end_date')
        }
        requested_campus = query_params.get('campus_id')
        if requested_campus:
            filters['campus_ids'] = [requested_campus]
            
        return AuditLogRepository.get_dashboard_metrics(filters)

    @staticmethod
    def get_dashboard_chart_data(auth_context: dict, query_params: dict) -> dict:
        """
        Elabora e restituisce i dati per i grafici temporali e dinamici.
        """
        if auth_context.get('role') != 'AMMINISTRATORE':
            raise PermissionError("Accesso negato. Solo gli Amministratori possono visualizzare la dashboard.")
            
        filters = {
            'start_date': query_params.get('start_date'),
            'end_date': query_params.get('end_date')
        }
        requested_campus = query_params.get('campus_id')
        if requested_campus:
            filters['campus_ids'] = [requested_campus]
            
        dynamic_attr = query_params.get('dynamic_attribute')
            
        return AuditLogRepository.get_dashboard_charts(filters, dynamic_attr)


# ============================================================================
# 7. ENDPOINT: API RESTFUL
# ============================================================================

@app.route('/health', methods=['GET'])
def health_check():
    try:
        db.session.execute(db.text('SELECT 1'))
        return jsonify({"status": "healthy", "database": "connected"}), 200
    except Exception as e:
        logger.error(f"Health check fallito: {str(e)}")
        return error_response("Service Unavailable", 503)
    
@app.route('/api/logs', methods=['GET'])
def get_logs():
    auth_context = get_auth_context()
    try:
        result = LogService.get_paginated_logs(auth_context, request.args)
        return jsonify(result), 200
    except PermissionError as pe:
        return error_response(str(pe), 403)
    except Exception as e:
        logger.error(f"Errore recupero log: {str(e)}")
        return error_response("Errore interno del server", 500)
    
@app.route('/api/logs/<log_id>', methods=['GET'])
def get_log_by_id(log_id):
    auth_context = get_auth_context()
    try:
        result = LogService.get_log_detail(auth_context, log_id)
        return jsonify(result), 200
    except PermissionError as pe:
        return error_response(str(pe), 403)
    except NotFoundError as nf:
        return error_response(str(nf), 404)
    except Exception as e:
        logger.error(f"Errore dettaglio log: {str(e)}")
        return error_response("Errore interno del server", 500)
    
@app.route('/api/logs/export', methods=['GET'])
def export_logs():
    auth_context = get_auth_context()
    try:
        csv_data = LogService.export_csv(auth_context, request.args)
        return Response(
            csv_data,
            mimetype="text/csv",
            headers={"Content-Disposition": "attachment; filename=audit_logs_export.csv"}
        )
    except PermissionError as pe:
        return error_response(str(pe), 403)
    except Exception as e:
        logger.error(f"Errore esportazione CSV: {str(e)}")
        return error_response("Errore interno del server", 500)

@app.route('/api/dashboard/metrics', methods=['GET'])
def get_dashboard_metrics_api():
    auth_context = get_auth_context()
    try:
        result = LogService.get_dashboard_stats(auth_context, request.args)
        return jsonify(result), 200
    except PermissionError as pe:
        return error_response(str(pe), 403)
    except Exception as e:
        logger.error(f"Errore elaborazione metriche dashboard: {str(e)}")
        return error_response("Errore interno del server", 500)
    
@app.route('/api/dashboard/charts', methods=['GET'])
def get_dashboard_charts_api():
    """
    Endpoint per alimentare i grafici della dashboard.
    Restituisce andamenti temporali e, se richiesto, la distribuzione su attributi custom (es. 'status').
    """
    auth_context = get_auth_context()
    try:
        result = LogService.get_dashboard_chart_data(auth_context, request.args)
        return jsonify(result), 200
    except PermissionError as pe:
        return error_response(str(pe), 403)
    except Exception as e:
        logger.error(f"Errore elaborazione dati grafici dashboard: {str(e)}")
        return error_response("Errore interno del server", 500)

# ============================================================================
# 8. RABBITMQ CONSUMER BACKGROUND THREAD
# ============================================================================

def process_log_event(ch, method, properties, body):
    """
    Callback eseguita per ogni messaggio RabbitMQ ricevuto.
    Gestisce l'ACK manuale in sicurezza.
    """
    with app.app_context():
        try:
            # 1. Parsing del messaggio JSON
            message_data = json.loads(body.decode('utf-8'))
            
            # 2. Validazione DTO
            schema = EventPayloadSchema()
            validated_data = schema.load(message_data)
            
            # Parsing sicuro del timestamp originale emesso dal publisher
            raw_timestamp = validated_data.get('timestamp')
            parsed_created_at = dateutil.parser.isoparse(raw_timestamp) if raw_timestamp else None

            # 3. Creazione del modello AuditLog
            log_entry = AuditLog(
                correlation_id=validated_data.get('correlation_id'),
                service_name=validated_data.get('service_name'),
                action=validated_data.get('azione'),
                actor_id=validated_data.get('autore_id'),
                entity_id=validated_data.get('entity_id'),
                payload=message_data,
                created_at=parsed_created_at  
            )
            
            # 4. Salvataggio su database
            AuditLogRepository.insert(log_entry)
            
            # ACK manuale: Conferma il salvataggio e rimuove il messaggio dalla coda
            if ch.is_open:
                ch.basic_ack(delivery_tag=method.delivery_tag)
                
            logger.info(f"Audit log registrato con successo: '{log_entry.action}' da '{log_entry.service_name}'")

        except json.JSONDecodeError:
            logger.error(f"Payload scartato (Non è JSON valido): {body}")
            if ch.is_open:
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
        except ValidationError as err:
            logger.error(f"Payload scartato (Fallimento validazione DTO): {err.messages}")
            if ch.is_open:
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
        except Exception as e:
            logger.error(f"Errore temporaneo DB, requeue del messaggio: {str(e)}")
            if ch.is_open:
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

def start_mq_consumer():
    """Avvia il consumer con retry automatico e coda dedicata persistente."""
    while True:
        try:
            logger.info("[*] Avvio consumer RabbitMQ (Log Service)...")
            mq_manager.start_consumer(
                exchange_name='system_events', 
                callback_function=process_log_event,
                queue_name='audit_log_persistent_queue',
                auto_ack=False,
                durable_queue=True
            )
        except Exception as e:
            logger.error(f"[!] Connessione RabbitMQ persa: {str(e)}. Riconnessione tra 5s...")
            time.sleep(5)

# ============================================================================
# ENTRY POINT  
# ============================================================================

consumer_thread = threading.Thread(target=start_mq_consumer, daemon=True)
consumer_thread.start()

if __name__ == '__main__':
    # Avvia il consumer in background  
    consumer_thread = threading.Thread(target=start_mq_consumer, daemon=True)
    consumer_thread.start()

    # Avvio del server Flask 
    app.run(host='0.0.0.0', port=5000)