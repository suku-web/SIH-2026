import { useEffect, useRef, useState } from "react";

const API = "http://localhost:5000";

function App() {
  const [name, setName] = useState("");
  const [userId, setUserId] = useState("");

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const [audioUrl, setAudioUrl] = useState("");
  const [savedRecordings, setSavedRecordings] = useState([]);

  const [message, setMessage] = useState("");

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startTimeRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, []);

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(
      2,
      "0"
    )}`;
  }

  async function startRecording() {
    if (!name.trim() || !userId.trim()) {
      setMessage("Please enter Name and User ID first.");
      return;
    }

    try {
      setMessage("");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      streamRef.current = stream;
      chunksRef.current = [];

      let mimeType = "audio/webm";

      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      }

      const recorder = new MediaRecorder(stream, {
        mimeType,
      });

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
          const elapsed = Math.floor(
            (Date.now() - startTimeRef.current) / 1000
          );

          setRecordingTime(elapsed);
        }, 250);
      };

      recorder.onstop = async () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const duration = Math.floor(
          (Date.now() - startTimeRef.current) / 1000
        );

        const blob = new Blob(chunksRef.current, {
          type: mimeType,
        });

        setIsRecording(false);

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => {
            track.stop();
          });

          streamRef.current = null;
        }

        if (blob.size === 0) {
          setMessage("Recording is empty.");
          return;
        }

        setMessage("⏳ Uploading recording...");

        await uploadRecording(blob, duration, mimeType);

        const localUrl = URL.createObjectURL(blob);
        setAudioUrl(localUrl);
      };

      recorder.start(250);
    } catch (error) {
      console.error(error);

      setIsRecording(false);
      setMessage(
        "Microphone permission was denied or microphone is unavailable."
      );
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }

  async function uploadRecording(blob, duration, mimeType) {
    try {
      const formData = new FormData();

      formData.append("audio", blob, "voice-recording.webm");
      formData.append("name", name);
      formData.append("userId", userId);
      formData.append("duration", String(duration));
      formData.append("mimeType", mimeType);

      const response = await fetch(`${API}/api/enroll`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const data = await response.json();

      console.log("Server response:", data);

      setMessage("✅ Voice enrollment saved successfully!");

      loadEnrollments();
    } catch (error) {
      console.error("Upload error:", error);

      setMessage("❌ Failed to upload recording to backend.");
    }
  }

  async function loadEnrollments() {
    try {
      const response = await fetch(`${API}/api/enrollments`);

      if (!response.ok) {
        throw new Error("Failed to load enrollments");
      }

      const data = await response.json();

      setSavedRecordings(
        Array.isArray(data)
          ? data
          : data.enrollments || data.recordings || []
      );
    } catch (error) {
      console.error("Load enrollments error:", error);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "40px",
        background: "#111827",
        color: "white",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
        }}
      >
        <h1 style={{ textAlign: "center" }}>
          🎙️ Voice Security
        </h1>

        <p style={{ textAlign: "center" }}>
          Voice Enrollment & Security System
        </p>

        <div
          style={{
            background: "#1f2937",
            padding: "25px",
            borderRadius: "12px",
            marginTop: "30px",
          }}
        >
          <h2>Voice Enrollment</h2>

          <label>Name</label>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            style={{
              display: "block",
              width: "100%",
              boxSizing: "border-box",
              padding: "12px",
              marginTop: "8px",
              marginBottom: "20px",
              borderRadius: "6px",
              border: "1px solid #4b5563",
            }}
          />

          <label>User ID</label>

          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Enter User ID"
            style={{
              display: "block",
              width: "100%",
              boxSizing: "border-box",
              padding: "12px",
              marginTop: "8px",
              marginBottom: "25px",
              borderRadius: "6px",
              border: "1px solid #4b5563",
            }}
          />

          <div style={{ textAlign: "center" }}>
            {!isRecording ? (
              <button
                onClick={startRecording}
                style={{
                  padding: "14px 30px",
                  fontSize: "16px",
                  cursor: "pointer",
                }}
              >
                🎙️ START RECORDING
              </button>
            ) : (
              <button
                onClick={stopRecording}
                style={{
                  padding: "14px 30px",
                  fontSize: "16px",
                  cursor: "pointer",
                  background: "#dc2626",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                }}
              >
                ⏹️ STOP RECORDING
              </button>
            )}
          </div>
        </div>

        {isRecording && (
          <div
            style={{
              textAlign: "center",
              marginTop: "30px",
            }}
          >
            <h2 style={{ color: "#ef4444" }}>
              🔴 LIVE RECORDING
            </h2>

            <div
              style={{
                fontSize: "40px",
                fontWeight: "bold",
              }}
            >
              {formatTime(recordingTime)}
            </div>

            <p>Speak clearly into the microphone...</p>
          </div>
        )}

        <h3
          style={{
            textAlign: "center",
            marginTop: "25px",
          }}
        >
          {message}
        </h3>

        {audioUrl && (
          <div
            style={{
              marginTop: "30px",
              padding: "20px",
              background: "#1f2937",
              borderRadius: "10px",
            }}
          >
            <h2>🎧 Latest Recording</h2>

            <audio
              controls
              src={audioUrl}
              style={{ width: "100%" }}
            />

            <br />
            <br />

            <a
              href={audioUrl}
              download="voice-recording.webm"
              style={{
                display: "inline-block",
                padding: "12px 20px",
                background: "#374151",
                color: "white",
                textDecoration: "none",
                borderRadius: "6px",
              }}
            >
              📥 Download Recording
            </a>
          </div>
        )}

        <hr style={{ margin: "35px 0" }} />

        <div style={{ textAlign: "center" }}>
          <button
            onClick={loadEnrollments}
            style={{
              padding: "12px 25px",
              fontSize: "16px",
              cursor: "pointer",
            }}
          >
            📋 VIEW ENROLLMENTS
          </button>
        </div>

        <h2>📋 Saved Voice Enrollments</h2>

        {savedRecordings.length === 0 ? (
          <p>No enrollments loaded yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr>
                  <th>Name</th>
                  <th>User ID</th>
                  <th>Duration</th>
                  <th>Audio</th>
                  <th>Download</th>
                </tr>
              </thead>

              <tbody>
                {savedRecordings.map((recording, index) => (
                  <tr key={recording.recordingId || index}>
                    <td style={{ padding: "10px" }}>
                      {recording.name}
                    </td>

                    <td style={{ padding: "10px" }}>
                      {recording.userId}
                    </td>

                    <td style={{ padding: "10px" }}>
                      {recording.duration} sec
                    </td>

                    <td style={{ padding: "10px" }}>
                      <audio
                        controls
                        src={`${API}${recording.audioUrl}`}
                      />
                    </td>

                    <td style={{ padding: "10px" }}>
                      <a
                        href={`${API}${recording.downloadUrl}`}
                        style={{ color: "white" }}
                      >
                        📥 Download
                      </a>
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