import os
import json
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import requests
from dotenv import load_dotenv

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GEMINI_MODEL   = "gemini-2.0-flash"
GEMINI_URL     = (
    f"https://generativelanguage.googleapis.com/v1beta"
    f"/models/{GEMINI_MODEL}:streamGenerateContent"
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SYSTEM_PROMPT = (
    "You are a helpful, friendly AI assistant. "
    "You can see the user's screen when they share it — describe what you see and answer questions about it. "
    "When responding in voice mode, keep answers concise and natural for spoken conversation. "
    "Be warm, clear, and genuinely helpful."
)

# session_id -> list of Gemini-format content dicts
sessions: dict[str, list] = {}


def _blocking_stream(history: list) -> list[str]:
    """Calls the Gemini streaming REST API and returns a list of text chunks."""
    url = f"{GEMINI_URL}?key={GOOGLE_API_KEY}&alt=sse"
    payload = {
        "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": history,
        "generationConfig": {"maxOutputTokens": 1024},
    }

    chunks: list[str] = []
    with requests.post(url, json=payload, stream=True, timeout=60) as resp:
        resp.raise_for_status()
        for raw_line in resp.iter_lines():
            if not raw_line:
                continue
            line = raw_line.decode("utf-8") if isinstance(raw_line, bytes) else raw_line
            if not line.startswith("data: "):
                continue
            data = line[6:]
            if data == "[DONE]":
                break
            try:
                obj = json.loads(data)
                for candidate in obj.get("candidates", []):
                    for part in candidate.get("content", {}).get("parts", []):
                        text = part.get("text", "")
                        if text:
                            chunks.append(text)
            except json.JSONDecodeError:
                continue

    return chunks


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()

    if session_id not in sessions:
        sessions[session_id] = []

    try:
        while True:
            raw = await websocket.receive_text()
            payload = json.loads(raw)

            user_text: str  = payload.get("message", "").strip()
            image_b64: str | None = payload.get("image")

            parts: list = []

            if image_b64:
                if "," in image_b64:
                    image_b64 = image_b64.split(",", 1)[1]
                parts.append({
                    "inline_data": {"mime_type": "image/png", "data": image_b64}
                })

            if user_text:
                parts.append({"text": user_text})

            if not parts:
                continue

            sessions[session_id].append({"role": "user", "parts": parts})

            # Run blocking HTTP stream in a thread
            loop = asyncio.get_event_loop()
            queue: asyncio.Queue[str | None] = asyncio.Queue()

            def _run():
                try:
                    for chunk in _blocking_stream(sessions[session_id]):
                        loop.call_soon_threadsafe(queue.put_nowait, chunk)
                except Exception as exc:
                    loop.call_soon_threadsafe(queue.put_nowait, f"\n\n[Error: {exc}]")
                finally:
                    loop.call_soon_threadsafe(queue.put_nowait, None)

            future = loop.run_in_executor(None, _run)

            full_response = ""
            while True:
                chunk = await queue.get()
                if chunk is None:
                    break
                full_response += chunk
                await websocket.send_json({"type": "stream", "content": chunk})

            await future

            sessions[session_id].append({"role": "model", "parts": [{"text": full_response}]})
            await websocket.send_json({"type": "done", "content": full_response})

    except WebSocketDisconnect:
        sessions.pop(session_id, None)
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "content": str(e)})
        except Exception:
            pass
        sessions.pop(session_id, None)


@app.delete("/session/{session_id}")
def clear_session(session_id: str):
    sessions.pop(session_id, None)
    return {"status": "cleared"}


@app.get("/health")
def health():
    return {"status": "ok"}
