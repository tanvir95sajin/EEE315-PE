/* engines.js  --  numerical engines (all angles in radians; load model  v = R i + XL di/dtheta + E, XL = omega*L) */
(function (g) {
  'use strict';
  const PE = g.PE = g.PE || {};
  const S = PE.sim = PE.sim || {};
  const U = PE.util;
  const TWO = 2 * Math.PI;

  /* ---------------------------------------------------------------------------------------------
   * Phase-controlled rectifier engine.
   * src[j] = { start, width, v(theta) }  : thyristor/diode group j is gated from `start` for `width` rad each cycle
   *                                          and, while it conducts, the load sees v_j(theta) - Vd.
   * Conduction ends when the load current reaches zero (or, with a freewheeling diode, when v_j <= 0).
   * A newly fired group takes over from the conducting one if its source voltage is higher (natural commutation).
   * Returns the last `keep` cycles of steady state.
   * -------------------------------------------------------------------------------------------- */
  S.rectifier = function (c) {
    const R = c.R, XL = c.XL || 0, E = c.E || 0, Vd = c.Vd || 0, fwd = !!c.fwd, src = c.src, ns = src.length;
    const N = c.nPer || 3600, dth = TWO / N, keep = c.keep || 2;
    const alg = XL < 1e-3 * R;
    const tau = alg ? 0 : XL / R;
    const settle = c.settle != null ? c.settle : Math.min(150, Math.max(6, Math.ceil(7 * Math.max(0.3, tau) / TWO) + 4));
    const K = (settle + keep) * N, K0 = settle * N, M = keep * N + 1;
    const th = new Float64Array(M), vo = new Float64Array(M), ii = new Float64Array(M), dev = new Int8Array(M);
    const s0 = src.map(s => U.modPos(s.start, TWO));
    let mode = 0, cur = -1, armed = -1, armedEnd = 0, i = 0;
    for (let k = 0; k <= K; k++) {
      const t = k * dth;
      for (let j = 0; j < ns; j++) {
        const n1 = Math.floor((t - s0[j]) / TWO + 1e-9), n0 = Math.floor((t - dth - s0[j]) / TWO + 1e-9);
        if (n1 > n0) {
          armed = j; armedEnd = t + src[j].width;
          const vj = src[j].v(t);
          if (mode === 1) { if (j !== cur && vj >= src[cur].v(t) - 1e-9) cur = j; }
          else if (mode === 0) { if (vj - Vd > E) { mode = 1; cur = j; } }
          else if (vj - Vd > 0) { mode = 1; cur = j; }
        }
      }
      if (mode !== 1 && armed >= 0) {
        if (t > armedEnd) armed = -1;
        else { const va = src[armed].v(t) - Vd; if (mode === 0 ? va > E : va > 0) { mode = 1; cur = armed; } }
      }
      if (mode === 1 && fwd && src[cur].v(t) - Vd <= 0) mode = 2;
      let v = mode === 1 ? src[cur].v(t) - Vd : mode === 2 ? 0 : E;
      if (alg) {
        if (mode === 1) { const val = (v - E) / R; if (val <= 0) { mode = 0; i = 0; v = E; } else i = val; }
        else { mode = 0; i = 0; v = E; }
      }
      if (k >= K0) { const q = k - K0; th[q] = q * dth; vo[q] = v; ii[q] = i; dev[q] = mode === 1 ? cur : mode === 2 ? -2 : -1; }
      if (k === K) break;
      if (!alg && mode !== 0) {
        const cj = cur, m1 = mode === 1;
        const f = (tt, y) => ((m1 ? src[cj].v(tt) - Vd : 0) - E - R * y) / XL;
        const h = dth, k1 = f(t, i), k2 = f(t + h / 2, i + h / 2 * k1), k3 = f(t + h / 2, i + h / 2 * k2), k4 = f(t + h, i + h * k3);
        let ni = i + h / 6 * (k1 + 2 * k2 + 2 * k3 + k4);
        if (ni <= 0) { ni = 0; mode = 0; }
        i = ni;
      }
    }
    return { th: th, vo: vo, i: ii, dev: dev, N: N, keep: keep };
  };

  /* ---------------------------------------------------------------------------------------------
   * Single-phase AC voltage controller (two anti-parallel thyristors, series R-L load)
   * -------------------------------------------------------------------------------------------- */
  S.acvc1 = function (c) {
    const Vm = c.Vm, R = c.R, XL = c.XL || 0, al = c.alpha;
    const N = c.nPer || 3600, dth = TWO / N, keep = c.keep || 2, alg = XL < 1e-3 * R;
    const tau = alg ? 0 : XL / R;
    const settle = Math.min(100, Math.max(4, Math.ceil(7 * Math.max(0.3, tau) / TWO) + 3));
    const K = (settle + keep) * N, K0 = settle * N, M = keep * N + 1;
    const th = new Float64Array(M), vs = new Float64Array(M), vo = new Float64Array(M), ii = new Float64Array(M), md = new Int8Array(M);
    let mode = 0, i = 0;
    for (let k = 0; k <= K; k++) {
      const t = k * dth, v = Vm * Math.sin(t), ph = U.modPos(t, TWO);
      const armPos = ph >= al - 1e-12 && ph < Math.PI, armNeg = ph >= Math.PI + al - 1e-12 && ph < TWO;
      if (mode === 0) { if (armPos && v > 0) mode = 1; else if (armNeg && v < 0) mode = -1; }
      let vout = mode !== 0 ? v : 0;
      if (alg) { if (mode !== 0) { i = v / R; if (mode * i <= 0) { mode = 0; i = 0; vout = 0; } } else i = 0; }
      if (k >= K0) { const q = k - K0; th[q] = q * dth; vs[q] = v; vo[q] = vout; ii[q] = i; md[q] = mode; }
      if (k === K) break;
      if (!alg && mode !== 0) {
        const f = (tt, y) => (Vm * Math.sin(tt) - R * y) / XL, h = dth;
        const k1 = f(t, i), k2 = f(t + h / 2, i + h / 2 * k1), k3 = f(t + h / 2, i + h / 2 * k2), k4 = f(t + h, i + h * k3);
        let ni = i + h / 6 * (k1 + 2 * k2 + 2 * k3 + k4);
        if (mode * ni <= 0) { ni = 0; mode = 0; }
        i = ni;
      }
    }
    return { th: th, vs: vs, vo: vo, i: ii, mode: md, N: N, keep: keep };
  };

  /* ---------------------------------------------------------------------------------------------
   * Three-phase AC voltage controller, star R load, isolated neutral, six thyristors.
   * Devices 0..5 = A+, C-, B+, A-, C+, B-  fired 60 deg apart, each gate pulse 120 deg wide (as in the note).
   * The conduction pattern is found by enumerating all consistent device combinations at every step.
   * -------------------------------------------------------------------------------------------- */
  S.acvc3 = function (c) {
    const Vm = c.Vm, R = c.R, al = c.alpha, N = c.nPer || 2400, dth = TWO / N, keep = c.keep || 2;
    const dtab = [[0, 3], [2, 5], [4, 1]];            // dtab[phase][0 = positive device, 1 = negative device]
    const gated = (d, t) => U.modPos(t - (al + d * Math.PI / 3), TWO) < 2 * Math.PI / 3 - 1e-12;
    const K = (2 + keep) * N, K0 = 2 * N, M = keep * N + 1;
    const th = new Float64Array(M), vp = [0, 1, 2].map(() => new Float64Array(M)), ip = [0, 1, 2].map(() => new Float64Array(M)), vl = [0, 1, 2].map(() => new Float64Array(M));
    const cnt = new Int8Array(M);
    let s = [0, 0, 0];
    const eps = 1e-9, combos = [];
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let d = -1; d <= 1; d++) combos.push([a, b, d]);
    for (let k = 0; k <= K; k++) {
      const t = k * dth, v = [Vm * Math.sin(t), Vm * Math.sin(t - 2 * Math.PI / 3), Vm * Math.sin(t - 4 * Math.PI / 3)];
      const g = [[gated(0, t), gated(3, t)], [gated(2, t), gated(5, t)], [gated(4, t), gated(1, t)]];
      let best = null, bs = -1, bvx = null;
      for (let q = 0; q < combos.length; q++) {
        const cb = combos[q]; let nS = 0, ok = true, sc = 0;
        for (let p = 0; p < 3; p++) {
          if (cb[p] !== 0) { nS++; const idx = cb[p] > 0 ? 0 : 1; if (!(g[p][idx] || s[p] === cb[p])) { ok = false; break; } }
          if (cb[p] !== 0 && cb[p] === s[p]) sc += 10;
        }
        if (!ok || nS === 1) continue;
        let vx = [0, 0, 0], Vn = 0;
        if (nS === 3) { vx = v.slice(); }
        else if (nS === 2) {
          const on = [0, 1, 2].filter(p => cb[p] !== 0); Vn = (v[on[0]] + v[on[1]]) / 2;
          vx[on[0]] = v[on[0]] - Vn; vx[on[1]] = v[on[1]] - Vn;
        }
        for (let p = 0; p < 3 && ok; p++) {
          if (cb[p] !== 0) { if (!(cb[p] * vx[p] > eps)) ok = false; }
          else if (nS === 2) {
            for (let idx = 0; idx < 2; idx++) { const pol = idx === 0 ? 1 : -1; if (g[p][idx] && pol * (v[p] - Vn) > eps) ok = false; }
          }
        }
        if (!ok) continue;
        sc += nS;
        if (sc > bs) { bs = sc; best = cb; bvx = vx; }
      }
      if (!best) { best = [0, 0, 0]; bvx = [0, 0, 0]; }
      s = best.slice();
      if (k >= K0) {
        const q = k - K0; th[q] = q * dth; cnt[q] = s.filter(x => x !== 0).length;
        for (let p = 0; p < 3; p++) { vp[p][q] = v[p]; vl[p][q] = bvx[p]; ip[p][q] = bvx[p] / R; }
      }
    }
    return { th: th, vs: vp, vl: vl, i: ip, nOn: cnt, N: N, keep: keep };
  };

  /* ---------------------------------------------------------------------------------------------
   * DC-DC converters with ideal switch and diode, RK4 integration, CCM and DCM handled by state events.
   * topologies: buck, boost, buckboost, flyback (single inductor)  |  cuk, sepic (two inductors)
   * -------------------------------------------------------------------------------------------- */
  S.dcdc = function (top, c) {
    const Vs = c.Vs, f = c.f, T = 1 / f, L = c.L, C = c.C, R = c.R;
    const L2 = c.L2 || L, C1 = c.C1 || C, nT = c.n || 1;
    const D = U.clamp(c.D, 0.02, 0.98);
    const NP = c.nPer || 400;
    const two = (top === 'cuk' || top === 'sepic');
    const nOn = Math.max(1, Math.round(D * NP)), nOff = Math.max(1, NP - nOn);
    const dtOn = D * T / nOn, dtOff = (1 - D) * T / nOff;
    // initial state from ideal CCM operation
    let x;
    if (top === 'buck') { x = [D * Vs / R, D * Vs]; }
    else if (top === 'boost') { x = [Vs / ((1 - D) * (1 - D) * R), Vs / (1 - D)]; }
    else if (top === 'buckboost') { x = [D * Vs / ((1 - D) * (1 - D) * R), D * Vs / (1 - D)]; }
    else if (top === 'flyback') { const Vo = nT * D * Vs / (1 - D); x = [Vo / R * nT / (1 - D), Vo]; }
    else if (top === 'cuk') { const Vo = -D * Vs / (1 - D); x = [-Vo / R * D / (1 - D), Vo / R, Vs / (1 - D), Vo]; }
    else { const Vo = D * Vs / (1 - D); x = [Vo / R * D / (1 - D), -Vo / R, Vs, Vo]; }
    let dcm = false;
    const deriv = function (sw, y) {
      const d = new Array(y.length);
      if (top === 'buck') {
        d[0] = sw ? (Vs - y[1]) / L : (dcm ? 0 : -y[1] / L);
        d[1] = ((sw || !dcm ? y[0] : 0) - y[1] / R) / C;
      } else if (top === 'boost') {
        d[0] = sw ? Vs / L : (dcm ? 0 : (Vs - y[1]) / L);
        d[1] = ((sw || dcm ? 0 : y[0]) - y[1] / R) / C;
      } else if (top === 'buckboost') {
        d[0] = sw ? Vs / L : (dcm ? 0 : -y[1] / L);
        d[1] = ((sw || dcm ? 0 : y[0]) - y[1] / R) / C;
      } else if (top === 'flyback') {
        d[0] = sw ? Vs / L : (dcm ? 0 : -(y[1] / nT) / L);
        d[1] = ((sw || dcm ? 0 : y[0] / nT) - y[1] / R) / C;
      } else if (top === 'cuk') {
        if (sw) { d[0] = Vs / L; d[1] = (-y[2] - y[3]) / L2; d[2] = y[1] / C1; }
        else if (!dcm) { d[0] = (Vs - y[2]) / L; d[1] = -y[3] / L2; d[2] = y[0] / C1; }
        else { const di = (Vs - y[2] - y[3]) / (L + L2); d[0] = di; d[1] = di; d[2] = y[0] / C1; }
        d[3] = (y[1] - y[3] / R) / C;
      } else {
        if (sw) { d[0] = Vs / L; d[1] = -y[2] / L2; d[2] = y[1] / C1; d[3] = -y[3] / (R * C); }
        else if (!dcm) { d[0] = (Vs - y[3] - y[2]) / L; d[1] = y[3] / L2; d[2] = y[0] / C1; d[3] = ((y[0] - y[1]) - y[3] / R) / C; }
        else { const di = (Vs - y[2]) / (L + L2); d[0] = di; d[1] = di; d[2] = y[0] / C1; d[3] = -y[3] / (R * C); }
      }
      return d;
    };
    const step = function (sw, y, h) {
      const k1 = deriv(sw, y), y2 = y.map((v, i) => v + h / 2 * k1[i]), k2 = deriv(sw, y2),
        y3 = y.map((v, i) => v + h / 2 * k2[i]), k3 = deriv(sw, y3), y4 = y.map((v, i) => v + h * k3[i]), k4 = deriv(sw, y4);
      return y.map((v, i) => v + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    };
    // after a step: detect inductor-current extinction during the off interval (DCM / third mode)
    const fixDcm = function (y) {
      if (two) {
        if (!dcm && (y[0] - y[1]) <= 0) { dcm = true; const m = (y[0] + y[1]) / 2; y[0] = m; y[1] = m; }
      } else if (!dcm && y[0] <= 0) { dcm = true; y[0] = 0; }
    };
    const maxP = c.maxPeriods || 500;
    let lastX = x.slice(), per = 0, conv = false;
    const rec = c.record === false ? false : true;
    const nkeep = c.keep || 3;
    let out = null;
    const runPeriod = function (record) {
      const o = record ? { t: [], sw: [], x: [], dx: [] } : null;
      let tt = 0; dcm = false;
      const push = (sw, y) => { if (!record) return; o.t.push(tt); o.sw.push(sw); o.x.push(y.slice()); o.dx.push(deriv(sw, y)); };
      push(1, x);
      for (let k = 0; k < nOn; k++) { x = step(1, x, dtOn); tt += dtOn; push(1, x); }
      for (let k = 0; k < nOff; k++) { x = step(0, x, dtOff); tt += dtOff; if (!dcm) fixDcm(x); push(0, x); }
      return o;
    };
    while (per < maxP) {
      const before = x.slice(); runPeriod(false); per++;
      let dif = 0; for (let q = 0; q < x.length; q++) dif = Math.max(dif, Math.abs(x[q] - before[q]) / (Math.abs(before[q]) + 1e-9 + Math.abs(x[x.length - 1]) * 0.01));
      if (per >= 20 && dif < 2e-6) { conv = true; break; }
    }
    const periods = [];
    for (let p = 0; p < nkeep; p++) periods.push(runPeriod(true));
    // stitch the recorded periods
    const t = [], sw = [], xs = [], dxs = []; let off = 0;
    periods.forEach((o, p) => { for (let q = (p ? 1 : 0); q < o.t.length; q++) { t.push(off + o.t[q]); sw.push(o.sw[q]); xs.push(o.x[q]); dxs.push(o.dx[q]); } off += T; });
    return { t: t, sw: sw, x: xs, dx: dxs, T: T, converged: conv, periods: per, D: D, nkeep: nkeep, twoInductor: two };
  };
})(globalThis);
