#!/bin/bash
echo "Generazione dell'immagine di test tramite il container dell'applicazione..."
# Sfrutta l'interprete python del container in esecuzione che ha già Pillow installato
docker exec $(docker ps -q -f ancestor=claudia179/media-service-img:50 | head -n 1) python3 -c "
from PIL import Image
img = Image.new('RGB', (200, 200), color='blue')
img.save('test_image.jpg', 'JPEG')
"