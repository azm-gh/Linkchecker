from datetime import datetime
from firebase_admin import firestore
from google.cloud.firestore_v1.base_client import BaseClient

def get_db() -> BaseClient:
    """Returns the Firestore client."""
    return firestore.client()

def save_link_check(target_url, source_url, status_code, error_message, is_alive, response_time_ms, user_id=None):
    """
    Saves a single link check result to the Firestore database.
    """
    db = get_db()
    
    doc_ref = db.collection('link_checks').document()
    
    doc_ref.set({
        'target_url': target_url,
        'source_url': source_url,
        'status_code': status_code,
        'error_message': error_message,
        'is_alive': is_alive,
        'response_time_ms': response_time_ms,
        'user_id': user_id,
        'timestamp': firestore.SERVER_TIMESTAMP
    })
