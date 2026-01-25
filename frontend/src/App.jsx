import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';

function App() {
  const webcamRef = useRef(null);
  const ws = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [debugLogs, setDebugLogs] = useState([]);
  const endpointIndex = useRef(0);
  const [previousGesture, setPreviousGesture] = useState("None");
  const [prevImageUrl, setPrevImageUrl] = useState("");
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [autoExposure, setAutoExposure] = useState(true);
  const [exposure, setExposure] = useState(0);

  const addLog = (msg) => {
    console.log(msg);
    setDebugLogs(prev => [msg, ...prev].slice(0, 10));
  };

  // New State Variables
  const [gestureCount, setGestureCount] = useState(0);
  const [currentDisplay, setCurrentDisplay] = useState({ label: "Waiting...", image_url: "" });
  const [bbox, setBbox] = useState(null);

  // Establish WebSocket connection
  useEffect(() => {
    let timeoutId = null;
    let shouldReconnect = true;

    const connect = () => {
      // Prevent multiple connections or connections after unmount
      if (!shouldReconnect) return;
      if (ws.current && ws.current.readyState === WebSocket.OPEN) return;

      // Timeout safeguard: If stuck in CONNECTING for too long
      const connectionTimeout = setTimeout(() => {
          if (ws.current && ws.current.readyState === WebSocket.CONNECTING) {
              addLog("Connection timed out state check");
              setErrorMsg("Connection timed out. Please check backend.");
          }
      }, 5000);

      const endpoints = [
        (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/ws',
        'ws://localhost:8000/ws',
        'ws://127.0.0.1:8000/ws'
      ];
      const wsUrl = endpoints[endpointIndex.current % endpoints.length];
      addLog(`Attempting connection to: ${wsUrl}`);
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        clearTimeout(connectionTimeout);
        addLog('Connected to WebSocket');
        setIsConnected(true);
        setLoading(false);
        setErrorMsg("");
        endpointIndex.current = 0;
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const { label, image_url, bbox } = data;

          setBbox(bbox);

          setCurrentDisplay(prev => {
              if (label !== prev.label) {
                  return { label, image_url };
              }
              return prev;
          });

        } catch (e) {
          console.error("Error parsing JSON", e);
        }
      };

      ws.current.onclose = (event) => {
        addLog(`Disconnected: Code ${event.code}, Reason: ${event.reason}`);
        setIsConnected(false);
        setLoading(true);
        
        // Only reconnect if we're supposed to (not unmounted)
        if (shouldReconnect) {
            endpointIndex.current += 1;
            timeoutId = setTimeout(connect, 1500);
        }
      };

      ws.current.onerror = (error) => {
        addLog('WebSocket error event fired');
        console.error('WebSocket error:', error);
        setErrorMsg("Connection error occurred.");
        try {
          ws.current && ws.current.close();
        } catch {}
        ws.current = null;
        endpointIndex.current += 1;
        if (shouldReconnect) {
          timeoutId = setTimeout(connect, 1000);
        }
      };
    };

    connect();

    return () => {
      shouldReconnect = false;
      if (timeoutId) clearTimeout(timeoutId);
      
      if (ws.current) {
        // Unbind onclose to prevent triggering reconnect logic during cleanup
        ws.current.onclose = null;
        ws.current.close();
      }
    };
  }, []);
  
  useEffect(() => {
    const url = currentDisplay.image_url;
    if (url && url !== prevImageUrl) {
      setGestureCount(prev => prev + 1);
      setPrevImageUrl(url);
    }
  }, [currentDisplay.image_url]);
  
  useEffect(() => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      const payload = {
        type: "settings",
        auto_exposure: autoExposure,
        exposure,
        brightness,
        contrast
      };
      ws.current.send(JSON.stringify(payload));
    }
  }, [autoExposure, exposure, brightness, contrast, isConnected]);

  // Frame processing loop
  useEffect(() => {
    const interval = setInterval(() => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN && webcamRef.current) {
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc) {
          ws.current.send(imageSrc);
        }
      }
    }, 200); // Capture every 200ms

    return () => clearInterval(interval);
  }, [isConnected]);

  return (
    <div className="h-screen w-screen bg-slate-900 text-zinc-100 flex overflow-hidden">
      
      {/* Loading State */}
      {loading && !isConnected && (
         <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-sm">
           <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
           <p className="mt-4 text-xl font-medium text-blue-400">Connecting to AI Engine...</p>
           {errorMsg && <p className="mt-2 text-red-400 text-sm max-w-md text-center">{errorMsg}</p>}
           <div className="mt-4 text-xs text-slate-500 font-mono text-left bg-black/50 p-2 rounded max-w-md w-full">
             {debugLogs.map((log, i) => <div key={i}>{log}</div>)}
           </div>
         </div>
      )}

      {/* Left Column: Input (Webcam) */}
      <div className="w-1/2 h-full relative border-r border-slate-700 bg-slate-800/50 flex flex-col items-center justify-center p-8">
        <h2 className="absolute top-8 left-8 text-2xl font-bold tracking-wider text-slate-400 uppercase">Input Feed</h2>
        
        <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-600 w-full max-w-2xl bg-black">
            <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                className="w-full h-full transform scale-x-[-1]" 
                style={{ filter: `brightness(${brightness}%) contrast(${contrast}%)` }}
                // Note: scale-x-[-1] mirrors the video visually.
                videoConstraints={{
                    facingMode: "user"
                }}
            />
            
            {/* Bounding Box Overlay */}
            {bbox && (
                <div 
                    className="absolute border-4 border-green-400 rounded-lg shadow-[0_0_15px_rgba(74,222,128,0.5)] transition-all duration-100 ease-linear pointer-events-none"
                    style={{
                        // Coordinates are normalized (0-1).
                        // Since video is mirrored visually (scale-x-[-1]), 
                        // left becomes right.
                        // However, the bbox coordinates are from the image sent to backend.
                        // If the backend sees the image "as is" (unmirrored data, but visually mirrored to user),
                        // The user sees themselves mirrored.
                        // The raw screenshot data usually matches what the camera sees (unmirrored).
                        // If I raise my right hand, it appears on the right side of the screen (mirror effect).
                        // In the raw image, it's on the left side.
                        // Backend sees it on the left (x ~ 0.1). Returns x_min = 0.1.
                        // If I draw at left: 10%, it will appear on the left of the container.
                        // But the video is flipped. So the left of the video container displays the right of the raw image?
                        // Actually: transform scale-x-[-1] flips the whole element.
                        // If I put the bbox div INSIDE the flipped container, it also gets flipped?
                        // If the bbox div is sibling to webcam but parent has scale-x-[-1]?
                        // The container above (relative) does NOT have scale-x-[-1]. Only the Webcam component has it via className.
                        // So the container coordinate system is normal (0 is left).
                        // The video is flipped inside.
                        // If raw image has hand at x=0.1 (Left), video displays it at Right (x=0.9).
                        // So we need to flip the X coordinate: left = (1 - x_max) * 100 + "%"
                        left: `calc(${(1-bbox.x_max) * 100}%)`,
                        top: `${bbox.y_min * 100}%`,
                        width: `${(bbox.x_max - bbox.x_min) * 100}%`,
                        height: `${(bbox.y_max - bbox.y_min) * 100}%`
                    }}
                >
                    <div className="absolute -top-6 left-0 bg-green-400 text-black text-xs font-bold px-2 py-0.5 rounded">
                        HAND DETECTED
                    </div>
                </div>
            )}
        </div>

        <div className="mt-6 w-full max-w-2xl bg-slate-900/60 rounded-xl border border-slate-700 p-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-3">
              <span className="text-sm text-slate-300">Auto Exposure</span>
              <input type="checkbox" checked={autoExposure} onChange={(e) => setAutoExposure(e.target.checked)} />
            </label>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-300">Exposure</span>
              <input type="range" min="-10" max="10" value={exposure} onChange={(e) => setExposure(parseInt(e.target.value))} disabled={autoExposure} className="w-full" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-300">Brightness</span>
              <input type="range" min="50" max="150" value={brightness} onChange={(e) => setBrightness(parseInt(e.target.value))} className="w-full" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-300">Contrast</span>
              <input type="range" min="50" max="150" value={contrast} onChange={(e) => setContrast(parseInt(e.target.value))} className="w-full" />
            </div>
          </div>
        </div>
        
        <div className="mt-8 flex items-center gap-3 bg-slate-900 px-4 py-2 rounded-full border border-slate-700">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-rose-500'}`}></div>
            <span className="text-sm font-medium text-slate-300">{isConnected ? "System Online" : "System Offline"}</span>
        </div>
      </div>

      {/* Right Column: Output (Response) */}
      <div className="w-1/2 h-full relative bg-slate-900 flex flex-col items-center justify-center p-8">
         <h2 className="absolute top-8 right-8 text-2xl font-bold tracking-wider text-slate-400 uppercase">AI Response</h2>

         <div className="flex flex-col items-center justify-center w-full max-w-xl">
             {/* Gesture Label */}
             <div className="mb-8 h-20 flex items-center justify-center">
                 {currentDisplay.label !== "Waiting..." && currentDisplay.label !== "None" ? (
                     <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 drop-shadow-sm uppercase tracking-tight">
                         {currentDisplay.label}
                     </h1>
                 ) : (
                     <h1 className="text-4xl font-bold text-slate-600 uppercase tracking-widest">
                         {currentDisplay.label === "None" ? "Ready" : "Waiting..."}
                     </h1>
                 )}
             </div>

             {/* Image Display */}
            <div className="w-full max-w-full bg-slate-800 rounded-3xl border-4 border-slate-700 shadow-2xl relative flex items-center justify-center p-4">
                 {currentDisplay.image_url ? (
                    <img 
                         src={currentDisplay.image_url} 
                         alt={currentDisplay.label} 
                        className="w-auto max-w-full h-auto max-h-screen"
                         onError={(e) => {
                            if (e.target.src.includes("placeholder.svg")) return;
                            e.target.src = "/placeholder.svg";
                        }}
                     />
                 ) : (
                     <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                         <svg className="w-20 h-20 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                         </svg>
                         <span className="text-lg font-medium">No Signal</span>
                     </div>
                 )}
             </div>

             {/* Status Bar / Counter */}
             <div className="mt-10 w-full bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-center justify-between shadow-lg">
                 <div className="flex flex-col">
                     <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Session Status</span>
                     <span className="text-emerald-400 font-bold text-lg">Active</span>
                 </div>
                 <div className="h-10 w-px bg-slate-700 mx-4"></div>
                 <div className="flex flex-col items-end">
                     <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Processed Inputs</span>
                     <span className="text-white font-mono text-2xl font-bold tabular-nums">{gestureCount}</span>
                 </div>
             </div>
         </div>
      </div>
    </div>
  );
}

export default App;
