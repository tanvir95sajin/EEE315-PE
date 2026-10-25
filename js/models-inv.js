/* models-inv.js -- DC-AC inverters: square wave (1-phase), Fourier synthesis, 3-phase 120/180, PWM, multilevel, resonant */
(function (g) {
  'use strict';
  const PE = g.PE, U = PE.util, K = PE.kit, S = PE.sim, D2R = U.D2R, PI = Math.PI, TWO = 2 * PI;
  const GR = 'Inverters (DC \u2192 AC)';
  const SQ = x => (U.modPos(x, 360) < 180 ? 1 : -1);

  /* integrate  L di/dt = v - R i  over sampled v (theta grid), RK2 sub-steps, `per` periods for steady state */
  function rlResponse(v, R, XL, dth, signFeedback) {
    const N = v.length, out = new Float64Array(N);
    if (XL < 1e-3 * R) { for (let k = 0; k < N; k++) out[k] = v[k] / R; return out; }
    const per = Math.min(80, Math.max(4, Math.ceil(6 * XL / R / TWO) + 3));
    let i = 0;
    for (let q = 0; q < per; q++) for (let k = 0; k < N; k++) {
      const v0 = v[k], v1 = v[(k + 1) % N], h = dth;
      const f = (vv, y) => (vv - R * y) / XL, k1 = f(v0, i), k2 = f((v0 + v1) / 2, i + h / 2 * k1), k3 = f((v0 + v1) / 2, i + h / 2 * k2), k4 = f(v1, i + h * k3);
      i += h / 6 * (k1 + 2 * k2 + 2 * k3 + k4);
      if (q === per - 1) out[k] = i;
    }
    return out;
  }

  /* ---------------- single-phase square wave inverter ---------------- */
  PE.register({
    id: 'inv-1ph', group: GR, title: 'Single-phase square-wave voltage source inverter (half bridge / full bridge)',
    pages: 'Note: Inverters 1 (half-bridge) and 2 (full-bridge): modes, Fourier analysis, performance parameters (HF, THD, DF, LOH)',
    desc: 'Q1/Q4 (half bridge) or Q1,Q6 / Q3,Q4 (full bridge) switched alternately with an optional dead time. With R-L load the feedback diodes carry the current through the dead time. Readouts follow the note: V_o1,rms = 0.45 V_DC (half) or 0.9 V_DC (full), THD, DF, LOH.',
    params: [K.sel('topo', 'Topology', [['half', 'Half bridge  (v_o = \u00b1V_DC/2)'], ['full', 'Full bridge  (v_o = \u00b1V_DC)']], 'full'),
      K.num('Vdc', 'DC supply V_DC', 'V', 10, 600, 1, 400), K.num('f', 'Output frequency f', 'Hz', 5, 400, 1, 50),
      K.num('R', 'Load R', '\u03a9', 0.5, 100, 0.5, 10), K.num('L', 'Load L', 'mH', 0, 500, 1, 0),
      K.num('dead', 'Dead time (commutation interval)', '\u00b0', 0, 30, 0.5, 0)],
    compute: function (p) {
      const N = 3600, dth = TWO / N, Vp = p.topo === 'half' ? p.Vdc / 2 : p.Vdc, XL = TWO * p.f * p.L / 1000;
      const half = p.dead / 2, M = 2 * N + 1;
      // gate signals (deg) and output voltage; current needs feedback-diode logic inside dead time
      const v = new Float64Array(N), gA = new Float64Array(N), gB = new Float64Array(N);
      for (let k = 0; k < N; k++) {
        const d = k * 360 / N;
        gA[k] = (d >= half && d < 180 - half) ? 1 : 0; gB[k] = (d >= 180 + half && d < 360 - half) ? 1 : 0;
        v[k] = gA[k] ? Vp : gB[k] ? -Vp : 0;
      }
      let io = new Float64Array(N);
      if (p.dead > 0 && XL >= 1e-3 * p.R) {          // simulate with current-dependent voltage in the dead time
        let i = 0; const per = Math.min(80, Math.max(4, Math.ceil(6 * XL / p.R / TWO) + 3));
        for (let q = 0; q < per; q++) for (let k = 0; k < N; k++) {
          let vv = v[k]; if (!gA[k] && !gB[k]) vv = i > 1e-12 ? -Vp : i < -1e-12 ? Vp : 0;
          const ni = i + (vv - p.R * i) / XL * dth;
          if (!gA[k] && !gB[k] && Math.sign(ni) !== Math.sign(i) && i !== 0) { v[k] = 0; i = 0; } else { i = ni; v[k] = vv; }
          if (q === per - 1) io[k] = i;
        }
      } else io = rlResponse(v, p.R, XL, dth);
      const rep = a => { const o = new Float64Array(M); for (let k = 0; k < M; k++) o[k] = a[k % N]; return o; };
      const x = U.range(M, 0, 720), H = 49, d = U.dft(v, H), hf = U.hfom(d.amp, H, 1);
      const fund = U.mapArr(x, t => d.amp[1] * Math.sin(t * D2R + d.ph[1]));
      const w1 = K.toDeg; const ax = K.degAxis(720, 90);
      const g1 = p.topo === 'half' ? 'G1 (Q1)' : 'G1,G6', g2 = p.topo === 'half' ? 'G4 (Q4)' : 'G3,G4';
      const strips = [
        { name: g1, y: rep(gA), color: 3, ticks: [0, 1], ymin: -0.3, ymax: 1.4 }, { name: g2, y: rep(gB), color: 4, ticks: [0, 1], ymin: -0.3, ymax: 1.4 },
        { name: 'Output voltage v_o', unit: 'V', y: rep(v), color: 1, overlays: [{ y: fund, color: 6, dash: true, label: 'fundamental' }] },
        { name: 'Load current i_o', unit: 'A', y: rep(io), color: 2 }];
      const V1 = d.amp[1] / Math.SQRT2, Vrms = U.rms(v), Z1 = Math.hypot(p.R, XL), th1 = Math.atan2(XL, p.R);
      const I1 = V1 / Z1, ref1 = (p.topo === 'half' ? 0.45 : 0.9) * p.Vdc * (p.dead ? NaN : 1);
      const ro = [K.ro('V_o,rms', Vrms, 'V', p.dead ? null : Vp), K.ro('Fundamental V_o1,rms', V1, 'V', isFinite(ref1) ? ref1 : null),
        K.ro('THD', hf.thd * 100, '%', p.dead ? null : 48.34, 'for an ideal square wave THD \u2192 48.3 % as n \u2192 \u221e'), K.ro('Distortion factor DF', hf.df * 100, '%'),
        K.ro('Lowest-order harmonic LOH', hf.loh || null, ''), K.ro('HF_3 = V_o3 / V_o1', d.amp[3] / d.amp[1] * 100, '%', p.dead ? null : 33.33),
        K.ro('Load impedance |Z_1| / angle \u03b8_1', Z1, '\u03a9  (\u03b8_1 = ' + U.fmt(th1 * U.R2D, 3) + '\u00b0)'),
        K.ro('I_o1,rms = V_o1,rms / |Z_1|', I1, 'A'), K.ro('Fundamental power P_o1 = V_o1 I_o1 cos\u03b8_1', V1 * I1 * Math.cos(th1), 'W'), K.ro('I_o,rms (total)', U.rms(io), 'A')];
      return Object.assign({ x: x, strips: strips, readouts: ro, bars: K.spectrumBars(d, H, 'Harmonic content of v_o  (% of fundamental, HF_n)', 1) }, ax);
    }
  });

  /* ---------------- Fourier synthesis of the square wave ---------------- */
  PE.register({
    id: 'inv-fourier', group: GR, title: 'Fourier synthesis of the inverter output (square wave)',
    pages: 'Note: Fourier analysis of the half-bridge / full-bridge inverter, v_o = (4V_DC/\u03c0)(sin \u03c9t + sin 3\u03c9t / 3 + \u2026)',
    desc: 'Add harmonics one by one: v_o \u2248 \u03a3 b_n sin(n\u03c9t) with b_n = 2V_DC/(n\u03c0) (half bridge, amplitude V_DC/2 \u2192 b_n = 2V_DC/n\u03c0) or 4V_DC/(n\u03c0) (full bridge).',
    params: [K.sel('topo', 'Topology', [['half', 'Half bridge'], ['full', 'Full bridge']], 'full'), K.num('Vdc', 'DC supply V_DC', 'V', 10, 600, 1, 400),
      K.num('Nh', 'Highest harmonic included', '', 1, 99, 2, 5)],
    compute: function (p) {
      const Vp = p.topo === 'half' ? p.Vdc / 2 : p.Vdc, M = 2001, x = U.range(M, 0, 720);
      const sq = U.mapArr(x, t => Vp * SQ(t)), bn = n => 4 * Vp / (n * PI);
      const sum = U.mapArr(x, t => { let s = 0; for (let n = 1; n <= p.Nh; n += 2) s += bn(n) * Math.sin(n * t * D2R); return s; });
      const f1 = U.mapArr(x, t => bn(1) * Math.sin(t * D2R));
      const last = p.Nh % 2 === 0 ? p.Nh - 1 : p.Nh, vals = []; for (let n = 1; n <= 49; n++) vals.push(n % 2 ? bn(n) / bn(1) * 100 : 0);
      let s2 = 0; for (let n = 3; n <= last; n += 2) s2 += bn(n) * bn(n);
      const strips = [{ name: 'Square wave and its partial Fourier sum', unit: 'V', y: sum, color: 1, overlays: [{ y: sq, color: 6, dash: true, label: 'ideal v_o' }, { y: f1, color: 0, label: 'fundamental' }] }];
      const ro = [K.ro('b_1 = 4V_p/\u03c0  (fundamental peak)', bn(1), 'V'), K.ro('V_o1,rms', bn(1) / Math.SQRT2, 'V', (p.topo === 'half' ? 0.45 : 0.9) * p.Vdc),
        K.ro('Harmonics included (odd, up to)', last, ''), K.ro('THD of the partial sum', Math.sqrt(s2) / bn(1) * 100, '%'),
        K.ro('rms error of partial sum vs square wave', U.rms(U.mapArr(x, (t, k) => sum[k] - sq[k])), 'V')];
      return Object.assign({ x: x, strips: strips, readouts: ro, bars: { title: 'Harmonic amplitudes b_n / b_1  [%]', values: vals, first: 1, hilite: new Set([1]) } }, K.degAxis(720, 90));
    }
  });

  /* ---------------- three-phase bridge, 120 / 180 conduction ---------------- */
  PE.register({
    id: 'inv-3ph', group: GR, title: 'Three-phase bridge inverter (180\u00b0 and 120\u00b0 conduction)',
    pages: 'Note: Three-phase voltage source square-wave inverter; line-to-line and line-to-neutral voltages; Fourier analysis',
    desc: 'Q1/Q4, Q3/Q6, Q5/Q2 legs with star-connected load. 180\u00b0 conduction (note): three switches on at a time, v_an = \u00b1V_DC/3, \u00b12V_DC/3. 120\u00b0 conduction needs a resistive load here (one leg floats).',
    params: [K.sel('cond', 'Conduction', [['180', '180\u00b0 conduction (as in the note)'], ['120', '120\u00b0 conduction']], '180'),
      K.num('Vdc', 'DC supply V_DC', 'V', 10, 800, 1, 400), K.num('f', 'Output frequency f', 'Hz', 5, 400, 1, 50),
      K.num('R', 'Load R per phase', '\u03a9', 0.5, 100, 0.5, 10), K.num('L', 'Load L per phase', 'mH', 0, 500, 1, 0, { show: p => p.cond === '180' })],
    compute: function (p) {
      const wid = p.cond === '180' ? 180 : 120, N = 3600, dth = TWO / N, Vh = p.Vdc / 2;
      // device k = 1..6 on for [60(k-1), 60(k-1)+wid)   legs: a = (1,4), b = (3,6), c = (5,2)
      const on = (k, d) => U.modPos(d - 60 * (k - 1), 360) < wid;
      const leg = [[1, 4], [3, 6], [5, 2]];
      const va = new Float64Array(N), vb = new Float64Array(N), vc = new Float64Array(N);
      const van = new Float64Array(N), vbn = new Float64Array(N), vcn = new Float64Array(N);
      const G = [1, 2, 3, 4, 5, 6].map(() => new Float64Array(N));
      for (let k = 0; k < N; k++) {
        const d = k * 360 / N, st = leg.map(l => on(l[0], d) ? 1 : on(l[1], d) ? -1 : 0);
        for (let q = 1; q <= 6; q++) G[q - 1][k] = on(q, d) ? 1 : 0;
        const con = st.filter(s => s !== 0), Vn = con.length ? con.reduce((a, s) => a + s * Vh, 0) / con.length : 0;
        van[k] = st[0] ? st[0] * Vh - Vn : 0; vbn[k] = st[1] ? st[1] * Vh - Vn : 0; vcn[k] = st[2] ? st[2] * Vh - Vn : 0;
      }
      const XL = p.cond === '180' ? TWO * p.f * p.L / 1000 : 0, ia = rlResponse(van, p.R, XL, dth), ib = rlResponse(vbn, p.R, XL, dth), ic = rlResponse(vcn, p.R, XL, dth);
      const vab = U.mapArr(van, (v, k) => v - vbn[k]), vbc = U.mapArr(vbn, (v, k) => v - vcn[k]), vca = U.mapArr(vcn, (v, k) => v - van[k]);
      const M = N + 1, x = U.range(M, 0, 360), cl = a => { const o = new Float64Array(M); for (let k = 0; k < M; k++) o[k] = a[k % N]; return o; };
      const ax = K.degAxis(360, 60);
      const strips = [K.gateStrip(x, [1, 2, 3, 4, 5, 6].map(k => ({ name: 'G' + k, start: 60 * (k - 1), width: wid })), 'Gate signals', 3),
        { name: 'Line voltage v_ab', unit: 'V', y: cl(vab), color: 0, overlays: [{ y: cl(vbc), color: 1, label: 'v_bc' }, { y: cl(vca), color: 2, label: 'v_ca' }], legend: [['v_ab', 0]] },
        { name: 'Phase voltage v_an', unit: 'V', y: cl(van), color: 1, overlays: [{ y: cl(vbn), color: 2, label: 'v_bn' }, { y: cl(vcn), color: 4, label: 'v_cn' }], legend: [['v_an', 1]] },
        { name: 'Phase current i_a', unit: 'A', y: cl(ia), color: 2 }];
      const H = 49, dl = U.dft(vab, H), dp = U.dft(van, H), hl = U.hfom(dl.amp, H, 1), hp = U.hfom(dp.amp, H, 1);
      const r180 = p.cond === '180';
      const ro = [K.ro('V_LL,rms', U.rms(vab), 'V', p.Vdc * (r180 ? Math.sqrt(2 / 3) : Math.SQRT1_2)), K.ro('V_ph,rms (v_an)', U.rms(van), 'V', p.Vdc * (r180 ? Math.SQRT2 / 3 : 1 / Math.sqrt(6))),
        K.ro('Fundamental V_LL1,rms', dl.amp[1] / Math.SQRT2, 'V', r180 ? 0.7797 * p.Vdc : 0.7797 * p.Vdc * (1)),
        K.ro('Fundamental V_ph1,rms', dp.amp[1] / Math.SQRT2, 'V'), K.ro('THD of line voltage', hl.thd * 100, '%'), K.ro('THD of phase voltage', hp.thd * 100, '%'),
        K.ro('Lowest-order harmonic (line voltage)', hl.loh || null, ''), K.ro('I_a,rms', U.rms(ia), 'A')];
      return Object.assign({ x: x, strips: strips, readouts: ro, bars: K.spectrumBars(dl, H, 'Harmonic content of the line voltage  (% of fundamental)', 1) }, ax);
    }
  });

  /* ---------------- sinusoidal PWM ---------------- */
  PE.register({
    id: 'inv-pwm', group: GR, title: 'Sinusoidal PWM inverter (comparator of m(t) and carrier c(t))',
    pages: 'Note: PWM inverter, f_o = f_c, c(t) > m(t) \u21d2 V_o = +V and c(t) < m(t) \u21d2 V_o = \u2212V',
    desc: 'Bipolar PWM: a comparator compares the 50 Hz modulating wave m(t) with the triangular carrier c(t). Switch the polarity box to reproduce the comparator of the note. The fundamental of v_o is m_a V (linear region m_a \u2264 1).',
    params: [K.num('V', 'Output level \u00b1V', 'V', 10, 600, 1, 400), K.num('f1', 'Modulating frequency f_m', 'Hz', 5, 200, 1, 50),
      K.num('mf', 'Frequency ratio m_f = f_c / f_m', '', 3, 60, 1, 15), K.num('ma', 'Modulation index m_a = A_m / A_c', '', 0, 1.5, 0.01, 0.8),
      K.chk('noteSign', "Comparator polarity of the note: c(t) > m(t) \u21d2 +V", false), K.num('R', 'Load R', '\u03a9', 0.5, 100, 0.5, 10), K.num('L', 'Load L', 'mH', 0, 200, 1, 0)],
    compute: function (p) {
      const mf = Math.round(p.mf), N = Math.max(3600, mf * 120), dth = TWO / N;
      const m = new Float64Array(N), c = new Float64Array(N), v = new Float64Array(N);
      for (let k = 0; k < N; k++) {
        const t = k / N, ph = U.modPos(mf * t + 0.25, 1);              // triangular carrier starting at its peak -> symmetric about m
        m[k] = p.ma * Math.sin(TWO * t); c[k] = 4 * Math.abs(ph - 0.5) - 1 + 0; c[k] = -c[k];
        const up = p.noteSign ? (c[k] > m[k]) : (m[k] > c[k]);
        v[k] = up ? p.V : -p.V;
      }
      const XL = TWO * p.f1 * p.L / 1000, io = rlResponse(v, p.R, XL, dth), M = N + 1;
      const x = U.range(M, 0, 360), cl = a => { const o = new Float64Array(M); for (let k = 0; k < M; k++) o[k] = a[k % N]; return o; };
      const H = Math.min(150, 3 * mf + 12), d = U.dft(v, H), hf = U.hfom(d.amp, H, 1);
      const fund = U.mapArr(x, t => d.amp[1] * Math.sin(t * D2R + d.ph[1])), ax = K.degAxis(360, 60);
      const strips = [{ name: 'Modulating m(t) and carrier c(t)', y: cl(m), color: 0, overlays: [{ y: cl(c), color: 6, label: 'c(t)' }], ymin: -1.5, ymax: 1.5, legend: [['m(t)', 0]] },
        { name: 'Output v_o', unit: 'V', y: cl(v), color: 1, overlays: [{ y: fund, color: 2, label: 'fundamental' }] },
        { name: 'Load current i_o', unit: 'A', y: cl(io), color: 2 }];
      const lin = p.ma <= 1, ref = lin ? p.ma * p.V : null;
      const ro = [K.ro('Fundamental amplitude V_o1(peak)', d.amp[1], 'V', ref), K.ro('Fundamental V_o1,rms', d.amp[1] / Math.SQRT2, 'V', ref && ref / Math.SQRT2),
        K.ro('V_o,rms', U.rms(v), 'V', p.V), K.ro('THD (up to harmonic ' + H + ')', hf.thd * 100, '%'), K.ro('Lowest-order harmonic LOH', hf.loh || null, ''),
        K.ro('Output frequency f_o = f_m', p.f1, 'Hz'), K.ro('Switching frequency f_c', mf * p.f1, 'Hz'), K.ro('I_o,rms', U.rms(io), 'A')];
      return Object.assign({ x: x, strips: strips, readouts: ro, bars: K.spectrumBars(d, Math.min(H, 100), 'Harmonic content of v_o  (% of fundamental)', 1) }, ax);
    }
  });

  /* ---------------- multilevel staircase ---------------- */
  PE.register({
    id: 'inv-multilevel', group: GR, title: 'Multilevel (cascaded-source) inverter, 2n+1 levels',
    pages: 'Note: Multilevel inverters, 7-level example with 3 sources, 12 switches, phases 1\u20137',
    desc: 'n series H-bridge sections each add +V_DC, 0 or \u2212V_DC: levels = 2n + 1, switches = 4n. The staircase angles are either the quantized-sine angles \u03b8_k = asin((2k\u22121)/2n) or equal-width steps.',
    params: [K.num('n', 'Number of DC sources n', '', 1, 8, 1, 3), K.num('Vdc', 'Each source V_DC', 'V', 5, 400, 1, 100), K.num('f', 'Output frequency f', 'Hz', 5, 400, 1, 50),
      K.sel('mode', 'Switching angles', [['quant', 'Quantized sine  \u03b8_k = asin((2k\u22121)/2n)'], ['equal', 'Equal-width steps']], 'quant')],
    compute: function (p) {
      const n = Math.round(p.n), N = 3600, v = new Float64Array(N), ang = [];
      for (let k = 1; k <= n; k++) ang.push(p.mode === 'quant' ? Math.asin((2 * k - 1) / (2 * n)) * U.R2D : (k * 90) / (n + 1) * (1));
      for (let k = 0; k < N; k++) {
        const d = U.modPos(k * 360 / N, 360), q = d <= 180 ? d : 360 - d, qq = q <= 90 ? q : 180 - q;
        let lev = 0; for (let j = 0; j < n; j++) if (qq >= ang[j]) lev++;
        v[k] = (d < 180 ? 1 : -1) * lev * p.Vdc;
      }
      const M = N + 1, x = U.range(M, 0, 360), cl = a => { const o = new Float64Array(M); for (let k = 0; k < M; k++) o[k] = a[k % N]; return o; };
      const H = 49, d = U.dft(v, H), hf = U.hfom(d.amp, H, 1);
      const fund = U.mapArr(x, t => d.amp[1] * Math.sin(t * D2R + d.ph[1]));
      const ticks = []; for (let k = -n; k <= n; k++) ticks.push(k * p.Vdc);
      const strips = [{ name: 'Output voltage v_o  (' + (2 * n + 1) + ' levels)', unit: 'V', y: cl(v), color: 1, ticks: n > 4 ? undefined : ticks, overlays: [{ y: fund, color: 6, dash: true, label: 'fundamental' }] }];
      const ro = [K.ro('Number of levels  2n + 1', 2 * n + 1, ''), K.ro('Number of switches  4n', 4 * n, ''), K.ro('Peak output n\u00b7V_DC', n * p.Vdc, 'V'),
        K.ro('Fundamental peak', d.amp[1], 'V'), K.ro('V_o,rms', U.rms(v), 'V'), K.ro('THD', hf.thd * 100, '%'), K.ro('Lowest-order harmonic LOH', hf.loh || null, ''),
        K.ro('Switching angles (deg, first quarter)', ang.map(a => U.fmt(a, 3)).join(', '), '')];
      return Object.assign({ x: x, strips: strips, readouts: ro, bars: K.spectrumBars(d, H, 'Harmonic content of v_o  (% of fundamental)', 1) }, K.degAxis(360, 60));
    }
  });

  /* ---------------- resonant inverters ---------------- */
  PE.register({
    id: 'inv-resonant', group: GR, title: 'Resonant pulse inverters (series resonant, full-bridge resonant)',
    pages: 'Note: Series resonant inverter (Q1/Q2 unidirectional, natural commutation) and full-bridge resonant inverter (bidirectional switches)',
    desc: 'Series R-L-C load. Unidirectional switches: Q1 connects V_DC, Q2 short-circuits the RLC branch; each turns off by itself when the current returns to zero (underdamped: R\u00b2 < 4L/C). Full bridge: switches with anti-parallel diodes impose \u00b1V_DC for each half period.',
    params: [K.sel('topo', 'Circuit', [['uni', 'Series resonant (unidirectional switches Q1, Q2)'], ['bridge', 'Full-bridge resonant (bidirectional switches)']], 'uni'),
      K.num('Vdc', 'DC supply V_DC', 'V', 10, 600, 1, 100), K.num('R', 'R', '\u03a9', 0.1, 50, 0.1, 2), K.num('L', 'L', '\u00b5H', 1, 1000, 1, 50), K.num('C', 'C', '\u00b5F', 0.1, 200, 0.1, 10),
      K.num('fs', 'Switching frequency f_s (full period)', 'kHz', 0.5, 40, 0.1, 3.0), K.num('dead', 'Dead time between Q1 and Q2', '\u00b5s', 0, 100, 1, 10)],
    compute: function (p) {
      const L = p.L * 1e-6, C = p.C * 1e-6, w0 = 1 / Math.sqrt(L * C), zeta = p.R / 2 * Math.sqrt(C / L), under = zeta < 1, wr = under ? w0 * Math.sqrt(1 - zeta * zeta) : 0;
      const Ts = 1 / (p.fs * 1e3), dead = p.dead * 1e-6, ncy = 3, dt = Math.min(Ts / 4000, 2e-8 * 1 + 1 / (w0 * 80));
      const nst = Math.ceil(ncy * Ts / dt), t = [], I = [], Vc = [], Vs = [], G1 = [], G2 = [];
      let i = 0, vc = 0, mode = 0, warm = 20, pg1 = false, pg2 = false;
      const simPeriod = (rec) => {
        for (let k = 0; k < Math.ceil(Ts / dt); k++) {
          const tt = k * dt, u = tt;
          const g1 = u >= dead / 2 && u < Ts / 2 - dead / 2, g2 = u >= Ts / 2 + dead / 2 && u < Ts - dead / 2;
          let vsrc, cond = true;
          if (p.topo === 'bridge') { vsrc = g1 ? p.Vdc : g2 ? -p.Vdc : (i > 1e-9 ? -p.Vdc : i < -1e-9 ? p.Vdc : 0); }
          else {
            // unidirectional switches fire on the rising edge of their gate pulse and stop by themselves when the current returns to zero
            if (mode === 0) { if (g1 && !pg1) mode = 1; else if (g2 && !pg2) mode = 2; }
            if (mode === 1) vsrc = p.Vdc; else if (mode === 2) vsrc = 0; else { cond = false; vsrc = 0; }
          }
          if (cond) {
            const f = (ii, v) => [(vsrc - p.R * ii - v) / L, ii / C];
            const k1 = f(i, vc), k2 = f(i + dt / 2 * k1[0], vc + dt / 2 * k1[1]), k3 = f(i + dt / 2 * k2[0], vc + dt / 2 * k2[1]), k4 = f(i + dt * k3[0], vc + dt * k3[1]);
            let ni = i + dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); const nv = vc + dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
            if (p.topo === 'uni' && ((mode === 1 && ni <= 0) || (mode === 2 && ni >= 0))) { ni = 0; mode = 0; }
            i = ni; vc = nv;
          } else i = 0;
          pg1 = g1; pg2 = g2;
          if (rec) { t.push(tt); I.push(i); Vc.push(vc); Vs.push(cond ? vsrc : 0); G1.push(g1 ? 1 : 0); G2.push(g2 ? 1 : 0); }
        }
      };
      for (let q = 0; q < Math.max(warm, Math.ceil(12 / Math.max(zeta * w0 * Ts, 0.05))); q++) { if (q > 400) break; simPeriod(false); }
      const tOff = []; for (let q = 0; q < ncy; q++) { const n0 = t.length; simPeriod(true); for (let k = n0; k < t.length; k++) t[k] += q * Ts; }
      const x = U.mapArr(t, v => v * 1e6);
      const strips = [{ name: 'Gate Q1', y: Float64Array.from(G1), color: 3, ticks: [0, 1], ymin: -0.3, ymax: 1.4 }, { name: 'Gate Q2', y: Float64Array.from(G2), color: 4, ticks: [0, 1], ymin: -0.3, ymax: 1.4 },
        { name: 'Voltage applied to the RLC branch', unit: 'V', y: Float64Array.from(Vs), color: 1 },
        { name: 'Load current i_o', unit: 'A', y: Float64Array.from(I), color: 2 }, { name: 'Capacitor voltage v_c', unit: 'V', y: Float64Array.from(Vc), color: 0 }];
      const ipk = Math.max(...I.map(Math.abs)), per = Ts * 1e6;
      const ax = { x0: 0, x1: ncy * per, xticks: U.degTicks(ncy * per, per / 2), xlabel: 'time  (\u00b5s)', xtickLabel: v => U.fmt(v, 4) };
      const ro = [K.ro('Natural frequency \u03c9_0 = 1/\u221a(LC)', w0, 'rad/s'), K.ro('Damping ratio \u03b6 = (R/2)\u221a(C/L)', zeta, ''), K.ro('Underdamped (R\u00b2 < 4L/C)?', under ? 'yes' : 'NO \u2013 no resonant half-cycles', ''),
        K.ro('Resonant frequency \u03c9_r = \u03c9_0\u221a(1\u2212\u03b6\u00b2)', under ? wr : null, 'rad/s'), K.ro('f_r = \u03c9_r / 2\u03c0', under ? wr / TWO : null, 'Hz'),
        K.ro('Half-period of resonance \u03c0/\u03c9_r (conduction time of one switch)', under ? PI / wr * 1e6 : null, '\u00b5s'),
        K.ro('Half period of the switching pattern', Ts / 2 * 1e6, '\u00b5s'), K.ro('Peak current', ipk, 'A'), K.ro('Peak capacitor voltage', Math.max(...Vc.map(Math.abs)), 'V')];
      return Object.assign({ x: x, strips: strips, readouts: ro }, ax);
    }
  });
})(globalThis);
