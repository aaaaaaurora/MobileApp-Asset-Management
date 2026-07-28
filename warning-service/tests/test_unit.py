import os
import uuid
import pytest
from unittest.mock import patch

# ============================================================================
# SETUP AMBIENTE
# ============================================================================
os.environ['DATABASE_URL'] = os.getenv('DATABASE_URL', 'postgresql://user:pass@127.0.0.1:5433/warning_db')

from app import app, db, Warning, WarningStatus, MaintenanceIntervention, MaintenanceType

# ============================================================================
# FIXTURE CONDIVISE
# ============================================================================
@pytest.fixture
def client():
    """Configura Flask in modalità TESTING e crea un DB pulito per ogni test."""
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'postgresql://user:pass@127.0.0.1:5433/warning_db')
    
    with app.test_client() as client:
        with app.app_context():
            # Inizializza l'estensione pgcrypto per gen_random_uuid() se manca
            from sqlalchemy import text
            db.session.execute(text('CREATE EXTENSION IF NOT EXISTS "pgcrypto";'))
            db.session.commit()
            
            # Ricrea le tabelle pulite
            db.drop_all()
            db.create_all()
            
            yield client
            
            # Pulizia post-test
            db.session.remove()
            db.drop_all()

@pytest.fixture(autouse=True)
def mock_rabbitmq():
    """Mock automatico per prevenire chiamate reali a RabbitMQ durante i test."""
    with patch('app.mq_manager.publish_event') as mock_pub:
        yield mock_pub

@pytest.fixture
def mock_asset_service():
    """Mock per la validazione sincrona dell'asset verso l'Asset Service."""
    with patch('app.requests.get') as mock_get:
        # Crea una finta risposta (mock) per requests.get
        mock_response = mock_get.return_value
        mock_response.status_code = 200
        # Di default restituisce un payload valido. I test specifici possono sovrascriverlo.
        mock_response.json.return_value = {
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "campus_id": "987e6543-e21b-34d5-c678-426614174999"
        }
        yield mock_get


# ============================================================================
# TEST CASES
# ============================================================================

def test_health_check(client):
    """Verifica il Liveness Probe di Kubernetes."""
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json['status'] == 'healthy'

def test_create_warning_success(client, mock_asset_service):
    """Verifica la creazione corretta di una segnalazione pubblica (US 6-1)."""
    headers = {'X-User-Id': str(uuid.uuid4())}
    payload = {
        "asset_id": "123e4567-e89b-12d3-a456-426614174000",
        "descrizione": "L'asset risulta danneggiato."
    }
    
    response = client.post('/warnings', json=payload, headers=headers)
    
    assert response.status_code == 201
    assert 'warning_id' in response.json
    assert response.json['status'] == 'aperta'
    
    # Verifica che il record sia stato creato nel database
    warning = Warning.query.first()
    assert warning is not None
    assert warning.description == "L'asset risulta danneggiato."

def test_create_warning_invalid_asset(client, mock_asset_service):
    """Verifica che la creazione fallisca se l'Asset Service restituisce 404."""
    # Sovrascrive il mock per simulare un asset inesistente
    mock_asset_service.return_value.status_code = 404
    
    headers = {'X-User-Id': str(uuid.uuid4())}
    payload = {
        "asset_id": "123e4567-e89b-12d3-a456-426614174000",
        "descrizione": "Test asset inesistente"
    }
    
    response = client.post('/warnings', json=payload, headers=headers)
    assert response.status_code == 404
    assert "non esiste" in response.json['error']

def test_get_warnings_operator(client):
    """Verifica che l'Operatore veda solo le segnalazioni del suo campus (US 6-2)."""
    campus_1 = uuid.uuid4()
    campus_2 = uuid.uuid4()
    
    # Crea due segnalazioni in due campus diversi
    w1 = Warning(asset_id=uuid.uuid4(), campus_id=campus_1, reporter_id=uuid.uuid4(), description="Guasto C1")
    w2 = Warning(asset_id=uuid.uuid4(), campus_id=campus_2, reporter_id=uuid.uuid4(), description="Guasto C2")
    db.session.add_all([w1, w2])
    db.session.commit()
    
    # Simula la richiesta di un Operatore assegnato SOLO al campus 1
    headers = {
        'X-User-Role': 'OPERATORE',
        'X-Campus-Ids': str(campus_1)
    }
    
    response = client.get('/warnings', headers=headers)
    
    assert response.status_code == 200
    assert len(response.json) == 1
    assert response.json[0]['descrizione'] == "Guasto C1"

