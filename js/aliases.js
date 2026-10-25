/* aliases.js -- connects the figure IDs used in the LaTeX note (\wave / \waveI placeholders) to the interactive models.
 * Open  https://<user>.github.io/<repo>/#<figure-id>  (or #fig-<figure-id>)  and the matching simulator loads with the preset values.
 * To link a figure you added yourself, add one line:   'my-figure-id': { model: 'rect-1ph-fw', params: { alpha: 60, L: 50 } },
 * Valid model ids and parameter keys are listed in README.md. */
(function (g) {
  'use strict';
  const PE = g.PE = g.PE || {};
  PE.aliases = {
    /* --- switches and commutation (chapter 1) --- */
    'sw-natcomm-R-waves':   { model: 'rect-1ph-hw', params: { dev: 'thyristor', alpha: 40, L: 0 } },
    'sw-natcomm-RL-waves':  { model: 'rect-1ph-hw', params: { dev: 'thyristor', alpha: 40, L: 60 } },
    'sw-classA-waves':      { model: 'comm-classA' },
    'sw-classB-waves':      { model: 'comm-classB' },
    'sw-classC-waves':      { model: 'comm-classC' },
    'sw-math1-L-ramp':      { model: 'scr-latch' },
    /* --- AC-AC (chapter 2) --- */
    'ac-cyclo-1ph-waves':   { model: 'cyclo-1ph', params: { n: 3, alpha: 0 } },
    'ac-cyclo-3ph-waves':   { model: 'cyclo-3ph', params: { n: 3, alpha: 0 } },
    'ac-dual-1ph-waves':    { model: 'dual-1ph' },
    'ac-vc-1ph-R-waves':    { model: 'acvc-1ph', params: { L: 0, alpha: 60 } },
    'ac-vc-3ph-waves':      { model: 'acvc-3ph', params: { alpha: 60 } },
    'ac-vc-3ph-output-waves': { model: 'acvc-3ph', params: { alpha: 60 } },
    /* --- inverters (chapter 3) --- */
    'inv-1ph-halfbridge-waves':          { model: 'inv-1ph', params: { topo: 'half', L: 0, dead: 8 } },
    'inv-1ph-halfbridge-feedback-waves': { model: 'inv-1ph', params: { topo: 'half', L: 30 } },
    'inv-1ph-halfbridge-fourier-waves':  { model: 'inv-fourier', params: { topo: 'half' } },
    'inv-1ph-fullbridge-waves':          { model: 'inv-1ph', params: { topo: 'full', L: 0, dead: 8 } },
    'inv-3ph-180-gate-line-waves':       { model: 'inv-3ph', params: { cond: '180' } },
    'inv-3ph-180-line-line-waves':       { model: 'inv-3ph', params: { cond: '180' } },
    'inv-3ph-180-line-neutral-waves':    { model: 'inv-3ph', params: { cond: '180' } },
    'inv-pwm-waves':                     { model: 'inv-pwm', params: { noteSign: true } },
    'inv-series-resonant-waves':         { model: 'inv-resonant', params: { topo: 'uni' } },
    'inv-full-bridge-resonant-waves':    { model: 'inv-resonant', params: { topo: 'bridge' } },
    'inv-multilevel-7level-waves':       { model: 'inv-multilevel', params: { n: 3 } },
    /* --- rectifiers (chapter 4): the first one comes from the figure list of chapter 4 --- */
    'rect-1ph-hw-unc-waves': { model: 'rect-1ph-hw', params: { dev: 'diode', L: 0 } }
  };
})(globalThis);
