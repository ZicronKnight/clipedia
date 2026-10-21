// Descarga las fuentes TTF (Regular y Bold) a /public/fonts
// usando el ZIP oficial de "Download family" de Google Fonts.
// Uso: node scripts/download-fonts.mjs
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';

const OUT = path.join(process.cwd(), 'public', 'fonts');

const FAMILIES = [
  ['Roboto', 'Roboto'],
  ['Merriweather', 'Merriweather'],
  ['Source Code Pro', 'SourceCodePro'],
  ['Playfair Display', 'PlayfairDisplay'],
  ['Montserrat', 'Montserrat'],
  ['Open Sans', 'OpenSans'],
  ['Lato', 'Lato'],
  ['Oswald', 'Oswald'],
  ['Raleway', 'Raleway'],
  ['Poppins', 'Poppins'],
  ['Nunito', 'Nunito'],
];

const SUFFIX = { regular: 'Regular', bold: 'Bold' };

async function fileOk(file) {
  try {
    const buf = await readFile(file);
    return buf.length > 10000;
  } catch {
    return false;
  }
}

// Descomprimidor ZIP mínimo (sin dependencias)
function unzip(buf) {
  const entries = new Map();
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP inválido (no se encontró el índice)');
  const count = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) break;
    const method = buf.readUInt16LE(ptr + 10);
    const compSize = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOff = buf.readUInt32LE(ptr + 42);
    const name = buf.toString('utf8', ptr + 46, ptr + 46 + nameLen);
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    if (!name.endsWith('/')) {
      if (method === 0) entries.set(name, Buffer.from(raw));
      else if (method === 8) entries.set(name, inflateRawSync(raw));
    }
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function downloadFamilyZip(family) {
  const url = `https://fonts.google.com/download?family=${encodeURIComponent(family)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} al pedir el ZIP de ${family}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000) throw new Error(`ZIP demasiado chico (${buf.length} bytes)`);
  return unzip(buf);
}

await mkdir(OUT, { recursive: true });

let ok = 0, skip = 0, fail = 0;

for (const [family, key] of FAMILIES) {
  let entries = null;
  for (const suffix of Object.values(SUFFIX)) {
    const file = path.join(OUT, `${key}-${suffix}.ttf`);
    if (await fileOk(file)) {
      console.log(`⏭️  ${key}-${suffix}.ttf ya existe, se omite`);
      skip++;
      continue;
    }
    try {
      if (!entries) entries = await downloadFamilyZip(family);
      // Buscamos el TTF por nombre de archivo, esté en la raíz o en /static/
      let found = null;
      for (const [name, data] of entries) {
        const base = name.split('/').pop();
        if (base === `${key}-${suffix}.ttf`) { found = data; break; }
      }
      if (!found) {
        // Segundo intento: coincidencia ignorando mayúsculas/minúsculas
        for (const [name, data] of entries) {
          const base = name.split('/').pop().toLowerCase();
          if (base === `${key}-${suffix}.ttf`.toLowerCase()) { found = data; break; }
        }
      }
      if (!found) throw new Error(`El ZIP no contiene ${key}-${suffix}.ttf`);
      await writeFile(file, found);
      console.log(`✅ ${key}-${suffix}.ttf (${found.length} bytes)`);
      ok++;
    } catch (e) {
      console.error(`❌ Fallo ${key}-${suffix}: ${e.message}`);
      fail++;
    }
  }
}

console.log(`\nResumen: ${ok} descargadas, ${skip} omitidas, ${fail} fallidas → public/fonts/`);