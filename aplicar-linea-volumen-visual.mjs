// aplicar-linea-volumen-visual.mjs — línea de ganancia PURAMENTE visual (sin controles encima del clip)
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-gainvisual', src);

// Línea visual: 100% = borde superior del clip · 0% = borde inferior · mute = rosa abajo.
const NEW_BLOCK = `{(() => { const vol = track.muted ? 0 : clamp(track.volume ?? 1, 0, 1); const gainTop = (1 - vol) * 100; return (
<div className="pointer-events-none absolute left-0 right-0 z-20" style={{ top: \`calc(\${gainTop}% - \${(1 - vol) * 2}px)\` }}>
<div className={cx('h-[2px] w-full', track.muted ? 'bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)]' : 'bg-green-400 shadow-[0_0_7px_rgba(74,222,128,0.9)]')} />
</div>
); })()}`;

function replaceGainBlock(markerRe, endToken) {
  const m = src.match(markerRe);
  if (!m || m.index === undefined) return false;
  const start = src.lastIndexOf('{(() => {', m.index);
  const end = src.indexOf(endToken, m.index);
  if (start === -1 || end === -1) return false;
  src = src.slice(0, start) + NEW_BLOCK + src.slice(end + endToken.length);
  return true;
}

let mode = '';
if (replaceGainBlock(/const\s+gainTop\s*=\s*\(1\s*-\s*vol\)\s*\*\s*100/, '); })()}')) {
  mode = 'actualizada (ya existía la versión visual)';
} else if (replaceGainBlock(/const\s+topPct\s*=\s*82\s*-\s*62\s*\*\s*vol/, '</>); })()}')) {
  mode = 'controles viejos eliminados → línea visual';
} else {
  const re = /<WaveformCanvas[^>]*\/\s*>/;
  if (!re.test(src)) { console.error('❌ No encontré <WaveformCanvas /> ni un bloque de ganancia previo. NO se tocó el archivo.'); process.exit(1); }
  src = src.replace(re, (tag) => tag + '\n' + NEW_BLOCK);
  mode = 'línea visual insertada';
}

// Limpiar el estado de drag huérfano del parche anterior (evita noUnusedLocals)
src = src.replace(/\nlet gainDragState:[^\n]*\n/, '\n');

fs.writeFileSync(PATH, src);
console.log('✅ Línea de volumen visual:', mode);
console.log('📦 Backup en:', PATH + '.bak-gainvisual');