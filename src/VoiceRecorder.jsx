import { useEffect, useRef, useState } from "react";

function VoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState("");

  const streamRef = useRef(null);

  const startRecording = async () => {
    try {
      setError("");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      streamRef.current = stream;

      setIsRecording(true);
      setStatus("Recording");
    } catch (err) {
      console.error(err);

      setIsRecording(false);
      setStatus("Error");
      setError(
        "Microphone permission was denied or microphone is unavailable."
      );
    }
  };

  const stopRecording = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      streamRef.current = null;
    }

    setIsRecording(false);
    setStatus("Ready");
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, []);

  return (
    <div className="voice-container">

      <h1>Voice Security</h1>

      <div className="microphone-icon">
        🎙️
      </div>

      <p>
        Microphone Status:{" "}
        <strong>
          {isRecording ? "🔴 Recording" : "🟢 Ready"}
        </strong>
      </p>

      <p>
        System Status: <strong>{status}</strong>
      </p>

      {error && (
        <p className="error">
          {error}
        </p>
      )}

      {!isRecording ? (
        <button onClick={startRecording}>
          START RECORDING
        </button>
      ) : (
        <button onClick={stopRecording}>
          STOP RECORDING
        </button>
      )}

    </div>
  );
}

export default VoiceRecorder;