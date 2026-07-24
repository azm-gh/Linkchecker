from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import HTMLResponse
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

app = FastAPI(title="Asyncio Link Checker")

# Mount static files and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

@app.get("/", response_class=HTMLResponse)
async def read_index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.websocket("/ws/scan")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
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
