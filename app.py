from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, Header, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import json
import crawler
import db
import security
import firebase_admin
from firebase_admin import auth, credentials
import os

# Initialize Firebase Admin
if os.path.exists("serviceAccountKey.json"):
    # Local Development: use local JSON key
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "serviceAccountKey.json"
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred, options={'projectId': 'link-checker-1784544272'})
else:
    # Production Cloud Run: use Application Default Credentials natively
    firebase_admin.initialize_app(options={'projectId': 'link-checker-1784544272'})

app = FastAPI(title="Link Checker")

# Allow React dev server to communicate with FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In production, serve the built React files
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "frontend", "dist")

async def get_user_from_token(authorization: str):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split("Bearer ")[1]
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token['uid'], decoded_token.get('email', '')
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

@app.get("/api/history")
async def get_history_api(authorization: str = Header(None)):
    user_id, _ = await get_user_from_token(authorization)
    history = await db.get_history(user_id)
    return {"history": history}

@app.get("/api/schedules")
async def get_schedules_api(authorization: str = Header(None)):
    user_id, _ = await get_user_from_token(authorization)
    schedules = await db.get_schedules(user_id)
    return {"schedules": schedules}

@app.post("/api/schedules")
async def create_schedule_api(request: Request, authorization: str = Header(None)):
    user_id, email = await get_user_from_token(authorization)
    data = await request.json()
    url = data.get("url")
    frequency = data.get("frequency")
    if not url or not frequency:
        raise HTTPException(status_code=400, detail="URL and frequency required")
    await db.add_schedule(user_id, url, frequency, email)
    return {"status": "success"}

@app.delete("/api/schedules/{schedule_id}")
async def delete_schedule_api(schedule_id: str, authorization: str = Header(None)):
    user_id, _ = await get_user_from_token(authorization)
    await db.delete_schedule(schedule_id, user_id)
    return {"status": "success"}
    
CRON_SECRET = "super-secret-cron-token-123"

@app.post("/api/cron/run-schedules")
async def run_schedules_cron(authorization: str = Header(None)):
    if authorization != f"Bearer {CRON_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized Cron")
        
    due_schedules = await db.get_due_schedules()
    results_summary = []
    
    for sched in due_schedules:
        # Run crawler headlessly
        summary = await crawler.run_crawl(
            start_url=sched['url'],
            concurrency=20,  # Lower concurrency for background tasks
            delay=0.1,
            user_id=sched['user_id']
        )
        
        # Update last run
        await db.update_schedule_last_run(sched['id'], sched['frequency'])
        
        # MOCK EMAIL
        print(f"==================================================")
        print(f"MOCK EMAIL SENT TO: {sched['email']}")
        print(f"SUBJECT: Link Checker Report for {sched['url']}")
        print(f"BODY: We finished auditing your site. Found {summary.get('dead', 0)} dead links.")
        print(f"==================================================")
        
        results_summary.append({"url": sched['url'], "status": "completed"})
        
    return {"status": "success", "ran": len(due_schedules), "details": results_summary}

# Keep a track of active scans to prevent multiple concurrent runs per user
active_scans = {}

@app.websocket("/ws/scan")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    user_id = None
    try:
        # Wait for the configuration from the client
        data = await websocket.receive_text()
        config = json.loads(data)
        
        start_url = config.get("url")
        concurrency = int(config.get("concurrency", 50))
        delay = float(config.get("delay", 0.0))
        token = config.get("token")
        
        if not start_url:
            await websocket.send_json({"type": "error", "message": "URL is required"})
            return
            
        if not token:
            await websocket.send_json({"type": "error", "message": "Authentication required. Please log in."})
            return
            
        try:
            decoded_token = auth.verify_id_token(token)
            if not decoded_token.get('email_verified', False):
                await websocket.send_json({"type": "error", "message": "Email not verified. Please verify your email."})
                return
            user_id = decoded_token['uid']
        except Exception as e:
            await websocket.send_json({"type": "error", "message": f"Authentication failed: {e}"})
            return

        # Enforce Daily Quota before starting scan
        try:
            under_limit = await db.check_daily_limit(user_id, security.DAILY_SCAN_LIMIT)
            if not under_limit:
                await websocket.send_json({"type": "error", "message": f"Daily quota exceeded! You are limited to {security.DAILY_SCAN_LIMIT} scans per 24 hours."})
                return
        except Exception as e:
            await websocket.send_json({"type": "error", "message": f"Failed to verify quota: {e}"})
            return

        # Define callbacks to send data over WebSocket
        async def ws_on_init(init_data):
            if "error" in init_data:
                await websocket.send_json({"type": "error", "message": init_data["error"]})
            else:
                await websocket.send_json({"type": "init", "data": init_data})

        async def ws_on_progress(result):
            await websocket.send_json({"type": "progress", "data": result})

        # Run the core crawler engine
        summary = await crawler.run_crawl(
            start_url=start_url,
            concurrency=concurrency,
            delay=delay,
            on_progress=ws_on_progress,
            on_init=ws_on_init,
            user_id=user_id
        )
        
        if "error" not in summary:
            await websocket.send_json({"type": "summary", "data": summary})
            
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

# Catch-all route to serve the React app
@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    if os.path.exists(os.path.join(FRONTEND_DIST, full_path)) and full_path != "":
        return FileResponse(os.path.join(FRONTEND_DIST, full_path))
    
    index_path = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    
    return HTMLResponse("<h1>React Build Not Found</h1><p>Run 'npm run build' in the frontend directory.</p>", status_code=404)
