/**
 * Aceita tanto o ID numérico do Discord (snowflake, 17-19 dígitos — nunca
 * muda, ideal se um dia integrarmos um bot) quanto o usuário/tag (ex:
 * "fulano" ou o formato antigo "fulano#1234") — a maioria dos membros não
 * sabe achar o ID numérico (exige ativar o Modo Desenvolvedor), então
 * exigir só o ID demonstrou ser fricção alta demais na prática.
 */
const NUMERIC_ID_PATTERN = /^\d{17,19}$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9._]{2,32}(#\d{4})?$/;

export function isValidDiscordHandle(value: string): boolean {
  return NUMERIC_ID_PATTERN.test(value) || USERNAME_PATTERN.test(value);
}
