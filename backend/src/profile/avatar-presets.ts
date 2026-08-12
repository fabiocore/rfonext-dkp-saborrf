/**
 * Avatares prontos, gerados via DiceBear (api.dicebear.com — serviço público,
 * gratuito, open-source, SVG determinístico por seed). Não fazemos download
 * nem hospedamos nada: o campo `avatarUrl` guarda a URL externa, igual a um
 * link de imagem qualquer. `key` é validada contra essa whitelist antes de
 * aplicar, então o membro só pode escolher um destes, nunca uma URL
 * arbitrária. Mistura 4 estilos do DiceBear (pedido do usuário, 2026-08-12,
 * pra dar variedade de verdade, não só mais rostos parecidos) — os seeds do
 * estilo "adventurer" são os mesmos de antes, pra quem já tinha escolhido um
 * desses continuar reconhecido como preset selecionado. `pixel-art` e
 * `personas` foram trocados por `avataaars`/`micah` no mesmo dia — usuário
 * achou os dois primeiros feios; escolheu os substitutos numa prévia visual
 * antes de trocar (ver CHANGELOG.md).
 */
const STYLE_SEEDS: Record<string, string[]> = {
  adventurer: ['Aurora', 'Blaze', 'Comet', 'Draco', 'Ember', 'Frost', 'Nova', 'Storm', 'Zephyr'],
  bottts: ['Circuit', 'Volt', 'Gizmo', 'Byte', 'Pixel', 'Turbo', 'Nano', 'Cyber', 'Servo'],
  avataaars: ['Jasper', 'Wren', 'Sage', 'River', 'Coral', 'Ash', 'Wilder', 'Indigo', 'Robin'],
  micah: ['Milo', 'Nora', 'Theo', 'Ivy', 'Finn', 'Greta', 'Otto', 'Maya', 'Silas'],
};

export const AVATAR_PRESETS = Object.entries(STYLE_SEEDS).flatMap(([style, seeds]) =>
  seeds.map((seed, index) => ({
    key: `${style}-${index + 1}`,
    url: `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}`,
  })),
);

export function resolveAvatarPresetUrl(key: string): string | null {
  return AVATAR_PRESETS.find((preset) => preset.key === key)?.url ?? null;
}
