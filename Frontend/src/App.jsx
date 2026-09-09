import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import VoiceRecorder from './components/VoiceRecorder.jsx';
import { API_BASE_URL, analyzeCall, checkHealth, enrollVoice } from './lib/api.js';
import './App.css';

const NA = () => <span className="na">N/A</span>;

function clientSessionId() {
  const key = 'voiceguard_client_session_id';
  let id = window.sessionStorage.getItem(key);

  if (!id) {
    id = 'CLIENT-' + Math.random().toString(16).slice(2, 10).toUpperCase();
    window.sessionStorage.setItem(key, id);
  }

  return id;
}

/* -------------------------------------------------------
   MATRIX / TERMINAL BACKGROUND
------------------------------------------------------- */

function MatrixRain() {
  const columns = useMemo(() => {
    const chars =
      '日月火水木金土山川天地人心空雨風光影電龍門零一二三四五六七八九十ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';


    return Array.from({ length: 34 }, (_, i) => {
      const length = 12 + ((i * 17) % 28);

      let text = '';

      for (let j = 0; j < length; j += 1) {
        text += chars[Math.floor(Math.random() * chars.length)];
        if (j !== length - 1) text += '\n';
      }

      return {
        id: i,
        text,
        left: `${(i / 34) * 100 + Math.random() * 2}%`,
        duration: `${8 + Math.random() * 14}s`,
        delay: `${Math.random() * -18}s`,
      };
    });
  }, []);

  return (
    <div className="matrix-rain" aria-hidden="true">
      {columns.map((column) => (
        <span
          key={column.id}
          className="matrix-column"
          style={{
            left: column.left,
            animationDuration: column.duration,
            animationDelay: column.delay,
          }}
        >
          {column.text}
        </span>
      ))}
    </div>
  );
}

/* -------------------------------------------------------
   MAIN APP
------------------------------------------------------- */

