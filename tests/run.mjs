// Numerical verification of every simulator against the closed-form results given in the note / textbooks.
// Run with:  node tests/run.mjs
import '../js/util.js'; import '../js/plot.js'; import '../js/engines.js'; import '../js/modelkit.js';
import '../js/models-switch.js'; import '../js/models-acac.js'; import '../js/models-inv.js'; import '../js/models-rect.js'; import '../js/models-dcdc.js'; import '../js/aliases.js';
const PE = globalThis.PE, PI = Math.PI;
let pass = 0, fail = 0;
function model(id) { const m = PE.models.find(x => x.id === id); if (!m) throw new Error('no model ' + id); return m; }
function run(id, over) { const m = model(id), p = {}; m.params.forEach(q => { p[q.key] = q.def; }); Object.assign(p, over || {}); return m.compute(p); }
function ro(res, start) { const r = res.readouts.find(x => x.label.startsWith(start)); if (!r) throw new Error('no readout ' + start); return r; }
function near(name, got, want, tol) {
  const e = Math.abs(got - want) / Math.max(Math.abs(want), 1e-9);
  if (e <= tol) { pass++; console.log('  ok   ' + name + '  = ' + got.toPrecision(5) + '  (expected ' + want.toPrecision(5) + ')'); }
  else { fail++; console.log('  FAIL ' + name + '  = ' + got.toPrecision(5) + '  expected ' + want.toPrecision(5) + '  (' + (e * 100).toFixed(2) + ' %)'); }
}
const D2R = PI / 180;

