import test from 'node:test';
import assert from 'node:assert/strict';
import { readUtf8BodyLimited, InvalidRequestUtf8Error, RequestBodyTooLargeError } from '../lib/mobile/request-body-limit.ts';

const url = 'https://clear.test.invalid/api/mobile/orgs/tenant/payments';
const jsonReq = (body, headers = {}) => new Request(url, { method: 'POST', body, headers: { 'content-type': 'application/json', ...headers } });

test('JSON body within byte limit and empty body remain readable', async () => {
  assert.equal(await readUtf8BodyLimited(jsonReq('{"a":1}'), 7), '{"a":1}');
  assert.equal(await readUtf8BodyLimited(new Request(url, { method: 'POST' }), 0), '');
  assert.equal(await readUtf8BodyLimited(jsonReq(''), 0), '');
});
test('UTF-8 byte length, not JavaScript character count, enforces the limit', async () => {
  const body = '{"name":"é"}';
  const bytes = new TextEncoder().encode(body).byteLength;
  assert.equal(body.length + 1, bytes);
  assert.equal(await readUtf8BodyLimited(jsonReq(body), bytes), body);
  await assert.rejects(readUtf8BodyLimited(jsonReq(body), bytes - 1), RequestBodyTooLargeError);
});
test('oversized Content-Length is rejected without consumption', async () => {
  const req = jsonReq('{"a":1}', { 'content-length': '99999' });
  await assert.rejects(readUtf8BodyLimited(req, 10), RequestBodyTooLargeError);
});
test('chunked request cannot bypass the limit with missing Content-Length', async () => {
  let pulls = 0;
  const source = new ReadableStream({
    pull(controller) {
      pulls += 1;
      controller.enqueue(new TextEncoder().encode(pulls === 1 ? '{"x":"' : 'abcdefghijk'));
      if (pulls > 2) controller.close();
    },
  });
  const req = new Request(url, { method: 'POST', body: source, duplex: 'half' });
  await assert.rejects(readUtf8BodyLimited(req, 12), RequestBodyTooLargeError);
});
test('UTF-8 multi-byte characters split across chunks decode faithfully', async () => {
  const bytes = new TextEncoder().encode('{"name":"😀"}');
  const chunks = [bytes.slice(0, 10), bytes.slice(10, 12), bytes.slice(12)];
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  const req = new Request(url, { method: 'POST', body: stream, duplex: 'half' });
  assert.equal(await readUtf8BodyLimited(req, bytes.byteLength), '{"name":"😀"}');
});
test('invalid UTF-8 is rejected instead of replacing damaged bytes', async () => {
  const req = jsonReq(new Uint8Array([0x7b, 0x22, 0xc3, 0x28, 0x22, 0x7d]));
  await assert.rejects(readUtf8BodyLimited(req, 64), InvalidRequestUtf8Error);
});
