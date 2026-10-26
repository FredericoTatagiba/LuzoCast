#!/usr/bin/env node
/**
 * Baixa o cloudflared (Windows x64) para apps/host/resources/bin/.
 * A versão é FIXA e o hash SHA-256 é verificado — nunca usar "latest" (docs/security.md, T10).
 *
 * Para atualizar: troque VERSION, rode com --print-hash, confira o hash com o publicado no
 * release do GitHub (cloudflare/cloudflared) e cole em SHA256.
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '2025.11.1';
// TODO: preencher com o hash oficial do release antes do primeiro build de distribuição.
const SHA256 = '';

const url = `https://github.com/cloudflare/cloudflared/releases/download/${VERSION}/cloudflared-windows-amd64.exe`;
const out = resolve(dirname(fileURLToPath(import.meta.url)), '../resources/bin/cloudflared.exe');
const printOnly = process.argv.includes('--print-hash');

const res = await fetch(url);
if (!res.ok) {
  console.error(`Falha ao baixar ${url}: HTTP ${res.status}`);
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
const hash = createHash('sha256').update(buf).digest('hex');

if (printOnly) {
  console.log(`cloudflared ${VERSION} sha256=${hash}`);
  process.exit(0);
}
if (!SHA256) {
  console.warn(`⚠️  SHA256 não fixado no script. Hash baixado: ${hash}\n   Confira no release oficial e preencha a constante SHA256.`);
} else if (hash !== SHA256) {
  console.error(`Hash não confere!\n esperado ${SHA256}\n obtido   ${hash}`);
  process.exit(1);
}

await mkdir(dirname(out), { recursive: true });
await writeFile(out, buf);
console.log(`cloudflared ${VERSION} salvo em ${out}`);
