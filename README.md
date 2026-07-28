# Link Checker (SaaS Architecture)

A high-performance, full-stack asynchronous web link checker built with Python's `asyncio`, a **FastAPI** backend, and a modern **React (Vite)** frontend.

It extracts links from standard webpages or massive XML Sitemaps, concurrently verifies their status, evades basic bot protections, and saves detailed analytics to **Google Cloud Firestore**.

## 🚀 Features

*   **Modern React UI:** A beautiful, responsive Single Page Application built with Vite. Features physics-based `framer-motion` animations and `sonner` toast notifications following modern Design Engineering principles.
*   **Firebase Authentication:** Secure email/password login and registration using the Firebase Client SDK.
*   **Real-time WebSockets:** Watch the results stream in live to the frontend as the backend engine audits your links.
*   **History Dashboard:** All past scans are securely persisted to Firestore. Users can easily view their historical website health.
*   **CSV Export:** Instantly download any completed scan as a fully formatted CSV file.
*   **Scheduled Scans (Cron):** Users can set up automated Daily, Weekly, or Monthly background audits. The backend features a secure webhook designed to be triggered by Google Cloud Scheduler, executing headless crawls and mocking email delivery.
*   **XML Sitemap Auditing:** Feed it a `.xml` file, and it automatically parses the `<loc>` tags to audit an entire website in one click.
*   **Lightning Fast Concurrency:** Uses Python's `asyncio` to check dozens of links simultaneously instead of waiting for each server sequentially.

## 🛠 Installation

1. Clone or download this repository.
2. Create and activate a Python virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install the required backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Install the frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```
5. Ensure you have your `serviceAccountKey.json` from Firebase Admin placed in the root directory for local database access.

## 🌐 Usage (Local Development)

You need to run both the FastAPI backend and the Vite development server.

1. **Start the Backend (Terminal 1):**
   ```bash
   source venv/bin/activate
   uvicorn app:app --reload
   ```

2. **Start the Frontend (Terminal 2):**
   ```bash
   cd frontend
   npm run dev
   ```

3. Open your browser to `http://localhost:5173`.

## ☁️ Production Deployment (Google Cloud Run)

The repository is configured to easily deploy as a single container to Google Cloud Run. The React frontend is built and served statically by FastAPI.

1. Build the React frontend:
   ```bash
   cd frontend
   npm run build
   ```
2. Deploy the backend (which now includes the static React files):
   ```bash
   gcloud run deploy link-checker --source . --project <your-project-id> --region <your-region> --allow-unauthenticated
   ```

## ⏱ Background Cron Jobs

To enable Scheduled Scans, create a Google Cloud Scheduler job that pings the secure webhook every hour:

```bash
gcloud scheduler jobs create http trigger-link-checker \
  --schedule="0 * * * *" \
  --uri="https://<your-cloud-run-url>/api/cron/run-schedules" \
  --http-method=POST \
  --headers="Authorization=Bearer super-secret-cron-token-123"
```

## 📂 Project Structure

*   `frontend/`: The modern React/Vite SPA.
*   `crawler.py`: The core asynchronous `asyncio` crawling engine.
*   `app.py`: The FastAPI backend handling WebSockets, Auth, and REST endpoints.
*   `db.py`: Handles Google Cloud Firestore integration.
*   `security.py`: Domain blocklists and rate limit controls.
