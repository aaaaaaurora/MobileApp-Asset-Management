#!/bin/bash
echo "Individuazione del container dell'applicazione in esecuzione..."
CONTAINER_ID=$(docker ps -q -f ancestor=claudia179/media-service-img | head -n 1)

if [ -z "$CONTAINER_ID" ]; then
    echo "Errore: Container del Media Service non trovato!"
    exit 1
fi

echo "Generazione dell'immagine di test tramite il container $CONTAINER_ID..."
docker exec "$CONTAINER_ID" python3 -c "
from PIL import Image
img = Image.new('RGB', (200, 200), color='blue')
img.save('test_image.jpg', 'JPEG')
"