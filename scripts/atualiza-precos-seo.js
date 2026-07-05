#!/usr/bin/env node
/* Sincroniza os PREÇOS ESTÁTICOS (meta description, og/twitter, JSON-LD e textos)
 * com o preço atual do admin. HTML estático não lê o banco em tempo real, então
 * rode este script sempre que mudar o preço no admin — ele reescreve os arquivos.
 *
 * Uso:
 *   node scripts/atualiza-precos-seo.js                 # busca o preço do endpoint público
 *   node scripts/atualiza-precos-seo.js --single=12.90 --combo=34.90
 *   node scripts/atualiza-precos-seo.js --base=https://www.entreescolhas.com.br
 *
 * Depois: git add -A && git commit -m "chore: precos SEO" && git push
 *
 * É idempotente: guarda o último preço aplicado em scripts/.precos-seo.json e
 * substitui a partir dele, então pode rodar quantas vezes quiser.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STATE = path.join(__dirname, '.precos-seo.json');

function brl(v) { return 'R$ ' + Number(v).toFixed(2).replace('.', ','); }
function arg(name) { const m = process.argv.find(a => a.startsWith('--' + name + '=')); return m ? m.split('=')[1] : null; }

async function getPrices() {
  const s = arg('single'), c = arg('combo');
  if (s && c) return { single: Number(s), combo: Number(c) };
  const base = arg('base') || 'https://www.entreescolhas.com.br';
  const r = await fetch(base + '/api/b2b?fn=public_prices');
  const d = await r.json();
  if (!d || !d.ok) throw new Error('Não consegui ler o preço do endpoint público.');
  return { single: Number(d.single), combo: Number(d.combo) };
}

function derive(p) {
  const de = +(p.single * 4).toFixed(2);
  const economia = Math.max(0, +(de - p.combo).toFixed(2));
  return { single: p.single, combo: p.combo, de, economia };
}

function literals(d) {
  return { single: brl(d.single), combo: brl(d.combo), de: brl(d.de), economia: brl(d.economia) };
}

(async () => {
  const novo = derive(await getPrices());
  let velho = { single: 9.90, combo: 29.90 };
  try { velho = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (e) {}
  velho = derive(velho);

  const from = literals(velho), to = literals(novo);
  // ordem: do mais específico/maior para o menor evita colisões parciais
  const pairs = [['de', from.de, to.de], ['combo', from.combo, to.combo], ['single', from.single, to.single], ['economia', from.economia, to.economia]];

  if (JSON.stringify(from) === JSON.stringify(to)) {
    console.log('Nada a fazer — preços já sincronizados:', to);
    return;
  }

  const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
  let totalFiles = 0, totalReps = 0;
  for (const f of files) {
    const p = path.join(ROOT, f);
    let html = fs.readFileSync(p, 'utf8');
    let reps = 0;
    for (const [, oldLit, newLit] of pairs) {
      if (oldLit === newLit) continue;
      const parts = html.split(oldLit);
      reps += parts.length - 1;
      html = parts.join(newLit);
    }
    if (reps > 0) { fs.writeFileSync(p, html); totalFiles++; totalReps += reps; console.log(`  ${f}: ${reps} substituições`); }
  }

  fs.writeFileSync(STATE, JSON.stringify({ single: novo.single, combo: novo.combo }, null, 2));
  console.log(`\n✓ ${totalReps} substituições em ${totalFiles} arquivos. De ${JSON.stringify(from)} → ${JSON.stringify(to)}`);
  console.log('Agora: git add -A && git commit -m "chore: sincroniza precos SEO" && git push');
})().catch(e => { console.error('Erro:', e.message); process.exit(1); });
