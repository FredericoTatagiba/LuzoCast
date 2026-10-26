#!/usr/bin/env node
/**
 * Baixa o cloudflared (Windows x64) para apps/host/resources/bin/.
 * Versão e hash vêm de resources/cloudflared.json — a MESMA fonte usada pela verificação
 * de prontidão do app. Nunca usar "latest" (docs/security.md, T10).
 *
 * Para atualizar: troque "version" no JSON, rode com --print-hash, confira o hash com o
 * publicado no release do GitHub (cloudflare/cloudflared) e cole em "sha256".
 *
 * Uso:  node scripts/fetch-cloudflared.mjs [--print-hash] [--if-missing]
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { version, sha256 } = JSON.parse(readFileSync(resolve(here, '../resources/cloudflared.json'), 'utf8'));
const url = `https://github.com/cloudflare/cloudflared/releases/download/${version}/cloudflared-windows-amd64.exe`;
const out = resolve(here, '../resources/bin/cloudflared.exe');
const printOnly = process.argv.includes('--print-hash');

const fileHash = (buf) => createHash('sha256').update(buf).digest('hex');

if (process.argv.includes('--if-missing') && existsSync(out) && fileHash(readFileSync(out)) === sha256) {
  console.log(`cloudflared ${version} já instalado e verificado.`);
  process.exit(0);
}

const res = await fetch(url);
if (!res.ok) {
  console.error(`Falha ao baixar ${url}: HTTP ${res.status}`);
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
const hash = fileHash(buf);

if (printOnly) {
  console.log(`cloudflared ${version} sha256=${hash}`);
  process.exit(0);
}
if (hash !== sha256) {
  console.error(`Hash não confere!\n esperado ${sha256}\n obtido   ${hash}`);
  process.exit(1);
}

await mkdir(dirname(out), { recursive: true });
await writeFile(out, buf);
console.log(`cloudflared ${version} verificado e salvo em ${out}`);
