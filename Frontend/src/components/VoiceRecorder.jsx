import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Real microphone recorder.
 *
 * The browser records using MediaRecorder, then converts the captured audio
 * to a PCM WAV Blob before handing it to the parent. The SIH-2026 backend
 * saves uploads using the supplied filename and its ML stack expects a
 * normal audio file, so sending .wav avoids browser-specific WebM/OGG
 * decoding issues in librosa/soundfile.
 */
export default function VoiceRecorder({ onRecordingReady, disabled = false }) {
  const [permission, setPermission] = useState('unknown');
  const [status, setStatus] = useState('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState(null);

  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const canvasRef = useRef(null);
  const startTimeRef = useRef(0);
  const timerRef = useRef(null);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      analyser.getByteTimeDomainData(dataArray);
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = '#39ff6a';
      ctx.lineWidth = 2;
      ctx.beginPath();

      const sliceWidth = w / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i += 1) {
        const v = dataArray[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      rafRef.current = requestAnimationFrame(render);
    };

    render();
  }, []);

  const cleanupAudioGraph = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupAudioGraph();
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl, cleanupAudioGraph, stopStream]);

  const encodeWav = (audioBuffer) => {
    const channelCount = Math.min(audioBuffer.numberOfChannels, 2);
    const frameCount = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    const bytesPerSample = 2;
    const blockAlign = channelCount * bytesPerSample;
    const dataSize = frameCount * blockAlign;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset, value) => {
      for (let i = 0; i < value.length; i += 1) {
        view.setUint8(offset + i, value.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, channelCount, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    const channels = [];
    for (let channel = 0; channel < channelCount; channel += 1) {
      channels.push(audioBuffer.getChannelData(channel));
    }

    let offset = 44;
    for (let i = 0; i < frameCount; i += 1) {
      for (let channel = 0; channel < channelCount; channel += 1) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        view.setInt16(
          offset,
          sample < 0 ? sample * 0x8000 : sample * 0x7fff,
          true
        );
        offset += 2;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  };

  const convertToWav = async (blob) => {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      throw new Error('Web Audio API is unavailable in this browser.');
    }

    const arrayBuffer = await blob.arrayBuffer();
    const decodeContext = new AudioContextCtor();
    try {
      const audioBuffer = await decodeContext.decodeAudioData(arrayBuffer);
      return encodeWav(audioBuffer);
    } finally {
      decodeContext.close().catch(() => {});
    }
  };

  const startRecording = async () => {
    setError(null);

    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    onRecordingReady?.(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setPermission('unavailable');
      setError('This browser does not expose microphone access.');
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermission('denied');
        setError('Microphone permission denied. Allow microphone access and try again.');
      } else if (err.name === 'NotFoundError') {
        setPermission('unavailable');
        setError('No microphone was found on this device.');
      } else {
        setPermission('unavailable');
        setError(`Could not access microphone: ${err.message}`);
      }
      return;
    }

    setPermission('granted');
    streamRef.current = stream;

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContextCtor();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    audioCtxRef.current = audioCtx;
    analyserRef.current = analyser;
    drawWaveform();

    let mimeType = '';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mimeType = 'audio/webm;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/webm')) {
      mimeType = 'audio/webm';
    } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
      mimeType = 'audio/ogg;codecs=opus';
    }

    let recorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch {
      cleanupAudioGraph();
      stopStream();
      setError('This browser cannot create an audio recorder.');
      return;
    }

    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data?.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onerror = () => {
      setError('The browser stopped recording because of an audio capture error.');
    };

    recorder.onstop = async () => {
      try {
        const captured = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });

        if (!captured.size) throw new Error('No audio was captured.');

        const wavBlob = await convertToWav(captured);
        const url = URL.createObjectURL(wavBlob);
        setAudioUrl(url);
        setStatus('stopped');
        onRecordingReady?.(wavBlob);
      } catch (err) {
        setStatus('idle');
        setError(`Could not prepare the recording for the backend: ${err.message}`);
        onRecordingReady?.(null);
      } finally {
        cleanupAudioGraph();
        stopStream();
      }
    };

    mediaRecorderRef.current = recorder;
    recorder.start(250);
    startTimeRef.current = Date.now();
    setElapsedMs(0);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 100);

    setStatus('recording');
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
  };

  const reRecord = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setStatus('idle');
    setElapsedMs(0);
    setError(null);
    onRecordingReady?.(null);
  };

  const formatDuration = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    const cs = Math.floor((ms % 1000) / 10).toString().padStart(2, '0');
    return `${m}:${s}.${cs}`;
  };

  return (
    <div className="voice-recorder">
      <canvas
        ref={canvasRef}
        width={520}
        height={90}
        className="voice-recorder__canvas"
      />

      <div className="voice-recorder__meta">
        <span className={`vr-dot vr-dot--${status === 'recording' ? 'live' : 'idle'}`} />
        <span className="voice-recorder__timer">{formatDuration(elapsedMs)}</span>
        <span className="voice-recorder__state">
          {status === 'recording'
            ? 'REC · MIC LIVE'
            : status === 'stopped'
              ? 'CAPTURED · WAV READY'
              : 'STANDBY'}
        </span>
      </div>

      {error && <div className="voice-recorder__error">{error}</div>}

      <div className="voice-recorder__controls">
        {status !== 'recording' && (
          <button className="btn btn--primary" onClick={startRecording} disabled={disabled}>
            {status === 'stopped' ? 'RE-RECORD' : 'START RECORDING'}
          </button>
        )}

        {status === 'recording' && (
          <button className="btn btn--danger" onClick={stopRecording}>
            STOP
          </button>
        )}

        {status === 'stopped' && audioUrl && (
          <>
            <audio className="voice-recorder__player" controls src={audioUrl} />
            <button className="btn btn--ghost" onClick={reRecord} disabled={disabled}>
              DISCARD
            </button>
          </>
        )}
      </div>

      <div className="voice-recorder__permission">
        MIC ACCESS:{' '}
        <span
          className={`tag tag--${
            permission === 'granted'
              ? 'ok'
              : permission === 'unknown'
                ? 'idle'
                : 'bad'
          }`}
        >
          {permission.toUpperCase()}
        </span>
      </div>
    </div>
  );
}
