import { XMLParser } from 'fast-xml-parser';
import { BadRequestException } from '@nestjs/common';

export interface ParsedGuildParticipation {
  activityColumnNames: string[];
  rows: { gameName: string; checks: boolean[] }[];
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Extrai o texto de uma célula <Cell><Data ss:Type="String">texto</Data></Cell>. */
function getCellText(cell: any): string {
  const data = cell?.Data;
  if (data === undefined || data === null) return '';
  if (typeof data === 'string' || typeof data === 'number') return String(data);
  return String(data['#text'] ?? '').trim();
}

/**
 * O jogo (RF Online Next) exporta um Excel 2003 SpreadsheetML (progid
 * Excel.Sheet), não um .xlsx real. Marcado/desmarcado é indicado pelo
 * ss:StyleID da célula ("CheckedStyle"/"UncheckedStyle") — os glifos
 * Wingdings dentro de <Data> não são confiáveis pra ler diretamente, então
 * o parser lê sempre pelo StyleID, tratando qualquer StyleID desconhecido
 * como não marcado.
 */
export function parseGuildParticipationXml(xmlText: string): ParsedGuildParticipation {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
  });

  let parsed: any;
  try {
    parsed = parser.parse(xmlText);
  } catch (err) {
    throw new BadRequestException(`XML inválido: ${(err as Error).message}`);
  }

  const workbook = parsed?.Workbook;
  if (!workbook) {
    throw new BadRequestException('Arquivo não parece ser um export válido do jogo (Workbook não encontrado).');
  }

  const worksheets = toArray(workbook.Worksheet);
  const worksheet = worksheets[0];
  if (!worksheet?.Table) {
    throw new BadRequestException('Nenhuma planilha/tabela encontrada no arquivo.');
  }

  const rows = toArray(worksheet.Table.Row);
  if (rows.length === 0) {
    throw new BadRequestException('A planilha não tem linhas.');
  }

  const headerCells = toArray(rows[0].Cell);
  if (headerCells.length < 2) {
    throw new BadRequestException('Linha de cabeçalho inválida (esperado nome + ao menos 1 atividade).');
  }
  const activityColumnNames = headerCells.slice(1).map(getCellText).filter((name) => name.length > 0);

  const dataRows = rows.slice(1);
  const parsedRows: { gameName: string; checks: boolean[] }[] = [];

  for (const row of dataRows) {
    const cells = toArray(row.Cell);
    if (cells.length === 0) continue;
    const gameName = getCellText(cells[0]);
    if (!gameName) continue;

    const checks = activityColumnNames.map((_, index) => {
      const cell = cells[index + 1];
      const styleId = cell?.['@_ss:StyleID'];
      return styleId === 'CheckedStyle';
    });

    parsedRows.push({ gameName, checks });
  }

  return { activityColumnNames, rows: parsedRows };
}

/** Extrai a data de referência do padrão AAAAMMDD_HHMMSS_NomeDaGuild.xml. */
export function parseReferenceDateFromFileName(fileName: string): Date {
  const match = fileName.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_.+\.xml$/i);
  if (!match) {
    throw new BadRequestException(
      `Nome de arquivo fora do padrão esperado (AAAAMMDD_HHMMSS_NomeDaGuild.xml): ${fileName}`,
    );
  }
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}
