import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRespondService, createSheetRecorder } from '../lib/respond.js';

afterEach(() => mock.restoreAll());

function request(body, overrides = {}) {
  return { method: 'POST', rawBody: JSON.stringify(body), ...overrides };
}

test('토큰과 응답을 Apps Script에 전달하고 결과를 돌려준다', async () => {
  const record = mock.fn(async (payload) => {
    assert.deepEqual(payload, { action: 'record', t: 'abc-123', a: 'yes' });
    return { ok: true, answer: 'yes' };
  });
  const result = await createRespondService(record)(request({ t: 'abc-123', a: 'yes' }));
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, { ok: true, answer: 'yes' });
  assert.equal(record.mock.calls.length, 1);
});

test('팝업 의견은 앞뒤 공백을 지우고 feedback으로 전달한다', async () => {
  const record = mock.fn(async (payload) => {
    assert.deepEqual(payload, { action: 'feedback', t: 'abc-123', text: '회의록 요약이 번거로워요' });
    return { ok: true };
  });
  const result = await createRespondService(record)(request({ t: 'abc-123', text: '  회의록 요약이 번거로워요\n' }));
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, { ok: true });
});

test('빈 의견이나 너무 긴 의견은 Apps Script를 호출하지 않는다', async () => {
  const record = mock.fn(async () => { throw new Error('should not call'); });
  const handle = createRespondService(record);
  assert.equal((await handle(request({ t: 'abc', text: '   ' }))).statusCode, 400);
  assert.equal((await handle(request({ t: 'abc', text: '가'.repeat(1001) }))).statusCode, 400);
  assert.equal((await handle(request({ t: '', text: '의견' }))).statusCode, 400);
  assert.equal(record.mock.calls.length, 0);
});

test('잘못된 토큰·응답·메서드는 Apps Script를 호출하지 않는다', async () => {
  const record = mock.fn(async () => { throw new Error('should not call'); });
  const handle = createRespondService(record);
  assert.equal((await handle(request({ t: '', a: 'yes' }))).statusCode, 400);
  assert.equal((await handle(request({ t: 'a b', a: 'yes' }))).statusCode, 400);
  assert.equal((await handle(request({ t: 'x'.repeat(65), a: 'yes' }))).statusCode, 400);
  assert.equal((await handle(request({ t: 'abc', a: 'maybe' }))).statusCode, 400);
  assert.equal((await handle(request({}, { rawBody: '{' }))).statusCode, 400);
  assert.equal((await handle(request({}, { rawBody: 'null' }))).statusCode, 400);
  assert.equal((await handle(request({ t: 'abc', a: 'yes' }, { method: 'GET' }))).statusCode, 405);
  assert.equal(record.mock.calls.length, 0);
});

test('시트에 없는 토큰이면 실패로 표시한다', async () => {
  const result = await createRespondService(async () => ({ ok: false }))(request({ t: 'abc', a: 'no' }));
  assert.equal(result.statusCode, 404);
  assert.equal(result.body.ok, false);
});

test('Apps Script 오류 시 실패를 반환한다', async () => {
  mock.method(console, 'error', () => {});
  const result = await createRespondService(async () => { throw new Error('down'); })(request({ t: 'abc', a: 'no' }));
  assert.equal(result.statusCode, 502);
  assert.equal(result.body.ok, false);
});

test('첫 시트에 토큰이 없으면 다음 시트에서 찾아 기록한다', async () => {
  const call = mock.fn(async (url) => (url === 'B' ? { ok: true, answer: 'yes' } : { ok: false }));
  const r = await createSheetRecorder(['A', 'B'], call)({ action: 'record', t: 'abc', a: 'yes' });
  assert.deepEqual(r, { ok: true, answer: 'yes' });
  assert.deepEqual(call.mock.calls.map((c) => c.arguments[0]), ['A', 'B']);
});

test('첫 시트에서 찾으면 다음 시트는 부르지 않는다', async () => {
  const call = mock.fn(async () => ({ ok: true, answer: 'no' }));
  await createSheetRecorder(['A', 'B'], call)({ action: 'record', t: 'abc', a: 'no' });
  assert.equal(call.mock.calls.length, 1);
});

test('어느 시트에도 없으면 ok: false, 한 곳이라도 오류면 오류를 던진다', async () => {
  assert.deepEqual(await createSheetRecorder(['A', 'B'], async () => ({ ok: false }))({}), { ok: false });
  const flaky = async (url) => { if (url === 'A') throw new Error('down'); return { ok: false }; };
  await assert.rejects(createSheetRecorder(['A', 'B'], flaky)({}), /down/);
});
