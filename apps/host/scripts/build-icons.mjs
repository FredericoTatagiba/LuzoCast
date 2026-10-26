#!/usr/bin/env node
/**
 * Gera os ícones do app a partir dos SVGs em apps/host/build/:
 *   icon.svg        → tamanhos ≥ 48 px (com degradê)
 *   icon-small.svg  → 16, 24 e 32 px (chapado, traços grossos)
 * Saída: build/icon.ico (todos os tamanhos), build/icon.png (512) e o favicon do viewer.
 *
 * Uso: pnpm --filter @luzocast/host icons   (rode após editar os SVGs e commite o resultado)
 */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const here = dirname(fileURLToPath(import.meta.url));
const build = resolve(here, '../build');
const big = readFileSync(resolve(build, 'icon.svg'), 'utf8');
const small = readFileSync(resolve(build, 'icon-small.svg'), 'utf8');

const render = (svg, size) => new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();

const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngs = sizes.map((s) => ({ size: s, data: render(s <= 32 ? small : big, s) }));

/** Container ICO com entradas PNG (suportado desde o Windows Vista). */
function toIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, data } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

writeFileSync(resolve(build, 'icon.ico'), toIco(pngs));
writeFileSync(resolve(build, 'icon.png'), render(big, 512));
copyFileSync(resolve(build, 'icon.svg'), resolve(here, '../../viewer/public/favicon.svg'));
console.log(`Ícones gerados: icon.ico (${sizes.join(', ')} px), icon.png (512 px), favicon do viewer`);
