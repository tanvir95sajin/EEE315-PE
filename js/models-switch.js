/* models-switch.js -- SCR latching, forced commutation Classes A, B, C */
(function (g) {
  'use strict';
  const PE = g.PE, U = PE.util, K = PE.kit;
  const GR = 'Switches & SCR commutation';
  const tAxis = (x1) => ({ x0: 0, x1: x1, xticks: U.degTicks(x1, x1 / 8), xlabel: 'time  (\u00b5s)', xtickLabel: v => U.fmt(v, 3) });

  /* ---------------- SCR latching: minimum gate pulse width ---------------- */
  PE.register({
    id: 'scr-latch', group: GR, title: 'SCR latching: minimum gate-pulse width (worked problems)',
    pages: 'Note: SCR, latching current I_L and holding current I_H; "Math" problems 1 and 2',
    desc: 'The anode current of a series R-L load rises as i = (V/R)(1 \u2212 e^{\u2212Rt/L}) (or V t/L if R = 0). The SCR latches only if i reaches I_L before the gate pulse ends. A parallel resistor R_p gives the current an instantaneous path (problem 2). Defaults reproduce problem 1(i): 75 \u00b5s.',
    params: [K.num('V', 'Supply voltage', 'V', 1, 500, 1, 100), K.num('R', 'Series resistance R', '\u03a9', 0, 500, 0.5, 0), K.num('L', 'Series inductance L', 'mH', 1, 2000, 1, 100),
      K.num('IL', 'Latching current I_L', 'mA', 1, 500, 1, 75), K.num('pw', 'Gate pulse width', '\u00b5s', 1, 1000, 1, 75), K.num('Rp', 'Parallel resistor R_p (0 = none)', '\u03a9', 0, 20000, 10, 0)],
    compute: function (p) {
      const L = p.L * 1e-3, IL = p.IL * 1e-3, pw = p.pw * 1e-6;
      const iRL = t => p.R <= 1e-9 ? p.V * t / L : p.V / p.R * (1 - Math.exp(-t * p.R / L));
      const iRp = p.Rp > 0 ? p.V / p.Rp : 0, itot = t => iRL(t) + iRp;
      let tmin = null;
      if (p.R <= 1e-9) tmin = (IL - iRp) * L / p.V; else if (p.V / p.R > IL - iRp) tmin = -(L / p.R) * Math.log(1 - (IL - iRp) * p.R / p.V); if (tmin != null && tmin < 0) tmin = 0;
      const span = Math.max(pw * 2, (tmin || pw) * 1.8, 2e-6), M = 600, t = U.range(M, 0, span), xu = U.mapArr(t, v => v * 1e6);
      const strips = [{ name: 'Gate pulse', y: U.mapArr(t, v => v <= pw ? 1 : 0), color: 3, ticks: [0, 1], ymin: -0.3, ymax: 1.4 },
        { name: 'Anode current i_A (and latching level)', unit: 'mA', y: U.mapArr(t, v => itot(v) * 1e3), color: 2, overlays: [{ y: U.mapArr(t, () => IL * 1e3), color: 1, dash: true, label: 'I_L' }] }];
      const ipw = itot(pw), latched = ipw >= IL;
      const rpmax = iRL(pw) < IL ? p.V / (IL - iRL(pw)) : null;
      const ro = [K.ro('Minimum pulse width for latching', tmin == null ? null : tmin * 1e6, '\u00b5s', null, tmin == null ? 'V/R < I_L: the load alone can never reach I_L' : ''),
        K.ro('Current at the end of the pulse', ipw * 1e3, 'mA'), K.ro('Latches?', latched ? 'yes' : 'no (SCR drops out when the pulse ends)', ''),
        K.ro('Largest parallel R_p that still latches', rpmax, '\u03a9', null, 'problem 2: V / (I_L \u2212 i(t_pulse))'), K.ro('Time constant L/R', p.R > 0 ? L / p.R * 1e6 : null, '\u00b5s')];
      return Object.assign({ x: xu, strips: strips, readouts: ro }, tAxis(span * 1e6));
    }
  });

  /* ---------------- Class A (series RLC load commutation) ---------------- */
  PE.register({
    id: 'comm-classA', group: GR, title: 'Forced commutation, Class A (load / self commutation)',
    pages: 'Note: Class A commutation: series R-L-C load, \u03b6 < 1 (R\u00b2 < 4L/C), capacitor charges to 2V_DC',
    desc: 'An underdamped series RLC rings; the current returns to zero after \u03c0/\u03c9_r and the SCR turns off. The capacitor overshoots to V_DC(1 + e^{\u2212\u03c0\u03b6/\u221a(1\u2212\u03b6\u00b2)}) \u2192 2V_DC for small \u03b6.',
    params: [K.num('V', 'DC supply V_DC', 'V', 10, 600, 1, 100), K.num('R', 'R', '\u03a9', 0.01, 50, 0.01, 1), K.num('L', 'L', '\u00b5H', 1, 2000, 1, 50), K.num('C', 'C', '\u00b5F', 0.1, 500, 0.1, 10)],
    compute: function (p) {
      const L = p.L * 1e-6, C = p.C * 1e-6, w0 = 1 / Math.sqrt(L * C), z = p.R / 2 * Math.sqrt(C / L), under = z < 1, wr = under ? w0 * Math.sqrt(1 - z * z) : 0;
      const span = under ? 1.6 * Math.PI / wr : 6 / (z * w0) * 0.3 + 4 / w0, M = 2400, dt = span / (M - 1);
      const t = U.range(M, 0, span), I = new Float64Array(M), V = new Float64Array(M), VS = new Float64Array(M);
      let i = 0, vc = 0, on = true, toff = null;
      for (let k = 0; k < M; k++) {
        I[k] = i; V[k] = vc; VS[k] = on ? 0 : p.V - vc;
        if (on) {
          const f = (ii, v) => [(p.V - p.R * ii - v) / L, ii / C];
          const h = dt, k1 = f(i, vc), k2 = f(i + h / 2 * k1[0], vc + h / 2 * k1[1]), k3 = f(i + h / 2 * k2[0], vc + h / 2 * k2[1]), k4 = f(i + h * k3[0], vc + h * k3[1]);
          const ni = i + h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); vc += h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
          if (ni <= 0 && k > 2) { on = false; toff = t[k + 1]; i = 0; } else i = ni;
        }
      }
      const xu = U.mapArr(t, v => v * 1e6);
      const strips = [{ name: 'Gate pulse I_g', y: U.mapArr(t, (v, k) => k < 12 ? 1 : 0), color: 3, ticks: [0, 1], ymin: -0.3, ymax: 1.4 },
        { name: 'Load current i_o', unit: 'A', y: I, color: 2 },
        { name: 'Capacitor voltage v_c', unit: 'V', y: V, color: 0, overlays: [{ y: U.mapArr(t, () => p.V), color: 6, dash: true, label: 'V_DC' }, { y: U.mapArr(t, () => 2 * p.V), color: 1, dash: true, label: '2V_DC' }] },
        { name: 'SCR voltage v_AK', unit: 'V', y: VS, color: 4 }];
      const vmax = U.max(V), ref = under ? p.V * (1 + Math.exp(-PI_ * z / Math.sqrt(1 - z * z))) : null;
      const ro = [K.ro('Natural frequency \u03c9_0 = 1/\u221a(LC)', w0, 'rad/s'), K.ro('Damping ratio \u03b6 = (R/2)\u221a(C/L)', z, ''), K.ro('Underdamped (R\u00b2 < 4L/C)?', under ? 'yes' : 'NO \u2013 SCR cannot turn off', ''),
        K.ro('Resonant frequency \u03c9_r', under ? wr : null, 'rad/s'), K.ro('Conduction time (SCR on) \u03c0/\u03c9_r', under ? Math.PI / wr * 1e6 : null, '\u00b5s', null), K.ro('Measured turn-off instant', toff == null ? null : toff * 1e6, '\u00b5s'),
        K.ro('Peak current', U.max(I), 'A'), K.ro('Peak capacitor voltage', vmax, 'V', ref), K.ro('Reverse voltage across SCR after turn-off', toff == null ? null : vmax - p.V, 'V')];
      return Object.assign({ x: xu, strips: strips, readouts: ro }, tAxis(span * 1e6));
    }
  });
  const PI_ = Math.PI;

  /* ---------------- Class B (resonant pulse) ---------------- */
  PE.register({
    id: 'comm-classB', group: GR, title: 'Forced commutation, Class B (resonant pulse / current commutation)',
    pages: 'Note: Class B commutation: main SCR T_M, auxiliary SCR T_A, LC circuit, I_M < I_H when I_c \u2265 I_L',
    desc: 'Constant load current I_L through T_M, capacitor pre-charged to V_DC. Firing T_A starts an LC oscillation i_c = V_DC\u221a(C/L) sin \u03c9_0 \u03c4. While i_c \u2265 I_L the main-SCR current I_M = I_L \u2212 i_c is zero and T_M turns off; the circuit turn-off time is (\u03c0 \u2212 2 asin(I_L/I_p))/\u03c9_0 (idealized, assumptions i\u2013iii of the note).',
    params: [K.num('V', 'DC supply V_DC', 'V', 10, 600, 1, 100), K.num('IL', 'Load current I_L (constant)', 'A', 0.5, 100, 0.5, 20), K.num('L', 'L', '\u00b5H', 1, 500, 1, 20), K.num('C', 'C', '\u00b5F', 0.1, 200, 0.1, 10),
      K.num('tA', 'Instant T_A is fired', '\u00b5s', 5, 100, 1, 20)],
    compute: function (p) {
      const L = p.L * 1e-6, C = p.C * 1e-6, w0 = 1 / Math.sqrt(L * C), Ip = p.V * Math.sqrt(C / L), tA = p.tA * 1e-6;
      const span = tA + 1.25 * Math.PI / w0, M = 1600, t = U.range(M, 0, span);
      const ic = U.mapArr(t, v => v < tA ? 0 : (v - tA <= Math.PI / w0 ? Ip * Math.sin(w0 * (v - tA)) : 0));
      const vc = U.mapArr(t, v => v < tA ? p.V : (v - tA <= Math.PI / w0 ? p.V * Math.cos(w0 * (v - tA)) : -p.V));
      const im = U.mapArr(ic, v => Math.max(p.IL - v, 0)), ok = Ip > p.IL;
      const tq = ok ? (Math.PI - 2 * Math.asin(p.IL / Ip)) / w0 : null, t1 = ok ? Math.asin(p.IL / Ip) / w0 : null;
      const strips = [{ name: 'Gate pulses  (T_M at 0, T_A at the marked instant)', y: U.mapArr(t, v => (v < 2e-6 || (v >= tA && v < tA + 2e-6)) ? 1 : 0), color: 3, ticks: [0, 1], ymin: -0.3, ymax: 1.4 },
        { name: 'Load current I_L', unit: 'A', y: U.mapArr(t, () => p.IL), color: 6, ymin: 0 },
        { name: 'Main SCR current I_M = I_L \u2212 i_c', unit: 'A', y: im, color: 2 },
        { name: 'Commutating current i_c', unit: 'A', y: ic, color: 1, overlays: [{ y: U.mapArr(t, () => p.IL), color: 6, dash: true, label: 'I_L' }] },
        { name: 'Capacitor voltage v_c', unit: 'V', y: vc, color: 0 }];
      const ro = [K.ro('Peak commutating current I_p = V_DC\u221a(C/L)', Ip, 'A'), K.ro('\u03c9_0 = 1/\u221a(LC)', w0, 'rad/s'), K.ro('Commutation succeeds (I_p > I_L)?', ok ? 'yes' : 'NO \u2013 I_M never reaches zero', ''),
        K.ro('T_M current reaches zero after T_A fires', t1 == null ? null : t1 * 1e6, '\u00b5s'), K.ro('Circuit turn-off time  (\u03c0 \u2212 2 asin(I_L/I_p))/\u03c9_0', tq == null ? null : tq * 1e6, '\u00b5s'),
        K.ro('Capacitor voltage after the half-cycle', -p.V, 'V')];
      return Object.assign({ x: U.mapArr(t, v => v * 1e6), strips: strips, readouts: ro }, tAxis(span * 1e6));
    }
  });

  /* ---------------- Class C (complementary) ---------------- */
  PE.register({
    id: 'comm-classC', group: GR, title: 'Forced commutation, Class C (complementary / impulse commutation)',
    pages: 'Note: Class C commutation: T1, T2, R1, R2 and the commutating capacitor C; waveforms of I_T1, I_T2, V_c, I_c',
    desc: 'T1 and T2 take turns. With T1 on, C charges through R2 (current V_s(1/R\u2081+1/R\u2082) decaying to V_s/R\u2081). Firing T2 puts the capacitor voltage across T1 with reverse polarity (turn-off); I_T2 starts at V_s(2/R\u2081+1/R\u2082). The next T1 pulse starts at V_s(1/R\u2081+2/R\u2082) because C is charged to \u2212V_s.',
    params: [K.num('Vs', 'Supply V_s', 'V', 10, 600, 1, 100), K.num('R1', 'R\u2081', '\u03a9', 1, 200, 1, 10), K.num('R2', 'R\u2082', '\u03a9', 1, 200, 1, 10), K.num('C', 'C', '\u00b5F', 0.1, 200, 0.1, 10),
      K.num('t1', 'T1 on-time per cycle', '\u00b5s', 50, 2000, 10, 500), K.num('t2', 'T2 on-time per cycle', '\u00b5s', 50, 2000, 10, 500)],
    compute: function (p) {
      const C = p.C * 1e-6, Vs = p.Vs, t1 = p.t1 * 1e-6, t2 = p.t2 * 1e-6, ncy = 3, M = 3000, span = ncy * (t1 + t2);
      const t = U.range(M, 0, span), IT1 = new Float64Array(M), IT2 = new Float64Array(M), VT1 = new Float64Array(M), VT2 = new Float64Array(M), VC = new Float64Array(M), IC = new Float64Array(M), G1 = new Float64Array(M), G2 = new Float64Array(M);
      let vc0 = 0; const tauA = p.R2 * C, tauB = p.R1 * C, starts = [];
      for (let c = 0; c < ncy; c++) { starts.push(c * (t1 + t2)); }
      // state at start of each stage
      const sA = [], sB = []; let v = 0;
      for (let c = 0; c < ncy; c++) { sA.push(v); const vA = Vs - (Vs - v) * Math.exp(-t1 / tauA); sB.push(vA); v = -Vs + (vA + Vs) * Math.exp(-t2 / tauB); }
      for (let k = 0; k < M; k++) {
        const c = Math.min(ncy - 1, Math.floor(t[k] / (t1 + t2) + 1e-12)), u = t[k] - c * (t1 + t2);
        if (u < t1) {
          const vc = Vs - (Vs - sA[c]) * Math.exp(-u / tauA), ic = (Vs - vc) / p.R2;
          IT1[k] = Vs / p.R1 + ic; IT2[k] = 0; VT1[k] = 0; VT2[k] = vc; VC[k] = vc; IC[k] = ic; G1[k] = u < 0.02 * t1 + 1e-9 ? 1 : 0;
        } else {
          const w = u - t1, vc = -Vs + (sB[c] + Vs) * Math.exp(-w / tauB), i1 = (Vs + vc) / p.R1;
          IT1[k] = 0; IT2[k] = i1 + Vs / p.R2; VT1[k] = -vc; VT2[k] = 0; VC[k] = vc; IC[k] = -i1; G2[k] = w < 0.02 * t2 + 1e-9 ? 1 : 0;
        }
      }
      const xu = U.mapArr(t, a => a * 1e6);
      const strips = [{ name: 'Gate pulses  (T1, T2)', y: G1, color: 3, overlays: [{ y: U.mapArr(G2, a => a + 1.5), color: 4 }], ticks: [0, 1.5], tickLabels: { 0: 'T1', 1.5: 'T2' }, ymin: -0.3, ymax: 2.8 },
        { name: 'V_T1', unit: 'V', y: VT1, color: 0 }, { name: 'I_T1', unit: 'A', y: IT1, color: 2 }, { name: 'V_T2', unit: 'V', y: VT2, color: 0 }, { name: 'I_T2', unit: 'A', y: IT2, color: 2 },
        { name: 'Capacitor voltage V_c', unit: 'V', y: VC, color: 1 }, { name: 'Capacitor current I_c', unit: 'A', y: IC, color: 5 }];
      const vA = sB[1], tq = p.R1 * C * Math.log((vA + Vs) / Vs) * 1e6;
      const ro = [K.ro('I_T1 at first turn-on (C empty)', Vs * (1 / p.R1 + 1 / p.R2), 'A', Vs * (1 / p.R1 + 1 / p.R2)), K.ro('I_T1 final value in the conduction interval', Vs / p.R1, 'A', Vs / p.R1),
        K.ro('I_T2 at turn-on', Vs * (2 / p.R1 + 1 / p.R2), 'A', Vs * (2 / p.R1 + 1 / p.R2)), K.ro('I_T2 final value', Vs / p.R2, 'A', Vs / p.R2),
        K.ro('I_T1 at the next turn-on (C at \u2212V_s)', Vs * (1 / p.R1 + 2 / p.R2), 'A', Vs * (1 / p.R1 + 2 / p.R2), 'the note: V_s(1/R\u2081 + 2/R\u2082) "because of capacitor voltage"'),
        K.ro('Time T1 stays reverse biased (circuit turn-off time)', tq, '\u00b5s'), K.ro('Time constants R\u2082C / R\u2081C', (tauA * 1e6).toFixed(1) + ' / ' + (tauB * 1e6).toFixed(1), '\u00b5s')];
      return Object.assign({ x: xu, strips: strips, readouts: ro, stripH: 70 }, tAxis(span * 1e6));
    }
  });
})(globalThis);
