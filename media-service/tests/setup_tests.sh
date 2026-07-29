#!/bin/bash
echo "Installazione di Pillow tramite pip..."
pip install Pillow==10.0.0 --break-system-packages --quiet

echo "Generazione dell'immagine di test con Pillow..."
python3 -c "
from PIL import Image
img = Image.new('RGB', (100, 100), color='blue')
img.save('test_image.jpg', 'JPEG')
"
echo "File test_image.jpg generato con successo."

# Aggiungi questa riga per il test dell'estensione non valida!
echo "Questo è un file di testo, non un'immagine." > invalid_file.txt
echo "File invalid_file.txt generato per il test di errore."