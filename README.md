# Asyncio Broken Link Checker

A high-performance, asynchronous web link checker built with Python's `asyncio` and `aiohttp`. It extracts all links from a given webpage, concurrently verifies their status, evades basic bot protections, and persists detailed analytics into an SQLite database.

## Features

*   **Lightning Fast:** Uses `asyncio` to check dozens of links concurrently instead of waiting for each server to respond sequentially.
*   **Bot Protection Evasion:** Automatically sends a standard browser `User-Agent` to prevent `403 Forbidden` errors from strict web servers.
*   **Global Rate Limiting:** Implements a configurable delay (`-d`) to stagger requests and avoid `429 Too Many Requests` bans.
*   **Smart Timeout Handling:** Automatically falls back from `HEAD` to `GET` requests when needed, and enforces a strict 10-second timeout on slow servers.
*   **SQLite Persistence:** All results, including response times, source URLs, and status codes, are saved to a local `links.db` database for powerful analytics.
*   **Color-Coded CLI:** Beautiful terminal output using `colorama`.

## Installation

1. Clone or download this repository.
2. Create and activate a Python virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```
3. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Usage

Run the `checker.py` script and pass the target URL:

```bash
python checker.py https://example.com
```

### Advanced Options

You can control the concurrency limit (max simultaneous connections) and the delay (staggering between requests):

```bash
# Set max concurrency to 20, and wait 0.5 seconds between dispatching each request
python checker.py https://example.com -c 20 -d 0.5
```

*   `-c` / `--concurrency`: Limits the maximum number of requests "in flight" at the same time (Default: 50).
*   `-d` / `--delay`: The delay in seconds before firing the next background task. Excellent for bypassing rate limits (Default: 0.0).

## Analytics & Database

Every time you run the script, it appends the results to `links.db`. You can open this database with any standard SQLite viewer or query it directly from your terminal:

```bash
# Find the 5 slowest links on your site:
sqlite3 links.db "SELECT target_url, response_time_ms FROM link_checks ORDER BY response_time_ms DESC LIMIT 5;"

# Find all broken links (404 Not Found):
sqlite3 links.db "SELECT target_url FROM link_checks WHERE status_code = 404;"
```

## Project Structure

*   `checker.py`: The main asynchronous crawler logic.
*   `db.py`: Handles SQLite database initialization and data insertion.
*   `requirements.txt`: Python dependencies.