export default function App() {
  // ---- page state ----
  // Page 1 = enrollment/setup
  // Page 2 = live analysis dashboard
  const [page, setPage] = useState('enrollment');

  // ---- system / connection state ----
  const [health, setHealth] = useState({
    checked: false,
    ok: false,
    latencyMs: null,
    error: null,
    lastChecked: null,
  });

  const [online, setOnline] = useState(navigator.onLine);

  const sessionId = useMemo(() => clientSessionId(), []);

  // ---- request monitor ----
  const [requestLog, setRequestLog] = useState([]);

  const logRequest = useCallback((entry) => {
    setRequestLog((prev) =>
      [{ ...entry, id: Date.now() + Math.random() }, ...prev].slice(0, 25)
    );
  }, []);

  // ---- enrollment ----
  const [enrollIdentity, setEnrollIdentity] = useState('');
  const [enrollBlob, setEnrollBlob] = useState(null);

  const [enrollState, setEnrollState] = useState({
    loading: false,
    result: null,
    error: null,
  });

  // ---- analysis ----
  const [claimedIdentity, setClaimedIdentity] = useState('');
  const [analyzeBlob, setAnalyzeBlob] = useState(null);

  const [analyzeState, setAnalyzeState] = useState({
    loading: false,
    result: null,
    error: null,
    timestamp: null,
    filename: null,
  });

  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [rawExpanded, setRawExpanded] = useState(false);
  const [copyLabel, setCopyLabel] = useState('COPY JSON');

  // ---- health polling ----
  const pollHealth = useCallback(async () => {
    const res = await checkHealth();

    logRequest({
      method: res.method,
      endpoint: res.endpoint,
      status: res.status,
      requestTimeMs: res.requestTimeMs,
      ok: res.ok,
      timestamp: res.timestamp,
    });

    setHealth({
      checked: true,
      ok: res.ok && res.data?.status === 'ok',
      latencyMs: res.requestTimeMs,
      error: res.ok ? null : res.error,
      lastChecked: new Date().toLocaleTimeString(),
    });
  }, [logRequest]);

  useEffect(() => {
    pollHealth();

    const interval = setInterval(pollHealth, 10000);

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [pollHealth]);

  // ---- enrollment ----
  const handleEnroll = async () => {
    if (!enrollIdentity.trim() || !enrollBlob) return;

    setEnrollState({
      loading: true,
      result: null,
      error: null,
    });

    const res = await enrollVoice(enrollIdentity.trim(), enrollBlob);

    logRequest({
      method: res.method,
      endpoint: res.endpoint,
      status: res.status,
      requestTimeMs: res.requestTimeMs,
      ok: res.ok,
      timestamp: res.timestamp,
    });

    if (res.ok) {
      setEnrollState({
        loading: false,
        result: res.data,
        error: null,
      });

      // Keep the successfully enrolled identity for the live analysis page.
      setClaimedIdentity(enrollIdentity.trim());

      // Move to Page 2 ONLY after the real backend enrollment succeeds.
      setPage('live');
    } else {
      setEnrollState({
        loading: false,
        result: null,
        error: res.error,
      });
    }
  };

  // ---- analysis ----
  const handleAnalyze = async () => {
    if (!claimedIdentity.trim() || !analyzeBlob) return;

    setAnalyzeState({
      loading: true,
      result: null,
      error: null,
      timestamp: null,
      filename: null,
    });

    const startedAt = new Date();

    const res = await analyzeCall(
      claimedIdentity.trim(),
      analyzeBlob
    );

    logRequest({
      method: res.method,
      endpoint: res.endpoint,
      status: res.status,
      requestTimeMs: res.requestTimeMs,
      ok: res.ok,
      timestamp: res.timestamp,
    });

    if (res.ok) {
      setAnalyzeState({
        loading: false,
        result: res.data,
        error: null,
        timestamp: startedAt.toLocaleString(),
        filename: 'call.wav',
      });
    } else {
      setAnalyzeState({
        loading: false,
        result: null,
        error: res.error,
        timestamp: null,
        filename: null,
      });
    }
  };

  const result = analyzeState.result;

  // ---- transcript search ----
  const highlightedTranscript = useMemo(() => {
    if (!result?.transcript) return null;

    if (!transcriptSearch.trim()) {
      return result.transcript;
    }

    const term = transcriptSearch.trim();

    const parts = result.transcript.split(
      new RegExp(
        `(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
        'gi'
      )
    );

    return parts.map((part, i) =>
      part.toLowerCase() === term.toLowerCase() ? (
        <mark key={i}>{part}</mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  }, [result, transcriptSearch]);

  // ---- copy transcript ----
  const copyTranscript = () => {
    if (result?.transcript) {
      navigator.clipboard.writeText(result.transcript);
    }
  };

  // ---- copy raw JSON ----
  const copyRawJson = () => {
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result, null, 2));

      setCopyLabel('COPIED');

      setTimeout(() => {
        setCopyLabel('COPY JSON');
      }, 1500);
    }
  };

  const backendOnline = health.checked && health.ok;

  return (
    <div className="vg">
      <MatrixRain />

      <div className="vg__scanline" />

      {/* =====================================================
          PAGE 1 — ENROLLMENT / SETUP
      ===================================================== */}

      {page === 'enrollment' && (
        <div className="enrollment-page">
          <div className="enrollment-shell">
            <div className="enrollment-brand">
              <span className="enrollment-logo">◈</span>

              <div>
                <h1>VOICEGUARD</h1>
                <p className="vg-header__sub">
                  REAL-TIME VOICE SECURITY &amp; FRAUD DETECTION
                </p>
              </div>
            </div>

            <div className="enrollment-card">
              <div className="panel__title">
                VOICE IDENTITY ENROLLMENT
              </div>

              <div className="enrollment-content">
                <div className="enrollment-intro">
                  <span className="enrollment-prompt">&gt;_</span>

                  <div>
                    <h2>INITIALIZE VOICE PROFILE</h2>

                    <p>
                      Record a clear voice sample to create the speaker
                      identity used for verification during live analysis.
                    </p>
                  </div>
                </div>

                <div className="enrollment-status">
                  <span
                    className={`status-chip__dot status-chip__dot--${
                      backendOnline ? 'ok' : 'bad'
                    }`}
                  />

                  <span>
                    {backendOnline
                      ? 'SECURE BACKEND CONNECTED'
                      : health.checked
                        ? 'WAITING FOR BACKEND'
                        : 'CHECKING BACKEND…'}
                  </span>
                </div>

                <label className="field-label">
                  VOICE IDENTITY
                </label>

                <input
                  className="text-input"
                  placeholder="e.g. CFO"
                  value={enrollIdentity}
                  onChange={(e) =>
                    setEnrollIdentity(e.target.value)
                  }
                  disabled={enrollState.loading}
                  autoComplete="off"
                />

                <div className="enrollment-hint">
                  This identity will be associated with the enrolled
                  speaker voice profile.
                </div>

                <VoiceRecorder
                  onRecordingReady={setEnrollBlob}
                  disabled={enrollState.loading}
                />

                <button
                  className="btn btn--full btn--primary"
                  onClick={handleEnroll}
                  disabled={
                    !enrollIdentity.trim() ||
                    !enrollBlob ||
                    enrollState.loading
                  }
                >
                  {enrollState.loading
                    ? 'ENROLLING VOICE…'
                    : 'INITIALIZE VOICEGUARD'}
                </button>

                {enrollState.error && (
                  <div className="voice-recorder__error">
                    {enrollState.error}
                  </div>
                )}

                {enrollState.result && (
                  <div className="vg-banner vg-banner--ok">
                    <strong>
                      ENROLLMENT{' '}
                      {String(
                        enrollState.result.status || ''
                      ).toUpperCase()}
                    </strong>

                    <span>
                      {enrollState.result.identity}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="enrollment-footer">
              <span>VOICEGUARD · SIH-2026</span>
              <span>SESSION: {sessionId}</span>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          PAGE 2 — LIVE ANALYSIS DASHBOARD
      ===================================================== */}

      {page === 'live' && (
        <>
          {/* ---------------- HEADER ---------------- */}

          <header className="vg-header">
            <div className="vg-header__brand">
              <span className="vg-header__logo">◈</span>

              <div>
                <h1>VOICEGUARD</h1>

                <p className="vg-header__sub">
                  REAL-TIME VOICE SECURITY &amp; FRAUD DETECTION
                </p>
              </div>
            </div>

            <div className="vg-header__status">
              <StatusChip
                label="BACKEND"
                ok={backendOnline}
                okText="ONLINE"
                badText={
                  health.checked
                    ? 'OFFLINE'
                    : 'CHECKING…'
                }
              />

              <StatusChip
                label="API"
                ok={backendOnline}
                okText="ONLINE"
                badText="OFFLINE"
              />

              <StatusChip
                label="NETWORK"
                ok={online}
                okText="CONNECTED"
                badText="DISCONNECTED"
              />

              <div className="vg-header__endpoint">
                {API_BASE_URL}
              </div>
            </div>
          </header>

          {/* ---------------- BACKEND WARNING ---------------- */}

          {health.checked && !backendOnline && (
            <div className="vg-banner vg-banner--error">
              <strong>
                BACKEND CONNECTION FAILED
              </strong>

              <span>
                Unable to reach <code>{API_BASE_URL}</code>
                {health.error
                  ? ` — ${health.error}`
                  : ''}. Check that the FastAPI server is running
                (<code>
                  uvicorn api:app --reload --port 8004
                </code>
                ) and that CORS is configured for this origin.
              </span>
            </div>
          )}

          {/* ---------------- MAIN GRID ---------------- */}

          <main className="vg-grid">
            {/* =================================================
                LEFT COLUMN
            ================================================= */}

            <section className="vg-col vg-col--left">
              <Panel title="CALL / SESSION DETAILS">
                <Row
                  label="CLIENT SESSION ID"
                  value={sessionId}
                  mono
                />

                <Row
                  label="RECORD ID"
                  value={<NA />}
                  note="backend does not return one"
                />

                <Row
                  label="CLAIMED IDENTITY"
                  value={
                    analyzeState.result?.claimed_identity ||
                    <NA />
                  }
                />

                <Row
                  label="TIMESTAMP"
                  value={
                    analyzeState.timestamp || <NA />
                  }
                />

                <Row
                  label="AUDIO FILE"
                  value={
                    analyzeState.filename || <NA />
                  }
                />

                <Row
                  label="PROCESSING STATUS"
                  value={
                    analyzeState.loading
                      ? 'PROCESSING REQUEST…'
                      : analyzeState.result
                        ? 'COMPLETE'
                        : analyzeState.error
                          ? 'FAILED'
                          : 'AWAITING CALL'
                  }
                />
              </Panel>

              <Panel title="IDENTITY VERIFICATION">
                {result ? (
                  <>
                    <Row
                      label="CLAIMED IDENTITY"
                      value={
                        result.claimed_identity ?? <NA />
                      }
                    />

                    <Row
                      label="SPEAKER MATCH"
                      value={
                        typeof result.speaker_match_score ===
                        'number'
                          ? `${result.speaker_match_score}%`
                          : <NA />
                      }
                    />

                    <Row
                      label="IDENTITY"
                      value={
                        <span
                          className={`tag tag--${
                            result.identity_verified
                              ? 'ok'
                              : 'bad'
                          }`}
                        >
                          {result.identity_verified
                            ? 'VERIFIED'
                            : 'NOT VERIFIED'}
                        </span>
                      }
                    />

                    {result.reason && (
                      <Row
                        label="REASON"
                        value={result.reason}
                      />
                    )}
                  </>
                ) : (
                  <EmptyState text="Run ANALYZE CALL to see identity verification results." />
                )}
              </Panel>

              <Panel title="REAL-TIME ANALYSIS">
                <Row
                  label="ANALYSIS STATUS"
                  value={
                    analyzeState.loading
                      ? 'RUNNING'
                      : result
                        ? 'IDLE — LAST RUN COMPLETE'
                        : 'IDLE'
                  }
                />

                <Row
                  label="AUDIO STREAM"
                  value={<NA />}
                  note="backend exposes no stream metric"
                />

                <Row
                  label="SAMPLE RATE"
                  value={<NA />}
                  note="not returned by /analyze"
                />

                <Row
                  label="PROCESSING"
                  value={
                    analyzeState.loading
                      ? 'ACTIVE'
                      : 'STANDBY'
                  }
                />

                <Row
                  label="CONFIDENCE"
                  value={
                    typeof result?.speaker_match_score ===
                    'number'
                      ? `${result.speaker_match_score}%`
                      : <NA />
                  }
                  note="mapped from speaker_match_score"
                />
              </Panel>
            </section>

            {/* =================================================
                CENTER COLUMN
            ================================================= */}

            <section className="vg-col vg-col--center">
              <Panel
                title="LIVE CALL — ANALYZE"
                accent
              >
                <label className="field-label">
                  CLAIMED IDENTITY
                </label>

                <input
                  className="text-input"
                  placeholder="e.g. CFO"
                  value={claimedIdentity}
                  onChange={(e) =>
                    setClaimedIdentity(e.target.value)
                  }
                  disabled={analyzeState.loading}
                />

                <VoiceRecorder
                  onRecordingReady={setAnalyzeBlob}
                  disabled={analyzeState.loading}
                />

                <button
                  className="btn btn--full btn--primary"
                  onClick={handleAnalyze}
                  disabled={
                    !claimedIdentity.trim() ||
                    !analyzeBlob ||
                    analyzeState.loading
                  }
                >
                  {analyzeState.loading
                    ? 'ANALYZING…'
                    : 'ANALYZE CALL'}
                </button>

                {analyzeState.error && (
                  <div className="voice-recorder__error">
                    {analyzeState.error}
                  </div>
                )}
              </Panel>

              <Panel title="VOICE ENROLLMENT">
                <div className="vg-note">
                  Current enrolled identity:{' '}
                  <strong>
                    {enrollIdentity || claimedIdentity || <NA />}
                  </strong>
                </div>

                <div className="enrollment-actions">
                  <button
                    className="btn btn--full btn--ghost"
                    onClick={() => {
                      setAnalyzeBlob(null);
                      setAnalyzeState({
                        loading: false,
                        result: null,
                        error: null,
                        timestamp: null,
                        filename: null,
                      });
                      setPage('enrollment');
                    }}
                    disabled={analyzeState.loading}
                  >
                    RE-ENROLL VOICE
                  </button>
                </div>
              </Panel>
            </section>

            {/* =================================================
                RIGHT COLUMN
            ================================================= */}

            <section className="vg-col vg-col--right">
              <Panel title="SYSTEM CONNECTION">
                <Row
                  label="CONNECTION"
                  value={
                    <span
                      className={`tag tag--${
                        backendOnline ? 'ok' : 'bad'
                      }`}
                    >
                      {backendOnline
                        ? 'SECURE'
                        : 'OFFLINE'}
                    </span>
                  }
                />

                <Row
                  label="NETWORK"
                  value={
                    <span
                      className={`tag tag--${
                        online ? 'ok' : 'bad'
                      }`}
                    >
                      {online
                        ? 'CONNECTED'
                        : 'DISCONNECTED'}
                    </span>
                  }
                />

                <Row
                  label="LATENCY"
                  value={
                    health.latencyMs != null
                      ? `${health.latencyMs}ms`
                      : <NA />
                  }
                />

                <Row
                  label="API"
                  value={
                    <span
                      className={`tag tag--${
                        backendOnline ? 'ok' : 'bad'
                      }`}
                    >
                      {backendOnline
                        ? 'ONLINE'
                        : 'OFFLINE'}
                    </span>
                  }
                />

                <Row
                  label="LAST CHECK"
                  value={
                    health.lastChecked || <NA />
                  }
                />
              </Panel>

              <Panel title="CONVERSATION RISK">
                {result ? (
                  <>
                    <Row
                      label="RISK SCORE"
                      value={
                        typeof result.conversation_risk_score ===
                        'number'
                          ? result.conversation_risk_score
                          : <NA />
                      }
                      note="0–100, rule-based scorer"
                    />

                    {result.risk_flags &&
                    result.risk_flags.length > 0 ? (
                      <div className="flag-list">
                        {result.risk_flags.map((flag) => (
                          <div
                            key={flag}
                            className="flag-item"
                          >
                            <span className="tag tag--warn">
                              {flag
                                .replaceAll('_', ' ')
                                .toUpperCase()}
                            </span>

                            {result.matched_phrases?.[
                              flag
                            ] && (
                              <span className="flag-phrase">
                                “
                                {
                                  result.matched_phrases[
                                    flag
                                  ]
                                }
                                ”
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        className="tag tag--ok"
                        style={{ marginTop: 8 }}
                      >
                        NO RISK FLAGS DETECTED
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyState text="Run ANALYZE CALL to see conversation risk results." />
                )}
              </Panel>

              <Panel title="SECURITY STATUS">
                <Row
                  label="VOICE IDENTITY"
                  value={
                    <span className="tag tag--ok">
                      ENROLLED
                    </span>
                  }
                />

                <Row
                  label="LIVE ANALYSIS"
                  value={
                    <span
                      className={`tag tag--${
                        analyzeState.loading
                          ? 'warn'
                          : 'idle'
                      }`}
                    >
                      {analyzeState.loading
                        ? 'PROCESSING'
                        : 'READY'}
                    </span>
                  }
                />

                <Row
                  label="LAST RESULT"
                  value={
                    result ? 'AVAILABLE' : 'NONE'
                  }
                />
              </Panel>
            </section>
          </main>

          {/* =================================================
              LOWER AREA
          ================================================= */}

          <section className="vg-lower">
            <Panel title="FULL TRANSCRIPT">
              {result?.transcript ? (
                <>
                  <div className="transcript-toolbar">
                    <input
                      className="text-input text-input--sm"
                      placeholder="Search transcript…"
                      value={transcriptSearch}
                      onChange={(e) =>
                        setTranscriptSearch(e.target.value)
                      }
                    />

                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={copyTranscript}
                    >
                      COPY TRANSCRIPT
                    </button>
                  </div>

                  <div className="transcript-body">
                    {highlightedTranscript}
                  </div>
                </>
              ) : (
                <EmptyState text="Transcript will appear here after ANALYZE CALL returns a result." />
              )}
            </Panel>

            <Panel title="RAW API RESPONSE">
              {result ? (
                <>
                  <div className="transcript-toolbar">
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() =>
                        setRawExpanded((v) => !v)
                      }
                    >
                      {rawExpanded
                        ? 'COLLAPSE'
                        : 'EXPAND'}
                    </button>

                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={copyRawJson}
                    >
                      {copyLabel}
                    </button>
                  </div>

                  {rawExpanded && (
                    <pre className="raw-json">
                      {JSON.stringify(
                        result,
                        null,
                        2
                      )}
                    </pre>
                  )}
                </>
              ) : (
                <EmptyState text="Raw backend JSON will appear here after a successful /analyze call." />
              )}
            </Panel>

            <Panel title="API REQUEST MONITOR">
              {requestLog.length === 0 ? (
                <EmptyState text="No requests sent yet." />
              ) : (
                <table className="req-table">
                  <thead>
                    <tr>
                      <th>METHOD</th>
                      <th>ENDPOINT</th>
                      <th>STATUS</th>
                      <th>TIME</th>
                    </tr>
                  </thead>

                  <tbody>
                    {requestLog.map((r) => (
                      <tr key={r.id}>
                        <td>{r.method}</td>

                        <td>{r.endpoint}</td>

                        <td
                          className={
                            r.ok
                              ? 'req-ok'
                              : 'req-bad'
                          }
                        >
                          {r.status || 'ERR'}
                        </td>

                        <td>
                          {(
                            r.requestTimeMs / 1000
                          ).toFixed(2)}
                          s
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </section>

          <footer className="vg-footer">
            VOICEGUARD · SIH-2026 · SOURCE OF TRUTH:{' '}
            {API_BASE_URL}
          </footer>
        </>
      )}
    </div>
  );
}

/* =========================================================
   PRESENTATIONAL COMPONENTS
========================================================= */

function Panel({ title, children, accent }) {
  return (
    <div
      className={`panel ${
        accent ? 'panel--accent' : ''
      }`}
    >
      <div className="panel__title">
        {title}
      </div>

      <div className="panel__body">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, note, mono }) {
  return (
    <div className="row">
      <span className="row__label">
        {label}
      </span>

      <span
        className={`row__value ${
          mono ? 'mono' : ''
        }`}
      >
        {value}
      </span>

      {note && (
        <span className="row__note">
          {note}
        </span>
      )}
    </div>
  );
}

function StatusChip({
  label,
  ok,
  okText,
  badText,
}) {
  return (
    <div className="status-chip">
      <span
        className={`status-chip__dot status-chip__dot--${
          ok ? 'ok' : 'bad'
        }`}
      />

      <span className="status-chip__label">
        {label}
      </span>

      <span className="status-chip__value">
        {ok ? okText : badText}
      </span>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="empty-state">
      {text}
    </div>
  );
}