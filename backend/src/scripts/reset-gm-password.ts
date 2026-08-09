// Recuperação de senha do GM quando ele está travado fora do painel (não
// consegue nem logar pra trocar a própria senha) — ver DEPLOY.md, seção
// "Recuperação de senha do GM". Roda direto no banco via Prisma, sem passar
// pela API, então não exige estar autenticado.
//
// Uso: docker compose exec api node dist/scripts/reset-gm-password.js
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { generateNumericPassword } from '../auth/password.util';

async function main() {
  const prisma = new PrismaClient();
  try {
    const gm = await prisma.user.findFirst({ where: { role: 'GM' } });
    if (!gm) {
      console.error('Nenhuma conta com papel GM encontrada no banco.');
      process.exitCode = 1;
      return;
    }

    const newPassword = generateNumericPassword(10);
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: gm.id }, data: { passwordHash } });

    console.log('Senha do GM redefinida com sucesso.');
    console.log(`Usuário: ${gm.username}`);
    console.log(`Nova senha: ${newPassword}`);
    console.log('Troque essa senha assim que conseguir logar (Admin > Minha Senha).');
  } finally {
    await prisma.$disconnect();
  }
}

main();
