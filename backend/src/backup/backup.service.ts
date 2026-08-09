import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { spawn } from 'child_process';

const RESTORE_CONFIRM_TEXT = 'RESTAURAR';

interface DbConnection {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
  schema: string;
}

/**
 * Backup/restore do banco via pg_dump/psql, conectando direto pela rede
 * (DATABASE_URL) — não usa `docker exec`/socket do Docker, então não precisa
 * de nenhum acesso especial além de rede até o serviço `db`. Client
 * (postgresql-client-16, ver Dockerfile) precisa bater com a versão major do
 * servidor, senão pg_dump recusa rodar ("server version mismatch").
 *
 * Dump gerado com --clean --if-exists: o próprio arquivo já contém os DROP
 * TABLE/DROP TYPE necessários, então restaurar é só rodar o arquivo inteiro
 * no psql — sem precisar de lógica extra de "limpar antes" no código.
 */
@Injectable()
export class BackupService {
  private getConnection(): DbConnection {
    const raw = process.env.DATABASE_URL;
    if (!raw) throw new InternalServerErrorException('DATABASE_URL não configurada.');
    const url = new URL(raw);
    return {
      host: url.hostname,
      port: url.port || '5432',
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ''),
      schema: url.searchParams.get('schema') || 'public',
    };
  }

  async createBackup(): Promise<Buffer> {
    const conn = this.getConnection();
    return this.run(
      'pg_dump',
      ['-h', conn.host, '-p', conn.port, '-U', conn.user, '-d', conn.database, '--clean', '--if-exists', '--schema', conn.schema],
      conn.password,
    );
  }

  async restoreFromUpload(fileBuffer: Buffer, confirmText: string | undefined): Promise<void> {
    if (confirmText?.trim().toUpperCase() !== RESTORE_CONFIRM_TEXT) {
      throw new BadRequestException(`Confirmação inválida. Digite exatamente "${RESTORE_CONFIRM_TEXT}" pra continuar.`);
    }
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('Nenhum arquivo enviado (campo esperado: "file").');
    }
    const conn = this.getConnection();
    await this.run(
      'psql',
      ['-h', conn.host, '-p', conn.port, '-U', conn.user, '-d', conn.database, '--set', 'ON_ERROR_STOP=1'],
      conn.password,
      fileBuffer,
    );
  }

  private run(cmd: string, args: string[], pgPassword: string, stdin?: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, { env: { ...process.env, PGPASSWORD: pgPassword } });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      child.stdout.on('data', (chunk) => stdout.push(chunk));
      child.stderr.on('data', (chunk) => stderr.push(chunk));
      child.on('error', (err) => reject(new InternalServerErrorException(`Falha ao executar ${cmd}: ${err.message}`)));
      child.on('close', (code) => {
        if (code !== 0) {
          const message = Buffer.concat(stderr).toString('utf8').trim().slice(0, 2000) || `${cmd} saiu com código ${code}`;
          reject(new BadRequestException(`Falha ao executar ${cmd}: ${message}`));
          return;
        }
        resolve(Buffer.concat(stdout));
      });
      child.stdin.end(stdin);
    });
  }
}
