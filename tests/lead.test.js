import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { buildSesRequest, createLeadService } from '../lib/lead.js';
import handler from '../api/lead.js';

const originalSender = process.env.SENDER_EMAIL;
afterEach(() => {
  mock.restoreAll();
  if (originalSender === undefined) delete process.env.SENDER_EMAIL;
  else process.env.SENDER_EMAIL = originalSender;
});

function request(body, overrides = {}) {
  return {
    method: 'POST',
    contentType: 'application/json',
    rawBody: JSON.stringify(body),
    ...overrides,
  };
}

function validBeta() {
  return { kind: 'beta', name: '김민수', contact: '010-1234-5678', agree: true, website: '' };
}

test('베타 접수는 SES가 메일 ID를 반환한 뒤에만 성공한다', async () => {
  process.env.SENDER_EMAIL = 'hello@example.com';
  const send = mock.fn(async (mail) => {
    assert.equal(mail.from, 'hello@example.com');
    assert.match(mail.subject, /베타 사전예약/);
    assert.match(mail.text, /010-1234-5678/);
    return 'ses-message-id';
  });
  const result = await createLeadService(send)(request(validBeta()));
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, { ok: true });
  assert.equal(send.mock.calls.length, 1);
});

test('SES 수신처는 지정된 Gmail이고 본문은 UTF-8 일반 텍스트다', () => {
  const sesRequest = buildSesRequest({ from: 'hello@example.com', subject: '베타 접수', text: '이름: 김민수', replyTo: '' });
  assert.deepEqual(sesRequest.Destination.ToAddresses, ['subw04@gmail.com']);
  assert.equal(sesRequest.Content.Simple.Body.Text.Charset, 'UTF-8');
  assert.equal(sesRequest.Content.Simple.Body.Text.Data, '이름: 김민수');
});

test('도입 문의는 내용과 답장 주소를 전달한다', async () => {
  process.env.SENDER_EMAIL = 'hello@example.com';
  const send = mock.fn(async (mail) => {
    assert.match(mail.text, /Acme/);
    assert.match(mail.text, /데모 요청/);
    assert.equal(mail.replyTo, 'minsu@example.com');
    return 'ses-message-id';
  });
  const result = await createLeadService(send)(request({
    kind: 'contact', company: 'Acme', name: '김민수', email: 'minsu@example.com',
    message: '데모 요청', agree: true, website: '',
  }));
  assert.equal(result.statusCode, 200);
});

test('동의가 없거나 연락처가 잘못되면 SES를 호출하지 않는다', async () => {
  process.env.SENDER_EMAIL = 'hello@example.com';
  const send = mock.fn(async () => { throw new Error('should not send'); });
  const handle = createLeadService(send);
  assert.equal((await handle(request({ ...validBeta(), agree: false }))).statusCode, 400);
  assert.equal((await handle(request({ ...validBeta(), contact: 'abc' }))).statusCode, 400);
  assert.equal(send.mock.calls.length, 0);
});

test('발신 주소가 설정되지 않았으면 접수 성공으로 표시하지 않는다', async () => {
  delete process.env.SENDER_EMAIL;
  const result = await createLeadService()(request(validBeta()));
  assert.equal(result.statusCode, 503);
  assert.equal(result.body.ok, undefined);
});

test('SES 실패 또는 메시지 ID 누락 시 접수 실패를 반환한다', async () => {
  process.env.SENDER_EMAIL = 'hello@example.com';
  mock.method(console, 'error', () => {});
  const failed = await createLeadService(async () => { throw new Error('SES down'); })(request(validBeta()));
  const missingId = await createLeadService(async () => undefined)(request(validBeta()));
  assert.equal(failed.statusCode, 502);
  assert.equal(missingId.statusCode, 502);
});

test('허니팟, 대용량, 잘못된 형식, GET을 거절한다', async () => {
  process.env.SENDER_EMAIL = 'hello@example.com';
  const handle = createLeadService(async () => 'should-not-send');
  assert.equal((await handle(request({ ...validBeta(), website: 'spam.example' }))).statusCode, 400);
  assert.equal((await handle(request({ ...validBeta(), extra: 'x'.repeat(9000) }))).statusCode, 413);
  assert.equal((await handle(request(validBeta(), { contentType: 'text/plain' }))).statusCode, 415);
  assert.equal((await handle(request(validBeta(), { method: 'GET' }))).statusCode, 405);
});

// Vercel function wrapper: only paths that never reach SES.
function vercelPair({ method = 'POST', headers = { 'content-type': 'application/json' }, chunks = [] } = {}) {
  const req = Object.assign(Readable.from(chunks), { method, headers });
  const sent = {};
  const res = {
    setHeader(name, value) { sent[name.toLowerCase()] = value; },
    status(code) { sent.statusCode = code; return res; },
    send(payload) { sent.payload = payload; return res; },
  };
  return { req, res, sent };
}

test('Vercel 핸들러는 본문 스트림이 한도를 넘으면 바로 413을 반환한다', async () => {
  const { req, res, sent } = vercelPair({ chunks: [Buffer.alloc(9000, 0x61)] });
  await handler(req, res);
  assert.equal(sent.statusCode, 413);
  assert.equal(sent['cache-control'], 'no-store');
  assert.match(sent['content-type'], /application\/json/);
});

test('Vercel 핸들러는 JSON이 아닌 요청을 415로 막는다', async () => {
  const { req, res, sent } = vercelPair({ headers: { 'content-type': 'text/plain' }, chunks: [Buffer.from('hi')] });
  await handler(req, res);
  assert.equal(sent.statusCode, 415);
  assert.equal(JSON.parse(sent.payload).error, '잘못된 요청 형식입니다');
});
