// Records a cold-mail button click ("관심 있어요" / "다음에요") in the Apps Script
// sheet. The mail buttons open /thanks on this site and the page posts here, so
// the visitor's browser never opens script.google.com. That avoids Google's
// "파일을 열 수 없습니다" screen for people signed in to several Google accounts.
const DEFAULT_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycby80yH8-aEIipS3nU15YCxoDcGdgAJKr7Kp0WVJAYTBVbaVxzB9IGLoB1kSanak1-m2/exec';
const MAX_BODY_BYTES = 1024;
const TOKEN = /^[\w-]{1,64}$/;
const SURVEY_URL = /^https:\/\/docs\.google\.com\/forms\//;

function result(statusCode, data) {
  return { statusCode, body: data };
}

function appsScriptUrl() {
  return process.env.APPS_SCRIPT_URL || DEFAULT_APPS_SCRIPT_URL;
}

async function callAppsScript(payload) {
  // Apps Script answers a POST with a redirect to the actual output; fetch
  // follows it as a GET, which is what Google expects.
  const response = await fetch(appsScriptUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow',
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`Apps Script HTTP ${response.status}`);
  return response.json();
}

// record is injectable so tests never reach Apps Script.
export function createRespondService(record = callAppsScript) {
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
    const answer = body?.a === 'yes' ? 'yes' : body?.a === 'no' ? 'no' : '';
    if (!TOKEN.test(token) || !answer) return result(400, { ok: false });

    try {
      const r = await record({ action: 'record', t: token, a: answer });
      if (!r || r.ok !== true) return result(404, { ok: false });
      return result(200, {
        ok: true,
        answer: r.answer === 'yes' ? 'yes' : 'no',
        email: typeof r.email === 'string' ? r.email : '',
        formUrl: typeof r.formUrl === 'string' && SURVEY_URL.test(r.formUrl) ? r.formUrl : '',
      });
    } catch (error) {
      console.error('Apps Script record failed:', error?.name || 'unknown');
      return result(502, { ok: false });
    }
  };
}

export const processRespond = createRespondService();
export { MAX_BODY_BYTES };
