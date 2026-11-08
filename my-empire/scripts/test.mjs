// Compila logica di dominio + test in .test-build e li esegue con il runner integrato di Node.
import { execSync } from 'node:child_process';
import { rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

rmSync('.test-build', { recursive: true, force: true });
execSync('tsc -p tsconfig.test.json', { stdio: 'inherit' });
const dir = join('.test-build', 'tests');
const files = readdirSync(dir).filter((f) => f.endsWith('.test.js')).map((f) => join(dir, f));
execSync(`node --test ${files.join(' ')}`, { stdio: 'inherit', env: { ...process.env, TZ: process.env.TZ ?? 'Europe/Rome' } });
