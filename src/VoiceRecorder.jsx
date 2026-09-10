import { useEffect, useRef, useState } from "react";

function VoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState("");

  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    try {
      setError("");
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        await sendAudioToBackend(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStatus("Recording...");
    } catch (err) {
      console.error(err);
      setIsRecording(false);
      setStatus("Error");
      setError("Microphone permission was denied or microphone is unavailable.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    setStatus("Processing Audio...");
  };

  const sendAudioToBackend = async (audioBlob) => {
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "call_sample.wav");

      // Backend port 5000 par audio file upload route
      const response = await fetch("http://localhost:5000/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const result = await response.json();
      setStatus("Done! Alert Generated");
      console.log("Analysis Result:", result);
    } catch (err) {
      console.error("Upload error:", err);
      setStatus("Failed to send audio");
      setError("Failed to upload audio to backend.");
    }
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="voice-container">
      <h1>Voice Security</h1>
      <div className="microphone-icon">🎙️</div>
      <p>
        Microphone Status:{" "}
        <strong>{isRecording ? "🔴 Recording" : "🟢 Ready"}</strong>
      </p>
      <p>
        System Status: <strong>{status}</strong>
      </p>
      {error && <p className="error" style={{ color: "red" }}>{error}</p>}

      {!isRecording ? (
        <button onClick={startRecording} style={{ padding: "10px 20px", cursor: "pointer" }}>
          START RECORDING
        </button>
      ) : (
        <button onClick={stopRecording} style={{ padding: "10px 20px", cursor: "pointer", background: "red", color: "white" }}>
          STOP RECORDING
        </button>
      )}
    </div>
  );
}

export default VoiceRecorder;