import datetime
from google.cloud import firestore
from firebase_admin import firestore as firebase_firestore

def get_db() -> firestore.AsyncClient:
    """Returns the async Firestore client."""
    return firestore.AsyncClient(project="link-checker-1784544272", database="link-checker-db")

async def check_daily_limit(user_id: str, limit: int) -> bool:
    """Returns True if the user is UNDER the daily limit."""
    if not user_id:
        return True
        
    db = get_db()
    yesterday = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1)
    
    query = db.collection('scans').where("user_id", "==", user_id).where("timestamp", ">=", yesterday)
    
    count = 0
    async for _ in query.stream():
        count += 1
        if count >= limit:
            return False
            
    return True

async def save_scan_summary(source_url: str, user_id: str, total_time_ms: int, results: list):
    """
    Saves a single summary document for the entire scan, reducing database writes by 400x.
    """
    db = get_db()
    
    # We can filter results to only save broken links to save even more space!
    broken_links = [r for r in results if not r['is_alive']]
    
    doc_ref = db.collection('scans').document()
    
    await doc_ref.set({
        'source_url': source_url,
        'user_id': user_id,
        'total_scanned': len(results),
        'alive_count': len(results) - len(broken_links),
        'dead_count': len(broken_links),
        'total_time_ms': total_time_ms,
        'broken_links': broken_links,
        'timestamp': firebase_firestore.SERVER_TIMESTAMP
    })

async def get_history(user_id: str, limit: int = 20) -> list:
    """Fetches the scan history for a user."""
    if not user_id:
        return []
    
    db = get_db()
    query = db.collection('scans').where("user_id", "==", user_id)
    
    results = []
    async for doc in query.stream():
        data = doc.to_dict()
        # Convert timestamp to ISO format for JSON serialization
        if 'timestamp' in data and data['timestamp']:
            data['timestamp'] = data['timestamp'].isoformat()
        results.append(data)
        
    # Sort in memory to avoid needing a custom composite Firestore index
    results.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
    return results[:limit]

async def add_schedule(user_id: str, url: str, frequency: str, email: str):
    """Adds a new scheduled scan."""
    db = get_db()
    next_run = datetime.datetime.now(datetime.timezone.utc) # Run immediately the first time
    await db.collection('schedules').add({
        'user_id': user_id,
        'url': url,
        'frequency': frequency,
        'email': email,
        'next_run_time': next_run,
        'created_at': firebase_firestore.SERVER_TIMESTAMP
    })

async def get_schedules(user_id: str) -> list:
    """Gets all scheduled scans for a user."""
    db = get_db()
    query = db.collection('schedules').where("user_id", "==", user_id)
    results = []
    async for doc in query.stream():
        data = doc.to_dict()
        data['id'] = doc.id
        if 'next_run_time' in data and data['next_run_time']:
            if isinstance(data['next_run_time'], datetime.datetime):
                data['next_run_time'] = data['next_run_time'].isoformat()
        if 'created_at' in data and data['created_at']:
            if isinstance(data['created_at'], datetime.datetime):
                data['created_at'] = data['created_at'].isoformat()
        if 'last_run_time' in data and data['last_run_time']:
             if isinstance(data['last_run_time'], datetime.datetime):
                data['last_run_time'] = data['last_run_time'].isoformat()
        results.append(data)
    return results

async def delete_schedule(schedule_id: str, user_id: str):
    """Deletes a schedule, verifying ownership."""
    db = get_db()
    doc = await db.collection('schedules').document(schedule_id).get()
    if doc.exists and doc.to_dict().get('user_id') == user_id:
        await db.collection('schedules').document(schedule_id).delete()

async def get_due_schedules() -> list:
    """Finds all schedules that are due to run."""
    db = get_db()
    now = datetime.datetime.now(datetime.timezone.utc)
    # Note: This query requires an index on next_run_time.
    query = db.collection('schedules').where("next_run_time", "<=", now)
    results = []
    async for doc in query.stream():
        data = doc.to_dict()
        data['id'] = doc.id
        results.append(data)
    return results

async def update_schedule_last_run(schedule_id: str, frequency: str):
    """Updates the schedule with the next run time."""
    db = get_db()
    now = datetime.datetime.now(datetime.timezone.utc)
    if frequency == 'daily':
        next_run = now + datetime.timedelta(days=1)
    elif frequency == 'weekly':
        next_run = now + datetime.timedelta(days=7)
    elif frequency == 'monthly':
        next_run = now + datetime.timedelta(days=30)
    else:
        next_run = now + datetime.timedelta(days=7)
        
    await db.collection('schedules').document(schedule_id).update({
        'next_run_time': next_run,
        'last_run_time': now
    })
