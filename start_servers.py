import subprocess
import time
import sys
import os

def run_servers():
    backend_dir = os.path.join(os.getcwd(), "backend")
    frontend_dir = os.path.join(os.getcwd(), "frontend")

    print("--- Starting Backend (FastAPI) ---")
    # Start backend
    backend_process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"],
        cwd=backend_dir
    )

    print("--- Starting Frontend (Vite) ---")
    # Start frontend
    # Note: On Windows, npm is usually a .cmd file
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    frontend_process = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=frontend_dir
    )

    try:
        while True:
            time.sleep(1)
            if backend_process.poll() is not None:
                print("Backend process terminated.")
                break
            if frontend_process.poll() is not None:
                print("Frontend process terminated.")
                break
    except KeyboardInterrupt:
        print("\nStopping servers...")
    finally:
        backend_process.terminate()
        frontend_process.terminate()
        print("Servers stopped.")

if __name__ == "__main__":
    run_servers()
