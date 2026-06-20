// (removido) — endpoint de diagnóstico temporário, desativado após a migração para o Supabase.
module.exports = async (req, res) => { res.statusCode = 410; res.end('gone'); };
