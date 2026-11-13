// aplicar-linea-volumen-overlays.mjs — línea de ganancia visual en clips superpuestos (V2/V3…)
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-gainvo', src);

if (src.includes('gain-line-vo')) {
  console.log('ℹ️ La línea de volumen en superposiciones ya estaba aplicada. No se tocó nada.');
  process.exit(0);
}

// Línea 100% visual: 100% = borde superior · 0% = borde inferior · mute = rosa.
const GAIN_VO = `{/* gain-line-vo */}
{(() => { const muted = vo.muted || isLaneMuted(vo.laneId); const vol = muted ? 0 : clamp((vo.volume ?? 1) * getLaneVolume(vo.laneId), 0, 1); const gainTop = (1 - vol) * 100; return (
<div className="pointer-events-none absolute left-0 right-0 z-20" style={{ top: \`calc(\${gainTop}% - \${(1 - vol) * 2}px)\` }}>
<div className={cx('h-[2px] w-full', muted ? 'bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)]' : 'bg-green-400 shadow-[0_0_7px_rgba(74,222,128,0.9)]')} />
</div>
); })()}
`;

// Ancla principal: justo antes del contenido interno del clip de video superpuesto.
const re = /(data-clip-item=\{`video:\$\{vo\.id\}`\}[\s\S]*?)(<div\s+className=\s*"relative z-10 flex h-full items-center justify-between gap-1\s*")/;
let done = false;
if (re.test(src)) {
  src = src.replace(re, (m, a, b) => a + GAIN_VO + b);
  done = true;
} else {
  // Fallback: después del nombre del clip de video (único por el 🔇 de vo.muted).
  const re2 = /(\{vo\.name\}\{vo\.muted \? ' 🔇' : ''\}\s*<\/p>)/;
  if (re2.test(src)) { src = src.replace(re2, (m) => m + '\n' + GAIN_VO); done = true; }
}

if (!done) { console.error('❌ No encontré el bloque del clip superpuesto. NO se tocó el archivo.'); process.exit(1); }
fs.writeFileSync(PATH, src);
console.log('✅ Línea de volumen visual agregada a los clips superpuestos (V2/V3…).');
console.log('📦 Backup en:', PATH + '.bak-gainvo');