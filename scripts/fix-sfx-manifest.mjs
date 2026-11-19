// fix-sfx-manifest.mjs — descubre el prefijo real, genera y publica SOLO el manifest
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';

const nodeRequire = createRequire(import.meta.url);
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const BUCKET = arg('bucket', 'clipedia-sfx');
const BASE = (arg('base', 'https://sfx.clipedia.net')).replace(/\/+$/, '');
const PREFIX_ARG = arg('prefix', 'sfx');

// 0) Localizar la carpeta de audios (sfx-source o public/sfx)
const SRC = ['sfx-source', path.join('public', 'sfx'), arg('src', '')].find((p) => p && fs.existsSync(p));
if (!SRC) { console.error('❌ No encuentro sfx-source/ ni public/sfx/. Pasame la ruta con --src'); process.exit(1); }
console.log('📂 Origen local:', SRC);

// 1) Wrangler directo con node (nada de .cmd → nada de EINVAL)
function resolveWrangler() {
  try {
    const pkgPath = nodeRequire.resolve('wrangler/package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const bin = typeof pkg.bin === 'string' ? pkg.bin : (pkg.bin && (pkg.bin.wrangler || pkg.bin.wrangler2));
    if (bin) { const p = path.join(path.dirname(pkgPath), bin); if (fs.existsSync(p)) return p; }
  } catch {}
  for (const c of [path.join('node_modules', 'wrangler', 'bin', 'wrangler.js'), path.join('node_modules', 'wrangler', 'wrangler-dist', 'cli.js')]) {
    if (fs.existsSync(c)) return path.resolve(c);
  }
  return null;
}
const WRANGLER = resolveWrangler();
if (!WRANGLER) { console.error('❌ Falta wrangler: npm i -D wrangler'); process.exit(1); }

function run(a) {
  return new Promise((res) => {
    execFile(process.execPath, [WRANGLER, ...a],
      { windowsHide: true, maxBuffer: 16 * 1024 * 1024, timeout: 120000,
        env: { ...process.env, WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1' } },
      (err, so, se) => res({ ok: !err, out: String(so || '') + String(se || '') }));
  });
}

// 2) Escaneo + duración MP3 (Xing/Info exacta, o CBR por tamaño)
const AUDIO = /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i;
const BR_V1 = [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320];
const BR_V2 = [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160];
const SR_TAB = { 3:[44100,48000,32000], 2:[22050,24000,16000], 0:[11025,12000,8000] };
function id3Size(b) {
  if (b.length < 10 || b.toString('ascii', 0, 3) !== 'ID3') return 0;
  const s = (b[6]&0x7f)*2097152 + (b[7]&0x7f)*16384 + (b[8]&0x7f)*128 + (b[9]&0x7f);
  return 10 + s + (b[5]&0x10 ? 10 : 0);
}
function mp3Duration(b) {
  const skip = id3Size(b); let i = skip;
  for (; i < Math.min(b.length - 4, skip + 8192); i++) if (b[i] === 0xff && (b[i+1] & 0xe0) === 0xe0) break;
  if (i >= b.length - 4) return 0;
  const ver = (b[i+1] >> 3) & 3, layer = (b[i+1] >> 1) & 3;
  if (ver === 1 || layer !== 1) return 0;
  const br = (ver === 3 ? BR_V1 : BR_V2)[(b[i+2] >> 4) & 15];
  const srIdx = (b[i+2] >> 2) & 3, sr = (SR_TAB[ver] || SR_TAB[3])[srIdx], pad = (b[i+2] >> 1) & 1;
  if (!br || !sr || srIdx === 3) return 0;
  const spf = ver === 3 ? 1152 : 576;
  const fsz = Math.floor((spf/8) * (br*1000) / sr) + pad;
  if (fsz <= 4) return 0;
  const mono = ((b[i+3] >> 6) & 3) === 3;
  const tagAt = i + 4 + (ver === 3 ? (mono ? 17 : 32) : (mono ? 9 : 17));
  if (tagAt + 12 <= b.length) {
    const tag = b.toString('ascii', tagAt, tagAt + 4);
    if ((tag === 'Xing' || tag === 'Info') && (b.readUInt32BE(tagAt+4) & 1)) {
      const frames = b.readUInt32BE(tagAt+8);
      if (frames > 0) return (frames * spf) / sr;
    }
  }
  return ((b.length - skip) / fsz) * spf / sr;
}
const pretty = (s) => s.replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim().replace(/\b\w/g,(c)=>c.toUpperCase());
const urlFor = (prefix, rel) => BASE + '/' + [prefix, ...rel.split('/')].filter(Boolean).map(encodeURIComponent).join('/');

const files = [];
(function walk(dir, rel) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a,b)=>a.name.localeCompare(b.name))) {
    const abs = path.join(dir, e.name);
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) walk(abs, r);
    else if (AUDIO.test(e.name)) files.push({ abs, rel: r });
  }
})(SRC, '');
if (!files.length) { console.error('❌ No hay audios en ' + SRC); process.exit(1); }
console.log('🔎 ' + files.length + ' audios locales');

