// aplicar-fix-audio-fetch.mjs — blindaje del audio liberado/independiente en export chunked
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-audiofetch', src);
const ops = [];
function rep(name, search, replace) {
  const c = src.split(search).length - 1;
  if (c !== 1) { console.error('❌ [' + name + '] ancla ' + c + ' veces (esperaba 1). NO se tocó nada.'); process.exit(1); }
  src = src.replace(search, replace); ops.push(name);
}
// 1) El audio vinculado LIBERADO de un clip pesado también va por byte-ranges (antes caía al fetch entero)
rep('released-byte-ranges',
'} else if (srcIdx >= 0 && willExtract.has(srcIdx) && !aud.released) {',
'} else if (srcIdx >= 0 && willExtract.has(srcIdx)) {');
// 2) La rama independiente: IndexedDB primero (inmune a blob: revocados) + byte-ranges si es pesado
rep('independent-audio',
`} else {
const fname = \`a\${j}.\${aud.url.includes('blob') ? 'mp4' : 'mp3'}\`;
await ff.writeFile(fname, new Uint8Array(await (await fetch(aud.url)).arrayBuffer()));
audioFiles.push(fname);
trackInputIdx[j] = audioFiles.length - 1;
}`,
`} else {
// Fuente independiente o liberada: recuperar el Blob desde IndexedDB (inmune a
// blob: URLs revocados) y, si es pesado, alimentarlo por byte-ranges en vez de
// leer los GB enteros a RAM (el viejo "Failed to fetch" / OOM de Fase 6).
let srcBlob: Blob | null = aud.assetId ? await getAsset(aud.assetId).catch(() => null) : null;
if (!srcBlob) { try { srcBlob = await (await fetch(aud.url)).blob(); } catch { srcBlob = null; } }
if (!srcBlob) throw new Error(\`No se pudo recuperar el audio "\${aud.name}": el asset local no está disponible.\`);
if (srcBlob.size > EXTRACT_THRESHOLD) {
const g2 = trackGeom(aud);
const segI = await extractAudioSegment(srcBlob, g2.offset, g2.offset + g2.duration * g2.speed, () => {});
if (!segI) throw new Error(\`El audio pesado "\${aud.name}" no es compatible con byte-ranges (AAC).\`);
totalFetched += segI.fetchedBytes;
await ff.writeFile(\`sax\${j}.m4a\`, segI.mp4);
audioFiles.push(\`sax\${j}.m4a\`);
trackInputIdx[j] = audioFiles.length - 1;
trackRoll[j] = Math.max(0, g2.offset - segI.firstTs);
trackWasExtracted[j] = true;
} else {
const fname = \`a\${j}.mp4\`;
await ff.writeFile(fname, new Uint8Array(await srcBlob.arrayBuffer()));
audioFiles.push(fname);
trackInputIdx[j] = audioFiles.length - 1;
}
}`);
fs.writeFileSync(PATH, src);
console.log('✅ Audio blindado:', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-audiofetch');