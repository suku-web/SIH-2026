import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const API = "http://localhost:5000";
const socket = io(API);

function App() {
  const [name, setName] = useState("");
  const [userId, setUserId] = useState("");

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const [audioUrl, setAudioUrl] = useState("");
  const [alerts, setAlerts] = useState([]);
  const [message, setMessage] = useState("");

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startTimeRef = useRef(0);

  // Load existing alerts + Socket.IO real-time listener
  useEffect(() => {
    loadAlerts();

    socket.on("new_alert", (newAlert) => {
      console.log("⚡ New alert received via Socket:", newAlert);
      setAlerts((prev) => [newAlert, ...prev]);
    });

    return () => {
      socket.off("new_alert");
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  async function loadAlerts() {
    try {
      const res = await fetch(`${API}/api/alerts`);
      const data = await res.json();
      setAlerts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading alerts:", err);
    }
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  async function startRecording() {
    if (!name.trim() || !userId.trim()) {
      setMessage("⚠️ Please enter Name and User ID first.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      let mimeType = "audio/webm";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstart = () => {
        setIsRecording(true);
        setRecordingTime(0);
        setMessage("🔴 Recording live... Speak now.");
        startTimeRef.current = Date.now();

        timerRef.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setRecordingTime(elapsed);
        }, 250);
      };

      recorder.onstop = async () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const blob = new Blob(chunksRef.current, { type: mimeType });

        if (blob.size === 0) {
          setMessage("❌ Recording is empty. Please try again.");
          return;
        }

        setAudioUrl(URL.createObjectURL(blob));

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        setIsRecording(false);
        setMessage("⏳ Analyzing audio through detection pipeline...");

        await processAudio(blob);
      };

      recorder.start(250);
    } catch (error) {
      console.error(error);
      setMessage("❌ Microphone access denied or unavailable.");
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      setMessage("⏳ Finishing recording...");
    }
  }

  async function processAudio(blob) {
    try {
      const formData = new FormData();
      formData.append("audio", blob, "voice-sample.webm");
      formData.append("claimed_identity", name);

      const response = await fetch(`${API}/api/process-call`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const result = await response.json();
      console.log("Analysis success:", result);
      setMessage(`✅ Verification complete! Decision: ${result.decision}`);
      loadAlerts();
    } catch (error) {
      console.error("Pipeline error:", error);
      setMessage("❌ Verification failed. Check backend logs.");
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#111827", color: "white", padding: "30px 20px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: "1050px", margin: "auto", background: "#1f2937", padding: "30px", borderRadius: "14px" }}>
        
        <h1 style={{ textAlign: "center", margin: 0 }}>🛡️ AI Voice Clone Detection Dashboard</h1>
        <p style={{ textAlign: "center", color: "#9ca3af" }}>Real-time voice verification, risk scoring & tamper-proof audit</p>

        <hr style={{ borderColor: "#374151", margin: "20px 0" }} />

        <h3>👤 Caller Verification Details</h3>
        <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", marginBottom: "20px" }}>
          <input
            type="text"
            placeholder="Enter Name (Claimed Identity)"
            value={name}
            disabled={isRecording}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: "12px", fontSize: "15px", flex: 1, borderRadius: "6px", border: "1px solid #4b5563", background: "#374151", color: "white" }}
          />
          <input
            type="text"
            placeholder="Enter User/Call ID"
            value={userId}
            disabled={isRecording}
            onChange={(e) => setUserId(e.target.value)}
            style={{ padding: "12px", fontSize: "15px", flex: 1, borderRadius: "6px", border: "1px solid #4b5563", background: "#374151", color: "white" }}
          />
        </div>

        <div style={{ textAlign: "center" }}>
          {!isRecording ? (
            <button onClick={startRecording} style={{ padding: "14px 28px", fontSize: "16px", cursor: "pointer", background: "#2563eb", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold" }}>
              🎤 START VERIFICATION RECORDING
            </button>
          ) : (
            <button onClick={stopRecording} style={{ padding: "14px 28px", fontSize: "16px", cursor: "pointer", background: "#dc2626", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold" }}>
              ⏹️ STOP & ANALYZE
            </button>
          )}
        </div>

        {isRecording && (
          <div style={{ textAlign: "center", marginTop: "15px" }}>
            <span style={{ color: "#ef4444", fontWeight: "bold" }}>🔴 RECORDING IN PROGRESS: </span>
            <span style={{ fontSize: "24px", fontWeight: "bold" }}>{formatTime(recordingTime)}</span>
          </div>
        )}

        <h4 style={{ textAlign: "center", color: message.includes("❌") ? "#ef4444" : "#10b981", marginTop: "15px" }}>
          {message}
        </h4>

        {audioUrl && (
          <div style={{ marginTop: "15px", padding: "15px", background: "#111827", borderRadius: "8px", display: "flex", alignItems: "center", gap: "15px" }}>
            <strong style={{ whiteSpace: "nowrap" }}>🎧 Preview:</strong>
            <audio controls src={audioUrl} style={{ flex: 1 }} />
          </div>
        )}

        <hr style={{ borderColor: "#374151", margin: "30px 0" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
          <h2 style={{ margin: 0 }}>🚨 Live Security & Risk Alerts</h2>
          <button onClick={loadAlerts} style={{ padding: "8px 16px", background: "#374151", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>
            🔄 Refresh Alerts
          </button>
        </div>

        {alerts.length === 0 ? (
          <p style={{ color: "#9ca3af" }}>No alerts generated yet. Record voice or send test data.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#111827", borderRadius: "8px", overflow: "hidden" }}>
              <thead>
                <tr style={{ background: "#374151", textAlign: "left" }}>
                  <th style={{ padding: "12px" }}>Call ID</th>
                  <th style={{ padding: "12px" }}>Risk Score</th>
                  <th style={{ padding: "12px" }}>Decision</th>
                  <th style={{ padding: "12px" }}>Action</th>
                  <th style={{ padding: "12px" }}>Blockchain Hash</th>
                  <th style={{ padding: "12px" }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((item) => (
                  <tr key={item._id || item.call_id} style={{ borderBottom: "1px solid #1f2937" }}>
                    <td style={{ padding: "12px", fontFamily: "monospace" }}>{item.call_id}</td>
                    <td style={{ padding: "12px", fontWeight: "bold" }}>{item.risk_score}%</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: "bold",
                        background: item.decision === "Genuine" ? "#065f46" : "#991b1b",
                        color: item.decision === "Genuine" ? "#34d399" : "#fca5a5"
                      }}>
                        {item.decision} ({item.risk_level})
                      </span>
                    </td>
                    <td style={{ padding: "12px" }}>{item.recommended_action}</td>
                    <td style={{ padding: "12px", fontFamily: "monospace", fontSize: "12px", color: "#9ca3af" }}>
                      {item.blockchain_tx_hash ? `${item.blockchain_tx_hash.slice(0, 14)}...` : "None"}
                    </td>
                    <td style={{ padding: "12px", fontSize: "12px", color: "#9ca3af" }}>
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;