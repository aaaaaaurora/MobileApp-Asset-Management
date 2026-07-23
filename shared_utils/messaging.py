import os
import json
import time
import pika

class RabbitMQManager:
    """
    Gestore centralizzato per la comunicazione asincrona tramite RabbitMQ.
    Implementa pattern di connessione sicura e retry automatico.
    """
    def __init__(self, rabbitmq_url=None):
        self.rabbitmq_url = rabbitmq_url or os.getenv('RABBITMQ_URL', 'amqp://guest:guest@rabbitmq-service:5672/')

    def get_connection(self):
        """
        Effettua la connessione a RabbitMQ con un meccanismo di retry (Backoff).
        Utile per gestire i tempi di avvio dei container in Kubernetes.
        """
        connection = None
        while not connection:
            try:
                params = pika.URLParameters(self.rabbitmq_url)
                connection = pika.BlockingConnection(params)
            except pika.exceptions.AMQPConnectionError:
                print("[Shared Messaging] RabbitMQ non ancora pronto. Tentativo tra 5 secondi...")
                time.sleep(5)
        return connection

    def publish_event(self, exchange_name, action, actor_id, service_name, extra_data=None):
        """
        Pubblica un evento standardizzato su un Exchange RabbitMQ.
        """
        event = {
            "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            "autore_id": str(actor_id),
            "azione": action,
            "service_name": service_name
        }
        if extra_data and isinstance(extra_data, dict):
            event.update(extra_data)

        try:
            connection = self.get_connection()
            channel = connection.channel()
            
            # Dichiara l'exchange di tipo fanout (pub/sub)
            channel.exchange_declare(exchange=exchange_name, exchange_type='fanout', durable=True)
            
            channel.basic_publish(
                exchange=exchange_name,
                routing_key='',
                body=json.dumps(event),
                properties=pika.BasicProperties(delivery_mode=2)  # Messaggio persistente
            )
            connection.close()
        except Exception as e:
            print(f"[Shared Messaging] Errore di pubblicazione evento su {exchange_name}: {str(e)}")

    def start_consumer(self, exchange_name, callback_function):
        """
        Avvia un consumer in ascolto su un determinato exchange (Fanout).
        """
        try:
            connection = self.get_connection()
            channel = connection.channel()
            
            channel.exchange_declare(exchange=exchange_name, exchange_type='fanout', durable=True)
            
            result = channel.queue_declare(queue='', exclusive=True)
            queue_name = result.method.queue
            channel.queue_bind(exchange=exchange_name, queue=queue_name)

            channel.basic_consume(queue=queue_name, on_message_callback=callback_function, auto_ack=True)
            print(f"[Shared Messaging] Consumer in ascolto sull'exchange: {exchange_name}")
            channel.start_consuming()
        except Exception as e:
            print(f"[Shared Messaging] Errore nel consumer RabbitMQ: {str(e)}")