/**
 * VoiceGuard API client
 * ----------------------
 * Single source of truth for talking to the real FastAPI backend
 * defined in api.py (Member 4's module: speaker + conversation analysis).
 *
 * Real endpoints (verified against api.py / pipeline.py in the repo):
 *   GET  /            -> { service, status }
 *   GET  /health       -> { status: "ok" }
 *   POST /enroll        (multipart/form-data: identity, file) -> { status, identity }
 *   POST /analyze        (multipart/form-data: claimed_identity, file) -> {
 *          claimed_identity, speaker_match_score, identity_verified,
 *          reason?, transcript, conversation_risk_score,
 *          risk_flags[], matched_phrases{}
 *        }
 *
 * There is NO voice-clone-detection, risk-engine level, fraud-prevention
 * message, or audit/blockchain endpoint wired into api.py today. Do not
 * add fields to the parsed result that the backend did not send — the UI
 * layer is responsible for rendering "N/A" when a field is missing, not
 * this client.
 */

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8004').replace(/\/$/, '');

/**
 * Wraps fetch with timing + normalized error handling so every caller
 * (and the API Request Monitor panel) gets the same shape back:
 *   { ok, status, data, error, requestTimeMs, endpoint, method }
 */
async function request(method, path, { formData, timeoutMs = 30000 } = {}) {
  const endpoint = `${API_BASE_URL}${path}`;
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const entry = {
    method,
    endpoint: path,
    fullUrl: endpoint,
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(endpoint, {
      method,
      body: formData || undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const requestTimeMs = Math.round(performance.now() - started);

    let data = null;
    let parseError = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        parseError = 'MALFORMED_RESPONSE';
      }
    }

    if (!res.ok) {
      return {
        ...entry,
        ok: false,
        status: res.status,
        data,
        error:
          data?.detail
            ? typeof data.detail === 'string'
              ? data.detail
              : JSON.stringify(data.detail)
            : `Request failed with status ${res.status}`,
        requestTimeMs,
      };
    }

    if (parseError) {
      return {
        ...entry,
        ok: false,
        status: res.status,
        data: null,
        error: 'Backend returned a response that could not be parsed as JSON.',
        requestTimeMs,
      };
    }

    if (text === '') {
      return {
        ...entry,
        ok: false,
        status: res.status,
        data: null,
        error: 'Backend returned an empty response.',
        requestTimeMs,
      };
    }

    return { ...entry, ok: true, status: res.status, data, error: null, requestTimeMs };
  } catch (err) {
    clearTimeout(timer);
    const requestTimeMs = Math.round(performance.now() - started);
    const isAbort = err.name === 'AbortError';
    return {
      ...entry,
      ok: false,
      status: 0,
      data: null,
      error: isAbort
        ? `Request to ${endpoint} timed out after ${timeoutMs / 1000}s.`
        : `Unable to reach ${endpoint}. Check that the FastAPI server is running.`,
      requestTimeMs,
    };
  }
}

export function checkHealth() {
  return request('GET', '/health');
}

export function checkRoot() {
  return request('GET', '/');
}

export function enrollVoice(identity, audioBlob, filename = 'enrollment.wav') {
  const form = new FormData();
  form.append('identity', identity);
  form.append('file', audioBlob, filename);
  return request('POST', '/enroll', { formData: form, timeoutMs: 60000 });
}

export function analyzeCall(claimedIdentity, audioBlob, filename = 'call.wav') {
  const form = new FormData();
  form.append('claimed_identity', claimedIdentity);
  form.append('file', audioBlob, filename);
  return request('POST', '/analyze', { formData: form, timeoutMs: 60000 });
}
