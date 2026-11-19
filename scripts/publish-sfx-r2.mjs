// publish-sfx-r2.mjs — sube sfx-source/ a R2 y publica el manifest (sin npx, sin .cmd)
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';

const nodeRequire = createRequire(import.meta.url);
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const has = (n) => args.includes('--' + n);

const BUCKET = arg('bucket', '');
const BASE = (arg('base', '') || '').replace(/\/+$/, '');
const SRC = arg('src', 'sfx-source');
const PREFIX = arg('prefix', 'sfx');
const CONC = Number(arg('conc', '6')) || 6;
const LIMIT = Number(arg('limit', '0')) || 0;

if (!BUCKET || !BASE) {
  console.error('Uso: node scripts/publish-sfx-r2.mjs --bucket TU_BUCKET --base https://sfx.clipedia.net');
  console.error('Opcional: --limit 5 (prueba) · --conc 8 · --src sfx-source · --prefix sfx');
  process.exit(1);
}
if (!fs.existsSync(SRC)) {
  console.error('❌ No existe ' + SRC + '. Mové public/sfx a sfx-source/ y agregalo al .gitignore.');
  process.exit(1);
}

/* ── Resolver el JS de Wrangler: nada de .cmd (Node parcheado lanza EINVAL) ── */
function resolveWrangler() {
  try {
    const pkgPath = nodeRequire.resolve('wrangler/package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const bin = typeof pkg.bin === 'string' ? pkg.bin : (pkg.bin && (pkg.bin.wrangler || pkg.bin.wrangler2));
    if (bin) {
      const p = path.join(path.dirname(pkgPath), bin);
      if (fs.existsSync(p)) return p;
    }
  } catch { /* no instalado localmente */ }
  const cands = [
    path.join('node_modules', 'wrangler', 'bin', 'wrangler.js'),
    path.join('node_modules', 'wrangler', 'wrangler-dist', 'cli.js'),
  ];
  for (const c of cands) if (fs.existsSync(c)) return path.resolve(c);
  return null;
}
const WRANGLER = resolveWrangler();
if (!WRANGLER) {
  console.error('❌ No encuentro Wrangler instalado en el proyecto.');
  console.error('   Instalalo como dependencia de desarrollo:  npm i -D wrangler');
  console.error('   Y autenticate una vez:                     npx wrangler login');
  process.exit(1);
}
console.log('🔧 Wrangler:', WRANGLER);

const AUDIO = /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i;
const MIME = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac', opus: 'audio/ogg' };
const STATE_FILE = '.sfx-upload-state.json';
const CACHE_AUDIO = 'public, max-age=31536000, immutable';
const CACHE_MANIFEST = 'public, max-age=60';

let state = {};
try { state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { state = {}; }

/* ── duración MP3 exacta (Xing/Info) o CBR por tamaño ── */
const BR_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const BR_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const SR_TAB = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
function id3Size(b) {
  if (b.length < 10 || b.toString('ascii', 0, 3) !== 'ID3') return 0;
  const s = (b[6] & 0x7f) * 2097152 + (b[7] & 0x7f) * 16384 + (b[8] & 0x7f) * 128 + (b[9] & 0x7f);
  return 10 + s + (b[5] & 0x10 ? 10 : 0);
}
function mp3Duration(b) {
  const skip = id3Size(b);
  let i = skip;
  for (; i < Math.min(b.length - 4, skip + 8192); i++) if (b[i] === 0xff && (b[i + 1] & 0xe0) === 0xe0) break;
  if (i >= b.length - 4) return 0;
  const ver = (b[i + 1] >> 3) & 3, layer = (b[i + 1] >> 1) & 3;
  if (ver === 1 || layer !== 1) return 0;
  const br = (ver === 3 ? BR_V1 : BR_V2)[(b[i + 2] >> 4) & 15];
  const srIdx = (b[i + 2] >> 2) & 3;
  const sr = (SR_TAB[ver] || SR_TAB[3])[srIdx];
  const pad = (b[i + 2] >> 1) & 1;
  if (!br || !sr || srIdx === 3) return 0;
  const spf = ver === 3 ? 1152 : 576;
  const fsz = Math.floor((spf / 8) * (br * 1000) / sr) + pad;
  if (fsz <= 4) return 0;
  const mono = ((b[i + 3] >> 6) & 3) === 3;
  const tagAt = i + 4 + (ver === 3 ? (mono ? 17 : 32) : (mono ? 9 : 17));
  if (tagAt + 12 <= b.length) {
    const tag = b.toString('ascii', tagAt, tagAt + 4);
    if ((tag === 'Xing' || tag === 'Info') && (b.readUInt32BE(tagAt + 4) & 1)) {
      const frames = b.readUInt32BE(tagAt + 8);
      if (frames > 0) return (frames * spf) / sr;
    }
  }
  return ((b.length - skip) / fsz) * spf / sr;
}
const pretty = (s) => s.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());

/* ── escaneo ── */
const files = [];
(function walk(dir, rel) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const abs = path.join(dir, e.name);
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) walk(abs, r);
    else if (AUDIO.test(e.name)) files.push({ abs, rel: r });
  }
})(SRC, '');
if (!files.length) { console.error('❌ No hay audios en ' + SRC); process.exit(1); }

