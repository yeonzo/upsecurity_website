import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { buildSesRequest, createHandler } from '../lambda/lead.mjs';

const originalSender = process.env.SENDER_EMAIL;
afterEach(() => {
  mock.restoreAll();
  if (originalSender === undefined) delete process.env.SENDER_EMAIL;
  else process.env.SENDER_EMAIL = originalSender;
});

function event(body, overrides = {}) {
  return {
    requestContext: { http: { method: 'POST' } },
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
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
  const result = await createHandler(send)(event(validBeta()));
  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(result.body), { ok: true });
  assert.equal(send.mock.calls.length, 1);
});

test('SES 수신처는 지정된 Gmail이고 본문은 UTF-8 일반 텍스트다', () => {
  const request = buildSesRequest({ from: 'hello@example.com', subject: '베타 접수', text: '이름: 김민수', replyTo: '' });
  assert.deepEqual(request.Destination.ToAddresses, ['subw04@gmail.com']);
  assert.equal(request.Content.Simple.Body.Text.Charset, 'UTF-8');
  assert.equal(request.Content.Simple.Body.Text.Data, '이름: 김민수');
});

test('도입 문의는 내용과 답장 주소를 전달한다', async () => {
  process.env.SENDER_EMAIL = 'hello@example.com';
  const send = mock.fn(async (mail) => {
    assert.match(mail.text, /Acme/);
    assert.match(mail.text, /데모 요청/);
    assert.equal(mail.replyTo, 'minsu@example.com');
    return 'ses-message-id';
  });
  const result = await createHandler(send)(event({
    kind: 'contact', company: 'Acme', name: '김민수', email: 'minsu@example.com',
    message: '데모 요청', agree: true, website: '',
  }));
  assert.equal(result.statusCode, 200);
});

test('동의가 없거나 연락처가 잘못되면 SES를 호출하지 않는다', async () => {
  process.env.SENDER_EMAIL = 'hello@example.com';
  const send = mock.fn(async () => { throw new Error('should not send'); });
  const handle = createHandler(send);
  assert.equal((await handle(event({ ...validBeta(), agree: false }))).statusCode, 400);
  assert.equal((await handle(event({ ...validBeta(), contact: 'abc' }))).statusCode, 400);
  assert.equal(send.mock.calls.length, 0);
});

test('발신 주소가 설정되지 않았으면 접수 성공으로 표시하지 않는다', async () => {
  delete process.env.SENDER_EMAIL;
  const result = await createHandler()(event(validBeta()));
  assert.equal(result.statusCode, 503);
  assert.equal(JSON.parse(result.body).ok, undefined);
});

test('SES 실패 또는 메시지 ID 누락 시 접수 실패를 반환한다', async () => {
  process.env.SENDER_EMAIL = 'hello@example.com';
  mock.method(console, 'error', () => {});
  const failed = await createHandler(async () => { throw new Error('SES down'); })(event(validBeta()));
  const missingId = await createHandler(async () => undefined)(event(validBeta()));
  assert.equal(failed.statusCode, 502);
  assert.equal(missingId.statusCode, 502);
});

test('허니팟, 대용량, 잘못된 형식을 거절한다', async () => {
  process.env.SENDER_EMAIL = 'hello@example.com';
  const handle = createHandler(async () => 'should-not-send');
  assert.equal((await handle(event({ ...validBeta(), website: 'spam.example' }))).statusCode, 400);
  assert.equal((await handle(event({ ...validBeta(), extra: 'x'.repeat(9000) }))).statusCode, 413);
  assert.equal((await handle(event(validBeta(), { headers: { 'content-type': 'text/plain' } }))).statusCode, 415);
});

test('API Gateway 2.0 base64 본문도 처리한다', async () => {
  process.env.SENDER_EMAIL = 'hello@example.com';
  const handle = createHandler(async () => 'ses-message-id');
  const payload = JSON.stringify(validBeta());
  const result = await handle(event(validBeta(), { body: Buffer.from(payload).toString('base64'), isBase64Encoded: true }));
  assert.equal(result.statusCode, 200);
});
