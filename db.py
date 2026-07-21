from google.cloud import firestore
from firebase_admin import firestore as firebase_firestore

def get_db() -> firestore.AsyncClient:
    """Returns the async Firestore client."""
    return firestore.AsyncClient(project="link-checker-1784544272", database="link-checker-db")

async def save_link_check(target_url, source_url, status_code, error_message, is_alive, response_time_ms, user_id=None):
    """
    Saves a single link check result to the Firestore database using the async client.
    """
    db = get_db()
    
    doc_ref = db.collection('link_checks').document()
    
    await doc_ref.set({
        'target_url': target_url,
        'source_url': source_url,
        'status_code': status_code,
        'error_message': error_message,
        'is_alive': is_alive,
        'response_time_ms': response_time_ms,
        'user_id': user_id,
        'timestamp': firebase_firestore.SERVER_TIMESTAMP
    })
