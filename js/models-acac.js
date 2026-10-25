/* models-acac.js -- AC voltage controllers, cycloconverters, dual converter */
(function (g) {
  'use strict';
  const PE = g.PE, U = PE.util, K = PE.kit, S = PE.sim, D2R = U.D2R, PI = Math.PI, TWO = 2 * PI;
  const GR = 'AC \u2192 AC converters';

  /* ---------- single-phase AC voltage controller ---------- */
  PE.register({
    id: 'acvc-1ph', group: GR, title: 'Single-phase AC voltage controller (phase control)',
    pages: 'Note: AC-AC controller, single-phase voltage controller (two anti-parallel thyristors)',
    desc: 'Thyristors T1/T4 in anti-parallel between source and load. With an R-L load, conduction continues past the zero crossing until the current reaches zero (extinction angle \u03b2); for \u03b1 < \u03c6 the thyristors cannot control the output.',
    params: [K.num('Vm', 'Supply peak V_m', 'V', 10, 600, 1, 325), K.num('f', 'Supply frequency f', 'Hz', 10, 400, 1, 50),
      K.num('R', 'Load resistance R', '\u03a9', 0.5, 100, 0.5, 10), K.num('L', 'Load inductance L', 'mH', 0, 500, 1, 0),
      K.num('alpha', 'Firing angle \u03b1', '\u00b0', 0, 179, 1, 60)],
    compute: function (p) {
      const a = p.alpha * D2R;
      const r = S.acvc1({ Vm: p.Vm, R: p.R, XL: TWO * p.f * p.L / 1000, alpha: a, nPer: 3600, keep: 2 });
      const N = r.N, x = K.toDeg(r.th), ax = K.degAxis(720, 90);
      const strips = [
        { name: 'Supply v_s', unit: 'V', y: r.vs, color: 0 },
        K.gateStrip(x, [{ name: 'G1 (T1)', start: p.alpha, width: 12 }, { name: 'G4 (T4)', start: 180 + p.alpha, width: 12 }], 'Gate pulses', 3),
        { name: 'Output voltage v_o', unit: 'V', y: r.vo, color: 1 },
        { name: 'Load current i_o', unit: 'A', y: r.i, color: 2 }
      ];
      const vo = K.lastCycle(r.vo, N, 2), io = K.lastCycle(r.i, N, 2), vs = K.lastCycle(r.vs, N, 2);
      const Vo = U.rms(vo), Io = U.rms(io), Vs = U.rms(vs), P = Io * Io * p.R, PF = Io > 1e-9 ? P / (Vs * Io) : 0;
      const phi = Math.atan2(TWO * p.f * p.L / 1000, p.R);
      let beta = null; for (let k = 1; k < N; k++) if (io[k] === 0 && io[k - 1] !== 0 && k * 360 / N > p.alpha) { beta = k * 360 / N; break; }
      const ref = p.L === 0 ? { Vo: p.Vm / Math.SQRT2 * Math.sqrt((PI - a + Math.sin(2 * a) / 2) / PI) } : null;
      const ro = [
        K.ro('V_o,rms', Vo, 'V', ref && ref.Vo), K.ro('I_o,rms', Io, 'A', ref && ref.Vo / p.R),
        K.ro('Output power P_o', P, 'W'), K.ro('Input power factor', PF, '', ref && ref.Vo / Vs),
        K.ro('Extinction angle \u03b2 (first half-cycle)', beta, '\u00b0'), K.ro('Load angle \u03c6 = atan(\u03c9L/R)', phi * U.R2D, '\u00b0'),
        K.ro('Control possible (\u03b1 > \u03c6)?', p.alpha * D2R > phi - 1e-9 ? 'yes' : 'no \u2013 full conduction', '')
      ];
      return Object.assign({ x: x, strips: strips, readouts: ro }, ax);
    }
  });

  /* ---------- three-phase AC voltage controller ---------- */
  PE.register({
    id: 'acvc-3ph', group: GR, title: 'Three-phase AC voltage controller (star, resistive load)',
    pages: 'Note: AC-AC controller, 3\u03c6 AC controller (modes: 5,6 / 6,1 / 1,2 / 2,3 / 3,4 / 4,5 conducting)',
    desc: 'Six thyristors (1\u20136), gate pulses 120\u00b0 wide and 60\u00b0 apart, isolated neutral. Two or three thyristors conduct at a time depending on \u03b1; at \u03b1 = 0 the load sees the full phase voltage.',
    params: [K.num('Vm', 'Phase peak V_m', 'V', 10, 600, 1, 325), K.num('R', 'Load resistance R (per phase)', '\u03a9', 0.5, 100, 0.5, 10), K.num('alpha', 'Firing angle \u03b1', '\u00b0', 0, 150, 1, 60)],
    compute: function (p) {
      const a = p.alpha * D2R, r = S.acvc3({ Vm: p.Vm, R: p.R, alpha: a, nPer: 2400, keep: 2 });
      const N = r.N, x = K.toDeg(r.th), ax = K.degAxis(720, 90);
      const strips = [
        { name: 'Supply phase voltages', unit: 'V', y: r.vs[0], overlays: [{ y: r.vs[1], color: 1 }, { y: r.vs[2], color: 2 }], color: 0, legend: [['v_a', 0], ['v_b', 1], ['v_c', 2]] },
        K.gateStrip(x, [1, 2, 3, 4, 5, 6].map(k => ({ name: 'G' + k, start: p.alpha + (k - 1) * 60, width: 12 })), 'Gate pulses', 3),
        { name: 'Thyristors conducting', y: U.mapArr(r.nOn, v => v), color: 5, ticks: [0, 2, 3], ymin: -0.3, ymax: 3.5 },
        { name: 'Load phase voltages', unit: 'V', y: r.vl[0], overlays: [{ y: r.vl[1], color: 1 }, { y: r.vl[2], color: 2 }], color: 0, legend: [['v_an', 0], ['v_bn', 1], ['v_cn', 2]] },
        { name: 'Line current i_a', unit: 'A', y: r.i[0], color: 4 }
      ];
      const Vo = U.rms(K.lastCycle(r.vl[0], N, 2)), Io = Vo / p.R, Vs = p.Vm / Math.SQRT2;
      const ref = p.alpha === 0 ? Vs : (p.alpha >= 150 ? 0 : null);
      const ro = [K.ro('V_o,rms (per phase)', Vo, 'V', ref), K.ro('V_s,rms (phase)', Vs, 'V'), K.ro('V_o,rms / V_s,rms', Vo / Vs, ''),
        K.ro('I_o,rms', Io, 'A'), K.ro('Output power P_o = 3 I\u00b2R', 3 * Io * Io * p.R, 'W'), K.ro('Input power factor', Vo / Vs, '')];
      return Object.assign({ x: x, strips: strips, readouts: ro }, ax);
    }
  });

  /* ---------- cycloconverters ---------- */
  function cycloCompute(p, three) {
    const a = p.alpha * D2R, n = Math.round(p.n), XL = TWO * p.fs * p.L / 1000;
    let base, Nb;   // one supply cycle of the positive-group output (steady state)
    if (three) {
      const fn = [t => p.Vm * Math.sin(t), t => p.Vm * Math.sin(t - TWO / 3), t => p.Vm * Math.sin(t - 2 * TWO / 3)];
      const pairs = [[0, 1], [0, 2], [1, 2], [1, 0], [2, 0], [2, 1]];
      const src = pairs.map((pr, j) => ({ start: PI / 6 + a + j * PI / 3, width: PI / 3, v: t => fn[pr[0]](t) - fn[pr[1]](t) }));
      const r = S.rectifier({ R: p.R, XL: XL, E: 0, Vd: 0, fwd: false, src: src, nPer: 1800, keep: 1 });
      base = r.vo; Nb = r.N;
    } else {
      const src = [{ start: a, width: Math.max(PI - a, 0.05), v: t => p.Vm * Math.sin(t) }, { start: PI + a, width: Math.max(PI - a, 0.05), v: t => -p.Vm * Math.sin(t) }];
      const r = S.rectifier({ R: p.R, XL: XL, E: 0, Vd: 0, fwd: false, src: src, nPer: 1800, keep: 1 });
      base = r.vo; Nb = r.N;
    }
    // composite output: n half-cycles (n*180 deg) of the positive group, then n half-cycles of the negative group
    const perDeg = 2 * n * 180, Nt = Math.round(perDeg / 360 * Nb), vo = new Float64Array(Nt);
    for (let k = 0; k < Nt; k++) {
      const ang = k * 360 / Nb, grp = Math.floor(ang / (n * 180) + 1e-9), sgn = grp % 2 === 0 ? 1 : -1;
      vo[k] = sgn * base[Math.floor(k % Nb)];
    }
    // load current (ideal dual converter: current may reverse), steady state by repeated periods
    const dth = TWO / Nb, io = new Float64Array(Nt); let i = 0;
    const alg = XL < 1e-3 * p.R;
    if (alg) { for (let k = 0; k < Nt; k++) io[k] = vo[k] / p.R; }
    else {
      const per = Math.min(120, Math.max(4, Math.ceil(7 * XL / p.R / (perDeg * D2R)) + 3));
      for (let q = 0; q < per; q++) for (let k = 0; k < Nt; k++) {
        const v0 = vo[k], v1 = vo[(k + 1) % Nt];
        const f = (v, y) => (v - p.R * y) / XL, h = dth, k1 = f(v0, i), k2 = f((v0 + v1) / 2, i + h / 2 * k1), k3 = f((v0 + v1) / 2, i + h / 2 * k2), k4 = f(v1, i + h * k3);
        i += h / 6 * (k1 + 2 * k2 + 2 * k3 + k4); if (q === per - 1) io[k] = i;
      }
    }
    // display two output periods when short
    const reps = perDeg <= 720 ? Math.max(2, Math.floor(720 / perDeg)) : 1, M = reps * Nt + 1;
    const x = new Float64Array(M), vd = new Float64Array(M), id = new Float64Array(M), vsd = new Float64Array(M);
    for (let k = 0; k < M; k++) { const kk = k % Nt; x[k] = k * 360 / Nb; vd[k] = vo[kk]; id[k] = io[kk]; vsd[k] = p.Vm * Math.sin(k * TWO / Nb); }
    const xmax = reps * perDeg, ax = K.degAxis(xmax, xmax > 1000 ? 360 : 180);
    const Vo = U.rms(vo), Io = U.rms(io);
    const H = Math.min(60, 10 * n + 6), d = U.dft(vo, H), hf = U.hfom(d.amp, H, 1);
    const ref = p.L === 0 ? p.Vm / Math.SQRT2 * (three ? NaN : Math.sqrt((PI - a + Math.sin(2 * a) / 2) / PI)) : null;
    const strips = [
      { name: three ? 'Supply phase voltage v_a' : 'Supply v_s', unit: 'V', y: vsd, color: 0 },
      { name: 'Output voltage v_o', unit: 'V', y: vd, color: 1, overlays: [{ y: U.mapArr(vd, (v, k) => d.amp[1] * Math.sin(TWO * ((k % Nt) / Nt) + d.ph[1])), color: 6, dash: true, label: 'fundamental' }] },
      { name: 'Load current i_o', unit: 'A', y: id, color: 2 }
    ];
    const ro = [K.ro('Output frequency f_o = f_s / n', p.fs / n, 'Hz'), K.ro('Output period T_o', n / p.fs * 1000, 'ms'),
      K.ro('V_o,rms (whole output wave)', Vo, 'V', ref && isFinite(ref) ? ref : null), K.ro('Fundamental V_o1,rms', d.amp[1] / Math.SQRT2, 'V'),
      K.ro('THD of v_o (w.r.t. f_o)', hf.thd * 100, '%'), K.ro('I_o,rms', Io, 'A'), K.ro('Lowest-order harmonic LOH (\u2265 3 % of fundamental)', hf.loh || null, '')];
    const bars = K.spectrumBars(d, H, 'Spectrum of v_o in multiples of f_o  (% of fundamental)', 1);
    return Object.assign({ x: x, strips: strips, readouts: ro, bars: bars }, ax);
  }
  PE.register({
    id: 'cyclo-1ph', group: GR, title: 'Single-phase cycloconverter (1\u03c6 \u2192 1\u03c6, f_o = f_s / n)',
    pages: 'Note: Cycloconverters, single-phase (p-converter and n-converter bridges)',
    desc: 'The p-converter supplies the positive half of the output for n supply half-cycles, then the n-converter supplies the negative half (ideal, non-circulating operation, the n-converter mirrors the p-converter output so that V_dc,p = \u2212V_dc,n).',
    params: [K.num('Vm', 'Supply peak V_m', 'V', 10, 600, 1, 325), K.num('fs', 'Supply frequency f_s', 'Hz', 10, 400, 1, 50),
      K.num('n', 'n  (f_o = f_s / n)', '', 1, 12, 1, 3), K.num('alpha', 'Firing angle \u03b1_p', '\u00b0', 0, 150, 1, 0),
      K.num('R', 'Load R', '\u03a9', 0.5, 100, 0.5, 10), K.num('L', 'Load L', 'mH', 0, 2000, 1, 0)],
    compute: p => cycloCompute(p, false)
  });
  PE.register({
    id: 'cyclo-3ph', group: GR, title: 'Three-phase cycloconverter (3\u03c6 \u2192 1\u03c6, 6-pulse groups)',
    pages: 'Note: Cycloconverters, three-phase (positive and negative converter groups, f_o \u2264 f_s)',
    desc: 'Two three-phase bridges (positive and negative group). Output built from segments of the line voltages; with f_o = f_s/3 the half period contains nine 60\u00b0 segments as in the note. V_m is the phase peak.',
    params: [K.num('Vm', 'Phase peak V_m', 'V', 10, 600, 1, 325), K.num('fs', 'Supply frequency f_s', 'Hz', 10, 400, 1, 50),
      K.num('n', 'n  (f_o = f_s / n)', '', 1, 12, 1, 3), K.num('alpha', 'Firing angle \u03b1', '\u00b0', 0, 120, 1, 0),
      K.num('R', 'Load R', '\u03a9', 0.5, 100, 0.5, 10), K.num('L', 'Load L', 'mH', 0, 2000, 1, 0)],
    compute: p => cycloCompute(p, true)
  });

  /* ---------- single-phase dual converter ---------- */
  PE.register({
    id: 'dual-1ph', group: GR, title: 'Single-phase dual converter and circulating current',
    pages: 'Note: Single-phase dual converter (\u03b1\u2082 = \u03c0 \u2212 \u03b1\u2081, circulating-current reactor L_r)',
    desc: 'Two fully controlled bridges back to back with firing angles \u03b1\u2081 and \u03b1\u2082 = \u03c0 \u2212 \u03b1\u2081 (continuous conduction, as sketched in the note). The instantaneous voltage difference v_r = v_o1 + v_o2 drives the circulating current i_r through L_r.',
    params: [K.num('Vm', 'Supply peak V_m', 'V', 10, 600, 1, 325), K.num('f', 'Supply frequency f', 'Hz', 10, 400, 1, 50),
      K.num('alpha', 'Firing angle \u03b1\u2081', '\u00b0', 0, 180, 1, 60), K.num('Lr', 'Circulating-current reactor L_r', 'mH', 1, 500, 1, 50)],
    compute: function (p) {
      const a1 = p.alpha * D2R, a2 = PI - a1, N = 3600, M = 2 * N + 1, dth = TWO / N;
      const bridge = (t, a) => { const m = Math.floor((t - a) / PI + 1e-12); return (m % 2 === 0 ? 1 : -1) * p.Vm * Math.sin(t); };
      const x = new Float64Array(M), vs = new Float64Array(M), v1 = new Float64Array(M), v2 = new Float64Array(M), vr = new Float64Array(M), ir = new Float64Array(M);
      let c = 0;
      for (let k = 0; k < M; k++) {
        const t = k * dth; x[k] = t * U.R2D; vs[k] = p.Vm * Math.sin(t);
        v1[k] = bridge(t, a1); v2[k] = bridge(t, a2); vr[k] = v1[k] + v2[k];
        if (k > 0) c += (vr[k] + vr[k - 1]) / 2 * dth;
        ir[k] = c;
      }
      const w = TWO * p.f, lo = U.min(ir.subarray(0, N)); for (let k = 0; k < M; k++) ir[k] = (ir[k] - lo) / (w * p.Lr / 1000);
      const ax = K.degAxis(720, 90);
      const strips = [
        { name: 'Supply v_s', unit: 'V', y: vs, color: 0 },
        K.gateStrip(x, [{ name: '1,6', start: p.alpha, width: 12 }, { name: '3,4', start: 180 + p.alpha, width: 12 }, { name: "1',6'", start: 180 - p.alpha, width: 12 }, { name: "3',4'", start: 360 - p.alpha, width: 12 }], 'Gate pulses (I_o\u207a: 1,6 / 3,4;  I_o\u207b: 1\u2032,6\u2032 / 3\u2032,4\u2032)', 3),
        { name: 'Converter 1 output v_o1', unit: 'V', y: v1, color: 1, avg: true },
        { name: 'Converter 2 output v_o2', unit: 'V', y: v2, color: 2, avg: true },
        { name: 'v_r = v_o1 + v_o2', unit: 'V', y: vr, color: 4 },
        { name: 'Circulating current i_r', unit: 'A', y: ir, color: 5 }
      ];
      const ipeak = U.max(ir.subarray(0, N)), wl = w * p.Lr / 1000;
      const ro = [K.ro('Avg v_o1', U.mean(v1.subarray(0, N)), 'V', 2 * p.Vm * Math.cos(a1) / PI), K.ro('Avg v_o2', U.mean(v2.subarray(0, N)), 'V', 2 * p.Vm * Math.cos(a2) / PI),
        K.ro('Avg v_r', U.mean(vr.subarray(0, N)), 'V', 0),
        K.ro('Peak circulating current i_r (baseline: minimum = 0)', ipeak, 'A', p.alpha <= 90 ? 2 * p.Vm * (1 - Math.cos(a1)) / wl : null, 'derived from v_r = v_o1 + v_o2 for \u03b1 \u2264 90\u00b0: (2V_m/\u03c9L_r)(1 \u2212 cos \u03b1)'),
        K.ro('Note p.39: (2V_m/\u03c9L_r)(cos \u03b1\u2081 \u2212 cos \u03c9t) at \u03c9t = \u03c0', null, 'A', 2 * p.Vm * (1 + Math.cos(a1)) / wl, 'expression as printed in the note; it differs from the simulated loop voltage (see README, "points to check")'),
        K.ro('\u03b1\u2082 = \u03c0 \u2212 \u03b1\u2081', a2 * U.R2D, '\u00b0')];
      return Object.assign({ x: x, strips: strips, readouts: ro }, ax);
    }
  });
})(globalThis);