// 3) DESCUBRIR EL PREFIJO REAL: probamos un archivo que sí debería estar subido
async function probe(u) {
  try {
    const r = await fetch(u + '?cb=' + Date.now(), { method: 'GET', headers: { Range: 'bytes=0-64' } });
    return r.status;
  } catch (e) { return 'ERR:' + (e?.message || e); }
}
const sample = files[0].rel;
const candidates = [...new Set([PREFIX_ARG, '', 'sfx'])];
let REAL_PREFIX = null;
console.log('🧭 Probando prefijos con:', sample);
for (const p of candidates) {
  const u = urlFor(p, sample);
  const st = await probe(u);
  console.log('   [' + st + '] ' + u);
  if (st === 200 || st === 206) { REAL_PREFIX = p; break; }
}
if (REAL_PREFIX === null) {
  console.error('\n❌ Ningún archivo responde por el dominio público. El problema NO es el manifest:');
  console.error('   1) R2 → bucket ' + BUCKET + ' → Settings → Custom Domains: ¿está sfx.clipedia.net conectado y activo?');
  console.error('   2) ¿El dominio apunta a ESTE bucket y no a otro?');
  console.error('   3) Probá abrir esa URL de ejemplo en el navegador y contame qué error da.');
  process.exit(1);
}
console.log('✅ Prefijo real detectado: "' + REAL_PREFIX + '"');

// 4) Construir el manifest con ese prefijo
const items = []; const catSet = new Set(); let bytes = 0;
for (const f of files) {
  const buf = fs.readFileSync(f.abs);
  const ext = path.extname(f.rel).slice(1).toLowerCase();
  const dur = ext === 'mp3' ? mp3Duration(buf) : 0;
  const folder = path.posix.dirname(f.rel) === '.' ? 'General' : path.posix.dirname(f.rel);
  const cat = folder.split('/').map(pretty).join(' · ');
  catSet.add(cat); bytes += buf.length;
  items.push({
    id: f.rel.replace(/\.[^.]+$/, '').replace(/[^\w/.-]/g, '_').replace(/\//g, '__'),
    name: pretty(path.basename(f.rel, path.extname(f.rel))),
    cat,
    dur: Math.round(dur * 1000) / 1000,
    url: urlFor(REAL_PREFIX, f.rel),
    bytes: buf.length,
  });
}
const cats = [...catSet].sort((a,b)=>a.localeCompare(b));
const manifest = { version: 1, builtAt: new Date().toISOString(), count: items.length, cats, items };
fs.writeFileSync('sfx-manifest.json', JSON.stringify(manifest));
console.log('📝 manifest local: ' + items.length + ' sonidos · ' + cats.length + ' categorías · ' + (bytes/1048576).toFixed(1) + ' MB');

// 5) Subir SOLO el manifest (key literal, sin encodear: wrangler la toma tal cual)
const key = [REAL_PREFIX, 'manifest.json'].filter(Boolean).join('/');
const target = BUCKET + '/' + key;
const sets = [
  ['r2','object','put',target,'--file',path.resolve('sfx-manifest.json'),'--content-type','application/json','--cache-control','public, max-age=60','--remote'],
  ['r2','object','put',target,'--file',path.resolve('sfx-manifest.json'),'--content-type','application/json','--cache-control','public, max-age=60'],
  ['r2','object','put',target,'--file',path.resolve('sfx-manifest.json'),'--content-type','application/json'],
  ['r2','object','put',target,'--file',path.resolve('sfx-manifest.json')],
];
let up = null;
for (const s of sets) { const r = await run(s); if (r.ok) { up = s; break; } up = r; }
if (!up || up.ok === false) { console.error('❌ No se pudo subir el manifest:\n' + String(up?.out || '').slice(-1200)); process.exit(1); }
console.log('☁️  Subido a ' + target);

// 6) Verificar por HTTP público
const finalUrl = BASE + '/' + key;
await new Promise((r) => setTimeout(r, 1500));
const st = await probe(finalUrl);
console.log('🌐 Verificación [' + st + '] ' + finalUrl);
if (st === 200 || st === 206) {
  console.log('\n✅ LISTO. La biblioteca ya tiene índice.');
  console.log('   Categorías:', cats.join(', '));
  if (REAL_PREFIX !== PREFIX_ARG) {
    console.log('\n⚠️  OJO: el prefijo real es "' + REAL_PREFIX + '", no "' + PREFIX_ARG + '".');
    console.log('   Los MP3 se subieron con otro prefijo; el manifest ya apunta a donde están.');
  }
} else {
  console.error('\n⚠️  El objeto se subió pero el dominio todavía no lo sirve (' + st + ').');
  console.error('   Esperá 30s y abrí esa URL en el navegador. Si sigue 404, revisá el Custom Domain del bucket.');
}