console.log('Rectifiers');
{ let r = run('rect-1ph-hw', { dev: 'diode' });
  near('1ph half-wave R: Vdc = Vm/pi', ro(r, 'V_o,avg').value, 325 / PI, 0.005); near('1ph half-wave R: Vrms = Vm/2', ro(r, 'V_o,rms').value, 162.5, 0.005);
  near('1ph half-wave R: input pf = 1/sqrt2 (note p.83)', ro(r, 'Input power factor').value, Math.SQRT1_2, 0.01);
  r = run('rect-1ph-hw', { dev: 'thyristor', alpha: 90 });
  near('1ph half-wave alpha=90: Vdc = Vm/2pi', ro(r, 'V_o,avg').value, 325 / (2 * PI), 0.01);
  r = run('rect-1ph-hw', { dev: 'thyristor', alpha: 60, L: 100, R: 10, fwd: true });
  near('half-wave RL + FWD: Vdc = Vm(1+cos a)/2pi', ro(r, 'V_o,avg').value, 325 * (1 + Math.cos(60 * D2R)) / (2 * PI), 0.01);
  r = run('rect-1ph-hw', { dev: 'diode', E: 100, R: 10 });   // battery charger: conducts only while vs > E
  near('battery charger: Idc', ro(r, 'I_o,avg').value, (() => { const a = Math.asin(100 / 325); let s = 0, n = 200000; for (let k = 0; k < n; k++) { const t = a + (PI - 2 * a) * (k + 0.5) / n; s += (325 * Math.sin(t) - 100) / 10; } return s * (PI - 2 * a) / n / (2 * PI); })(), 0.005);
  r = run('rect-1ph-fw', { dev: 'thyristor', alpha: 60 });
  near('1ph bridge R alpha=60: Vdc = Vm(1+cos a)/pi', ro(r, 'V_o,avg').value, 325 * 1.5 / PI, 0.005);
  near('1ph bridge R alpha=60: Vrms', ro(r, 'V_o,rms').value, 325 / Math.SQRT2 * Math.sqrt(1 - (60 * D2R) / PI + Math.sin(120 * D2R) / (2 * PI)), 0.005);
  r = run('rect-1ph-fw', { dev: 'thyristor', alpha: 60, L: 3000, R: 10 });
  near('1ph bridge highly inductive: Vdc = 2Vm cos a/pi', ro(r, 'V_o,avg').value, 2 * 325 * Math.cos(60 * D2R) / PI, 0.01);
  r = run('rect-1ph-fw', { dev: 'diode' }); near('1ph bridge diodes: Vdc = 2Vm/pi', ro(r, 'V_o,avg').value, 2 * 325 / PI, 0.005);
  r = run('rect-3ph-hw', { dev: 'diode' }); near('3ph half-wave R: Vdc = 3sqrt3 Vm/2pi', ro(r, 'V_o,avg').value, 3 * Math.sqrt(3) * 325 / (2 * PI), 0.005);
  near('3ph half-wave R: Vrms = 0.8407 Vm', ro(r, 'V_o,rms').value, 0.8407 * 325, 0.005);
  r = run('rect-3ph-hw', { dev: 'thyristor', alpha: 45 }); near('3ph half-wave alpha=45: Vdc', ro(r, 'V_o,avg').value, 3 * 325 * (1 + Math.cos(PI / 6 + 45 * D2R)) / (2 * PI), 0.01);
  r = run('rect-3ph-fw', { dev: 'diode' }); near('3ph bridge R: Vdc = 3sqrt3 Vm/pi', ro(r, 'V_o,avg').value, 3 * Math.sqrt(3) * 325 / PI, 0.005);
  near('3ph bridge R: Vrms = 1.6554 Vm', ro(r, 'V_o,rms').value, 1.6554 * 325, 0.005);
  r = run('rect-3ph-fw', { dev: 'thyristor', alpha: 30, L: 3000 }); near('3ph bridge highly inductive alpha=30', ro(r, 'V_o,avg').value, 3 * Math.sqrt(3) * 325 * Math.cos(30 * D2R) / PI, 0.01);
  r = run('rect-3ph-fw', { dev: 'thyristor', alpha: 90 }); near('3ph bridge R alpha=90: Vdc', ro(r, 'V_o,avg').value, 3 * Math.sqrt(3) * 325 * (1 + Math.cos(150 * D2R)) / PI, 0.01);
}
console.log('AC-AC');
{ let r = run('acvc-1ph', { alpha: 60, L: 0 }); const Vo = ro(r, 'V_o,rms'); near('1ph controller R alpha=60: Vo,rms (note p.40)', Vo.value, Vo.ref, 0.005);
  near('1ph controller pf (note p.41)', ro(r, 'Input power factor').value, ro(r, 'Input power factor').ref, 0.005);
  r = run('acvc-1ph', { alpha: 30, L: 50 }); near('1ph controller RL, alpha < phi: full conduction, Vo,rms = Vs,rms', ro(r, 'V_o,rms').value, 325 / Math.SQRT2, 0.01);
  r = run('acvc-3ph', { alpha: 0 }); near('3ph controller alpha=0: Vo = Vs', ro(r, 'V_o,rms (per').value, 325 / Math.SQRT2, 0.003);
  r = run('acvc-3ph', { alpha: 30 }); { const a = 30 * D2R; near('3ph controller alpha=30: Vo,rms', ro(r, 'V_o,rms (per').value, 325 / Math.SQRT2 * Math.sqrt(1 - 3 * a / (2 * PI) + 3 * Math.sin(2 * a) / (4 * PI)), 0.01); }
  r = run('acvc-3ph', { alpha: 150 }); near('3ph controller alpha=150: Vo ~ 0', ro(r, 'V_o,rms (per').value + 1, 1, 0.01);
  r = run('cyclo-1ph', { alpha: 0, n: 3 }); near('cyclo 1ph: f_o = f_s/3', ro(r, 'Output frequency').value, 50 / 3, 1e-9);
  r = run('cyclo-1ph', { alpha: 60, n: 2 }); near('cyclo 1ph R: Vo,rms (note p.33)', ro(r, 'V_o,rms').value, ro(r, 'V_o,rms').ref, 0.005);
  r = run('dual-1ph', { alpha: 60, Lr: 50 }); near('dual converter peak i_r = (2Vm/wLr)(1-cos a), alpha=60', ro(r, 'Peak circulating').value, 2 * 325 * 0.5 / (2 * PI * 50 * 0.05), 0.02);
  r = run('dual-1ph', { alpha: 90, Lr: 50 }); near('dual converter peak i_r, alpha=90', ro(r, 'Peak circulating').value, 2 * 325 / (2 * PI * 50 * 0.05), 0.02);
  near('dual converter: mean(v_r) ~ 0 (within 0.5 % of V_m)', ro(r, 'Avg v_r').value + 325, 325, 0.005);
}
console.log('Inverters');
{ let r = run('inv-1ph', { topo: 'half', L: 0 }); near('half bridge: V1,rms = 0.45 Vdc', ro(r, 'Fundamental V_o1').value, 0.45 * 400, 0.003); near('half bridge: Vrms = Vdc/2', ro(r, 'V_o,rms').value, 200, 0.001);
  r = run('inv-1ph', { topo: 'full', L: 0 }); near('full bridge: V1,rms = 0.9 Vdc', ro(r, 'Fundamental V_o1').value, 0.9 * 400, 0.003);
  near('square wave THD (harmonics 3..49 only)', ro(r, 'THD').value, (() => { let s = 0; for (let n = 3; n <= 49; n += 2) s += 1 / (n * n); return Math.sqrt(s) * 100; })(), 0.003); near('HF3 = 1/3', ro(r, 'HF_3').value, 33.33, 0.005);
  r = run('inv-1ph', { topo: 'full', L: 50, R: 10 }); { const w = 2 * PI * 50 * 0.05, Z1 = Math.hypot(10, w), V1 = 0.9 * 400; near('RL load: I1,rms = V1/|Z1|', ro(r, 'I_o1,rms').value, V1 / Z1, 0.01);
    near('RL load: P_o1 = V1 I1 cos th', ro(r, 'Fundamental power').value, V1 * V1 / Z1 * (10 / Z1), 0.01); }
  r = run('inv-fourier', { topo: 'full', Nh: 99 }); near('Fourier synthesis (99 harmonics): rms error = truncated tail', ro(r, 'rms error').value, (() => { let s = 0; for (let n = 101; n < 200001; n += 2) s += Math.pow(4 * 400 / (n * PI), 2) / 2; return Math.sqrt(s); })(), 0.12);
  r = run('inv-3ph', { cond: '180' }); near('3ph 180: V_LL,rms = sqrt(2/3) Vdc', ro(r, 'V_LL,rms').value, 400 * Math.sqrt(2 / 3), 0.002); near('3ph 180: V_ph,rms = sqrt2/3 Vdc', ro(r, 'V_ph,rms').value, 400 * Math.SQRT2 / 3, 0.002);
  near('3ph 180: fundamental V_LL1,rms = 0.78 Vdc', ro(r, 'Fundamental V_LL1').value, 0.7797 * 400, 0.003);
  r = run('inv-3ph', { cond: '120' }); near('3ph 120: V_LL,rms = Vdc/sqrt2', ro(r, 'V_LL,rms').value, 400 / Math.SQRT2, 0.003); near('3ph 120: V_ph,rms = Vdc/sqrt6', ro(r, 'V_ph,rms').value, 400 / Math.sqrt(6), 0.003);
  r = run('inv-pwm', { ma: 0.8, mf: 21 }); near('SPWM: fundamental = ma V', ro(r, 'Fundamental amplitude').value, 0.8 * 400, 0.03);
  r = run('inv-multilevel', { n: 3 }); near('multilevel: 7 levels', ro(r, 'Number of levels').value, 7, 1e-9); near('multilevel: 12 switches', ro(r, 'Number of switches').value, 12, 1e-9);
  r = run('inv-multilevel', { n: 6 }); near('multilevel n=6: THD small', ro(r, 'THD').value + 1, 1 + 5, 1);
  r = run('inv-resonant', { topo: 'uni', R: 2, L: 50, C: 10 }); { const z = 1 / 2 * 2 * Math.sqrt(10e-6 / 50e-6) / 1, w0 = 1 / Math.sqrt(50e-12 * 10); near('resonant: zeta', ro(r, 'Damping ratio').value, z, 1e-9); }
}
console.log('DC-DC');
{ const tests = [['buck', 'D V_s', {}], ['boost', '', {}], ['buckboost', '', {}], ['flyback', '', { n: 1.5 }], ['cuk', '', {}], ['sepic', '', {}]];
  tests.forEach(t => { const r = run('dcdc-' + t[0], t[2]), vo = ro(r, 'Output voltage V_o'); near(t[0] + ' CCM: V_o = ideal ratio', vo.value, vo.ref, 0.01);
    near(t[0] + ' ideal: P_out = P_in', ro(r, 'Output power').value, ro(r, 'Output power').ref, 0.02); });
  let r = run('dcdc-buck', {}); near('buck ripple di_L', ro(r, 'Inductor current ripple').value, ro(r, 'Inductor current ripple').ref, 0.03);
  near('buck ripple dv_o', ro(r, 'Output voltage ripple').value, ro(r, 'Output voltage ripple').ref, 0.1);
  r = run('dcdc-boost', {}); near('boost ripple di_L', ro(r, 'Inductor current ripple').value, ro(r, 'Inductor current ripple').ref, 0.03); near('boost ripple dv_o', ro(r, 'Output voltage ripple').value, ro(r, 'Output voltage ripple').ref, 0.1);
  r = run('dcdc-buck', { L: 0.02, R: 50, D: 0.5 }); console.log('  mode:', ro(r, 'Operating').value); near('buck DCM: V_o matches DCM formula', ro(r, 'Output voltage V_o').value, ro(r, 'Output voltage V_o').ref, 0.02);
  r = run('dcdc-boost', { L: 0.02, R: 50, D: 0.5 }); console.log('  mode:', ro(r, 'Operating').value); near('boost DCM: V_o matches DCM formula', ro(r, 'Output voltage V_o').value, ro(r, 'Output voltage V_o').ref, 0.02);
  r = run('dcdc-buckboost', { L: 0.02, R: 50, D: 0.5 }); console.log('  mode:', ro(r, 'Operating').value); near('buck-boost DCM: V_o matches DCM formula', ro(r, 'Output voltage V_o').value, ro(r, 'Output voltage V_o').ref, 0.02);
  r = run('dcdc-flyback', { L: 0.02, R: 50, D: 0.5, n: 1.5 }); console.log('  mode:', ro(r, 'Operating').value); near('flyback DCM: V_o matches DCM formula', ro(r, 'Output voltage V_o').value, ro(r, 'Output voltage V_o').ref, 0.02);
  r = run('dcdc-cuk', { L: 0.05, L2: 0.05, R: 100 }); console.log('  cuk light load mode:', ro(r, 'Operating').value, ' Vo =', ro(r, 'Output voltage V_o').value);
}
console.log('SCR / commutation');
{ let r = run('scr-latch', {}); near('problem 1(i): t_min = 75 us (note p.29)', ro(r, 'Minimum pulse').value, 75, 0.001);
  r = run('scr-latch', { R: 100, pw: 78 }); near('problem 1(ii): t_min = 78 us (note p.30)', ro(r, 'Minimum pulse').value, 78, 0.01);
  r = run('scr-latch', { R: 20, L: 500, IL: 50, pw: 50, V: 100 }); near('problem 2: current after 50 us = 10 mA', ro(r, 'Current at the end').value, 10, 0.01);
  near('problem 2: R_p max = 2.5 kOhm', ro(r, 'Largest parallel').value, 2500, 0.01);
  r = run('comm-classA', {}); near('class A: V_c peak = V_DC (1+e^(-pi z/sqrt(1-z^2)))', ro(r, 'Peak capacitor').value, ro(r, 'Peak capacitor').ref, 0.01);
  near('class A: conduction time pi/wr', ro(r, 'Measured turn-off').value, ro(r, 'Conduction time').value, 0.01);
  r = run('comm-classB', {}); near('class B: turn-off time', ro(r, 'Circuit turn-off').value, (PI - 2 * Math.asin(20 / (100 * Math.sqrt(10 / 20)))) / (1 / Math.sqrt(20e-6 * 10e-6)) * 1e6, 1e-6);
  r = run('comm-classC', {}); near('class C: I_T1 at the next turn-on = Vs(1/R1+2/R2) (note p.23)', ro(r, 'I_T1 at the next').value, 100 * (1 / 10 + 2 / 10), 1e-9);
  { const m = model('comm-classC'), p = {}; m.params.forEach(q => { p[q.key] = q.def; }); const res = m.compute(p);
    const it1 = res.strips[2].y; let mx = 0; for (let k = 2000; k < it1.length; k++) mx = Math.max(mx, it1[k]); near('class C: simulated I_T1 peak in cycle 3 (= V_s(1/R1+2/R2) when C is fully reversed)', mx, 30, 0.02); }
}
console.log('Rendering and aliases');
{ let bad = 0;
  PE.models.forEach(m => {
    const res = run(m.id, {}); const o = PE.plot.strips({ width: 900, stripH: res.stripH || 96, x: res.x, x0: res.x0, x1: res.x1, xticks: res.xticks, xtickLabel: res.xtickLabel, xlabel: res.xlabel, strips: res.strips });
    if (o.svg.length < 2000 || /NaN|undefined|Infinity/.test(o.svg)) { bad++; console.log('  FAIL render ' + m.id + (/NaN|undefined|Infinity/.test(o.svg) ? ' (NaN/undefined in svg)' : '')); }
    res.strips.forEach(s => { for (let k = 0; k < s.y.length; k++) if (!isFinite(s.y[k])) { bad++; console.log('  FAIL non-finite value in ' + m.id + ' / ' + s.name); break; } });
    if (res.bars) { const b = PE.plot.bars({ width: 900, height: 200, values: res.bars.values, first: res.bars.first, title: res.bars.title, hilite: res.bars.hilite }); if (/NaN/.test(b)) { bad++; console.log('  FAIL bars ' + m.id); } }
  });
  if (bad === 0) { pass++; console.log('  ok   all ' + PE.models.length + ' models render without NaN'); } else fail += bad;
  let miss = 0; Object.keys(PE.aliases).forEach(k => { const a = PE.aliases[k]; const m = PE.models.find(x => x.id === a.model); if (!m) { miss++; console.log('  FAIL alias ' + k); return; }
    Object.keys(a.params || {}).forEach(pk => { if (!m.params.find(q => q.key === pk)) { miss++; console.log('  FAIL alias ' + k + ' unknown param ' + pk); } }); });
  if (!miss) { pass++; console.log('  ok   all ' + Object.keys(PE.aliases).length + ' aliases point to valid models and parameters'); } else fail += miss;
}
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
