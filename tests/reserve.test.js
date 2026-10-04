import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createReserveService } from '../lib/reserve.js';

afterEach(() => mock.restoreAll());

function request(body, overrides = {}) {
  return { method: 'POST', rawBody: JSON.stringify(body), ...overrides };
}

function company() {
  return {
    type: 'company', company: 'Acme', department: '보안팀', name: '김민수',
    contact: 'minsu@acme.com', concern: '사내 기밀이 걱정돼요', agree: true, website: '', src: 'booth',
  };
}

function personal() {
  return { type: 'personal', name: '이지은', contact: '010-1234-5678', concern: '', agree: true, website: '' };
}

test('기업 사전예약은 정리된 항목을 Apps Script에 reserve로 전달한다', async () => {
  const save = mock.fn(async (payload) => {
    assert.deepEqual(payload, {
      action: 'reserve', type: 'company', company: 'Acme', department: '보안팀', name: '김민수',
      contact: 'minsu@acme.com', concern: '사내 기밀이 걱정돼요', source: 'booth',
    });
    return { ok: true };
  });
  const result = await createReserveService(save)(request(company()));
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, { ok: true });
});

test('개인 사전예약은 기업명·부서를 비워서 보낸다', async () => {
  const save = mock.fn(async (payload) => {
    assert.equal(payload.company, '');
    assert.equal(payload.department, '');
    assert.equal(payload.contact, '010-1234-5678');
    return { ok: true };
  });
  const result = await createReserveService(save)(request({ ...personal(), company: '무시됨' }));
  assert.equal(result.statusCode, 200);
  assert.equal(save.mock.calls.length, 1);
});

test('필수 항목·동의·형식이 맞지 않으면 Apps Script를 호출하지 않는다', async () => {
  const save = mock.fn(async () => { throw new Error('should not call'); });
  const handle = createReserveService(save);
  assert.equal((await handle(request({ ...company(), company: '' }))).statusCode, 400);
  assert.equal((await handle(request({ ...company(), agree: false }))).statusCode, 400);
  assert.equal((await handle(request({ ...personal(), name: ' ' }))).statusCode, 400);
  assert.equal((await handle(request({ ...personal(), contact: 'abc' }))).statusCode, 400);
  assert.equal((await handle(request({ ...personal(), type: 'other' }))).statusCode, 400);
  assert.equal((await handle(request({ ...personal(), concern: '가'.repeat(1001) }))).statusCode, 400);
  assert.equal((await handle(request({ ...personal(), website: 'spam' }))).statusCode, 400);
  assert.equal((await handle(request({}, { rawBody: '{' }))).statusCode, 400);
  assert.equal((await handle(request(personal(), { method: 'GET' }))).statusCode, 405);
  assert.equal(save.mock.calls.length, 0);
});

test('유입 경로는 영문·숫자 코드만 남긴다', async () => {
  const save = mock.fn(async (payload) => { assert.equal(payload.source, ''); return { ok: true }; });
  await createReserveService(save)(request({ ...personal(), src: '<script>' }));
  assert.equal(save.mock.calls.length, 1);
});

test('Apps Script 오류나 실패 응답이면 접수 실패를 반환한다', async () => {
  mock.method(console, 'error', () => {});
  const down = createReserveService(async () => { throw new Error('down'); });
  assert.equal((await down(request(personal()))).statusCode, 502);
  const refused = createReserveService(async () => ({ ok: false }));
  assert.equal((await refused(request(personal()))).statusCode, 502);
});
