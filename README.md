# Antigravity Link Checker

A high-performance, full-stack asynchronous web link checker built with Python's `asyncio`, `aiohttp`, and a real-time **FastAPI** web interface. 

It extracts links from standard webpages or massive XML Sitemaps, concurrently verifies their status, evades basic bot protections, and persists detailed analytics into an SQLite database.

## 🚀 Features

*   **Real-time Web UI:** A stunning, modern web interface powered by WebSockets. Watch the results stream in live as the engine audits your links.
*   **XML Sitemap Auditing:** Feed it a `.xml` file, and it automatically parses the `<loc>` tags to audit an entire website in one click.
*   **Lightning Fast Concurrency:** Uses `asyncio` to check dozens of links simultaneously instead of waiting for each server sequentially.
*   **Bot Evasion & Pacing:** Implement configurable dispatch delays (Request Pacing) to stagger requests and avoid `429 Too Many Requests` bans.
*   **Security & Blocklists:** Built-in safeguards automatically skip massive domains that block bots (like LinkedIn and Amazon) and strictly cap concurrency to prevent SSRF abuse.
*   **SQLite Persistence:** All results, including millisecond response times, source URLs, and status codes, are saved to a local `links.db` database for powerful analytics.
*   **CLI Fallback:** Still prefer the terminal? A fully functional command-line interface with `colorama` output is included.

## 🛠 Installation

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

## 🌐 Usage (Web Interface)

The best way to use the Link Checker is via the real-time FastAPI web interface.

1. Start the web server:
   ```bash
   uvicorn app:app --host 127.0.0.1 --port 8000
   ```
2. Open your browser to `http://127.0.0.1:8000`.
3. Enter your target URL (HTML page or `sitemap.xml`) and click **Start Scan**.

## 💻 Usage (Command Line)

If you prefer the terminal, you can run the core engine directly:

```bash
# Check an HTML page
python cli.py https://example.com

# Check an entire Sitemap
python cli.py https://example.com/sitemap.xml
```

### Advanced CLI Options
*   `-c` / `--concurrency`: Limits the maximum number of requests "in flight" at the same time (Default: 50).
*   `-d` / `--delay`: The delay in seconds before firing the next background task. Excellent for bypassing rate limits (Default: 0.0).

```bash
python cli.py https://example.com -c 20 -d 0.5
```

## 📊 Analytics & Database

Every scan automatically appends the results to `links.db`. You can open this database with any standard SQLite viewer or query it directly from your terminal:

```bash
# Find the 5 slowest links on your site:
sqlite3 links.db "SELECT target_url, response_time_ms FROM link_checks ORDER BY response_time_ms DESC LIMIT 5;"

# Find all broken links (404 Not Found):
sqlite3 links.db "SELECT target_url FROM link_checks WHERE status_code = 404;"
```

## 📂 Project Structure

*   `crawler.py`: The core asynchronous `asyncio` crawling engine.
*   `app.py`: The FastAPI backend handling WebSockets.
*   `cli.py`: The Command-Line interface wrapper.
*   `db.py`: Handles SQLite database initialization and data insertion.
*   `security.py`: Domain blocklists and SSRF concurrency caps.
*   `templates/` & `static/`: HTML, CSS, and JS for the web interface.
