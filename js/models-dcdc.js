/* models-dcdc.js -- buck, boost, buck-boost, flyback, Cuk, SEPIC (ideal switch and diode, CCM and DCM) */
(function (g) {
  'use strict';
  const PE = g.PE, U = PE.util, K = PE.kit, S = PE.sim;
  const GR = 'DC \u2192 DC converters';

  /* trapezoidal time average / rms of a sampled signal over the last switching period */
  function lastPeriod(res, arr) {
    const t = res.t, T = res.T, t0 = (res.nkeep - 1) * T - 1e-12, o = { t: [], v: [] };
    for (let k = 0; k < t.length; k++) if (t[k] >= t0) { o.t.push(t[k]); o.v.push(arr[k]); }
    return o;
  }
  const tavg = (o) => { let s = 0; for (let k = 1; k < o.t.length; k++) s += (o.v[k] + o.v[k - 1]) / 2 * (o.t[k] - o.t[k - 1]); return s / (o.t[o.t.length - 1] - o.t[0]); };
  const trms = (o) => { let s = 0; for (let k = 1; k < o.t.length; k++) s += (o.v[k] * o.v[k] + o.v[k - 1] * o.v[k - 1]) / 2 * (o.t[k] - o.t[k - 1]); return Math.sqrt(s / (o.t[o.t.length - 1] - o.t[0])); };
  const pp = (o) => Math.max.apply(null, o.v) - Math.min.apply(null, o.v);

  function baseParams(top) {
    const two = top === 'cuk' || top === 'sepic';
    const a = [K.num('Vs', 'Input voltage V_s', 'V', 1, 400, 1, top === 'boost' || top === 'sepic' ? 12 : 48),
      K.num('D', 'Duty ratio D', '', 0.05, 0.95, 0.01, 0.5), K.num('f', 'Switching frequency f', 'kHz', 1, 500, 1, 20),
      K.num('L', two ? 'Inductance L\u2081' : (top === 'flyback' ? 'Magnetizing inductance L_m (primary)' : 'Inductance L'), 'mH', 0.005, 50, 0.005, two ? 1 : 1),
      K.num('C', two ? 'Output capacitance C\u2082' : 'Output capacitance C', '\u00b5F', 1, 2000, 1, 100), K.num('R', 'Load resistance R', '\u03a9', 0.5, 500, 0.5, 10)];
    if (two) { a.splice(4, 0, K.num('L2', 'Inductance L\u2082', 'mH', 0.005, 50, 0.005, 1)); a.splice(6, 0, K.num('C1', 'Coupling capacitance C\u2081', '\u00b5F', 1, 2000, 1, 100)); }
    if (top === 'flyback') a.splice(4, 0, K.num('n', 'Turns ratio n = N_s / N_p', '', 0.1, 10, 0.1, 1));
    return a;
  }

  function make(top, title, pages, desc) {
    PE.register({
      id: 'dcdc-' + top, group: GR, title: title, pages: pages, desc: desc, params: baseParams(top),
      compute: function (p) {
        const two = top === 'cuk' || top === 'sepic', fHz = p.f * 1e3, T = 1 / fHz;
        const res = S.dcdc(top, { Vs: p.Vs, D: p.D, f: fHz, L: p.L * 1e-3, L2: (p.L2 || p.L) * 1e-3, C: p.C * 1e-6, C1: (p.C1 || p.C) * 1e-6, R: p.R, n: p.n || 1, nPer: 400, keep: 3 });
        const t = res.t, n = t.length, sw = res.sw, X = res.x, DX = res.dx;
        const col = j => Float64Array.from(X, v => v[j]), dcol = j => Float64Array.from(DX, v => v[j]);
        const Lp = p.L * 1e-3, L2p = (p.L2 || p.L) * 1e-3, C2 = p.C * 1e-6;
        const unitMs = T >= 1e-3, sc = unitMs ? 1e3 : 1e6, xu = unitMs ? 'ms' : '\u00b5s';
        const x = Float64Array.from(t, v => v * sc);
        const gate = Float64Array.from(sw);
        let strips, vo, il, iin, iD, vLarr;
        const sgn = (top === 'buckboost') ? -1 : 1;
        if (!two) {
          il = col(0); const vc = col(1); vo = Float64Array.from(vc, v => sgn * v);
          vLarr = dcol(0).map(v => v * Lp);
          iD = Float64Array.from(sw, (s, k) => s ? 0 : (top === 'flyback' ? il[k] / p.n : il[k]));
          iin = Float64Array.from(sw, (s, k) => top === 'boost' ? il[k] : (s ? il[k] : 0));
          const iC = dcol(1).map(v => v * C2);
          strips = [{ name: 'Switch gate (1 = on)', y: gate, color: 3, ticks: [0, 1], ymin: -0.3, ymax: 1.4 },
            { name: top === 'flyback' ? 'Primary inductor voltage v_L' : 'Inductor voltage v_L', unit: 'V', y: vLarr, color: 0 },
            { name: top === 'flyback' ? 'Magnetizing current i_m (primary)' : 'Inductor current i_L', unit: 'A', y: il, color: 2, avg: true },
            { name: top === 'flyback' ? 'Diode (secondary) current' : 'Diode current i_D', unit: 'A', y: iD, color: 4, avg: true },
            { name: 'Capacitor current i_C', unit: 'A', y: iC, color: 5 },
            { name: 'Output voltage v_o (zoomed)', unit: 'V', y: vo, color: 1, avg: true, zoom: true }];
        } else {
          const i1 = col(0), i2 = col(1), v1 = col(2); vo = col(3); il = i1;
          iD = Float64Array.from(sw, (s, k) => s ? 0 : Math.max(0, i1[k] - i2[k]));
          iin = i1;
          strips = [{ name: 'Switch gate (1 = on)', y: gate, color: 3, ticks: [0, 1], ymin: -0.3, ymax: 1.4 },
            { name: 'Inductor voltages v_L1, v_L2', unit: 'V', y: dcol(0).map(v => v * Lp), color: 0, overlays: [{ y: dcol(1).map(v => v * L2p), color: 4, label: 'v_L2' }], legend: [['v_L1', 0]] },
            { name: 'Inductor currents i_L1, i_L2', unit: 'A', y: i1, color: 2, overlays: [{ y: i2, color: 5, label: 'i_L2' }], legend: [['i_L1', 2]] },
            { name: 'Diode current i_D', unit: 'A', y: iD, color: 4, avg: true },
            { name: 'Coupling capacitor v_C1 (zoomed)', unit: 'V', y: v1, color: 6, avg: true, zoom: true },
            { name: 'Output voltage v_o (zoomed)', unit: 'V', y: vo, color: 1, avg: true, zoom: true }];
        }
        const o = (arr) => lastPeriod(res, arr);
        const Vo = tavg(o(vo)), Vopp = pp(o(vo)), ILavg = tavg(o(il)), ILpp = pp(o(il)), Pin = p.Vs * tavg(o(iin)), Pout = Vo * Vo / p.R;
        const D = res.D, Dc = D;
        // theory
        let ccm, dcmTh = null, Lmin = null, dI = null, dV = null, K2 = 2 * (p.L * 1e-3) / (p.R * T);
        if (top === 'buck') { ccm = D * p.Vs; dcmTh = p.Vs * 2 / (1 + Math.sqrt(1 + 4 * K2 / (D * D))); Lmin = (1 - D) * p.R / (2 * fHz); dI = ccm * (1 - D) / (Lp * fHz); dV = ccm * (1 - D) / (8 * Lp * C2 * fHz * fHz); }
        else if (top === 'boost') { ccm = p.Vs / (1 - D); dcmTh = p.Vs * (1 + Math.sqrt(1 + 4 * D * D / K2)) / 2; Lmin = D * (1 - D) * (1 - D) * p.R / (2 * fHz); dI = p.Vs * D / (Lp * fHz); dV = ccm * D / (p.R * C2 * fHz); }
        else if (top === 'buckboost') { ccm = -D * p.Vs / (1 - D); dcmTh = -D * p.Vs / Math.sqrt(K2); Lmin = (1 - D) * (1 - D) * p.R / (2 * fHz); dI = p.Vs * D / (Lp * fHz); dV = Math.abs(ccm) * D / (p.R * C2 * fHz); }
        else if (top === 'flyback') { ccm = p.n * D * p.Vs / (1 - D); dcmTh = D * p.Vs * Math.sqrt(p.R * T / (2 * Lp)); Lmin = (1 - D) * (1 - D) * p.R / (2 * fHz * p.n * p.n); dI = p.Vs * D / (Lp * fHz); dV = ccm * D / (p.R * C2 * fHz); }
        else if (top === 'cuk') { ccm = -D * p.Vs / (1 - D); dI = p.Vs * D / (Lp * fHz); }
        else { ccm = D * p.Vs / (1 - D); dI = p.Vs * D / (Lp * fHz); }
        // CCM / DCM detection: inductor current (or i1 - i2) reaching zero during the off interval
        const idx = []; for (let k = 0; k < n; k++) if (t[k] >= (res.nkeep - 1) * T - 1e-12 && !sw[k]) idx.push(k);
        let dcm = false;
        idx.forEach(k => { if (two ? (X[k][0] - X[k][1]) <= 1e-7 * (Math.abs(X[k][0]) + 1e-9) : X[k][0] <= 1e-9) dcm = true; });
        const theory = dcm && dcmTh != null ? dcmTh : ccm;
        const ro = [K.ro('Operating mode', dcm ? 'DCM (inductor current reaches zero)' : 'CCM', ''),
          K.ro('Output voltage V_o (average)', Vo, 'V', theory, dcm ? 'DCM formula' : 'CCM: ' + (top === 'buck' ? 'D V_s' : top === 'boost' ? 'V_s/(1\u2212D)' : 'ideal ratio')),
          K.ro('Output current I_o', Vo / p.R, 'A'), K.ro('Avg inductor current ' + (two ? 'I_L1' : 'I_L'), ILavg, 'A'),
          K.ro('Inductor current ripple \u0394i_L (peak-to-peak)', ILpp, 'A', dcm ? null : dI), K.ro('Output voltage ripple \u0394v_o (peak-to-peak)', Vopp, 'V', (dcm || dV == null) ? null : dV),
          K.ro('Input power P_in', Pin, 'W'), K.ro('Output power P_out = V_o\u00b2/R', Pout, 'W', Pin, 'ideal converter: P_out = P_in'),
          K.ro('Critical inductance L_min (CCM boundary)', Lmin == null ? null : Lmin * 1e3, 'mH'),
          K.ro('Steady state reached', res.converged ? 'yes' : 'not fully (' + res.periods + ' periods)', '')];
        const ax = { x0: 0, x1: res.nkeep * T * sc, xticks: U.degTicks(res.nkeep * T * sc, T * sc / 2), xlabel: 'time  (' + xu + ')', xtickLabel: v => U.fmt(v, 4) };
        return Object.assign({ x: x, strips: strips, readouts: ro, stripH: 84 }, ax);
      }
    });
  }
  make('buck', 'Buck (step-down) converter', 'Note: DC-DC converters, buck converter (CCM and DCM, ripple, L_min)', 'Switch on: v_L = V_s \u2212 V_o; off: v_L = \u2212V_o. Reproduces V_o = D V_s, \u0394i_L = V_o(1\u2212D)/(Lf), \u0394V_o/V_o = (1\u2212D)/(8LCf\u00b2).');
  make('boost', 'Boost (step-up) converter', 'Note: DC-DC converters, boost converter', 'Switch on: v_L = V_s; off: v_L = V_s \u2212 V_o. V_o = V_s/(1\u2212D), \u0394i_L = V_s D/(Lf), \u0394V_o/V_o = D/(RCf).');
  make('buckboost', 'Buck-boost (inverting) converter', 'Note: DC-DC converters, buck-boost converter', 'Inverting converter: V_o = \u2212D V_s/(1\u2212D). The output is plotted with its true (negative) polarity.');
  make('cuk', '\u0106uk converter', 'Note: DC-DC converters, \u0106uk converter', 'Two inductors and a coupling capacitor C\u2081 (V_C1 = V_s/(1\u2212D)); V_o = \u2212D V_s/(1\u2212D). Simulated through CCM and the DCM mode where i_L1 = i_L2.');
  make('sepic', 'SEPIC (single-ended primary-inductor converter)', 'Note: DC-DC converters, SEPIC', 'Non-inverting: V_o = D V_s/(1\u2212D), coupling capacitor charged to V_s. (i_L2 is drawn with the reference direction used in the simulation, so it is negative in normal operation.)');
  make('flyback', 'Flyback converter', 'Note: DC-DC converters, flyback converter (isolated buck-boost)', 'Coupled inductor with turns ratio n = N_s/N_p, magnetizing inductance on the primary: V_o = n D V_s/(1\u2212D) in CCM; in DCM V_o = D V_s \u221a(RT/2L_m).');
})(globalThis);