def test_resolve_warning_success(client):
    """Verifica la chiusura di una segnalazione e la registrazione della manutenzione (US 6-3)."""
    campus_id = uuid.uuid4()
    operator_id = uuid.uuid4()
    
    # 1. Prepara una segnalazione aperta
    warning = Warning(
        asset_id=uuid.uuid4(),
        campus_id=campus_id,
        reporter_id=uuid.uuid4(),
        description="Palo della luce fulminato"
    )
    db.session.add(warning)
    db.session.commit()
    
    # 2. Richiesta di risoluzione da parte di un Operatore autorizzato
    headers = {
        'X-User-Id': str(operator_id),
        'X-User-Role': 'OPERATORE',
        'X-Campus-Ids': str(campus_id)
    }
    payload = {"nota_intervento": "Sostituita lampadina LED."}
    
    response = client.patch(f'/warnings/{warning.id}/resolve', json=payload, headers=headers)
    
    assert response.status_code == 200
    assert response.json['status'] == 'chiusa'
    
    # 3. Verifica l'aggiornamento a DB e la tabella manutenzioni
    updated_warning = db.session.get(Warning, warning.id)
    assert updated_warning.status == WarningStatus.chiusa
    
    maintenance = MaintenanceIntervention.query.filter_by(warning_id=warning.id).first()
    assert maintenance is not None
    assert maintenance.technical_note == "Sostituita lampadina LED."
    assert maintenance.intervention_type == MaintenanceType.correttiva

def test_resolve_warning_wrong_campus(client):
    """Verifica il blocco di sicurezza se l'Operatore tenta di chiudere un ticket fuori giurisdizione."""
    campus_autorizzato = uuid.uuid4()
    campus_non_autorizzato = uuid.uuid4()
    
    warning = Warning(
        asset_id=uuid.uuid4(),
        campus_id=campus_non_autorizzato,
        reporter_id=uuid.uuid4(),
        description="Ticket blindato"
    )
    db.session.add(warning)
    db.session.commit()
    
    headers = {
        'X-User-Id': str(uuid.uuid4()),
        'X-User-Role': 'OPERATORE',
        'X-Campus-Ids': str(campus_autorizzato)
    }
    payload = {"nota_intervento": "Tentativo di hack"}
    
    response = client.patch(f'/warnings/{warning.id}/resolve', json=payload, headers=headers)
    assert response.status_code == 403
    assert "Non sei autorizzato" in response.json['error']

def test_create_maintenance_success(client, mock_asset_service):
    """Verifica la creazione di un intervento di manutenzione diretta (US 4-3)."""
    # Usiamo l'ID campus che la nostra finta API (mock) dell'Asset Service restituirà
    campus_id = "987e6543-e21b-34d5-c678-426614174999" 
    
    headers = {
        'X-User-Id': str(uuid.uuid4()),
        'X-User-Role': 'OPERATORE',
        'X-Campus-Ids': campus_id
    }
    payload = {
        "asset_id": "123e4567-e89b-12d3-a456-426614174000",
        "nota_intervento": "Ispezione ordinaria. Tutto ok.",
        "tipo_intervento": "preventiva"
    }
    
    response = client.post('/maintenances', json=payload, headers=headers)
    
    assert response.status_code == 201
    
    maintenance = MaintenanceIntervention.query.first()
    assert maintenance is not None
    assert maintenance.intervention_type == MaintenanceType.preventiva
    assert maintenance.warning_id is None # Nessuna segnalazione collegata

def test_create_maintenance_invalid_type(client, mock_asset_service):
    """Verifica che il sistema respinga tipologie di intervento non previste dall'Enum."""
    headers = {
        'X-User-Id': str(uuid.uuid4()),
        'X-User-Role': 'OPERATORE',
        'X-Campus-Ids': "987e6543-e21b-34d5-c678-426614174999"
    }
    payload = {
        "asset_id": "123e4567-e89b-12d3-a456-426614174000",
        "nota_intervento": "Test tipologia errata",
        "tipo_intervento": "non_esiste" # Errato
    }
    
    response = client.post('/maintenances', json=payload, headers=headers)
    assert response.status_code == 400
    assert "Tipo intervento non valido" in response.json['error']