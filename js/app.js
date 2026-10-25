/* app.js -- user interface: navigation, parameter controls, plots, readouts, deep links (#model?param=value) */
(function () {
  'use strict';
  const PE = globalThis.PE, U = PE.util, P = PE.plot;
  const $ = (s, r) => (r || document).querySelector(s);
  let cur = null, vals = {}, lastRes = null, raf = 0, hashLock = false;

  const SVG_CSS = '.fr{fill:#fff;stroke:#9aa4b2}.gx,.gy{stroke:#e3e7ee;stroke-width:1}.gz{stroke:#9aa4b2;stroke-width:1}.tk{fill:#5b6573;font:11px sans-serif}.nm{fill:#111;font:600 12px sans-serif}.un{font-weight:400;fill:#5b6573}' +
    '.xl{fill:#111;font:12px sans-serif}.ln{fill:none;stroke-width:1.6}.dash{stroke-dasharray:5 4}.avg{stroke:#5b6573;stroke-dasharray:2 3}.bar{fill:#4c78c9}.bar.hl{fill:#e07b39}.lg{font:11px sans-serif}.fill{opacity:.15}' +
    '.c0{stroke:#2b6cb0;fill:#2b6cb0}.c1{stroke:#d1453b;fill:#d1453b}.c2{stroke:#2f9e5b;fill:#2f9e5b}.c3{stroke:#d9822b;fill:#d9822b}.c4{stroke:#7b57c9;fill:#7b57c9}.c5{stroke:#1f9fa8;fill:#1f9fa8}.c6{stroke:#7a8594;fill:#7a8594}.c7{stroke:#8a5a3c;fill:#8a5a3c}' +
    '.c0t{fill:#2b6cb0}.c1t{fill:#d1453b}.c2t{fill:#2f9e5b}.c3t{fill:#d9822b}.c4t{fill:#7b57c9}.c5t{fill:#1f9fa8}.c6t{fill:#7a8594}.c7t{fill:#8a5a3c}.ln{fill:none}';

  /* ---------- routing ---------- */
  function parseHash() {
    let h = decodeURIComponent(location.hash.replace(/^#/, '')); if (!h) return null;
    const q = h.indexOf('?'), id = (q < 0 ? h : h.slice(0, q)).replace(/^fig-/, ''), params = {};
    if (q >= 0) h.slice(q + 1).split('&').forEach(kv => { const e = kv.indexOf('='); if (e > 0) params[kv.slice(0, e)] = kv.slice(e + 1); });
    return { id: id, params: params };
  }
  function resolve(id) {
    let m = PE.models.find(x => x.id === id);
    if (m) return { model: m, preset: {} };
    const a = PE.aliases && PE.aliases[id];
    if (a) { m = PE.models.find(x => x.id === a.model); if (m) return { model: m, preset: a.params || {} }; }
    return null;
  }
  function coerce(pr, v) {
    if (pr.type === 'check') return v === true || v === 'true' || v === '1' || v === 1;
    if (pr.type === 'select') return String(v);
    const x = parseFloat(v); return isFinite(x) ? x : pr.def;
  }
  function setHash() {
    const q = []; cur.params.forEach(pr => { if (vals[pr.key] !== pr.def) q.push(pr.key + '=' + encodeURIComponent(vals[pr.key])); });
    const h = '#' + cur.id + (q.length ? '?' + q.join('&') : '');
    hashLock = true; history.replaceState(null, '', h); setTimeout(() => { hashLock = false; }, 0);
  }

  /* ---------- navigation ---------- */
  function buildNav() {
    const nav = $('#nav'), groups = [];
    PE.models.forEach(m => { let g = groups.find(x => x.name === m.group); if (!g) { g = { name: m.group, items: [] }; groups.push(g); } g.items.push(m); });
    nav.innerHTML = groups.map(g => '<div class="grp"><h3>' + g.name + '</h3>' + g.items.map(m => '<a href="#' + m.id + '" data-id="' + m.id + '" data-t="' + (m.title + ' ' + m.group).toLowerCase() + '">' + m.title + '</a>').join('') + '</div>').join('');
  }
  function markNav() { document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.id === cur.id)); }
  function filterNav(q) {
    q = q.toLowerCase().trim();
    document.querySelectorAll('#nav a').forEach(a => { a.style.display = !q || a.dataset.t.indexOf(q) >= 0 ? '' : 'none'; });
    document.querySelectorAll('#nav .grp').forEach(g => { g.style.display = Array.from(g.querySelectorAll('a')).some(a => a.style.display !== 'none') ? '' : 'none'; });
  }

  /* ---------- controls ---------- */
  function buildControls() {
    const box = $('#params'); box.innerHTML = '';
    cur.params.forEach(pr => {
      const row = document.createElement('div'); row.className = 'prm'; row.dataset.key = pr.key;
      if (pr.type === 'range') {
        row.innerHTML = '<label>' + pr.label + (pr.unit ? ' <span class="u">[' + pr.unit + ']</span>' : '') + '</label><div class="two"><input type="range" min="' + pr.min + '" max="' + pr.max + '" step="' + pr.step + '"><input type="number" min="' + pr.min + '" max="' + pr.max + '" step="' + pr.step + '"></div>';
        const rg = $('input[type=range]', row), nb = $('input[type=number]', row); rg.value = nb.value = vals[pr.key];
        rg.addEventListener('input', () => { nb.value = rg.value; vals[pr.key] = parseFloat(rg.value); changed(); });
        nb.addEventListener('input', () => { const v = parseFloat(nb.value); if (isFinite(v)) { vals[pr.key] = v; rg.value = v; changed(); } });
        nb.addEventListener('change', () => { let v = parseFloat(nb.value); if (!isFinite(v)) v = pr.def; v = Math.min(pr.max, Math.max(pr.min, v)); nb.value = v; rg.value = v; vals[pr.key] = v; changed(); });
      } else if (pr.type === 'select') {
        row.innerHTML = '<label>' + pr.label + '</label><select>' + pr.options.map(o => '<option value="' + o[0] + '">' + o[1] + '</option>').join('') + '</select>';
        const sl = $('select', row); sl.value = vals[pr.key]; sl.addEventListener('change', () => { vals[pr.key] = sl.value; changed(); });
      } else {
        row.innerHTML = '<label class="chk"><input type="checkbox"> ' + pr.label + '</label>';
        const cb = $('input', row); cb.checked = !!vals[pr.key]; cb.addEventListener('change', () => { vals[pr.key] = cb.checked; changed(); });
      }
      box.appendChild(row);
    });
    visibility();
  }
  function syncControls() {
    cur.params.forEach(pr => {
      const row = $('.prm[data-key="' + pr.key + '"]'); if (!row) return;
      if (pr.type === 'range') { $('input[type=range]', row).value = vals[pr.key]; $('input[type=number]', row).value = vals[pr.key]; }
      else if (pr.type === 'select') $('select', row).value = vals[pr.key]; else $('input', row).checked = !!vals[pr.key];
    });
  }
  function visibility() { cur.params.forEach(pr => { const row = $('.prm[data-key="' + pr.key + '"]'); if (row) row.style.display = (pr.show && !pr.show(vals)) ? 'none' : ''; }); }
  function changed() { visibility(); setHash(); schedule(); }
  function schedule() { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); }

  /* ---------- rendering ---------- */
  function fmtVal(v, unit) {
    if (v == null || (typeof v === 'number' && !isFinite(v))) return '\u2013';
    return (typeof v === 'number' ? U.fmt(v, 4) : String(v)) + (unit ? ' ' + unit.replace(/^\s+/, '') : '');
  }
  function renderReadouts(ro) {
    let h = '<table class="ro"><thead><tr><th>Quantity</th><th>Simulation</th><th>Formula in the note</th></tr></thead><tbody>';
    ro.forEach(r => {
      let ref = '\u2013', cls = '';
      if (r.ref != null && typeof r.ref === 'number' && isFinite(r.ref)) {
        ref = U.fmt(r.ref, 4) + (r.unit && r.unit.length < 4 ? ' ' + r.unit : '');
        if (typeof r.value === 'number' && isFinite(r.value)) {
          const e = Math.abs(r.value - r.ref) / Math.max(Math.abs(r.ref), 1e-9);
          cls = e < 0.02 ? 'ok' : 'off'; ref += e < 0.02 ? '  \u2713' : '  (\u0394 ' + (e * 100).toFixed(1) + ' %)';
        } else if (r.value == null) ref = ref;   // formula-only row
      }
      h += '<tr' + (r.hint ? ' title="' + r.hint.replace(/"/g, '&quot;') + '"' : '') + '><td>' + r.label + '</td><td class="num">' + fmtVal(r.value, r.unit) + '</td><td class="num ' + cls + '">' + ref + '</td></tr>';
    });
    $('#readouts').innerHTML = h + '</tbody></table>';
  }
  function render() {
    const plot = $('#plot'), err = $('#err');
    let res;
    try { res = cur.compute(Object.assign({}, vals)); err.textContent = ''; }
    catch (e) { err.textContent = 'Computation error: ' + e.message; console.error(e); return; }
    lastRes = res;
    const W = Math.round(Math.min(1180, Math.max(560, plot.clientWidth || 900)));
    const out = P.strips({ width: W, stripH: res.stripH || 96, x: res.x, x0: res.x0, x1: res.x1, xticks: res.xticks, xtickLabel: res.xtickLabel, xlabel: res.xlabel, strips: res.strips });
    plot.innerHTML = out.svg + '<div id="tip" class="tip" hidden></div>';
    attachCursor(plot, out.geom, res);
    const bars = $('#bars');
    if (res.bars) bars.innerHTML = P.bars({ width: W, height: 200, values: res.bars.values, first: res.bars.first, title: res.bars.title, hilite: res.bars.hilite, xlabel: res.bars.xlabel }); else bars.innerHTML = '';
    renderReadouts(res.readouts || []);
    $('#notes').innerHTML = (res.notes || []).map(n => '<p>' + n + '</p>').join('');
  }
  function attachCursor(host, geom, res) {
    const svg = host.querySelector('svg'), line = svg.querySelector('.cur'), tip = $('#tip'), x = res.x, n = x.length;
    function hide() { line.style.display = 'none'; tip.hidden = true; }
    function move(ev) {
      const t = ev.touches ? ev.touches[0] : ev, r = svg.getBoundingClientRect(), vx = (t.clientX - r.left) / r.width * geom.W;
      if (vx < geom.ml || vx > geom.W - geom.mr) { hide(); return; }
      const xv = geom.x0 + (vx - geom.ml) / geom.pw * (geom.x1 - geom.x0);
      let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (x[m] <= xv) lo = m; else hi = m; }
      const idx = (xv - x[lo] <= x[hi] - xv) ? lo : hi;
      line.setAttribute('x1', vx); line.setAttribute('x2', vx); line.style.display = '';
      let h = '<b>' + (res.xtickLabel ? res.xtickLabel(Math.round(x[idx] * 10) / 10) : U.fmt(x[idx])) + '</b>';
      res.strips.forEach(s => { h += '<div><span class="sw c' + (s.color || 0) + 'b"></span>' + s.name.replace(/<[^>]+>/g, '') + ': ' + U.fmt(s.y[idx], 4) + (s.unit ? ' ' + s.unit : '') + '</div>'; });
      tip.innerHTML = h; tip.hidden = false;
      const hr = host.getBoundingClientRect(); let px = t.clientX - hr.left + 14; if (px > hr.width - 240) px = t.clientX - hr.left - 240;
      tip.style.left = Math.max(0, px) + 'px'; tip.style.top = Math.max(0, t.clientY - hr.top - 20) + 'px';
    }
    svg.addEventListener('mousemove', move); svg.addEventListener('mouseleave', hide);
    svg.addEventListener('touchstart', move, { passive: true }); svg.addEventListener('touchmove', move, { passive: true }); svg.addEventListener('touchend', hide);
  }

  /* ---------- load a model ---------- */
  function load(id, overrides) {
    const rs = resolve(id); if (!rs) return false;
    cur = rs.model; vals = {};
    cur.params.forEach(pr => { vals[pr.key] = pr.def; });
    const apply = o => Object.keys(o).forEach(k => { const pr = cur.params.find(q => q.key === k); if (pr) vals[k] = coerce(pr, o[k]); });
    apply(rs.preset); apply(overrides || {});
    $('#title').textContent = cur.title; $('#pages').textContent = cur.pages || ''; $('#desc').textContent = cur.desc || '';
    document.title = cur.title + ' \u2013 Power Electronics interactive';
    buildControls(); markNav(); if (rs.model.id !== id || Object.keys(overrides || {}).length || Object.keys(rs.preset).length) setHash();
    render(); return true;
  }
  function route() {
    const h = parseHash();
    if (h && load(h.id, h.params)) return;
    load(PE.models[0].id === 'scr-latch' ? 'rect-1ph-hw' : PE.models[0].id);
  }

  /* ---------- buttons ---------- */
  function download(name, mime, text) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function bindButtons() {
    $('#reset').addEventListener('click', () => { cur.params.forEach(pr => { vals[pr.key] = pr.def; }); syncControls(); visibility(); setHash(); schedule(); });
    $('#share').addEventListener('click', () => {
      const url = location.href; const done = () => { const b = $('#share'); const t = b.textContent; b.textContent = 'Link copied'; setTimeout(() => { b.textContent = t; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => window.prompt('Copy this link:', url)); else window.prompt('Copy this link:', url);
    });
    $('#csv').addEventListener('click', () => {
      if (!lastRes) return; const r = lastRes, cols = r.strips.map(s => s.name.replace(/[",]/g, ' '));
      let t = 'x,' + cols.join(',') + '\n'; for (let k = 0; k < r.x.length; k++) t += r.x[k].toFixed(6) + ',' + r.strips.map(s => s.y[k]).join(',') + '\n';
      download(cur.id + '.csv', 'text/csv', t);
    });
    $('#svg').addEventListener('click', () => {
      const s = $('#plot svg'); if (!s) return; let t = new XMLSerializer().serializeToString(s).replace('<svg ', '<svg style="background:#fff" ');
      t = t.replace('>', '><style>' + SVG_CSS + '</style>'); t = t.replace(/<line class="cur"[^>]*>/, ''); download(cur.id + '.svg', 'image/svg+xml', t);
    });
    $('#theme').addEventListener('click', () => {
      const d = document.documentElement, dark = d.dataset.theme === 'dark' || (!d.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
      d.dataset.theme = dark ? 'light' : 'dark'; try { localStorage.setItem('pe-theme', d.dataset.theme); } catch (e) { /* storage unavailable */ }
    });
    $('#q').addEventListener('input', e => filterNav(e.target.value));
    window.addEventListener('hashchange', () => { if (!hashLock) route(); });
    let rt = 0; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(schedule, 150); });
  }

  function init() {
    try { const t = localStorage.getItem('pe-theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) { /* ignore */ }
    buildNav(); bindButtons(); route();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
