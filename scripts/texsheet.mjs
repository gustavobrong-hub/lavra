// Executa scripts/texsheet.ts pelo executor de módulos do Vite (TypeScript sem dependências novas).
// Uso: node scripts/texsheet.mjs [opções]  — veja o cabeçalho de scripts/texsheet.ts.
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { runnerImport } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const { module } = await runnerImport('./scripts/texsheet.ts', { root, logLevel: 'error' });
console.log(module.main(process.argv.slice(2)));
