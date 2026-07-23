from flask import Flask, jsonify

# Inizializza l'applicazione Flask
app = Flask(__name__)

# Endpoint di base per il controllo di salute (Health Check)
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)