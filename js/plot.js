/* plot.js  --  tiny SVG "scope" renderer: stacked strips sharing one x axis (like the note's figures) + bar charts */
(function (g) {
  'use strict';
  const PE = g.PE = g.PE || {};
  const P = PE.plot = {};
  const L = P.layout = { ml: 80, mr: 16, mt: 10, gap: 10, axisH: 46 };

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const f1 = v => (Math.round(v * 10) / 10).toString();

  function niceNum(range, round) {
    const exp = Math.floor(Math.log10(range)), f = range / Math.pow(10, exp);
    let nf;
    if (round) nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10; else nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
    return nf * Math.pow(10, exp);
  }
  function niceTicks(lo, hi, n) {
    if (!(hi - lo > 1e-12)) { lo -= 1; hi += 1; }
    const step = niceNum(niceNum(hi - lo, false) / (n - 1), true);
    const nlo = Math.floor(lo / step + 1e-9) * step, nhi = Math.ceil(hi / step - 1e-9) * step, t = [];
    for (let v = nlo; v <= nhi + step * 0.5; v += step) t.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    return { lo: nlo, hi: nhi, ticks: t, step: step };
  }
  function tickText(v, step) {
    if (v === 0) return '0';
    const d = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step)));
    if (Math.abs(v) >= 1e5) return v.toExponential(1);
    return v.toFixed(d);
  }
  P.niceTicks = niceTicks;

  function pathOf(x, y, sx, sy, pw) {
    const n = x.length, stride = Math.max(1, Math.floor(n / (pw * 1.5)));
    let d = '';
    if (stride === 1) {
      for (let i = 0; i < n; i++) d += (i ? 'L' : 'M') + f1(sx(x[i])) + ' ' + f1(sy(y[i]));
    } else {
      let first = true;
      for (let i = 0; i < n; i += stride) {
        let mn = Infinity, mx = -Infinity, imn = i, imx = i;
        const e = Math.min(n, i + stride);
        for (let k = i; k < e; k++) { if (y[k] < mn) { mn = y[k]; imn = k; } if (y[k] > mx) { mx = y[k]; imx = k; } }
        const a = imn < imx ? imn : imx, b = imn < imx ? imx : imn;
        d += (first ? 'M' : 'L') + f1(sx(x[a])) + ' ' + f1(sy(y[a])); first = false;
        if (b !== a) d += 'L' + f1(sx(x[b])) + ' ' + f1(sy(y[b]));
      }
    }
    return d;
  }

  /** spec: {width, stripH, x, x0, x1, xticks[], xtickLabel(v), xlabel, strips:[{name, y, color, unit, ymin, ymax, overlays:[{y,color,dash,label}],
   *         avg:bool, fill:bool, ticks[], tickLabels{}, legend:[[label,color]]}]} */
  P.strips = function (s) {
    const W = s.width || 920, x = s.x, n = x.length;
    const x0 = s.x0 != null ? s.x0 : x[0], x1 = s.x1 != null ? s.x1 : x[n - 1];
    const pw = W - L.ml - L.mr, sh = s.stripH || 96, ns = s.strips.length;
    const H = L.mt + ns * sh + (ns - 1) * L.gap + L.axisH;
    const sx = v => L.ml + (v - x0) / (x1 - x0) * pw;
    const geom = { W: W, H: H, ml: L.ml, mr: L.mr, pw: pw, x0: x0, x1: x1, strips: [] };
    let o = '<svg xmlns="http://www.w3.org/2000/svg" class="scope" viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img">';
    const xt = s.xticks || [];
    for (let k = 0; k < ns; k++) {
      const st = s.strips[k], top = L.mt + k * (sh + L.gap), inner = sh - 10;
      let lo = Infinity, hi = -Infinity;
      const all = [st.y].concat((st.overlays || []).map(a => a.y));
      all.forEach(arr => { for (let i = 0; i < arr.length; i++) { const v = arr[i]; if (v < lo) lo = v; if (v > hi) hi = v; } });
      if (st.zoom) { const pad = (hi - lo) * 0.3 || Math.abs(hi) * 0.01 + 1e-6; lo -= pad; hi += pad; }
      else { if (lo > 0) lo = 0; if (hi < 0) hi = 0; }
      if (st.ymin != null) lo = st.ymin; if (st.ymax != null) hi = st.ymax;
      let nt;
      if (st.ticks) { nt = { lo: Math.min(lo, Math.min.apply(null, st.ticks)), hi: Math.max(hi, Math.max.apply(null, st.ticks)), ticks: st.ticks, step: 1 }; }
      else nt = niceTicks(lo, hi, 4);
      const ylo = nt.lo, yhi = nt.hi;
      const sy = v => top + 5 + inner * (1 - (v - ylo) / (yhi - ylo));
      geom.strips.push({ top: top, sh: sh, lo: ylo, hi: yhi });
      o += '<rect class="fr" x="' + L.ml + '" y="' + top + '" width="' + pw + '" height="' + sh + '"/>';
      xt.forEach(v => { if (v >= x0 && v <= x1) o += '<line class="gx" x1="' + f1(sx(v)) + '" x2="' + f1(sx(v)) + '" y1="' + top + '" y2="' + (top + sh) + '"/>'; });
      nt.ticks.forEach(v => {
        if (v < ylo - 1e-9 || v > yhi + 1e-9) return;
        o += '<line class="' + (v === 0 ? 'gz' : 'gy') + '" x1="' + L.ml + '" x2="' + (L.ml + pw) + '" y1="' + f1(sy(v)) + '" y2="' + f1(sy(v)) + '"/>';
        const lab = st.tickLabels && st.tickLabels[v] != null ? st.tickLabels[v] : tickText(v, nt.step);
        o += '<text class="tk" x="' + (L.ml - 6) + '" y="' + f1(sy(v) + 3.5) + '" text-anchor="end">' + esc(lab) + '</text>';
      });
      if (st.fill) {
        const d0 = pathOf(x, st.y, sx, sy, pw);
        o += '<path class="fill c' + (st.color || 0) + '" d="' + d0 + 'L' + f1(sx(x[n - 1])) + ' ' + f1(sy(0)) + 'L' + f1(sx(x[0])) + ' ' + f1(sy(0)) + 'Z"/>';
      }
      (st.overlays || []).forEach(ov => {
        o += '<path class="ln c' + (ov.color != null ? ov.color : 6) + (ov.dash ? ' dash' : '') + '" d="' + pathOf(x, ov.y, sx, sy, pw) + '"/>';
      });
      o += '<path class="ln c' + (st.color || 0) + '" d="' + pathOf(x, st.y, sx, sy, pw) + '"/>';
      if (st.avg) {
        let m = 0; for (let i = 0; i < n; i++) m += st.y[i]; m /= n;
        o += '<line class="avg" x1="' + L.ml + '" x2="' + (L.ml + pw) + '" y1="' + f1(sy(m)) + '" y2="' + f1(sy(m)) + '"/>';
      }
      o += '<text class="nm" x="' + (L.ml + 8) + '" y="' + (top + 14) + '">' + esc(st.name) + (st.unit ? ' <tspan class="un">[' + esc(st.unit) + ']</tspan>' : '') + '</text>';
      const leg = (st.legend || []).slice();
      (st.overlays || []).forEach(ov => { if (ov.label) leg.push([ov.label, ov.color != null ? ov.color : 6]); });
      leg.forEach((a, j) => {
        o += '<text class="lg c' + a[1] + 't" x="' + (L.ml + pw - 8 - j * 64) + '" y="' + (top + 14) + '" text-anchor="end">' + esc(a[0]) + '</text>';
      });
    }
    const bot = L.mt + ns * sh + (ns - 1) * L.gap;
    xt.forEach(v => {
      if (v < x0 - 1e-9 || v > x1 + 1e-9) return;
      o += '<line class="gz" x1="' + f1(sx(v)) + '" x2="' + f1(sx(v)) + '" y1="' + bot + '" y2="' + (bot + 4) + '"/>';
      o += '<text class="tk" x="' + f1(sx(v)) + '" y="' + (bot + 16) + '" text-anchor="middle">' + esc(s.xtickLabel ? s.xtickLabel(v) : v) + '</text>';
    });
    o += '<text class="xl" x="' + (L.ml + pw / 2) + '" y="' + (bot + 38) + '" text-anchor="middle">' + esc(s.xlabel || '') + '</text>';
    o += '<line class="cur" x1="0" x2="0" y1="' + L.mt + '" y2="' + bot + '" style="display:none"/>';
    o += '</svg>';
    return { svg: o, geom: geom };
  };

  /** Bar chart (harmonic spectra). spec: {width,height,values[],first(=1),title,ylabel,hilite:Set of indices,fmt} */
  P.bars = function (s) {
    const W = s.width || 920, Hh = s.height || 190, ml = L.ml, mr = L.mr, mt = 22, mb = 34;
    const v = s.values, n = v.length, first = s.first || 1;
    const pw = W - ml - mr, ph = Hh - mt - mb;
    let mx = 0; for (let i = 0; i < n; i++) if (v[i] > mx) mx = v[i];
    const nt = niceTicks(0, mx || 1, 4), yhi = nt.hi;
    const sy = t => mt + ph * (1 - t / yhi), bw = pw / n;
    let o = '<svg xmlns="http://www.w3.org/2000/svg" class="scope" viewBox="0 0 ' + W + ' ' + Hh + '" width="100%" role="img">';
    o += '<rect class="fr" x="' + ml + '" y="' + mt + '" width="' + pw + '" height="' + ph + '"/>';
    nt.ticks.forEach(t => {
      o += '<line class="' + (t === 0 ? 'gz' : 'gy') + '" x1="' + ml + '" x2="' + (ml + pw) + '" y1="' + f1(sy(t)) + '" y2="' + f1(sy(t)) + '"/>';
      o += '<text class="tk" x="' + (ml - 6) + '" y="' + f1(sy(t) + 3.5) + '" text-anchor="end">' + tickText(t, nt.step) + '</text>';
    });
    const lab = Math.max(1, Math.ceil(n / 16));
    for (let i = 0; i < n; i++) {
      const hl = s.hilite && s.hilite.has(i + first);
      o += '<rect class="bar' + (hl ? ' hl' : '') + '" x="' + f1(ml + i * bw + bw * 0.15) + '" y="' + f1(sy(v[i])) + '" width="' + f1(bw * 0.7) + '" height="' + f1(sy(0) - sy(v[i])) + '"><title>n=' + (i + first) + ': ' + PE.util.fmt(v[i], 4) + '</title></rect>';
      if (i % lab === 0) o += '<text class="tk" x="' + f1(ml + i * bw + bw / 2) + '" y="' + (mt + ph + 14) + '" text-anchor="middle">' + (i + first) + '</text>';
    }
    o += '<text class="nm" x="' + (ml + 8) + '" y="' + (mt - 8) + '">' + esc(s.title || '') + '</text>';
    o += '<text class="xl" x="' + (ml + pw / 2) + '" y="' + (Hh - 6) + '" text-anchor="middle">' + esc(s.xlabel || 'harmonic order n') + '</text>';
    return o + '</svg>';
  };
})(globalThis);
