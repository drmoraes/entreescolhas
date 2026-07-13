/* ============================================================
   EntreEscolhas — Roda de Perfil (gráfico radial de resultado)
   - SVG puro, sem dependências; 3 a 6 dimensões como setores
     preenchidos até o índice (escala 40–100), score Geral no centro.
   - Paleta categórica validada para daltonismo e contraste nos
     dois temas (superfícies #0F0F1E e #FFFFFF); a distinção nunca
     depende só da cor: cada setor tem rótulo direto + vão.
   - Uso: EERoda.render(container, { scores, dimNames, dimInfo, nivel })
   ============================================================ */
(function () {
  var CORES = ['#6C63FF', '#A8862F', '#3D7FD9', '#4E9E3D', '#D14A7E', '#1F9E8C'];
  var NS = 'http://www.w3.org/2000/svg';
  var XLINK = 'http://www.w3.org/1999/xlink';
  var UID = 0;

  function injectCSS() {
    if (document.getElementById('ee-roda-css')) return;
    var st = document.createElement('style');
    st.id = 'ee-roda-css';
    st.textContent =
      '.ee-roda{position:relative;display:flex;justify-content:center;margin:6px 0 20px}' +
      '.ee-roda svg{width:100%;max-width:540px;height:auto;display:block}' +
      '.ee-roda svg text{font-family:inherit}' +
      '.ee-roda .seg{cursor:default}' +
      '.ee-roda .fill{opacity:0;transition:opacity .7s ease}' +
      '.ee-roda.on .fill{opacity:1}' +
      '.ee-roda .seg:hover .fill{opacity:.85}' +
      '.ee-roda .ring{fill:none;stroke:rgba(148,144,192,.16);stroke-width:1;stroke-dasharray:3 5}' +
      'html[data-theme="light"] .ee-roda .ring{stroke:rgba(94,90,138,.25)}' +
      '.ee-roda .tick{fill:rgba(200,197,230,.85);stroke:var(--bg-card,#0F0F1E);stroke-width:3;paint-order:stroke;font-size:11px}' +
      'html[data-theme="light"] .ee-roda .tick{fill:#5E5A8A;stroke:#FFFFFF}' +
      '.ee-roda .center-bg{fill:var(--bg-raised,#141428);stroke:rgba(201,168,76,.55);stroke-width:1.5}' +
      '.ee-roda .center-lbl{fill:var(--text-2,#9490C0);font-size:15px;font-weight:600;letter-spacing:2px}' +
      '.ee-roda .center-num{fill:#C9A84C;font-size:56px;font-weight:800}' +
      'html[data-theme="light"] .ee-roda .center-num{fill:#8A6D1F}' +
      '.ee-roda .val{font-size:29px;font-weight:800}' +
      '.ee-roda .arc-lbl{fill:#FFFFFF;font-weight:700;letter-spacing:.4px}' +
      '.ee-roda-tip{position:absolute;pointer-events:none;background:var(--bg-raised,#141428);' +
        'border:1px solid var(--border,rgba(108,99,255,.15));border-radius:10px;padding:9px 12px;' +
        'font-size:.8rem;max-width:240px;color:var(--text-2,#9490C0);box-shadow:0 8px 28px rgba(0,0,0,.35);' +
        'opacity:0;transition:opacity .15s;z-index:5;line-height:1.45}' +
      '.ee-roda-tip b{color:var(--text,#F0EFF8);display:block;font-size:.84rem}' +
      '@media print{.ee-roda .fill{opacity:1 !important}.ee-roda-tip{display:none}}';
    document.head.appendChild(st);
  }

  function el(t, at) {
    var e = document.createElementNS(NS, t);
    for (var k in at) e.setAttribute(k, at[k]);
    return e;
  }

  function render(container, opts) {
    if (!container || !opts || !opts.scores) return false;
    var keys = Object.keys(opts.scores);
    if (keys.length < 3 || keys.length > CORES.length) return false; // fora da faixa, ficam só as barras
    injectCSS();

    var dimNames = opts.dimNames || {};
    var dimInfo = opts.dimInfo || {};
    var nivel = opts.nivel || null;
    var MIN = opts.min != null ? opts.min : 40;
    var MAX = opts.max != null ? opts.max : 100;
    var RINGS = opts.rings || [55, 70, 85];
    var uid = 'eer' + (++UID) + '_';

    var geral = opts.centerValue != null ? opts.centerValue
      : Math.round(keys.reduce(function (s, k) { return s + (+opts.scores[k] || 0); }, 0) / keys.length);

    var CX = 360, CY = 360, R_IN = 118, R_OUT = 278, R_LBL_IN = 292, R_LBL_OUT = 326;
    var N = keys.length, STEP = 360 / N, START = -90, PAD = 2.6;
    function rad(a) { return a * Math.PI / 180; }
    function pt(r, a) { return [CX + r * Math.cos(rad(a)), CY + r * Math.sin(rad(a))]; }
    function ring(r1, r2, a1, a2) { // setor de coroa circular
      var lg = (a2 - a1) > 180 ? 1 : 0;
      var p1 = pt(r2, a1), p2 = pt(r2, a2), p3 = pt(r1, a2), p4 = pt(r1, a1);
      return 'M' + p1 + ' A' + r2 + ' ' + r2 + ' 0 ' + lg + ' 1 ' + p2 +
             ' L' + p3 + ' A' + r1 + ' ' + r1 + ' 0 ' + lg + ' 0 ' + p4 + ' Z';
    }
    function rScale(v) {
      var f = (Math.max(MIN, Math.min(MAX, +v || MIN)) - MIN) / (MAX - MIN);
      return R_IN + f * (R_OUT - R_IN);
    }

    container.innerHTML = '';
    container.className = 'ee-roda';
    var resumo = keys.map(function (k) { return (dimNames[k] || k) + ' ' + opts.scores[k]; }).join(', ');
    var svg = el('svg', { viewBox: '0 0 720 720', role: 'img',
      'aria-label': (opts.centerLabel || 'Geral') + ' ' + geral + ' de ' + MAX + '. Dimensões: ' + resumo + '.' });
    var tip = document.createElement('div');
    tip.className = 'ee-roda-tip';

    RINGS.forEach(function (g) {
      svg.appendChild(el('circle', { class: 'ring', cx: CX, cy: CY, r: rScale(g) }));
    });

    keys.forEach(function (k, i) {
      var v = Math.round(+opts.scores[k] || 0), cor = CORES[i];
      var nome = dimNames[k] || k;
      var a1 = START + i * STEP + PAD / 2, a2 = START + (i + 1) * STEP - PAD / 2, mid = (a1 + a2) / 2;
      var g = el('g', { class: 'seg' });
      var ti = el('title', {});
      ti.textContent = nome + ': ' + v + ' de ' + MAX + (nivel ? ' — ' + nivel(v) : '');
      g.appendChild(ti);

      g.appendChild(el('path', { d: ring(R_IN, R_OUT, a1, a2), fill: cor, opacity: .10 }));
      g.appendChild(el('path', { class: 'fill', d: ring(R_IN, rScale(v), a1, a2), fill: cor }));
      g.appendChild(el('path', { d: ring(R_LBL_IN, R_LBL_OUT, a1, a2), fill: cor }));

      // nome da dimensão seguindo o arco (invertido na metade de baixo)
      var flip = mid > 0 && mid < 180;
      var rT = flip ? R_LBL_IN + 11 : (R_LBL_IN + R_LBL_OUT) / 2 + 4;
      var s = pt(rT, flip ? a2 : a1), e = pt(rT, flip ? a1 : a2);
      var lg = (a2 - a1) > 180 ? 1 : 0;
      var pid = uid + 'l' + i;
      svg.appendChild(el('path', { id: pid, fill: 'none',
        d: 'M' + s + ' A' + rT + ' ' + rT + ' 0 ' + lg + ' ' + (flip ? 0 : 1) + ' ' + e }));
      var arcLen = rad(a2 - a1) * rT;
      var fs = Math.min(17, Math.max(11, arcLen * 0.95 / (0.58 * nome.length)));
      var t = el('text', { class: 'arc-lbl', 'font-size': fs });
      var tp = el('textPath', { startOffset: '50%', 'text-anchor': 'middle' });
      tp.setAttributeNS(XLINK, 'xlink:href', '#' + pid);
      tp.setAttribute('href', '#' + pid);
      tp.textContent = nome;
      t.appendChild(tp);
      g.appendChild(t);

      // rótulo direto do valor: dentro do preenchimento quando há espaço;
      // se o setor é raso, logo acima dele, na cor do segmento (legível nos 2 temas)
      var rv = rScale(v), inside = (rv - R_IN) >= 68;
      var pv = pt(inside ? rv - 34 : Math.min(rv + 28, R_OUT - 16), mid);
      var tv = el('text', { class: 'val', x: pv[0], y: pv[1], fill: inside ? '#FFFFFF' : cor,
        'text-anchor': 'middle', 'dominant-baseline': 'middle' });
      tv.textContent = v;
      g.appendChild(tv);

      g.addEventListener('mousemove', function (ev) {
        var r = container.getBoundingClientRect();
        tip.style.left = Math.min(ev.clientX - r.left + 14, Math.max(0, r.width - 250)) + 'px';
        tip.style.top = (ev.clientY - r.top + 14) + 'px';
        tip.innerHTML = '<b>' + nome + ' · ' + v + '/' + MAX + '</b>' +
          (nivel ? nivel(v) : '') + (dimInfo[k] ? (nivel ? ' — ' : '') + dimInfo[k] : '');
        tip.style.opacity = 1;
      });
      g.addEventListener('mouseleave', function () { tip.style.opacity = 0; });
      svg.appendChild(g);
    });

    // centro — Geral em dourado (código "premium/IA" da marca)
    svg.appendChild(el('circle', { class: 'center-bg', cx: CX, cy: CY, r: 96 }));
    var c1 = el('text', { class: 'center-lbl', x: CX, y: CY - 26, 'text-anchor': 'middle' });
    c1.textContent = (opts.centerLabel || 'Geral').toUpperCase();
    var c2 = el('text', { class: 'center-num', x: CX, y: CY + 30, 'text-anchor': 'middle' });
    c2.textContent = geral;
    svg.appendChild(c1);
    svg.appendChild(c2);

    // marcas da escala nos anéis-guia
    RINGS.forEach(function (g) {
      var p = pt(rScale(g), START + 1.6);
      var t = el('text', { class: 'tick', x: p[0], y: p[1] - 4, 'text-anchor': 'middle' });
      t.textContent = g;
      svg.appendChild(t);
    });

    container.appendChild(svg);
    container.appendChild(tip);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { container.classList.add('on'); });
    });
    return true;
  }

  window.EERoda = { render: render, cores: CORES.slice() };
})();
