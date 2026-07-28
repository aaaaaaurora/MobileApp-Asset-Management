#!/bin/bash
echo "Generazione dell'immagine di test tramite Pillow..."
python3 -c "
from PIL import Image
img = Image.new('RGB', (100, 100), color='blue')
img.save('test_image.jpg', 'JPEG')
"
echo "File test_image.jpg generato con successo."