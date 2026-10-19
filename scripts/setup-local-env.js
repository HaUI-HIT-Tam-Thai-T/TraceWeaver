import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';

const root = new URL('../', import.meta.url);
try {
  const template = await readFile(new URL('.env.example', root), 'utf8');
  const values = parseEnv(template);
  const password = randomBytes(32).toString('hex');
  const url = new URL(`postgresql://127.0.0.1:${values.POSTGRES_PORT}/${values.POSTGRES_DB}`);
  url.username = values.POSTGRES_USER;
  url.password = password;
  const content = template
    .replace(/^POSTGRES_PASSWORD=.*$/m, `POSTGRES_PASSWORD=${password}`)
    .replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${url.href}`);
  await writeFile(new URL('.env', root), content, { flag: 'wx', mode: 0o600 });
  console.log('Created local .env with a random DB password. Credentials were not printed.');
} catch (error) {
  console.error(error.code === 'EEXIST' ? '.env already exists; kept unchanged.' : 'LOCAL_ENV_SETUP_FAILED');
  process.exitCode = 1;
}
