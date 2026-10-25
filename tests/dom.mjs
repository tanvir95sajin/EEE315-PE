// Smoke test of the real page in a simulated browser (jsdom): loads index.html, opens every model through the URL hash,
// moves every parameter to its minimum and maximum and checks that a plot and the result table are always produced.
import { JSDOM } from 'jsdom'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, f) => '<script>' + fs.readFileSync(path.join(root, f), 'utf8').replace(/<\/script/g, '<\\/script') + '</script>');
const errors = [];
const dom = new JSDOM(html, { url: 'http://localhost/index.html', runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(w) { w.addEventListener('error', e => errors.push(e.message)); const ce = w.console.error; w.console.error = (...a) => { errors.push(a.join(' ')); }; } });
const w = dom.window, d = w.document, PE = w.PE;
const tick = () => new Promise(r => setTimeout(r, 30));
let n = 0, bad = 0;
function check(id, tag) {
  const svg = d.querySelector('#plot svg'), rows = d.querySelectorAll('#readouts tbody tr').length, err = d.querySelector('#err').textContent;
  if (!svg || rows === 0 || err || /NaN|undefined/.test(svg.outerHTML)) { bad++; console.log('  FAIL', id, tag, err || (!svg ? 'no svg' : 'rows=' + rows)); }
  n++;
}
for (const m of PE.models) {
  w.location.hash = '#' + m.id; await tick();
  if (d.querySelectorAll('#params .prm').length < 1) { bad++; console.log('  FAIL no controls for', m.id); continue; }
  check(m.id, 'default');
  for (const pr of m.params) {
    const row = d.querySelector('.prm[data-key="' + pr.key + '"]'); if (!row) continue;
    if (pr.type === 'range') {
      for (const v of [pr.min, pr.max]) { const nb = row.querySelector('input[type=number]'); nb.value = v; nb.dispatchEvent(new w.Event('input', { bubbles: true })); nb.dispatchEvent(new w.Event('change', { bubbles: true })); await tick(); check(m.id, pr.key + '=' + v); }
      const nb = row.querySelector('input[type=number]'); nb.value = pr.def; nb.dispatchEvent(new w.Event('input', { bubbles: true })); nb.dispatchEvent(new w.Event('change', { bubbles: true }));
    } else if (pr.type === 'select') {
      const sl = row.querySelector('select'); for (const o of pr.options) { sl.value = o[0]; sl.dispatchEvent(new w.Event('change', { bubbles: true })); await tick(); check(m.id, pr.key + '=' + o[0]); }
      sl.value = pr.def; sl.dispatchEvent(new w.Event('change', { bubbles: true }));
    } else { const cb = row.querySelector('input'); cb.checked = !pr.def; cb.dispatchEvent(new w.Event('change', { bubbles: true })); await tick(); check(m.id, pr.key + ' toggled'); cb.checked = pr.def; cb.dispatchEvent(new w.Event('change', { bubbles: true })); }
  }
}
// deep links from the figure aliases
for (const k of Object.keys(PE.aliases)) { w.location.hash = '#fig-' + k; await tick(); check(k, 'alias'); }
console.log(n + ' page states checked, ' + bad + ' problems, ' + errors.length + ' script errors');
errors.slice(0, 5).forEach(e => console.log('  ', e));
process.exit(bad || errors.length ? 1 : 0);
