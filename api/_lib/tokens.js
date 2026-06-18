const crypto = require('crypto');

// 32 bytes -> 64 caracteres hex, mesmo tamanho usado nas colunas VARCHAR(64) do schema.
function genToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = { genToken };
