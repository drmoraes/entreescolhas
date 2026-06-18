// GET /api/export — exporta candidatos como CSV
const { setCors, err, requireApiKey } = require('./_lib/http');
const { query } = require('./_lib/db');

function csvField(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[";\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

module.exports = async (req, res) => {
  if (setCors(req, res)) return;
  if (!requireApiKey(req, res)) return;

  const q = req.query || {};
  const where = ['1=1'];
  const params = [];
  const addFilter = (col, val, op = '=') => {
    params.push(val);
    where.push(`${col} ${op} $${params.length}`);
  };
  if (q.status) addFilter('status', q.status);
  if (q.objetivo) addFilter('objetivo', q.objetivo);
  if (q.from) addFilter('created_at::date', q.from, '>=');
  if (q.to) addFilter('created_at::date', q.to, '<=');

  const { rows } = await query(
    `SELECT id,nome,email,telefone,cidade,linkedin,objetivo,cargo,empresa,
            experiencia,escolaridade,senioridade,arquetipo,pcd,status,
            notes,created_at
     FROM candidates WHERE ${where.join(' AND ')} ORDER BY created_at DESC`,
    params
  );

  const filename = `candidatos_${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const header = [
    'ID', 'Nome', 'E-mail', 'Telefone', 'Cidade', 'LinkedIn', 'Objetivo',
    'Cargo', 'Empresa', 'Experiência', 'Escolaridade', 'Senioridade',
    'Arquétipo', 'PCD', 'Status', 'Notas', 'Cadastrado em',
  ];

  const lines = [header.map(csvField).join(';')];
  for (const r of rows) {
    const dt = r.created_at ? new Date(r.created_at) : null;
    const dtStr = dt
      ? `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`
      : '';
    lines.push([
      r.id, r.nome, r.email, r.telefone, r.cidade, r.linkedin, r.objetivo,
      r.cargo, r.empresa, r.experiencia, r.escolaridade, r.senioridade,
      r.arquetipo, r.pcd ? 'Sim' : 'Não', r.status, r.notes, dtStr,
    ].map(csvField).join(';'));
  }

  res.send('﻿' + lines.join('\n'));
};
