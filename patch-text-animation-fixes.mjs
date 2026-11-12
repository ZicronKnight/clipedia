#!/usr/bin/env node
/**
 * Clipedia Studio — limita animaciones incompatibles con drawtext y corrige shake.
 * Uso: node patch-text-animation-fixes.mjs [ruta/a/Studio.tsx]
 * Crea un .bak antes de escribir. No modifica nada si alguna validación falla.
 */
import fs from 'node:fs';
import path from 'node:path';

const target = path.resolve(process.argv[2] || 'components/studio/Studio.tsx');
if (!fs.existsSync(target)) {
  console.error(`❌ No encuentro el archivo: ${target}`);
  process.exit(1);
}
let src = fs.readFileSync(target, 'utf8');
const original = src;
const applied = [];

function replaceOnce(label, before, after) {
  const count = src.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: esperaba 1 coincidencia exacta y encontré ${count}. No se escribió ningún archivo.`);
  src = src.replace(before, after);
  applied.push(label);
}
function replaceFirst(label, before, after) {
  const count = src.split(before).length - 1;
  if (count < 1) throw new Error(`${label}: no encontré el bloque esperado. No se escribió ningún archivo.`);
  src = src.replace(before, after);
  applied.push(label);
}

try {
  // Lista específica para texto: no incluye zoom-in, zoom-out ni zoom-elastic.
  replaceOnce('lista segura de animaciones para texto',
    "const ANIM_OUT_LABELS: Record<OverlayAnimOut, string> = { 'none':'Sin animación','to-left':'⬅️ Hacia la izquierda','to-right':'➡️ Hacia la derecha','to-top':'⬆️ Hacia arriba','to-bottom':'⬇️ Hacia abajo','zoom-in':'🔍 Zoom creciendo','zoom-out':'🔭 Zoom encogiendo','pop-bounce':'🏀 Pop Rebote','bounce-up':'🏀 Rebote Arriba','bounce-down':'🏀 Rebote Abajo','bounce-left':'🏀 Rebote Izquierda','bounce-right':'🏀 Rebote Derecha','drop-bounce':'🪨 Caída con pique','shake':'📳 Sacudida / Impacto','swing':'🌊 Vaivén / Péndulo','neon':'⚡ Destello Neón','zoom-elastic':'🎈 Zoom Elástico' };",
    "const ANIM_OUT_LABELS: Record<OverlayAnimOut, string> = { 'none':'Sin animación','to-left':'⬅️ Hacia la izquierda','to-right':'➡️ Hacia la derecha','to-top':'⬆️ Hacia arriba','to-bottom':'⬇️ Hacia abajo','zoom-in':'🔍 Zoom creciendo','zoom-out':'🔭 Zoom encogiendo','pop-bounce':'🏀 Pop Rebote','bounce-up':'🏀 Rebote Arriba','bounce-down':'🏀 Rebote Abajo','bounce-left':'🏀 Rebote Izquierda','bounce-right':'🏀 Rebote Derecha','drop-bounce':'🪨 Caída con pique','shake':'📳 Sacudida / Impacto','swing':'🌊 Vaivén / Péndulo','neon':'⚡ Destello Neón','zoom-elastic':'🎈 Zoom Elástico' };\n\n// drawtext admite x/y/alpha dinámicos, pero fontsize es estático durante el filtro.\nconst TEXT_ANIM_IN = ['none','from-left','from-right','from-top','from-bottom','pop-bounce','bounce-up','bounce-down','bounce-left','bounce-right','drop-bounce','shake','swing','neon'] as const;\nconst TEXT_ANIM_OUT = ['none','to-left','to-right','to-top','to-bottom','pop-bounce','bounce-up','bounce-down','bounce-left','bounce-right','drop-bounce','shake','swing','neon'] as const;");

  // Reemplaza el movimiento shake en preview por una vibración amortiguada que
  // vale exactamente cero al principio y al final. Pop-bounce de texto no escala.
  replaceOnce('shake preview y pop-bounce sin escala en texto',
    "else if(id==='pop-bounce') { dy += sign*refH*0.16*spring; f *= 1+0.10*spring; alpha *= entering ? Math.min(1,q*7) : Math.max(0,1-q); }",
    "else if(id==='pop-bounce') { dy += sign*refH*0.16*spring; alpha *= entering ? Math.min(1,q*7) : Math.max(0,1-q); }");
  replaceOnce('shake preview con retorno exacto a posición base',
    "else if(id==='shake') { dx += refW*0.018*tail*Math.sin(q*72); dy += refH*0.012*tail*Math.cos(q*61); }",
    "else if(id==='shake') { const envelope=Math.pow(Math.sin(Math.PI*q),2); dx += refW*0.006*envelope*Math.sin(q*16*Math.PI); dy += refH*0.0035*envelope*Math.cos(q*14*Math.PI); }");

  // Añade wrapper de preview para textos/subtítulos. También neutraliza valores
  // antiguos guardados en proyectos (incluidos zooms seleccionados anteriormente).
  replaceOnce('helper de animaciones seguras para texto',
    "// ===== CHROMA KEY (PARIDAD 1:1 RGB COLORKEY PREVIEW <-> FFMPEG) Y SUBTÍTULOS KARAOKE =====",
    "function safeTextAnim<T extends { animIn?: OverlayAnim; animOut?: OverlayAnimOut }>(item: T): T {\n  const blocked = (v: string | undefined) => v === 'zoom-in' || v === 'zoom-out' || v === 'zoom-elastic' ? 'none' : v;\n  return { ...item, animIn: blocked(item.animIn) as OverlayAnim | undefined, animOut: blocked(item.animOut) as OverlayAnimOut | undefined };\n}\nfunction animOffsetsText(a: TextOverlay, t: number, refW: number, refH: number) {\n  const result = animOffsets(safeTextAnim(a), t, refW, refH);\n  // Pop Rebote en texto es solo desplazamiento + fade; nunca cambia fontsize/escala.\n  return { ...result, f: 1 };\n}\n\n// ===== CHROMA KEY (PARIDAD 1:1 RGB COLORKEY PREVIEW <-> FFMPEG) Y SUBTÍTULOS KARAOKE =====");

  // FFmpeg drawtext recibe únicamente las animaciones seguras.
  replaceOnce('sanitizar animaciones antes de drawtext',
    "const anT = animExprFF(txt, S, E, refW, refH);",
    "const anT = animExprFF(safeTextAnim(txt), S, E, refW, refH);");

  // Shake en FFmpeg usa la misma envolvente que preview. Se expresa respecto
  // a txt.x/txt.y, sin alterar las coordenadas guardadas del overlay.
  replaceOnce('shake FFmpeg con retorno exacto a posición base',
    "else if(id==='shake'){termsX.push(`(${(refW*0.018).toFixed(2)}*${tail}*sin(${q}*72))`);termsY.push(`(${(refH*0.012).toFixed(2)}*${tail}*cos(${q}*61))`);}",
    "else if(id==='shake'){const env=`pow(sin(PI*${q}),2)`;termsX.push(`(${(refW*0.006).toFixed(2)}*${env}*sin(${q}*16*PI))`);termsY.push(`(${(refH*0.0035).toFixed(2)}*${env}*cos(${q}*14*PI))`);}");

  // Textos y subtítulos usan listas limitadas; imágenes y videos mantienen el pack completo.
  const inOld = "{(Object.keys(ANIM_IN_LABELS) as OverlayAnim[]).map((a) => (<option key={a} value={a}>{ANIM_IN_LABELS[a]}</option>))}";
  const outOld = "{(Object.keys(ANIM_OUT_LABELS) as OverlayAnimOut[]).map((a) => (<option key={a} value={a}>{ANIM_OUT_LABELS[a]}</option>))}";
  const inCount = src.split(inOld).length - 1;
  const outCount = src.split(outOld).length - 1;
  if (inCount !== 3 || outCount !== 3) throw new Error(`Selectores de animación: esperaba 3 de entrada y 3 de salida (texto, imagen, video), encontré ${inCount} y ${outCount}. No se escribió ningún archivo.`);
  // Primer selector de cada tipo corresponde a texto; los otros dos quedan intactos.
  src = src.replace(inOld, "{TEXT_ANIM_IN.map((a) => (<option key={a} value={a}>{ANIM_IN_LABELS[a]}</option>))}");
  src = src.replace(outOld, "{TEXT_ANIM_OUT.map((a) => (<option key={a} value={a}>{ANIM_OUT_LABELS[a]}</option>))}");
  applied.push('selectores de texto limitados a animaciones compatibles');

  // Actualiza el mensaje de ayuda para no prometer zoom en texto.
  replaceFirst('texto de ayuda de animación (panel de texto)',
    'Mismo movimiento en el preview y en el export. Los slides cruzan el canvas; el zoom escala el elemento.',
    'Animaciones compatibles con texto: desplazamiento, rebote, sacudida, vaivén y neón. El zoom queda reservado para imágenes y videos.');

  // Preview: solo la llamada de activeText cambia; imágenes y videos conservan escala.
  replaceOnce('preview de texto usa offsets seguros',
    'const an = animOffsets(activeText, playhead, REF_WIDTH, REF_HEIGHT);',
    'const an = animOffsetsText(activeText, playhead, REF_WIDTH, REF_HEIGHT);');

  // Confirma que las rutas de salida de drawtext nunca interpolen fontsize.
  if (/fontsize\s*=\s*['"`]\s*\$\{|fontsize\s*=\s*['"][^'"\n]*\bt\b/.test(src)) {
    throw new Error('Se detectó una posible expresión temporal en fontsize. No se escribió ningún archivo.');
  }
  const backup = `${target}.bak-${new Date().toISOString().replace(/[:.]/g,'-')}`;
  fs.copyFileSync(target, backup);
  fs.writeFileSync(target, src, 'utf8');
  console.log('✅ Parche aplicado correctamente.');
  for (const item of applied) console.log(`  • ${item}`);
  console.log(`🛟 Respaldo: ${backup}`);
  console.log(`📄 Actualizado: ${target}`);
} catch (err) {
  console.error(`❌ ${err.message || err}`);
  console.error('No se modificó el archivo original.');
  process.exit(1);
}
