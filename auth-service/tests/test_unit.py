import pytest
import json
import jwt
import pyotp
import datetime
import uuid
from unittest.mock import patch

# Importa l'app e i modelli dal tuo file principale (assunto come app.py)
from app import app, db, AppUser, Role, RoleType, UserCampus, UserCategory

# ============================================================================
# FIXTURES E SETUP
# ============================================================================

@pytest.fixture
def client():
    """
    Configura l'applicazione Flask in modalità TESTING e predispone il database
    per ogni singolo test, garantendo un ambiente pulito.
    """
    app.config['TESTING'] = True
    app.config['JWT_SECRET'] = 'test-secret-key-per-pytest'
    
    with app.test_client() as client:
        with app.app_context():
            # Pulisce e ricrea il database (usando il DB Postgres fornito dalla pipeline)
            db.drop_all()
            db.create_all()
            
            # Seed dei ruoli necessari
            db.session.add_all([
                Role(name=RoleType.GUEST, description='Utente base'),
                Role(name=RoleType.OPERATORE, description='Tecnico sul campo'),
                Role(name=RoleType.AMMINISTRATORE, description='Admin sistema')
            ])
            db.session.commit()
            
            yield client
            
            # Pulizia al termine del test
            db.session.remove()
            db.drop_all()

@pytest.fixture(autouse=True)
def mock_rabbitmq():
    """
    Mock automatico per RabbitMQ. Previene l'invio reale di eventi durante i test,
    evitando crash se il broker non è raggiungibile durante i test unitari.
    """
    with patch('app.mq_manager.publish_event') as mock_pub:
        yield mock_pub

@pytest.fixture
def mock_google_verify():
    """
    Mock per la validazione del token di Google. Restituisce un payload utente valido.
    """
    with patch('app.id_token.verify_oauth2_token') as mock_verify:
        mock_verify.return_value = {
            "sub": "1234567890",
            "email": "mario.rossi@studenti.unisa.it",
            "given_name": "Mario",
            "family_name": "Rossi"
        }
        yield mock_verify

# ============================================================================
# TEST CASES
# ============================================================================

def test_health_check(client):
    """Verifica che il probe di Kubernetes risponda correttamente."""
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json['status'] == 'healthy'

def test_auth_google_success(client, mock_google_verify):
    """
    Verifica il login con Google e l'Auto-Provisioning di un utente GUEST.
    """
    payload = {"google_id_token": "dummy_google_token"}
    response = client.post('/auth/google', json=payload)
    
    assert response.status_code == 200
    assert 'temp_token' in response.json
    assert response.json['user']['email'] == "mario.rossi@studenti.unisa.it"
    
    # Verifica che l'utente sia stato creato nel DB
    user = AppUser.query.filter_by(email="mario.rossi@studenti.unisa.it").first()
    assert user is not None
    assert user.role_id is not None

def test_auth_google_missing_token(client):
    """Verifica la gestione dell'errore se manca il token nel payload."""
    response = client.post('/auth/google', json={})
    assert response.status_code == 400
    assert "Token mancante" in response.json['error']

@patch('app.pyotp.TOTP.verify')
def test_verify_2fa_success(mock_totp_verify, client):
    """
    Verifica che fornendo un codice TOTP valido venga rilasciato il JWT definitivo.
    """
    # 1. Preparazione utente mock nel DB
    role = Role.query.filter_by(name=RoleType.GUEST).first()
    user = AppUser(email="test@2fa.com", role_id=role.id, totp_secret="TESTSECRET")
    db.session.add(user)
    db.session.commit()
    
    # 2. Generazione manuale del temp_token
    temp_payload = {"user_id": str(user.id), "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=5)}
    temp_token = jwt.encode(temp_payload, app.config['JWT_SECRET'], algorithm="HS256")
    
    # Forziamo il mock del TOTP a restituire True (codice corretto)
    mock_totp_verify.return_value = True
    
    # 3. Esecuzione richiesta
    response = client.post('/auth/2fa/verify', json={
        "temp_token": temp_token,
        "totp_code": "123456"
    })
    
    assert response.status_code == 200
    assert 'token' in response.json
    assert response.json['role'] == "GUEST"

def test_create_operator_success(client):
    """Verifica che un admin possa creare un nuovo operatore."""
    headers = {'X-User-Id': str(uuid.uuid4())}
    payload = {
        "email": "nuovo.operatore@campus.it",
        "campus_ids": [str(uuid.uuid4())]
    }
    
    response = client.post('/admin/operators', json=payload, headers=headers)
    
    assert response.status_code == 201
    assert 'user_id' in response.json
    assert 'totp_provisioning_uri' in response.json
    
    # Verifica salvataggio a DB
    new_op = AppUser.query.filter_by(email="nuovo.operatore@campus.it").first()
    assert new_op is not None
    # Verifica che il ruolo sia effettivamente OPERATORE
    role = Role.query.get(new_op.role_id)
    assert role.name == RoleType.OPERATORE

def test_create_operator_duplicate(client):
    """Verifica la protezione contro la creazione di operatori duplicati."""
    # Creiamo un operatore prima
    role = Role.query.filter_by(name=RoleType.OPERATORE).first()
    user = AppUser(email="duplicato@campus.it", role_id=role.id)
    db.session.add(user)
    db.session.commit()
    
    # Tentiamo di ricrearlo
    response = client.post('/admin/operators', json={"email": "duplicato@campus.it"})
    assert response.status_code == 409
    assert "già presente" in response.json['error']

def test_update_operator_success(client):
    """Verifica l'aggiornamento dei permessi spaziali (Campus) di un operatore."""
    # 1. Creazione operatore base
    role = Role.query.filter_by(name=RoleType.OPERATORE).first()
    user = AppUser(email="update@campus.it", role_id=role.id)
    db.session.add(user)
    db.session.commit()
    
    new_campus_id = str(uuid.uuid4())
    
    # 2. Esecuzione aggiornamento
    response = client.put(f'/admin/operators/{str(user.id)}', json={
        "campus_ids": [new_campus_id]
    })
    
    assert response.status_code == 200
    
    # 3. Verifica che il Soft Link sia stato creato correttamente
    link = UserCampus.query.filter_by(user_id=user.id).first()
    assert link is not None
    assert str(link.campus_id) == new_campus_id

def test_get_operators(client):
    """Verifica il recupero della lista degli operatori."""
    # Creazione di due operatori di test
    role = Role.query.filter_by(name=RoleType.OPERATORE).first()
    op1 = AppUser(email="op1@campus.it", role_id=role.id, first_name="A", last_name="B")
    op2 = AppUser(email="op2@campus.it", role_id=role.id, first_name="C", last_name="D")
    db.session.add_all([op1, op2])
    db.session.commit()
    
    response = client.get('/admin/operators')
    
    assert response.status_code == 200
    assert isinstance(response.json, list)
    assert len(response.json) >= 2
    
    # Verifichiamo che i dati siano serializzati correttamente
    emails = [op['email'] for op in response.json]
    assert "op1@campus.it" in emails
    assert "op2@campus.it" in emails