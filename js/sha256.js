/* OPSIGNE - SHA-256. WebCrypto when available, otherwise a pure-JS implementation (FIPS 180-4).
   Classic script (no modules) so it also works from file://. In the browser it defines window.OPSIGNE.sha; in node, module.exports. */
(function (root) {
  'use strict';
  var K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);

  /* string -> UTF-8 bytes (lone surrogates become U+FFFD, like TextEncoder) */
  function utf8(s) {
    var out = [], i, c, d;
    s = String(s);
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length && (d = s.charCodeAt(i + 1)) >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++;
      } else if (c >= 0xd800 && c <= 0xdfff) { c = 0xfffd; }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return Uint8Array.from(out);
  }

  function digestBytes(msg) {
    var len = msg.length, total = (((len + 8) >> 6) + 1) << 6, buf = new Uint8Array(total), i, j, t;
    buf.set(msg); buf[len] = 0x80;
    var bits = len * 8, hi = Math.floor(bits / 4294967296), lo = bits >>> 0;
    buf[total - 8] = hi >>> 24; buf[total - 7] = hi >>> 16; buf[total - 6] = hi >>> 8; buf[total - 5] = hi;
    buf[total - 4] = lo >>> 24; buf[total - 3] = lo >>> 16; buf[total - 2] = lo >>> 8; buf[total - 1] = lo;
    var H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    var w = new Uint32Array(64);
    for (var off = 0; off < total; off += 64) {
      for (i = 0; i < 16; i++) w[i] = (buf[off + 4 * i] << 24) | (buf[off + 4 * i + 1] << 16) | (buf[off + 4 * i + 2] << 8) | buf[off + 4 * i + 3];
      for (i = 16; i < 64; i++) {
        var x = w[i - 15], y = w[i - 2];
        var s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
        var s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (j = 0; j < 64; j++) {
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[j] + w[j]) | 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var mj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    var hex = '';
    for (t = 0; t < 8; t++) hex += ('00000000' + H[t].toString(16)).slice(-8);
    return hex;
  }

  function sha256HexSync(str) { return digestBytes(utf8(str)); }

  var subtle = (root.crypto && root.crypto.subtle) || null, forced = false, engine = '';
  function sha256Hex(str) {
    if (subtle && !forced) {
      return subtle.digest('SHA-256', utf8(str)).then(function (buf) {
        engine = 'webcrypto';
        var u = new Uint8Array(buf), s = '', i;
        for (i = 0; i < u.length; i++) s += ('0' + u[i].toString(16)).slice(-2);
        return s;
      }, function () { engine = 'js-fallback'; return sha256HexSync(str); });
    }
    engine = 'js-fallback';
    return Promise.resolve(sha256HexSync(str));
  }

  var api = {
    utf8: utf8, sha256HexSync: sha256HexSync, sha256Hex: sha256Hex,
    forceFallback: function (v) { forced = !!v; },
    lastEngine: function () { return engine; },
    _setSubtle: function (s) { var o = subtle; subtle = s; return o; }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.OPSIGNE = root.OPSIGNE || {}; root.OPSIGNE.sha = api; }
})(typeof window !== 'undefined' ? window : globalThis);
