import os
import random
import base64
import cv2
import numpy as np
import mediapipe as mp
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import json
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

app = FastAPI()

# Mount static files
ASSETS_DIR = os.path.join(os.path.dirname(__file__), "gesture_assets")
app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

# CORS (allow all for development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class GestureController:
    def __init__(self):
        base_options = python.BaseOptions(model_asset_path='backend/gesture_recognizer.task')
        options = vision.GestureRecognizerOptions(base_options=base_options)
        self.recognizer = vision.GestureRecognizer.create_from_options(options)
        self.auto_exposure = True
        self.exposure = 0
        self.brightness = 100
        self.contrast = 100

    def process_frame(self, base64_string: str):
        try:
            # Decode base64 image
            if "," in base64_string:
                base64_string = base64_string.split(",")[1]
            
            image_bytes = base64.b64decode(base64_string)
            nparr = np.frombuffer(image_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if frame is None:
                return "None", None
            if self.auto_exposure:
                frame = cv2.normalize(frame, None, 0, 255, cv2.NORM_MINMAX)
            else:
                alpha = max(0.1, float(self.contrast) / 100.0)
                beta = int(self.brightness) - 100
                frame = cv2.convertScaleAbs(frame, alpha=alpha, beta=beta)
            # Convert to MediaPipe Image
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame)
            
            # Recognize gesture
            recognition_result = self.recognizer.recognize(mp_image)
            
            bbox = None
            gesture_name = "None"

            if recognition_result.gestures:
                # Get the top gesture
                gesture_name = recognition_result.gestures[0][0].category_name
            
            if recognition_result.hand_landmarks:
                landmarks = recognition_result.hand_landmarks[0]
                x_coords = [lm.x for lm in landmarks]
                y_coords = [lm.y for lm in landmarks]
                x_min = min(x_coords)
                y_min = min(y_coords)
                x_max = max(x_coords)
                y_max = max(y_coords)
                w = max(0.0, x_max - x_min)
                h = max(0.0, y_max - y_min)
                cx = (x_min + x_max) / 2.0
                cy = (y_min + y_max) / 2.0
                scale = 1.2
                half_w = (w * scale) / 2.0
                half_h = (h * scale) / 2.0
                x_min_exp = max(0.0, cx - half_w)
                x_max_exp = min(1.0, cx + half_w)
                y_min_exp = max(0.0, cy - half_h)
                y_max_exp = min(1.0, cy + half_h)
                bbox = {
                    "x_min": x_min_exp,
                    "y_min": y_min_exp,
                    "x_max": x_max_exp,
                    "y_max": y_max_exp
                }

            return gesture_name, bbox
        except Exception as e:
            print(f"Error processing frame: {e}")
            return "None", None

# Initialize GestureController
# We do this globally or on startup. 
# Note: MediaPipe might have thread safety issues if shared across multiple requests concurrently, 
# but for a single websocket connection or simple usage it's usually fine. 
# To be safe, we can instantiate it inside the websocket handler or keep a single instance if it's thread-safe.
# The documentation says GestureRecognizer is not thread safe for the same instance across threads if running async?
# Actually, for standard synchronous recognize() it should be okay if serialized, but WebSocket is async.
# We'll create one instance for now.
gesture_controller = None

@app.on_event("startup")
async def startup_event():
    global gesture_controller
    try:
        gesture_controller = GestureController()
        print("GestureController initialized.")
        create_dummy_assets()
    except Exception as e:
        print(f"Failed to initialize GestureController: {e}")

def create_dummy_assets():
    # Helper to create dummy images if they don't exist
    gestures = ["Victory", "Thumb_Up", "Open_Palm", "Closed_Fist", "Pointing_Up", "Thumb_Down", "None"]
    for gesture in gestures:
        folder = os.path.join(ASSETS_DIR, gesture)
        os.makedirs(folder, exist_ok=True)
        # Check if empty
        if not os.listdir(folder):
            # Create a dummy image
            img = np.zeros((300, 300, 3), dtype=np.uint8)
            # Add text
            cv2.putText(img, gesture, (50, 150), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
            cv2.imwrite(os.path.join(folder, "random_pic.jpg"), img)
            print(f"Created dummy asset for {gesture}")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("WebSocket connection accepted")
    try:
        while True:
            data = await websocket.receive_text()
            gesture_label = "None"
            bbox = None
            if data and len(data) > 0 and data[0] == "{":
                try:
                    obj = json.loads(data)
                    if obj.get("type") == "settings" and gesture_controller:
                        gesture_controller.auto_exposure = bool(obj.get("auto_exposure", True))
                        gesture_controller.exposure = int(obj.get("exposure", 0))
                        gesture_controller.brightness = int(obj.get("brightness", 100))
                        gesture_controller.contrast = int(obj.get("contrast", 100))
                        continue
                except Exception:
                    pass
            if gesture_controller:
                gesture_label, bbox = gesture_controller.process_frame(data)
            
            # Look for image in assets
            gesture_folder = os.path.join(ASSETS_DIR, gesture_label)
            image_url = ""
            
            if os.path.exists(gesture_folder):
                images = [f for f in os.listdir(gesture_folder) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif'))]
                if images:
                    random_image = random.choice(images)
                    # Construct URL. Assuming localhost:8000 for now, but should be dynamic ideally.
                    # In a real app, use the request base url.
                    image_url = f"http://localhost:8000/assets/{gesture_label}/{random_image}"
            
            response = {
                "label": gesture_label,
                "image_url": image_url,
                "bbox": bbox
            }
            
            await websocket.send_json(response)
            
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
        try:
            await websocket.close()
        except:
            pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
