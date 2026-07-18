from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import json
import crawler

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
        
        if not start_url:
            await websocket.send_json({"type": "error", "message": "URL is required"})
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
            on_init=ws_on_init
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
        except:
            pass
