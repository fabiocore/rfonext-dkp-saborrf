import { randomBytes } from 'crypto';

// Mesmo alfabeto seguro do código de leilão (sem 0/O/1/I) — aqui só maiúsculas
// alfanuméricas, 12 caracteres (mais longo que o de leilão porque dá acesso
// a dados pessoais/edição de perfil, não só lance dentro do saldo disponível).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateProfileAccessCode(): string {
  const bytes = randomBytes(12);
  let code = '';
  for (let i = 0; i < 12; i++) code += ALPHABET[bytes[i] % ALPHABET.length];
  return code;
}
