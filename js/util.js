/* util.js  --  namespace, statistics, Fourier helpers, number formatting */
(function (g) {
  'use strict';
  const PE = g.PE = g.PE || {};
  PE.models = PE.models || [];
  PE.register = function (m) { PE.models.push(m); return m; };
  const U = PE.util = {};
  U.D2R = Math.PI / 180;
  U.R2D = 180 / Math.PI;
  U.TWO_PI = 2 * Math.PI;

  U.mean = a => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s / a.length; };
  U.rms = a => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s / a.length); };
  U.min = a => { let m = Infinity; for (let i = 0; i < a.length; i++) if (a[i] < m) m = a[i]; return m; };
  U.max = a => { let m = -Infinity; for (let i = 0; i < a.length; i++) if (a[i] > m) m = a[i]; return m; };
  U.clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  U.zeros = n => new Float64Array(n);
  U.mapArr = (a, f) => { const o = new Float64Array(a.length); for (let i = 0; i < a.length; i++) o[i] = f(a[i], i); return o; };
  U.slice = (a, i0, i1) => Array.prototype.slice.call(a, i0, i1);
  U.modPos = (x, m) => ((x % m) + m) % m;

  /** Fourier analysis of ONE period sampled uniformly (N samples, endpoint excluded).
   *  Returns {dc, amp[1..H], ph[1..H]} with y ~ dc + sum amp[n] sin(n t + ph[n]). */
  U.dft = function (y, H) {
    const N = y.length, amp = new Float64Array(H + 1), ph = new Float64Array(H + 1);
    let dc = 0; for (let k = 0; k < N; k++) dc += y[k]; dc /= N;
    for (let n = 1; n <= H; n++) {
      let a = 0, b = 0; const w = 2 * Math.PI * n / N;
      for (let k = 0; k < N; k++) { const c = Math.cos(w * k), s = Math.sin(w * k); a += y[k] * c; b += y[k] * s; }
      a *= 2 / N; b *= 2 / N;
      amp[n] = Math.hypot(a, b); ph[n] = Math.atan2(a, b);
    }
    return { dc, amp, ph };
  };

  /** Harmonic figures of merit as defined in the note (HF_n, THD, DF, LOH). */
  U.hfom = function (amp, H, fundIdx) {
    fundIdx = fundIdx || 1;
    const a1 = amp[fundIdx]; let s2 = 0, sdf = 0, loh = 0;
    for (let n = 1; n <= H; n++) {
      if (n === fundIdx) continue;
      s2 += amp[n] * amp[n];
      const r = n / fundIdx;
      sdf += Math.pow(amp[n] / (r * r), 2);
      if (!loh && n > fundIdx && amp[n] >= 0.03 * a1) loh = n;
    }
    return { thd: Math.sqrt(s2) / a1, df: Math.sqrt(sdf) / a1, loh: loh };
  };

  U.fmt = function (x, d) {
    d = d == null ? 4 : d;
    if (x == null || !isFinite(x)) return '\u2013';
    if (x === 0) return '0';
    const ax = Math.abs(x);
    if (ax >= 1e6 || ax < 1e-3) return x.toExponential(Math.max(1, d - 1));
    return String(Number(x.toPrecision(d)));
  };
  U.range = (n, a, b) => { const o = new Float64Array(n); for (let i = 0; i < n; i++) o[i] = a + (b - a) * i / (n - 1); return o; };
  U.degTicks = (x1, step) => { const t = []; for (let v = 0; v <= x1 + 1e-9; v += step) t.push(v); return t; };
})(globalThis);
