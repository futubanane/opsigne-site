'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const nodeCrypto = require('node:crypto');
const S = require('../js/sha256.js');

// NIST / RFC 6234 test vectors
const VECTORS = [
  ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq', '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'],
  ['abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu',
   'cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1'],
  ['a'.repeat(1000000), 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0'],
];

test('pure-JS SHA-256 matches the standard test vectors (empty, abc, 448-bit, 896-bit, one million a)', () => {
  for (const [msg, want] of VECTORS) assert.equal(S.sha256HexSync(msg), want, 'vector len ' + msg.length);
});

test('pure-JS SHA-256 agrees with node:crypto on padding boundaries 0..130 bytes and on unicode', () => {
  for (let n = 0; n <= 130; n++) {
    const m = 'x'.repeat(n);
    assert.equal(S.sha256HexSync(m), nodeCrypto.createHash('sha256').update(m, 'utf8').digest('hex'), 'n=' + n);
  }
  for (const m of ['é', 'Démo à données fictives', '日本語', '😀 emoji', '\u0000nul', 'a\ud800b' /* lone surrogate */]) {
    assert.equal(S.sha256HexSync(m), nodeCrypto.createHash('sha256').update(Buffer.from(S.utf8(m))).digest('hex'), m);
  }
});

test('utf8 encoder equals TextEncoder for well-formed strings and replaces lone surrogates with U+FFFD', () => {
  for (const m of ['', 'abc', 'é', '€', '😀', 'mixé 日本 😀']) assert.deepEqual([...S.utf8(m)], [...new TextEncoder().encode(m)]);
  assert.deepEqual([...S.utf8('\ud800')], [0xef, 0xbf, 0xbd]);
});

test('async sha256Hex uses WebCrypto when available and gives the same digest as the fallback', async () => {
  const a = await S.sha256Hex('abc');
  assert.equal(a, VECTORS[1][1]);
  assert.equal(S.lastEngine(), 'webcrypto');
  S.forceFallback(true);
  try {
    assert.equal(await S.sha256Hex('abc'), VECTORS[1][1]);
    assert.equal(S.lastEngine(), 'js-fallback');
    assert.equal(await S.sha256Hex(''), VECTORS[0][1]);
  } finally { S.forceFallback(false); }
});

test('no WebCrypto at all (file:// / insecure context): falls back automatically', async () => {
  const saved = S._setSubtle(null);
  try {
    assert.equal(await S.sha256Hex('abc'), VECTORS[1][1]);
    assert.equal(S.lastEngine(), 'js-fallback');
  } finally { S._setSubtle(saved); }
});
