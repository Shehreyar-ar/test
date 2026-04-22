import os
import json
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import requests
from dotenv import load_dotenv

load_dotenv()

OLLAMA_URL   = os.getenv("OLLAMA_URL", "http://localhost:11434")
TEXT_MODEL   = os.getenv("TEXT_MODEL",   "gemma3")
VISION_MODEL = os.getenv("VISION_MODEL", "llava")

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

# session_id -> list of Ollama-format message dicts
sessions: dict[str, list] = {}


def _blocking_stream(messages: list, model: str) -> list[str]:
    """Calls Ollama /api/chat with streaming and returns list of text chunks."""
    url = f"{OLLAMA_URL}/api/chat"
    payload = {
        "model":    model,
        "system":   SYSTEM_PROMPT,
        "messages": messages,
        "stream":   True,
    }

    chunks: list[str] = []
    with requests.post(url, json=payload, stream=True, timeout=120) as resp:
        resp.raise_for_status()
        for raw_line in resp.iter_lines():
            if not raw_line:
                continue
            line = raw_line.decode("utf-8") if isinstance(raw_line, bytes) else raw_line
            try:
                obj = json.loads(line)
                text = obj.get("message", {}).get("content", "")
                if text:
                    chunks.append(text)
                if obj.get("done"):
                    break
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

            user_text: str       = payload.get("message", "").strip()
            image_b64: str | None = payload.get("image")

            if not user_text and not image_b64:
                continue

            # Build the Ollama message
            msg: dict = {"role": "user", "content": user_text or "What do you see on my screen?"}

            if image_b64:
                if "," in image_b64:
                    image_b64 = image_b64.split(",", 1)[1]
                msg["images"] = [image_b64]

            sessions[session_id].append(msg)
            model = VISION_MODEL if image_b64 else TEXT_MODEL

            # Stream response via thread + queue
            loop  = asyncio.get_event_loop()
            queue: asyncio.Queue[str | None] = asyncio.Queue()

            def _run():
                try:
                    for chunk in _blocking_stream(sessions[session_id], model):
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

            sessions[session_id].append({"role": "assistant", "content": full_response})
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
