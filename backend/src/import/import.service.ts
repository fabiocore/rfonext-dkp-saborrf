import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CharactersService } from '../characters/characters.service';
import { ActivitiesService } from '../activities/activities.service';
import { LedgerService } from '../ledger/ledger.service';
import { parseGuildParticipationXml, parseReferenceDateFromFileName } from './xml-parser.util';

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly charactersService: CharactersService,
    private readonly activitiesService: ActivitiesService,
    private readonly ledgerService: LedgerService,
  ) {}

  findAll() {
    return this.prisma.importBatch.findMany({ orderBy: { uploadedAt: 'desc' } });
  }

  async importXmlFile(fileName: string, buffer: Buffer, uploadedById?: string) {
    const referenceDate = parseReferenceDateFromFileName(fileName);

    const existingBatch = await this.prisma.importBatch.findUnique({ where: { fileName } });
    if (existingBatch) {
      throw new ConflictException(`O arquivo "${fileName}" já foi importado anteriormente.`);
    }

    // O jogo republica o XML do dia várias vezes (às vezes o GM baixa cedo,
    // antes de todo mundo ter feito check-in/doação/atividade) — então
    // reenviar a MESMA data é esperado e precisa funcionar, nunca gerar
    // emissão duplicada (emitOnce, em LedgerService, já garante isso por
    // characterId+activityId+dia). O que muda entre a 1ª e as próximas
    // importações da mesma data é só o status "Saiu": só é reavaliado na
    // primeira importação processada daquela data — reenvios (inclusive
    // de uma data antiga, pra corrigir algo) nunca voltam a mexer nisso,
    // pra não marcar por engano como "Saiu" alguém que só ficou de fora
    // daquele arquivo específico reenviado.
    const priorBatchForDate = await this.prisma.importBatch.findFirst({
      where: { referenceDate, status: 'PROCESSED' },
      orderBy: { uploadedAt: 'asc' },
    });
    const isFirstImportForDate = !priorBatchForDate;

    const xmlText = buffer.toString('utf-8');
    const { activityColumnNames, rows } = parseGuildParticipationXml(xmlText);

    // Reserva o nome do arquivo já de cara pra impedir upload duplo concorrente.
    const batch = await this.prisma.importBatch.create({
      data: {
        fileName,
        referenceDate,
        uploadedById,
        status: 'PROCESSED',
        rowCount: rows.length,
      },
    });

    try {
      let newActivitiesDetected = 0;
      // Nomes exatos das colunas novas detectadas neste arquivo — exibido no
      // resultado do import pra pegar na hora um typo/acento diferente numa
      // atividade pré-cadastrada em Configurações (que só "conecta" com o
      // XML real se o nome bater EXATO); se aparecer aqui um nome parecido
      // mas diferente do que foi pré-configurado, é sinal de duplicata.
      const newActivityNames: string[] = [];
      const activityByName = new Map<string, { id: string }>();
      for (const columnName of activityColumnNames) {
        const existing = await this.activitiesService.findByName(columnName);
        const activity = await this.activitiesService.ensureXmlColumnActivity(columnName);
        if (!existing) {
          newActivitiesDetected++;
          newActivityNames.push(columnName);
        }
        activityByName.set(columnName, activity);
      }

      let newCharactersDetected = 0;

      for (const row of rows) {
        const existingCharacter = await this.prisma.character.findUnique({
          where: { gameName: row.gameName },
        });
        if (!existingCharacter) newCharactersDetected++;

        const character = await this.charactersService.upsertFromImport(row.gameName, referenceDate);

        for (let i = 0; i < activityColumnNames.length; i++) {
          const activity = activityByName.get(activityColumnNames[i]);
          if (!activity) continue;
          const checked = row.checks[i] ?? false;

          await this.prisma.activityCheckIn.upsert({
            where: {
              characterId_activityId_referenceDate: {
                characterId: character.id,
                activityId: activity.id,
                referenceDate,
              },
            },
            update: { checked, importBatchId: batch.id },
            create: {
              characterId: character.id,
              activityId: activity.id,
              referenceDate,
              checked,
              importBatchId: batch.id,
            },
          });
        }
      }

      const { emittedCount } = await this.ledgerService.recordActivityEmissionsForBatch(batch.id);

      // A lista válida de personagens é sempre a do XML mais recente — quem
      // não aparece nele "Saiu" da guild (PREMISSAS.md seção 3). Um arquivo
      // "padrão" (só cabeçalho, sem nenhuma linha de personagem — usado pra
      // configurar valores de atividade antes do primeiro import real) não
      // prova ausência de ninguém, então pula essa checagem por completo em
      // vez de marcar todo mundo como "Saiu" — e reenvios da mesma data
      // (isFirstImportForDate = false) também pulam, pra não reavaliar
      // "Saiu" com base num arquivo que não é necessariamente o mais
      // completo/atual (ver comentário no início do método).
      if (rows.length > 0 && isFirstImportForDate) {
        await this.charactersService.markMissingAsLeft(rows.map((row) => row.gameName));
      }

      return this.prisma.importBatch.update({
        where: { id: batch.id },
        data: { newCharactersDetected, newActivitiesDetected },
        select: {
          id: true,
          fileName: true,
          referenceDate: true,
          rowCount: true,
          newCharactersDetected: true,
          newActivitiesDetected: true,
          status: true,
          uploadedAt: true,
        },
      }).then((result) => ({ ...result, emittedCount, newActivityNames, isFirstImportForDate }));
    } catch (err) {
      // Falha no meio do processamento: desfaz a reserva do nome do arquivo
      // pra permitir reenviar depois de corrigido o problema.
      await this.prisma.importBatch
        .update({
          where: { id: batch.id },
          data: { status: 'FAILED', errorDetail: (err as Error).message },
        })
        .catch(() => undefined);
      throw err;
    }
  }
}
