import { randomInt } from 'crypto';

/** Senha numérica aleatória (padrão: 10 dígitos) — usada pro GM gerar contas de conselho. */
export function generateNumericPassword(length = 10): string {
  let password = '';
  for (let i = 0; i < length; i++) {
    password += randomInt(0, 10).toString();
  }
  return password;
}
