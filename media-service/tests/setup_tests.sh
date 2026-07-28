#!/bin/bash
echo "Generazione di un file immagine di test minimale..."

python3 -c "
with open('test_image.jpg', 'wb') as f:
    # Scrive un'intestazione minima JPEG e dati binari validi
    header = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00'
    body = b'\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c'
    footer = b'\xff\xd9'
    f.write(header + body + footer)
"

echo "File test_image.jpg generato con successo."