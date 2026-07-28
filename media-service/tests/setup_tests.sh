#!/bin/bash
echo "Generazione di un'immagine di test per Newman..."
python3 -c "
from PIL import Image
img = Image.new('RGB', (200, 200), color='blue')
img.save('test_image.jpg', 'JPEG')
"