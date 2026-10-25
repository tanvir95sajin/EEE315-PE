/* models-rect.js -- phase-controlled / uncontrolled rectifiers with R, RL, RLE load, freewheeling diode */
(function (g) {
  'use strict';
  const PE = g.PE, U = PE.util, K = PE.kit, S = PE.sim, D2R = U.D2R, PI = Math.PI;
  const GR = 'Rectifiers (AC \u2192 DC)';

  const loadParams = (Rdef, Ldef) => [
    K.num('R', 'Load resistance R', '\u03a9', 0.5, 100, 0.5, Rdef),
    K.num('L', 'Load inductance L', 'mH', 0, 2000, 1, Ldef),
    K.num('E', 'Back-emf E (battery)', 'V', 0, 400, 1, 0),
    K.num('Vd', 'Device voltage drop', 'V', 0, 5, 0.1, 0),
    K.chk('fwd', 'Freewheeling diode across the load', false)
  ];

  function run(p, def) {
    const a = (p.dev === 'diode' ? 0 : p.alpha) * D2R;
    const XL = 2 * PI * p.f * p.L / 1000;
    const src = def.src(p, a);
    const r = S.rectifier({ R: p.R, XL: XL, E: p.E, Vd: p.Vd, fwd: p.fwd, src: src, nPer: 3600, keep: 2 });
    const N = r.N, M = r.th.length, x = K.toDeg(r.th), ax = K.degAxis(720, 90);
    // phase quantities for display
    const vph = def.vph(p).map(fn => U.mapArr(r.th, fn));
    const nph = def.nph;
    const ip = []; for (let q = 0; q < nph; q++) ip.push(new Float64Array(M));
    for (let k = 0; k < M; k++) { const d = r.dev[k]; if (d >= 0) for (let q = 0; q < nph; q++) ip[q][k] = src[d].cur[q] * r.i[k]; }
    const strips = [];
    strips.push({ name: def.vsName, unit: 'V', y: vph[0], overlays: vph.slice(1).map((y, j) => ({ y: y, color: j + 1, label: def.phLabels ? def.phLabels[j + 1] : undefined })), color: 0, legend: def.phLabels ? [[def.phLabels[0], 0]] : [] });
    strips.push(K.gateStrip(x, def.gates(p, a * U.R2D), 'Gate pulses', 3));
    if (def.devLabels) {
      const nd = def.devLabels.length, y = new Float64Array(M), tl = { 0: 'off' }, ticks = [0];
      for (let k = 0; k < M; k++) { const d = r.dev[k]; y[k] = d >= 0 ? d + 1 : (d === -2 ? nd + 1 : 0); }
      def.devLabels.forEach((s, j) => { tl[j + 1] = s; ticks.push(j + 1); });
      if (p.fwd) { tl[nd + 1] = 'FWD'; ticks.push(nd + 1); }
      strips.push({ name: 'Conducting', y: y, color: 5, ticks: ticks, tickLabels: tl, ymin: -0.3, ymax: ticks[ticks.length - 1] + 0.5 });
    }
    strips.push({ name: 'Load voltage v_o', unit: 'V', y: r.vo, color: 1, avg: true });
    strips.push({ name: 'Load current i_o', unit: 'A', y: r.i, color: 2, avg: true });
    strips.push({ name: 'Supply current ' + (nph > 1 ? 'i_a' : 'i_s'), unit: 'A', y: ip[0], color: 4 });

    const vo = K.lastCycle(r.vo, N, 2), io = K.lastCycle(r.i, N, 2), vs0 = K.lastCycle(vph[0], N, 2), is0 = K.lastCycle(ip[0], N, 2);
    const Vdc = U.mean(vo), Vrms = U.rms(vo), Idc = U.mean(io), Irms = U.rms(io);
    let P = 0;
    for (let q = 0; q < nph; q++) { const v = K.lastCycle(vph[q], N, 2), ii = K.lastCycle(ip[q], N, 2); let s = 0; for (let k = 0; k < N; k++) s += v[k] * ii[k]; P += s / N; }
    const Vsr = U.rms(vs0), Isr = U.rms(is0), PF = Isr > 1e-9 ? P / (nph * Vsr * Isr) : 0;
    const FF = Vdc !== 0 ? Vrms / Vdc : Infinity, RF = Vdc !== 0 ? Math.sqrt(Math.max(0, FF * FF - 1)) : Infinity;
    const eta = (Vrms * Irms) > 1e-12 ? (Vdc * Idc) / (Vrms * Irms) : 0;
    let minI = Infinity; for (let k = 0; k < N; k++) if (io[k] < minI) minI = io[k];
    const cont = minI > 1e-6 * (Idc + 1e-12) && Idc > 0;
    // extinction angle (single device groups only): last falling zero of i_o inside the cycle
    let beta = null;
    if (!cont && Idc > 0) { for (let k = 1; k < N; k++) if (io[k] === 0 && io[k - 1] > 0) { beta = k * 360 / N; break; } }
    const ref = (p.E === 0 && p.L === 0 && p.Vd === 0) ? def.ref(p, a) : null;
    const ro = [
      K.ro('V_o,avg  (V_dc)', Vdc, 'V', ref && ref.Vdc),
      K.ro('V_o,rms', Vrms, 'V', ref && ref.Vrms),
      K.ro('I_o,avg', Idc, 'A', ref && ref.Vdc / p.R),
      K.ro('I_o,rms', Irms, 'A', ref && ref.Vrms / p.R),
      K.ro('Form factor  FF = V_rms / V_dc', FF, '', ref && ref.Vrms / ref.Vdc),
      K.ro('Ripple factor  RF = \u221a(FF\u00b2 \u2212 1)', RF, ''),
      K.ro('Rectification ratio  \u03b7 = P_dc / P_ac', eta, ''),
      K.ro('Input power factor', PF, ''),
      K.ro('Load current', cont ? 'continuous' : 'discontinuous', ''),
      K.ro('Extinction angle \u03b2', beta, '\u00b0')
    ];
    if (def.inductive && !p.fwd) ro.push(K.ro('V_dc if L \u2192 \u221e (continuous)', null, 'V', def.inductive(p, a)));
    return Object.assign({ x: x, strips: strips, readouts: ro, notes: [] }, ax);
  }

  const alphaP = K.num('alpha', 'Firing angle \u03b1', '\u00b0', 0, 180, 1, 0, { show: p => p.dev !== 'diode' });
  const devP = K.sel('dev', 'Devices', [['thyristor', 'Thyristors (controlled)'], ['diode', 'Diodes (uncontrolled, \u03b1 = 0)']], 'diode');

  /* ---- single-phase half-wave ---- */
  PE.register({
    id: 'rect-1ph-hw', group: GR, title: 'Single-phase half-wave rectifier',
    pages: 'Note: Rectifiers, single-phase half-wave (uncontrolled and controlled)',
    desc: 'Diode or thyristor feeding R, R-L, R-L-E (battery charger) loads, with optional freewheeling diode. Set the devices to diodes and L = 0 to reproduce V_dc = V_m/\u03c0 and V_rms = V_m/2.',
    params: [K.num('Vm', 'Supply peak V_m', 'V', 10, 600, 1, 325), K.num('f', 'Supply frequency f', 'Hz', 10, 400, 1, 50), devP, alphaP].concat(loadParams(10, 0)),
    compute: function (p) {
      return run(p, {
        nph: 1, vsName: 'Supply v_s', phLabels: null,
        src: (q, a) => [{ start: a, width: Math.max(PI - a, 0.05), v: t => q.Vm * Math.sin(t), cur: [1] }],
        vph: q => [t => q.Vm * Math.sin(t)],
        gates: (q, ad) => [{ name: 'G (T1)', start: ad, width: 12 }],
        ref: (q, a) => ({ Vdc: q.Vm * (1 + Math.cos(a)) / (2 * PI), Vrms: q.Vm / 2 * Math.sqrt(1 - a / PI + Math.sin(2 * a) / (2 * PI)) })
      });
    }
  });

  /* ---- single-phase full-wave bridge ---- */
  PE.register({
    id: 'rect-1ph-fw', group: GR, title: 'Single-phase full-wave bridge rectifier',
    pages: 'Note: Rectifiers, single-phase full-wave (uncontrolled and fully controlled; resistive, RL, highly inductive load)',
    desc: 'Fully controlled bridge (T1,T2 / T3,T4). With diodes it is the uncontrolled bridge; with a very large L the load current is constant (highly inductive load). The centre-tapped version gives the same waveforms with V_m of one half of the secondary.',
    params: [K.num('Vm', 'Supply peak V_m', 'V', 10, 600, 1, 325), K.num('f', 'Supply frequency f', 'Hz', 10, 400, 1, 50), devP, alphaP].concat(loadParams(10, 0)),
    compute: function (p) {
      return run(p, {
        nph: 1, vsName: 'Supply v_s',
        src: (q, a) => [{ start: a, width: Math.max(PI - a, 0.05), v: t => q.Vm * Math.sin(t), cur: [1] },
                        { start: PI + a, width: Math.max(PI - a, 0.05), v: t => -q.Vm * Math.sin(t), cur: [-1] }],
        vph: q => [t => q.Vm * Math.sin(t)],
        gates: (q, ad) => [{ name: 'G1,G2', start: ad, width: 12 }, { name: 'G3,G4', start: 180 + ad, width: 12 }],
        devLabels: ['T1,T2', 'T3,T4'],
        ref: (q, a) => ({ Vdc: q.Vm * (1 + Math.cos(a)) / PI, Vrms: q.Vm / Math.SQRT2 * Math.sqrt(1 - a / PI + Math.sin(2 * a) / (2 * PI)) }),
        inductive: (q, a) => 2 * q.Vm * Math.cos(a) / PI
      });
    }
  });

  /* ---- three-phase half-wave ---- */
  const ph3 = q => [t => q.Vm * Math.sin(t), t => q.Vm * Math.sin(t - 2 * PI / 3), t => q.Vm * Math.sin(t - 4 * PI / 3)];
  PE.register({
    id: 'rect-3ph-hw', group: GR, title: 'Three-phase half-wave (3-pulse) rectifier',
    pages: 'Note: Rectifiers, three-phase half-wave (uncontrolled and controlled)',
    desc: 'Three thyristors/diodes with a common cathode; each conducts for 120\u00b0 in continuous conduction. V_m is the phase-voltage peak.',
    params: [K.num('Vm', 'Phase peak V_m', 'V', 10, 600, 1, 325), K.num('f', 'Supply frequency f', 'Hz', 10, 400, 1, 50), devP, alphaP].concat(loadParams(10, 0)),
    compute: function (p) {
      return run(p, {
        nph: 3, vsName: 'Phase voltages', phLabels: ['v_a', 'v_b', 'v_c'],
        src: (q, a) => ph3(q).map((fn, j) => ({ start: PI / 6 + a + j * 2 * PI / 3, width: 2 * PI / 3, v: fn, cur: [j === 0 ? 1 : 0, j === 1 ? 1 : 0, j === 2 ? 1 : 0] })),
        vph: ph3,
        gates: (q, ad) => [0, 1, 2].map(j => ({ name: 'G' + (j + 1) + ' (T' + (j + 1) + ')', start: 30 + ad + 120 * j, width: 12 })),
        devLabels: ['T1', 'T2', 'T3'],
        ref: (q, a) => {
          const Vdc = a <= PI / 6 ? 3 * Math.sqrt(3) * q.Vm * Math.cos(a) / (2 * PI) : 3 * q.Vm * (1 + Math.cos(PI / 6 + a)) / (2 * PI);
          const Vrms = a <= PI / 6 ? Math.sqrt(3) * q.Vm * Math.sqrt(1 / 6 + Math.sqrt(3) / (8 * PI) * Math.cos(2 * a)) : null;
          return { Vdc: Vdc, Vrms: Vrms };
        },
        inductive: (q, a) => 3 * Math.sqrt(3) * q.Vm * Math.cos(a) / (2 * PI)
      });
    }
  });

  /* ---- three-phase full bridge ---- */
  PE.register({
    id: 'rect-3ph-fw', group: GR, title: 'Three-phase full-wave (6-pulse) bridge rectifier',
    pages: 'Note: Rectifiers, three-phase full bridge (uncontrolled and controlled)',
    desc: 'Six devices, two conducting at a time (60\u00b0 intervals, each device 120\u00b0). V_m is the phase-voltage peak (line peak = \u221a3 V_m). The reference rows give the textbook closed forms for a resistive load.',
    params: [K.num('Vm', 'Phase peak V_m', 'V', 10, 600, 1, 325), K.num('f', 'Supply frequency f', 'Hz', 10, 400, 1, 50), devP, alphaP].concat(loadParams(10, 0)),
    compute: function (p) {
      const pairs = [[0, 1], [0, 2], [1, 2], [1, 0], [2, 0], [2, 1]];      // (high phase, low phase) for pairs 6-1,1-2,2-3,3-4,4-5,5-6
      return run(p, {
        nph: 3, vsName: 'Phase voltages', phLabels: ['v_a', 'v_b', 'v_c'],
        src: (q, a) => { const fn = ph3(q); return pairs.map((pr, j) => ({ start: PI / 6 + a + j * PI / 3, width: PI / 3, v: t => fn[pr[0]](t) - fn[pr[1]](t), cur: [0, 1, 2].map(m => m === pr[0] ? 1 : m === pr[1] ? -1 : 0) })); },
        vph: ph3,
        gates: (q, ad) => [1, 2, 3, 4, 5, 6].map((k, j) => ({ name: 'G' + k, start: 30 + ad + 60 * j, width: 12 })),
        devLabels: ['T6,T1', 'T1,T2', 'T2,T3', 'T3,T4', 'T4,T5', 'T5,T6'],
        ref: (q, a) => {
          const Vdc = a <= PI / 3 ? 3 * Math.sqrt(3) * q.Vm * Math.cos(a) / PI : 3 * Math.sqrt(3) * q.Vm * (1 + Math.cos(a + PI / 3)) / PI;
          const Vrms = a <= PI / 3 ? Math.sqrt(3) * q.Vm * Math.sqrt(0.5 + 3 * Math.sqrt(3) / (4 * PI) * Math.cos(2 * a)) : null;
          return { Vdc: Vdc, Vrms: Vrms };
        },
        inductive: (q, a) => 3 * Math.sqrt(3) * q.Vm * Math.cos(a) / PI
      });
    }
  });
})(globalThis);
