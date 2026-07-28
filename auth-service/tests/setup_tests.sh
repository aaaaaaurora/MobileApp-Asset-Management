#!/bin/bash
# Script per popolare il DB effimero Docker dell'Auth Service prima dei test Postman (Newman)

echo "[Setup Auth] Inizio popolamento dati di test per Auth Service..."

# --- CONFIGURAZIONE VARIABILI ---
USER=${DOCKER_USER:-"claudia179"}
IMG="auth-service-img" 
TAG=${BUILD_NUMBER:-"latest"}

FULL_IMAGE_NAME="${USER}/${IMG}:${TAG}"

echo "[Setup Auth] Cerco container in esecuzione con immagine: $FULL_IMAGE_NAME"

# 1. Trova l'ID del container attivo
APP_CONTAINER=$(docker ps -q -f "ancestor=${FULL_IMAGE_NAME}" | head -n 1)

if [ -z "$APP_CONTAINER" ]; then
    echo "[Setup Auth] Build specifica non trovata, provo latest..."
    APP_CONTAINER=$(docker ps -q -f "ancestor=${USER}/${IMG}:latest" | head -n 1)
fi

if [ -z "$APP_CONTAINER" ]; then
    echo "ERRORE CRITICO: Container dell'Auth Service non trovato! Impossibile popolare il DB."
    docker ps 
    exit 1
fi

echo "[Setup Auth] Container target trovato: $APP_CONTAINER"

# 2. Script Python eseguito all'interno del container per abilitare l'estensione UUID e inserire i ruoli
PYTHON_SEED_SCRIPT="
from app import db, app
from app import Role, RoleType
from sqlalchemy import text
import sys

try:
    with app.app_context():
        # Abilita l'estensione UUID su Postgres per consentire l'uso di uuid_generate_v4()
        db.session.execute(text('CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";'))
        db.session.commit()

        # Inserisce i ruoli di dominio essenziali attesi dall'Auth Service
        # (GUEST, OPERATORE, AMMINISTRATORE)
        roles_to_insert = [
            (RoleType.GUEST, 'Utente base'),
            (RoleType.OPERATORE, 'Tecnico sul campo'),
            (RoleType.AMMINISTRATORE, 'Admin sistema')
        ]
        
        for r_name, r_desc in roles_to_insert:
            existing = Role.query.filter_by(name=r_name).first()
            if not existing:
                role = Role(name=r_name, description=r_desc)
                db.session.add(role)
        
        db.session.commit()
        print('Estensione UUID e ruoli di base inseriti con successo nel DB effimero!')
except Exception as e:
    print(f'ERRORE CRITICO SEED AUTH: {e}')
    sys.exit(1)
"

# 3. Esegue lo script Python all'interno del container dell'Auth Service
echo "[Setup Auth] Esecuzione script di seed dentro il container..."
docker exec $APP_CONTAINER python -c "$PYTHON_SEED_SCRIPT"

# 4. Verifica esito
if [ $? -eq 0 ]; then
    echo "[Setup Auth] Seeding completato con successo. Il DB è pronto per Postman."
else
    echo "[Setup Auth] Errore durante l'esecuzione del seeding."
    exit 1
fi