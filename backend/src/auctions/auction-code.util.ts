import { randomBytes } from 'crypto';

// Sem 0/O/1/I pra evitar confusão quando o conselho for ditar/copiar o código.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';

/** Formato LLLLNN (4 letras + 2 números) — curto o bastante pra decorar e digitar de cabeça. */
export function generateAccessCode(): string {
  const letterBytes = randomBytes(4);
  const digitBytes = randomBytes(2);
  let code = '';
  for (let i = 0; i < 4; i++) code += LETTERS[letterBytes[i] % LETTERS.length];
  for (let i = 0; i < 2; i++) code += DIGITS[digitBytes[i] % DIGITS.length];
  return code;
}
