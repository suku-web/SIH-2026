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

    return `${String(mins).padStart(2, "0")}:${String(
      secs
    ).padStart(2, "0")}`;
  }

  async function startRecording() {
    if (!name.trim() || !userId.trim()) {
      setMessage("Please enter Name and User ID first.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      streamRef.current = stream;
      chunksRef.current = [];

      let mimeType = "audio/webm";

      if (
        MediaRecorder.isTypeSupported(
          "audio/webm;codecs=opus"
        )
      ) {
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

        const blob = new Blob(chunksRef.current, {
          type: mimeType,
        });

        if (blob.size === 0) {
          setMessage("❌ Recording is empty. Please try again.");
          return;
        }

        const localUrl = URL.createObjectURL(blob);
        setAudioUrl(localUrl);

        const duration = Math.max(
          1,
          Math.round(
            (Date.now() - startTimeRef.current) / 1000
          )
        );

        if (streamRef.current) {
          streamRef.current
            .getTracks()
            .forEach((track) => track.stop());
        }

        setIsRecording(false);
        setMessage("⏳ Uploading recording...");

        await uploadRecording(blob, duration, mimeType);
      };

      recorder.start(250);

    } catch (error) {
      console.error(error);
      setMessage(
        "❌ Microphone access failed. Allow microphone permission and try again."
      );
    }
  }

  function stopRecording() {
    if (
      recorderRef.current &&
      recorderRef.current.state !== "inactive"
    ) {
      recorderRef.current.stop();
      setMessage("⏳ Finishing recording...");
    }
  }

  async function uploadRecording(blob, duration, mimeType) {
    try {
      const formData = new FormData();

      formData.append(
        "audio",
        blob,
        "voice-recording.webm"
      );

      formData.append("name", name);
      formData.append("userId", userId);
      formData.append("duration", duration);
      formData.append("mimeType", mimeType);

      const response = await fetch(
        `${API}/api/enroll`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const data = await response.json();

      console.log("Server response:", data);

      setMessage(
        "✅ Voice enrollment saved successfully!"
      );

      loadEnrollments();

    } catch (error) {
      console.error("Upload error:", error);

      setMessage(
        "❌ Upload failed. Make sure the backend is running."
      );
    }
  }

  async function loadEnrollments() {
    try {
      const response = await fetch(
        `${API}/api/enrollments`
      );

      const data = await response.json();

      setSavedRecordings(
        data.enrollments || []
      );

    } catch (error) {
      console.error(error);

      setMessage(
        "❌ Could not load enrollments."
      );
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#111827",
        color: "white",
        padding: "40px 20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1000px",
          margin: "auto",
          background: "#1f2937",
          padding: "35px",
          borderRadius: "15px",
        }}
      >
        <h1 style={{ textAlign: "center" }}>
          🎤 Voice Security Enrollment
        </h1>

        <p style={{ textAlign: "center" }}>
          Capture, save and share voice enrollment recordings.
        </p>

        <hr />

        <h2>👤 User Details</h2>

        <div
          style={{
            display: "flex",
            gap: "15px",
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            placeholder="Enter Name"
            value={name}
            disabled={isRecording}
            onChange={(e) => setName(e.target.value)}
            style={{
              padding: "14px",
              fontSize: "16px",
              flex: 1,
            }}
          />

          <input
            type="text"
            placeholder="Enter User ID"
            value={userId}
            disabled={isRecording}
            onChange={(e) => setUserId(e.target.value)}
            style={{
              padding: "14px",
              fontSize: "16px",
              flex: 1,
            }}
          />
        </div>

        <br />

        <div style={{ textAlign: "center" }}>
          {!isRecording ? (
            <button
              onClick={startRecording}
              style={{
                padding: "15px 30px",
                fontSize: "18px",
                cursor: "pointer",
              }}
            >
              🎤 START RECORDING
            </button>
          ) : (
            <button
              onClick={stopRecording}
              style={{
                padding: "15px 30px",
                fontSize: "18px",
                cursor: "pointer",
              }}
            >
              ⏹️ STOP RECORDING
            </button>
          )}
        </div>

        {isRecording && (
          <div
            style={{
              textAlign: "center",
              marginTop: "20px",
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
            marginTop: "20px",
          }}
        >
          {message}
        </h3>

        {audioUrl && (
          <div
            style={{
              marginTop: "30px",
              padding: "20px",
              background: "#111827",
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
                  <th style={{ padding: "10px" }}>
                    #
                  </th>
                  <th style={{ padding: "10px" }}>
                    Name
                  </th>
                  <th style={{ padding: "10px" }}>
                    User ID
                  </th>
                  <th style={{ padding: "10px" }}>
                    Duration
                  </th>
                  <th style={{ padding: "10px" }}>
                    Audio
                  </th>
                  <th style={{ padding: "10px" }}>
                    Download
                  </th>
                </tr>
              </thead>

              <tbody>
                {savedRecordings.map(
                  (recording, index) => (
                    <tr key={recording.recordingId}>
                      <td style={{ padding: "10px" }}>
                        {index + 1}
                      </td>

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
                          style={{
                            color: "white",
                          }}
                        >
                          📥 Download
                        </a>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;