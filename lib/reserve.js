// Beta pre-registration from the QR landing page (/intro). Validated here and
// stored as a row in a separate Apps Script sheet (festa_opinion, '사전예약' tab)
// instead of sending mail, so it is not limited by any daily email quota.
// This is not the cold-mail Apps Script; paste the festa_opinion web app URL
// (…/exec) here or set RESERVE_SCRIPT_URL in Vercel.
const DEFAULT_RESERVE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzbsyiZEs5tBzbdPUgf4AL9jIQHlN2I2X4xo7nwFDbCOpA0L0AjobYxxIB57UNN2JCe/exec';
const MAX_BODY_BYTES = 8192;
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const SOURCE = /^[\w-]{1,40}$/;

function result(statusCode, data) {
  return { statusCode, body: data };
}

function inline(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/[\r\n\t\u0000-\u001f]/g, ' ').slice(0, maxLength + 1);
}

function validPhone(value) {
  const digits = value.replace(/\D/g, '');
  return /^\+?[\d\s().-]+$/.test(value) && digits.length >= 9 && digits.length <= 15;
}

// Returns the cleaned reservation, or null when a required field is missing or too long.
export function validateReservation(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const type = body.type;
  if (!['company', 'personal'].includes(type) || body.agree !== true) return null;

  const name = inline(body.name, 40);
  const contact = inline(body.contact, 120);
  const concern = typeof body.concern === 'string' ? body.concern.trim() : '';
  if (!name || name.length > 40) return null;
  if (!contact || contact.length > 120 || !(EMAIL.test(contact) || validPhone(contact))) return null;
  if (concern.length > 1000) return null;

  let company = '';
  let department = '';
  if (type === 'company') {
    company = inline(body.company, 80);
    department = inline(body.department, 60);
    if (!company || company.length > 80 || department.length > 60) return null;
  }

  const source = typeof body.src === 'string' && SOURCE.test(body.src) ? body.src : '';
  return { type, company, department, name, contact, concern, source };
}

async function callAppsScript(payload) {
  const url = process.env.RESERVE_SCRIPT_URL || DEFAULT_RESERVE_SCRIPT_URL;
  if (!url) throw Object.assign(new Error('Reserve script URL is not set'), { name: 'NotConfigured' });
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow',
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`Apps Script HTTP ${response.status}`);
  return response.json();
}

// save is injectable so tests never reach Apps Script.
export function createReserveService(save = callAppsScript) {
  return async function processReserve({ method, rawBody = '' }) {
    if (method !== 'POST') return result(405, { ok: false });

    let body;
    try {
      if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) return result(413, { ok: false });
      body = JSON.parse(rawBody);
    } catch {
      return result(400, { ok: false });
    }

    // Hidden field catches basic automated submissions.
    if (body?.website) return result(400, { ok: false });
    const reservation = validateReservation(body);
    if (!reservation) return result(400, { ok: false });

    try {
      const r = await save({ action: 'reserve', ...reservation });
      if (!r || r.ok !== true) return result(502, { ok: false });
      return result(200, { ok: true });
    } catch (error) {
      // Never write submitted personal information to the function logs.
      console.error('Apps Script reserve failed:', error?.name || 'unknown');
      return result(error?.name === 'NotConfigured' ? 503 : 502, { ok: false });
    }
  };
}

export const processReserve = createReserveService();
export { MAX_BODY_BYTES };
