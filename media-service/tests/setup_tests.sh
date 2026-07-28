#!/bin/bash
echo "Installazione temporanea di Pillow per la generazione dell'immagine di test..."
pip install Pillow==10.0.0 --quiet

echo "Generazione dell'immagine di test test_image.jpg..."
python3 -c "
from PIL import Image
img = Image.new('RGB', (200, 200), color='blue')
img.save('test_image.jpg', 'JPEG')
"