# Hand Gesture Recognition App — Setup & Run Guide

This project is a full‑stack hand gesture recognition application.
- Backend: FastAPI with MediaPipe GestureRecognizer, WebSockets, static assets
  - Entrypoint: [main.py](file:///d:/application_files/code_files/python/project_V/backend/main.py)
  - Requirements: [requirements.txt](file:///d:/application_files/code_files/python/project_V/backend/requirements.txt)
- Frontend: React + Vite, Tailwind CSS, react-webcam
  - Entrypoint: [App.jsx](file:///d:/application_files/code_files/python/project_V/frontend/src/App.jsx)
  - Dev proxy: [vite.config.js](file:///d:/application_files/code_files/python/project_V/frontend/vite.config.js)

## 1. Requirements
- Windows 10/11 (macOS/Linux also work with equivalent commands)
- Python 3.10 or 3.11 recommended
- Node.js 18 LTS or 20 LTS
- Webcam access; firewall allows localhost ports

## 2. Installation
From the project root `project_V`:

### Python (backend)
```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install --upgrade pip
pip install -r backend/requirements.txt
```

### Node (frontend)
```bash
cd frontend
npm ci
```

## 3. Run (Development)
### Start backend
```bash
# from project root; ensure venv is active
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

### Start frontend
```bash
cd frontend
npm run dev
```

Open the printed dev URL (usually http://localhost:5173). If 5173 is busy, Vite chooses another port (e.g., 5174).

## 4. How It Works
- Frontend opens a WebSocket to `/ws` and streams base64 images from the webcam every ~200ms.
- Backend decodes frames, runs MediaPipe to detect hand gestures, and responds with:
  - `label`: predicted gesture
  - `image_url`: a random gesture asset served from `/assets/<label>/...`
  - `bbox`: bounding box of detected hand (normalized coordinates)

## 5. Troubleshooting
- Stuck on “Connecting to AI Engine…”:
  - Verify backend is running on port 8000
  - Refresh the page; check the small debug box on the overlay for connection attempts and errors
  - If ports differ, update the proxy in [vite.config.js](file:///d:/application_files/code_files/python/project_V/frontend/vite.config.js) or set a direct WebSocket URL in [App.jsx](file:///d:/application_files/code_files/python/project_V/frontend/src/App.jsx)
- Camera blocked:
  - Allow webcam permissions; close other apps using the camera
- Port conflicts:
  - Backend: choose another port `--port 8001` and update proxy targets
  - Frontend: use the printed URL; do not hardcode 5173
- Cross-device/LAN:
  - Frontend dev server: `npm run dev -- --host`
  - Update proxy targets from `http://localhost:8000` to `http://<backend_ip>:8000`
  - Or set WebSocket in frontend to `ws://<backend_ip>:8000/ws`

## 6. Production
```bash
cd frontend
npm run build
npm run preview
```
Serve `frontend/dist` with your preferred static server and keep the backend running. Ensure `/ws` and `/assets` routes reach the backend.

## 7. Maintenance
- Keep Python 3.10/3.11 and Node 18/20
- Update dependencies carefully; MediaPipe and OpenCV are platform-sensitive
- Back up:
  - `backend/gesture_assets/*`
  - `backend/gesture_recognizer.task`
- Use git for versioning and keep notes on any environment-specific changes (ports, IPs).
