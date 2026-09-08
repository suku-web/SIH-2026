import { useRef, useState } from "react";

const API = "http://localhost:5000";

function App() {
  const [name, setName] = useState("");
  const [userId, setUserId] = useState("");

  const [recording, setRecording] = useState(false);
  const [message, setMessage] = useState("");

  const [audioUrl, setAudioUrl] = useState("");
  const [audioBlob, setAudioBlob] = useState(null);

  const [enrollments, setEnrollments] = useState([]);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startTimeRef = useRef(0);

  // ==========================================
  // START RECORDING
  // ==========================================

  async function startRecording() {
    if (!name.trim() || !userId.trim()) {
      setMessage(
        "⚠️ Please enter Name and User ID first."
      );
      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      streamRef.current = stream;
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      const recorder =
        new MediaRecorder(stream);

      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(
          chunksRef.current,
          {
            type: "audio/webm",
          }
        );

        const url =
          URL.createObjectURL(blob);

        setAudioUrl(url);
        setAudioBlob(blob);

        stream
          .getTracks()
          .forEach((track) => {
            track.stop();
          });

        const duration = Math.round(
          (Date.now() -
            startTimeRef.current) /
            1000
        );

        setMessage(
          "⏳ Uploading recording..."
        );

        await uploadVoice(
          blob,
          duration
        );
      };

      recorder.start();

      setRecording(true);

      setMessage(
        "🔴 Recording live... Speak now."
      );
    } catch (error) {
      console.error(error);

      setMessage(
        "❌ Microphone permission failed."
      );
    }
  }

  // ==========================================
  // STOP RECORDING
  // ==========================================

  function stopRecording() {
    if (
      recorderRef.current &&
      recorderRef.current.state !==
        "inactive"
    ) {
      recorderRef.current.stop();
    }

    setRecording(false);

    setMessage(
      "⏳ Processing recording..."
    );
  }

  // ==========================================
  // UPLOAD VOICE TO BACKEND
  // ==========================================

  async function uploadVoice(
    blob,
    duration
  ) {
    try {
      const formData =
        new FormData();

      formData.append(
        "audio",
        blob,
        "voice-recording.webm"
      );

      formData.append(
        "name",
        name
      );

      formData.append(
        "userId",
        userId
      );

      formData.append(
        "duration",
        duration
      );

      formData.append(
        "sampleRate",
        "browser-default"
      );

      console.log(
        "Uploading recording..."
      );

      const response =
        await fetch(
          `${API}/api/enroll`,
          {
            method: "POST",
            body: formData,
          }
        );

      const data =
        await response.json();

      console.log(
        "Backend response:",
        data
      );

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Upload failed"
        );
      }

      setMessage(
        "✅ Voice enrollment saved successfully!"
      );

      await loadEnrollments();
    } catch (error) {
      console.error(error);

      setMessage(
        "❌ Upload failed: " +
          error.message
      );
    }
  }

  // ==========================================
  // LOAD ENROLLMENTS
  // ==========================================

  async function loadEnrollments() {
    try {
      const response =
        await fetch(
          `${API}/api/enrollments`
        );

      const data =
        await response.json();

      console.log(
        "Enrollments:",
        data
      );

      setEnrollments(
        data.enrollments || []
      );
    } catch (error) {
      console.error(error);

      setMessage(
        "❌ Could not load enrollments."
      );
    }
  }

  // ==========================================
  // DOWNLOAD LATEST RECORDING
  // ==========================================

  function downloadLatest() {
    if (!audioBlob) {
      return;
    }

    const url =
      URL.createObjectURL(
        audioBlob
      );

    const link =
      document.createElement("a");

    link.href = url;

    link.download =
      `${userId}-voice-recording.webm`;

    document.body.appendChild(
      link
    );

    link.click();

    document.body.removeChild(
      link
    );

    URL.revokeObjectURL(url);
  }

  // ==========================================
  // UI
  // ==========================================

  return (
    <div
      style={{
        maxWidth: "1000px",
        margin: "40px auto",
        padding: "30px",
        fontFamily:
          "Arial, sans-serif",
      }}
    >
      <h1>
        🎤 Voice Security
        Enrollment
      </h1>

      <p>
        Capture and securely save
        a voice recording.
      </p>

      <hr />

      {/* USER DETAILS */}

      <h2>
        👤 User Details
      </h2>

      <input
        type="text"
        placeholder="Enter Name"
        value={name}
        disabled={recording}
        onChange={(e) =>
          setName(e.target.value)
        }
        style={{
          padding: "12px",
          width: "220px",
          marginRight: "10px",
        }}
      />

      <input
        type="text"
        placeholder="Enter User ID"
        value={userId}
        disabled={recording}
        onChange={(e) =>
          setUserId(e.target.value)
        }
        style={{
          padding: "12px",
          width: "220px",
        }}
      />

      <br />
      <br />

      {/* RECORD BUTTON */}

      {!recording ? (
        <button
          onClick={startRecording}
          style={{
            padding:
              "14px 25px",
            fontSize: "16px",
            cursor: "pointer",
          }}
        >
          🎤 START RECORDING
        </button>
      ) : (
        <button
          onClick={stopRecording}
          style={{
            padding:
              "14px 25px",
            fontSize: "16px",
            cursor: "pointer",
          }}
        >
          ⏹ STOP RECORDING
        </button>
      )}

      <h3>
        {message}
      </h3>

      <hr />

      {/* LATEST RECORDING */}

      {audioUrl && (
        <div>
          <h2>
            🎧 Latest Recording
          </h2>

          <audio
            controls
            src={audioUrl}
            style={{
              width: "500px",
              maxWidth: "100%",
            }}
          />

          <br />
          <br />

          <button
            onClick={downloadLatest}
            style={{
              padding:
                "12px 20px",
              fontSize: "16px",
              cursor: "pointer",
            }}
          >
            ⬇️ DOWNLOAD RECORDING
          </button>
        </div>
      )}

      <hr />

      {/* ENROLLMENTS */}

      <h2>
        📋 Voice Enrollments
      </h2>

      <button
        onClick={loadEnrollments}
        style={{
          padding:
            "12px 20px",
          fontSize: "16px",
          cursor: "pointer",
        }}
      >
        🔄 VIEW SAVED ENROLLMENTS
      </button>

      <br />
      <br />

      {enrollments.length === 0 ? (
        <p>
          No enrollments loaded.
        </p>
      ) : (
        <table
          border="1"
          cellPadding="10"
          style={{
            width: "100%",
            borderCollapse:
              "collapse",
          }}
        >
          <thead>
            <tr>
              <th>
                Enrollment
              </th>

              <th>
                Name
              </th>

              <th>
                User ID
              </th>

              <th>
                Duration
              </th>

              <th>
                Audio
              </th>

              <th>
                Download
              </th>
            </tr>
          </thead>

          <tbody>
            {enrollments.map(
              (item, index) => (
                <tr
                  key={
                    item.recordingId
                  }
                >
                  <td>
                    {index + 1}
                  </td>

                  <td>
                    {item.name}
                  </td>

                  <td>
                    {item.userId}
                  </td>

                  <td>
                    {item.duration}{" "}
                    sec
                  </td>

                  <td>
                    <audio
                      controls
                      src={`${API}${item.audioUrl}`}
                      style={{
                        width:
                          "250px",
                      }}
                    />
                  </td>

                  <td>
                    <a
                      href={`${API}${item.audioUrl}`}
                      download
                    >
                      <button>
                        ⬇️ Download
                      </button>
                    </a>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default App;