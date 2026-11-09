// aplicar-anim-fix2.mjs — balancea los scale de zoom y agrega diagnóstico al export
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-animfix2', src);
const ops = [];
// 1) Reescribe CUALQUIER línea zoomPart* a la forma con paréntesis balanceados
//    (max(2,trunc(iw*(F))) = 3 cierres después de F), sin importar cómo esté hoy.
const lines = src.split('\n');
let fixed = 0;
for (let i = 0; i < lines.length; i++) {
const m = lines[i].match(/^const (zoomPart[A-Za-z]*) = (an[A-Za-z]*)\.f \? `,scale=w='max\(2,trunc\(iw\*/);
if (!m) continue;
const name = m[1]; const v = m[2];
const wPart = "max(2,trunc(iw*(${" + v + ".f})))";
const hPart = "max(2,trunc(ih*(${" + v + ".f})))";
lines[i] = "const " + name + " = " + v + ".f ? `" + ",scale=w='" + wPart + "':h='" + hPart + "':eval=frame` : '';";
fixed++;
}
if (fixed > 0) { src = lines.join('\n'); ops.push('zoom-balanceado x' + fixed); }
else { console.error('❌ No encontré ninguna línea zoomPart para balancear. NO se tocó el archivo.'); process.exit(1); }
// 2) Diagnóstico: si el export clásico vuelve a fallar, volcá el grafo completo
const DIAG = "console.error('[Export] ERROR FATAL:', error);";
if (src.split(DIAG).length - 1 === 1) {
src = src.replace(DIAG, DIAG + "\nconsole.error('[Export] filterComplex completo:\\n' + filterComplex);");
ops.push('diagnostico-filterComplex');
} else { ops.push('diagnostico-ya-existia-o-no-aplica'); }
fs.writeFileSync(PATH, src);
console.log('✅ Aplicado:', ops.join(' · '));
console.log('📦 Backup en:', PATH + '.bak-animfix2');