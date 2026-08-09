/**
 * Avatares prontos, gerados via DiceBear (api.dicebear.com — serviço público,
 * gratuito, open-source, SVG determinístico por seed). Não fazemos download
 * nem hospedamos nada: o campo `avatarUrl` guarda a URL externa, igual a um
 * link de imagem qualquer. Lista curta de propósito (pedido do usuário) —
 * key é validada contra essa whitelist antes de aplicar, então o membro só
 * pode escolher um destes, nunca uma URL arbitrária.
 */
const DICEBEAR_STYLE = 'adventurer';
const SEEDS = ['Aurora', 'Blaze', 'Comet', 'Draco', 'Ember', 'Frost', 'Nova', 'Storm'];

export const AVATAR_PRESETS = SEEDS.map((seed, index) => ({
  key: `preset-${index + 1}`,
  url: `https://api.dicebear.com/9.x/${DICEBEAR_STYLE}/svg?seed=${seed}`,
}));

export function resolveAvatarPresetUrl(key: string): string | null {
  return AVATAR_PRESETS.find((preset) => preset.key === key)?.url ?? null;
}
