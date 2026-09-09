import { useEffect, useRef, useState } from "react";

const API = "http://localhost:5000";

function VoiceRecorder() {
  const [name, setName] = useState("");
  const [userId, setUserId] = useState("");

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const [recordingTime, setRecordingTime] = useState("");
  const [message, setMessage] = useState("");

  const [audioUrl, setAudioUrl] = useState("");
  const [savedFile, setSavedFile] = useState("");

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

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

  async function startRecording() {
    if (!name.trim() || !userId.trim()) {
      setMessage("⚠️ Enter Name and User ID first.");
      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      streamRef.current = stream;
      chunksRef.current = [];

      let mimeType = "";

      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "audio/webm";
      } else {
        mimeType = "";
      }

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorderRef.current = recorder;

      const startTime = new Date();

      startTimeRef.current = startTime;

      setRecordingSeconds(0);

      setRecordingTime(
        startTime.toLocaleString()
      );

      setAudioUrl("");
      setSavedFile("");

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const finalType =
          recorder.mimeType || "audio/webm";

        const blob = new Blob(
          chunksRef.current,
          {
            type: finalType,
          }
        );

        console.log(
          "Recording size:",
          blob.size,
          "bytes"
        );

        if (blob.size === 0) {
          setMessage(
            "❌ Recording was empty. Please try again."
          );
          return;
        }

        const localUrl =
          URL.createObjectURL(blob);

        setAudioUrl(localUrl);

        const endTime = new Date();

        const seconds = Math.max(
          1,
          Math.round(
            (endTime.getTime() -
              startTime.getTime()) /
              1000
          )
        );

        setRecordingSeconds(seconds);

        stream
          .getTracks()
          .forEach((track) => track.stop());

        await uploadRecording(
          blob,
          seconds,
          startTime
        );
      };

      recorder.onerror = (event) => {
        console.error(
          "Recorder error:",
          event
        );

        setMessage(
          "❌ Recording error occurred."
        );
      };

      recorder.start(250);

      setIsRecording(true);

      setMessage(
        "🔴 LIVE RECORDING — Speak now..."
      );

      timerRef.current = setInterval(() => {
        setRecordingSeconds((previous) => {
          return previous + 1;
        });
      }, 1000);

    } catch (error) {
      console.error(error);

      setMessage(
        "❌ Microphone permission failed."
      );
    }
  }

  function stopRecording() {
    if (
      recorderRef.current &&
      recorderRef.current.state !== "inactive"
    ) {
      recorderRef.current.stop();
    }

    setIsRecording(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setMessage(
      "⏳ Saving recording to project storage..."
    );
  }

  async function uploadRecording(
    blob,
    seconds,
    startTime
  ) {
    try {
      const formData = new FormData();

      formData.append(
        "audio",
        blob,
        `${userId}_voice.webm`
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
        String(seconds)
      );

      formData.append(
        "recordedAt",
        startTime.toISOString()
      );

      formData.append(
        "sampleRate",
        "browser-default"
      );

      const response = await fetch(
        `${API}/api/enroll`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

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

      setSavedFile(
        data.enrollment?.fileName ||
          ""
      );

      setMessage(
        "✅ Recording saved successfully in project storage!"
      );

    } catch (error) {
      console.error(error);

      setMessage(
        "❌ Upload failed: " +
          error.message
      );
    }
  }

  function formatTime(seconds) {
    const minutes = Math.floor(
      seconds / 60
    );

    const remainingSeconds =
      seconds % 60;

    return `${String(minutes).padStart(
      2,
      "0"
    )}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  }

  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "40px auto",
        padding: "30px",
        fontFamily: "Arial",
        textAlign: "center",
      }}
    >
      <h1>
        🎤 Voice Security Enrollment
      </h1>

      <p>
        Record and securely store a voice
        enrollment sample.
      </p>

      <hr />

      <h2>👤 User Details</h2>

      <div>
        <input
          type="text"
          placeholder="Name"
          value={name}
          disabled={isRecording}
          onChange={(e) =>
            setName(e.target.value)
          }
          style={{
            padding: "12px",
            margin: "8px",
            width: "220px",
          }}
        />

        <input
          type="text"
          placeholder="User ID"
          value={userId}
          disabled={isRecording}
          onChange={(e) =>
            setUserId(e.target.value)
          }
          style={{
            padding: "12px",
            margin: "8px",
            width: "220px",
          }}
        />
      </div>

      <br />

      {isRecording ? (
        <button
          onClick={stopRecording}
          style={{
            padding: "15px 30px",
            fontSize: "17px",
            cursor: "pointer",
          }}
        >
          ⏹ STOP RECORDING
        </button>
      ) : (
        <button
          onClick={startRecording}
          style={{
            padding: "15px 30px",
            fontSize: "17px",
            cursor: "pointer",
          }}
        >
          🎤 START RECORDING
        </button>
      )}

      <h2>{message}</h2>

      {isRecording && (
        <div>
          <h2>
            🔴 LIVE RECORDING
          </h2>

          <div
            style={{
              fontSize: "32px",
              fontWeight: "bold",
            }}
          >
            {formatTime(
              recordingSeconds
            )}
          </div>

          <p>
            Recording is currently in
            progress...
          </p>
        </div>
      )}

      {recordingTime && (
        <div>
          <hr />

          <h2>
            🕒 Recording Date & Time
          </h2>

          <p>
            {recordingTime}
          </p>
        </div>
      )}

      {audioUrl && (
        <div>
          <hr />

          <h2>
            🎧 Saved Recording
          </h2>

          <audio
            controls
            preload="metadata"
            src={audioUrl}
            style={{
              width: "90%",
              maxWidth: "600px",
            }}
          />

          <p>
            <b>
              Duration:
            </b>{" "}
            {formatTime(
              recordingSeconds
            )}
          </p>

          {savedFile && (
            <div>
              <p>
                <b>
                  Project storage:
                </b>
              </p>

              <code>
                voice-security-backend/uploads/
                <br />
                {savedFile}
              </code>
            </div>
          )}
        </div>
      )}

      <hr />

      <h2>
        📁 Shared Project Storage
      </h2>

      <p>
        Recordings are stored by the backend
        in:
      </p>

      <code>
        voice-security-backend/uploads/
      </code>

      <p>
        Other team members can use the
        backend API to access the recordings.
      </p>
    </div>
  );
}

export default VoiceRecorder;