const items = [];
const catSet = new Set();
let bytes = 0;
for (const f of files) {
  const buf = fs.readFileSync(f.abs);
  const ext = path.extname(f.rel).slice(1).toLowerCase();
  const dur = ext === 'mp3' ? mp3Duration(buf) : 0;
  const folder = path.posix.dirname(f.rel) === '.' ? 'General' : path.posix.dirname(f.rel);
  const cat = folder.split('/').map(pretty).join(' · ');
  catSet.add(cat);
  bytes += buf.length;
  items.push({
    id: f.rel.replace(/\.[^.]+$/, '').replace(/[^\w/.-]/g, '_').replace(/\//g, '__'),
    name: pretty(path.basename(f.rel, path.extname(f.rel))),
    cat,
    dur: Math.round(dur * 1000) / 1000,
    url: BASE + '/' + PREFIX + '/' + f.rel.split('/').map(encodeURIComponent).join('/'),
    bytes: buf.length,
    __abs: path.resolve(f.abs),
    __rel: f.rel,
    __mime: MIME[ext] || 'application/octet-stream',
    __sig: buf.length + ':' + fs.statSync(f.abs).mtimeMs,
  });
}
console.log('🔎 ' + items.length + ' audios · ' + catSet.size + ' categorías · ' + (bytes / 1048576).toFixed(1) + ' MB');

const queue = LIMIT > 0 ? items.slice(0, LIMIT) : items;
if (LIMIT > 0) console.log('🧪 Modo prueba: solo los primeros ' + queue.length);

/* ── ejecución: node + wrangler.js (sin shell, sin .cmd) ── */
function run(a) {
  return new Promise((res) => {
    execFile(
      process.execPath,
      [WRANGLER, ...a],
      {
        windowsHide: true,
        maxBuffer: 16 * 1024 * 1024,
        timeout: 180000,
        env: { ...process.env, WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1' },
      },
      (err, so, se) => res({ ok: !err, out: String(so || '') + String(se || '') })
    );
  });
}
function flagSets(absPath, relKey, mime, cache) {
  const key = path.posix.join(PREFIX, relKey.split('/').map(encodeURIComponent).join('/'));
  const target = BUCKET + '/' + key;
  return [
    ['r2', 'object', 'put', target, '--file', absPath, '--content-type', mime, '--cache-control', cache, '--remote'],
    ['r2', 'object', 'put', target, '--file', absPath, '--content-type', mime, '--cache-control', cache],
    ['r2', 'object', 'put', target, '--file', absPath, '--content-type', mime],
    ['r2', 'object', 'put', target, '--file', absPath],
  ];
}

let LOCKED = -1;
let probePromise = null;
async function ensureProbe() {
  if (LOCKED >= 0) return;
  if (!probePromise) {
    probePromise = (async () => {
      const first = queue[0];
      const sets = flagSets(first.__abs, first.__rel, first.__mime, CACHE_AUDIO);
      let last = '';
      for (let i = 0; i < sets.length; i++) {
        const r = await run(sets[i]);
        if (r.ok) {
          LOCKED = i;
          state[first.__rel] = first.__sig;
          console.log('🔧 Flags de Wrangler fijados (set ' + (i + 1) + ' de ' + sets.length + ')');
          return;
        }
        last = r.out;
      }
      console.error('❌ Wrangler no pudo subir ni el primer archivo. Salida:\n' + last.slice(-1600));
      console.error('   Verificá:  npx wrangler login   ·   que el bucket "' + BUCKET + '" exista.');
      process.exit(1);
    })();
  }
  await probePromise;
}

async function upload(absPath, relKey, mime, cache) {
  await ensureProbe();
  const sets = flagSets(absPath, relKey, mime, cache);
  const r = await run(sets[LOCKED]);
  if (!r.ok) console.error('❌ Falló ' + relKey + '\n' + r.out.slice(-500));
  return r.ok;
}

/* ── subida con concurrencia + estado reanudable ── */
let done = 0, skipped = 0, failed = 0, cursor = 0, sinceSave = 0;
const t0 = Date.now();
function saveState() { fs.writeFileSync(STATE_FILE, JSON.stringify(state)); sinceSave = 0; }

async function worker() {
  while (cursor < queue.length) {
    const it = queue[cursor++];
    if (state[it.__rel] === it.__sig) { skipped++; done++; continue; }
    const ok = await upload(it.__abs, it.__rel, it.__mime, CACHE_AUDIO);
    if (ok) { state[it.__rel] = it.__sig; sinceSave++; }
    else failed++;
    done++;
    if (sinceSave >= 10) saveState();
    if (done % 25 === 0 || done === queue.length) {
      const el = (Date.now() - t0) / 1000;
      const rate = (done - skipped) / Math.max(el, 0.001);
      const left = rate > 0 ? Math.round((queue.length - done) / rate) : 0;
      console.log('📤 ' + done + '/' + queue.length + ' · omitidos ' + skipped + ' · fallidos ' + failed + (left > 0 ? ' · ~' + left + 's restantes' : ''));
    }
  }
}
console.log('☁️  Subiendo a R2 (' + CONC + ' en paralelo)…');
await Promise.all(Array.from({ length: CONC }, worker));
saveState();

if (failed) {
  console.error('⚠️ ' + failed + ' archivos no se subieron. Volvé a correr el script: retoma donde quedó.');
  process.exit(1);
}
if (LIMIT > 0) {
  console.log('🧪 Prueba OK (' + queue.length + ' archivos). Corré sin --limit para subir todo.');
  process.exit(0);
}

/* ── manifest ── */
const cats = [...catSet].sort((a, b) => a.localeCompare(b));
const manifest = {
  version: 1,
  builtAt: new Date().toISOString(),
  count: items.length,
  cats,
  items: items.map(({ __abs, __rel, __mime, __sig, ...pub }) => pub),
};
const mPath = 'sfx-manifest.json';
fs.writeFileSync(mPath, JSON.stringify(manifest));
const mOk = await upload(path.resolve(mPath), 'manifest.json', 'application/json', CACHE_MANIFEST);
if (!mOk) { console.error('❌ El manifest no se pudo subir.'); process.exit(1); }

const noDur = items.filter((i) => !i.dur).length;
console.log('✅ Listo: ' + items.length + ' sonidos · ' + cats.length + ' categorías · ' + (bytes / 1048576).toFixed(1) + ' MB');
console.log('🗂️  Manifest: ' + BASE + '/' + PREFIX + '/manifest.json');
console.log('   Categorías:', cats.join(', '));
if (noDur) console.log('   ℹ️ ' + noDur + ' sin duración en el manifest (el navegador la mide al reproducir).');
console.log('⏱️  Tiempo total: ' + Math.round((Date.now() - t0) / 1000) + 's');