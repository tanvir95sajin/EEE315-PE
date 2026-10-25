/* modelkit.js -- helpers shared by all circuit models */
(function (g) {
  'use strict';
  const PE = g.PE = g.PE || {};
  const U = PE.util;
  const K = PE.kit = {};

  /** parameter descriptors */
  K.num = function (key, label, unit, min, max, step, def, extra) {
    return Object.assign({ key: key, label: label, unit: unit || '', type: 'range', min: min, max: max, step: step, def: def }, extra || {});
  };
  K.sel = function (key, label, options, def, extra) {
    return Object.assign({ key: key, label: label, type: 'select', options: options, def: def }, extra || {});
  };
  K.chk = function (key, label, def, extra) {
    return Object.assign({ key: key, label: label, type: 'check', def: def }, extra || {});
  };

  /** readout row: value from the simulation, ref = value predicted by the formula in the note (optional) */
  K.ro = function (label, value, unit, ref, hint) { return { label: label, value: value, unit: unit || '', ref: ref, hint: hint }; };

  /** x-axis in degrees */
  K.degAxis = function (x1, step) {
    return { x0: 0, x1: x1, xticks: U.degTicks(x1, step || (x1 > 400 ? 90 : 60)), xlabel: '\u03b8 = \u03c9t  (degrees)', xtickLabel: v => v + '\u00b0' };
  };
  /** convert a radian array to degrees */
  K.toDeg = a => U.mapArr(a, v => v * U.R2D);

  /** stacked gate-pulse strip. gates: [{name, start(deg), width(deg), period(deg)}] ; xdeg array */
  K.gateStrip = function (xdeg, gates, label, color) {
    const ticks = [], tl = {}, n = xdeg.length, ys = [];
    gates.forEach((gt, j) => {
      const base = j * 1.5, y = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        const per = gt.period || 360, u = U.modPos(xdeg[i] - gt.start, per);
        y[i] = base + (u < gt.width ? 1 : 0);
      }
      ys.push(y); ticks.push(base); tl[base] = gt.name;
    });
    return { name: label || 'Gate pulses', y: ys[0], overlays: ys.slice(1).map((y, j) => ({ y: y, color: ((color || 3) + j + 1) % 8 })), color: color || 3, ticks: ticks, tickLabels: tl, ymin: -0.3, ymax: (gates.length - 1) * 1.5 + 1.3, legend: [] };
  };

  /** pulse train helper: rectangular wave on for [on0,on1) degrees inside each `period` */
  K.pulse = function (xdeg, on0, on1, period) {
    const y = new Float64Array(xdeg.length);
    for (let i = 0; i < y.length; i++) { const u = U.modPos(xdeg[i], period); y[i] = (u >= on0 && u < on1) ? 1 : 0; }
    return y;
  };

  /** stats over the last cycle of an array that holds `keep` cycles of N samples (+1) */
  K.lastCycle = function (arr, N, keep) { return U.slice(arr, (keep - 1) * N, keep * N); };

  /** spectrum helper: returns {amp[1..H] relative to fundamental (%), hfom} from one period of y */
  K.spectrum = function (y, H, fundIdx) {
    const d = U.dft(y, H), m = U.hfom(d.amp, H, fundIdx || 1);
    return { dft: d, hf: m };
  };
  K.spectrumBars = function (dft, H, title, fundIdx) {
    const a1 = dft.amp[fundIdx || 1] || 1, v = [];
    for (let n = 1; n <= H; n++) v.push(dft.amp[n] / a1 * 100);
    return { title: title || 'Harmonic content  V_n / V_1  [%]', values: v, first: 1, hilite: new Set([fundIdx || 1]) };
  };
})(globalThis);
