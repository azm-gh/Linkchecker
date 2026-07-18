import sqlite3
import os
from datetime import datetime

DB_FILE = 'links.db'

def init_db():
    """Initializes the SQLite database and creates the table if it doesn't exist."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS link_checks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            target_url TEXT NOT NULL,
            source_url TEXT NOT NULL,
            status_code INTEGER,
            error_message TEXT,
            is_alive BOOLEAN NOT NULL,
            response_time_ms INTEGER,
            checked_at TIMESTAMP NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

def save_link_check(target_url, source_url, status_code, error_message, is_alive, response_time_ms):
    """Saves a single link check result to the database."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    now = datetime.utcnow()
    
    cursor.execute('''
        INSERT INTO link_checks (target_url, source_url, status_code, error_message, is_alive, response_time_ms, checked_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (target_url, source_url, status_code, error_message, is_alive, response_time_ms, now))
    
    conn.commit()
    conn.close()
