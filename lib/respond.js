// Records a cold-mail button click ("관심 있어요" / "다음에요") and the optional
// pain-point note from the /thanks popup in the Apps Script sheet. The mail
// buttons open /thanks on this site and the page posts here, so the visitor's
// browser never opens script.google.com. That avoids Google's "파일을 열 수
// 없습니다" screen for people signed in to several Google accounts.
// One Apps Script web app per sending Gmail account. A token lives in exactly
// one sheet, so the other web apps answer { ok: false } and the next is tried.
const DEFAULT_APPS_SCRIPT_URLS = [
  'https://script.google.com/macros/s/AKfycby80yH8-aEIipS3nU15YCxoDcGdgAJKr7Kp0WVJAYTBVbaVxzB9IGLoB1kSanak1-m2/exec',
  'https://script.google.com/macros/s/AKfycbySt5sLcIKe57jZ0fhpWtMe-brI5cYScjgpptJ-tCRhV5AjZ4anhkw6Iwj3DWi2JNj_FA/exec',
];
// Every web app may be asked in turn, so each call gets a share of the
// function's 30s maxDuration (vercel.json).
const CALL_TIMEOUT_MS = 14000;
const MAX_BODY_BYTES = 8192;
const FEEDBACK_MAX = 1000;
const TOKEN = /^[\w-]{1,64}$/;

function result(statusCode, data) {
  return { statusCode, body: data };
}

// APPS_SCRIPT_URL (comma-separated) is tried first, then the defaults.
function appsScriptUrls() {
  const fromEnv = (process.env.APPS_SCRIPT_URL || '').split(',').map((u) => u.trim()).filter(Boolean);
  return [...new Set([...fromEnv, ...DEFAULT_APPS_SCRIPT_URLS])];
}

async function callAppsScript(url, payload) {
  // Apps Script answers a POST with a redirect to the actual output; fetch
  // follows it as a GET, which is what Google expects.
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow',
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Apps Script HTTP ${response.status}`);
  return response.json();
}

// Asks each web app until one finds the token. If none found it but one
// failed, the token may be in that sheet, so the failure is reported.
export function createSheetRecorder(urls = appsScriptUrls(), call = callAppsScript) {
  return async function recordInAnySheet(payload) {
    let failure;
    for (const url of urls) {
      try {
        const r = await call(url, payload);
        if (r && r.ok === true) return r;
      } catch (error) {
        failure = error;
      }
    }
    if (failure) throw failure;
    return { ok: false };
  };
}

// record is injectable so tests never reach Apps Script.
export function createRespondService(record = createSheetRecorder()) {
  return async function processRespond({ method, rawBody = '' }) {
    if (method !== 'POST') return result(405, { ok: false });

    let body;
    try {
      if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) return result(413, { ok: false });
      body = JSON.parse(rawBody);
    } catch {
      return result(400, { ok: false });
    }

    const token = typeof body?.t === 'string' ? body.t : '';
    if (!TOKEN.test(token)) return result(400, { ok: false });

    // { t, text } saves the popup note; { t, a } records the button click.
    let payload;
    if (typeof body.text === 'string') {
      const text = body.text.trim();
      if (!text || text.length > FEEDBACK_MAX) return result(400, { ok: false });
      payload = { action: 'feedback', t: token, text };
    } else {
      const answer = body.a === 'yes' ? 'yes' : body.a === 'no' ? 'no' : '';
      if (!answer) return result(400, { ok: false });
      payload = { action: 'record', t: token, a: answer };
    }

    try {
      const r = await record(payload);
      if (!r || r.ok !== true) return result(404, { ok: false });
      if (payload.action === 'feedback') return result(200, { ok: true });
      return result(200, { ok: true, answer: r.answer === 'yes' ? 'yes' : 'no' });
    } catch (error) {
      console.error('Apps Script record failed:', error?.name || 'unknown');
      return result(502, { ok: false });
    }
  };
}

export const processRespond = createRespondService();
export { MAX_BODY_BYTES };
