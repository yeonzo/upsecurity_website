import { processLead, MAX_BODY_BYTES } from '../lib/lead.js';

// Vercel may parse the JSON body for us; otherwise read the stream and stop
// early once the request is larger than the service accepts.
async function readRawBody(req) {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  const rawBody = await readRawBody(req);
  if (rawBody === null) {
    res.status(413).send(JSON.stringify({ error: '입력 내용이 너무 깁니다' }));
    return;
  }

  const { statusCode, body } = await processLead({
    method: req.method,
    contentType: req.headers['content-type'] || '',
    rawBody,
  });
  res.status(statusCode).send(JSON.stringify(body));
}
