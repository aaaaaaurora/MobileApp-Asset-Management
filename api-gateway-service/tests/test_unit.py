import os
import pytest
import jwt
from unittest.mock import patch, MagicMock
from app import app


@pytest.fixture
def client():
    """
    Configura l'applicazione in modalità di test e fornisce un test client.
    """
    app.config['TESTING'] = True
    app.config['JWT_SECRET'] = 'test-secret-key'
    with app.test_client() as client:
        yield client

def test_health_check(client):
    """
    Verifica che l'endpoint di health check risponda correttamente.
    """
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json['status'] == 'healthy'
    assert response.json['service'] == 'api-gateway'

def test_proxy_service_not_found(client):
    """
    Verifica che una richiesta verso un microservizio non censito restituisca 404.
    """
    response = client.get('/api/servizio- inesistente/risorsa')
    assert response.status_code == 404
    assert "Microservizio di destinazione non trovato" in response.json['error']

@patch('app.requests.request')
def test_proxy_forwarding_with_valid_jwt(mock_requests_request, client):
    """
    Verifica che il Gateway decodifichi correttamente il JWT e inietti 
    gli header contestuali (ID, Ruolo, Campus) prima di inoltrare al backend.
    """
    # Impostiamo la configurazione dell'app esplicitamente nel test
    app.config['JWT_SECRET'] = 'test-secret-key'
    
    payload = {
        "sub": "user-uuid-999",
        "role": "OPERATORE",
        "campus_ids": ["campus-alpha", "campus-beta"],
    }
    token = jwt.encode(payload, app.config['JWT_SECRET'], algorithm="HS256")

    mock_response = MagicMock()
    mock_response.status_code = 201
    mock_response.content = b'{"status": "created"}'
    mock_response.raw.headers = {'content-type': 'application/json'}
    mock_requests_request.return_value = mock_response

    headers = {
        'Authorization': f'Bearer {token}'
    }

    response = client.post('/api/asset/api/assets', headers=headers, json={"name": "Test Asset"})

    assert response.status_code == 201
    mock_requests_request.assert_called_once()
    
    # Estrae gli argomenti con cui 'requests.request' è stato chiamato dal Gateway
    call_kwargs = mock_requests_request.call_args[1]
    sent_headers = call_kwargs['headers']
    
    # Asserzioni sulla corretta propagazione degli header di contesto
    assert sent_headers.get('X-User-Id') == 'user-uuid-999'
    assert sent_headers.get('X-User-Role') == 'OPERATORE'
    assert sent_headers.get('X-Campus-Ids') == 'campus-alpha,campus-beta'

@patch('app.requests.request')
def test_proxy_forwarding_with_valid_jwt(mock_requests_request, client):
    """
    Verifica che il Gateway decodifichi correttamente il JWT e inietti 
    gli header contestuali (ID, Ruolo, Campus) prima di inoltrare al backend.
    """
    secret = 'test-secret-key'
    payload = {
        "sub": "user-uuid-999",
        "role": "OPERATORE",
        "campus_ids": ["campus-alpha", "campus-beta"],
    }
    token = jwt.encode(payload, secret, algorithm="HS256")

    mock_response = MagicMock()
    mock_response.status_code = 201
    mock_response.content = b'{"status": "created"}'
    mock_response.raw.headers = {'content-type': 'application/json'}
    mock_requests_request.return_value = mock_response

    headers = {
        'Authorization': f'Bearer {token}'
    }

    response = client.post('/api/asset/api/assets', headers=headers, json={"name": "Test Asset"})

    assert response.status_code == 201
    mock_requests_request.assert_called_once()
    
    # Estrae gli argomenti con cui 'requests.request' è stato chiamato dal Gateway
    call_kwargs = mock_requests_request.call_args[1]
    sent_headers = call_kwargs['headers']
    
    # Asserzioni sulla corretta propagazione degli header di contesto
    assert sent_headers.get('X-User-Id') == 'user-uuid-999'
    assert sent_headers.get('X-User-Role') == 'OPERATORE'
    assert sent_headers.get('X-Campus-Ids') == 'campus-alpha,campus-beta'

@patch('app.requests.request')
def test_proxy_requests_exception_handling(mock_requests_request, client):
    """
    Verifica la resilienza del Gateway nel caso in cui il microservizio di backend 
    sia irraggiungibile (gestione dell'eccezione e ritorno di HTTP 502).
    """
    import requests
    mock_requests_request.side_effect = requests.exceptions.ConnectionError("Refused connection")

    response = client.get('/api/warning/warnings')
    assert response.status_code == 502
    assert "Gateway Timeout o Errore di comunicazione" in response.json['error']