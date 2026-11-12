// apply-animations-and-sub-ux.mjs
import fs from 'node:fs';
import path from 'node:path';

const candidatePaths = [
  process.argv[2],
  'Studio.tsx',
  'components/studio/Studio.tsx',
  'src/components/Studio.tsx',
  'src/app/Studio.tsx',
  'components/Studio.tsx',
].filter(Boolean);

const targetPath = candidatePaths.find((p) => fs.existsSync(p));

if (!targetPath) {
  console.error('❌ No se encontró Studio.tsx. Ejecutá: node apply-animations-and-sub-ux.mjs <ruta/a/Studio.tsx>');
  process.exit(1);
}

let src = fs.readFileSync(targetPath, 'utf8');
const hasCRLF = src.includes('\r\n');
src = src.replace(/\r\n/g, '\n');

// Encuentra el cierre exacto de llaves { ... } a partir de un índice
function findClosingBrace(text, openBraceIdx) {
  let depth = 0;
  let inSingle = false, inDouble = false, inTemplate = false;
  for (let i = openBraceIdx; i < text.length; i++) {
    const ch = text[i];
    const prev = text[i - 1];
    if (prev === '\\') continue;
    if (!inDouble && !inTemplate && ch === "'") { inSingle = !inSingle; continue; }
    if (!inSingle && !inTemplate && ch === '"') { inDouble = !inDouble; continue; }
    if (!inSingle && !inDouble && ch === '`') { inTemplate = !inTemplate; continue; }
    if (inSingle || inDouble || inTemplate) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// 1. Reemplazar desde "type OverlayAnim =" hasta la llave de cierre '}' de "function animExprFF"
{
  const startIdx = src.indexOf('type OverlayAnim =');
  const fnIdx = src.indexOf('function animExprFF(', startIdx);
  if (startIdx === -1 || fnIdx === -1) {
    console.error('❌ No se encontró type OverlayAnim o function animExprFF');
    process.exit(1);
  }
  const paramsEnd = src.indexOf('):', fnIdx);
  const bodyOpenBrace = src.indexOf('{', paramsEnd !== -1 ? paramsEnd : fnIdx);
  const revTypeBrace = src.indexOf('}', bodyOpenBrace);
  const actualBodyOpen = src.indexOf('{', revTypeBrace);
  const endBraceIdx = findClosingBrace(src, actualBodyOpen);

  if (endBraceIdx === -1) {
    console.error('❌ No se pudo calcular el cierre de llaves de animExprFF');
    process.exit(1);
  }

  const replacement1 = `type OverlayAnim =
  | 'none'
  | 'pop-bounce'
  | 'bounce-up'
  | 'bounce-down'
  | 'bounce-left'
  | 'bounce-right'
  | 'drop-bounce'
  | 'shake'
  | 'swing'
  | 'neon'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-elastic';

const OVERLAY_ANIMS: { id: OverlayAnim; label: string; textOk: boolean }[] = [
  { id: 'none', label: 'Ninguna', textOk: true },
  { id: 'pop-bounce', label: '🏀 Pop Rebote', textOk: true },
  { id: 'bounce-up', label: '⏫ Rebote Abajo', textOk: true },
  { id: 'bounce-down', label: '⏬ Rebote Arriba', textOk: true },
  { id: 'bounce-left', label: '⏪ Rebote Der.', textOk: true },
  { id: 'bounce-right', label: '⏩ Rebote Izq.', textOk: true },
  { id: 'drop-bounce', label: '🪨 Caída Pique', textOk: true },
  { id: 'shake', label: '📳 Impacto / Shake', textOk: true },
  { id: 'swing', label: '🌊 Vaivén', textOk: true },
  { id: 'neon', label: '⚡ Destello Neón', textOk: true },
  { id: 'slide-up', label: '↑ Deslizar Abajo', textOk: true },
  { id: 'slide-down', label: '↓ Deslizar Arriba', textOk: true },
  { id: 'slide-left', label: '← Deslizar Der.', textOk: true },
  { id: 'slide-right', label: '→ Deslizar Izq.', textOk: true },
  { id: 'zoom-elastic', label: '🎈 Zoom Elástico', textOk: false },
  { id: 'zoom-in', label: '🔍 Zoom +', textOk: false },
  { id: 'zoom-out', label: '🔎 Zoom −', textOk: false },
];

// Devuelve desplazamientos (en % del lienzo), factor de escala y multiplicador de opacidad para un instante local \`lt\` dentro de [0, dur].
function animOffsets(animIn: OverlayAnim, animOut: OverlayAnim, inDur: number, outDur: number, lt: number, dur: number): { dxPct: number; dyPct: number; scale: number; alphaMul: number } {
  let dxPct = 0, dyPct = 0, scale = 1, alphaMul = 1;
  const apply = (a: OverlayAnim, k: number) => {
    const p = 1 - k;
    const spring = k * k * Math.cos(p * 4.5);
    if (a === 'slide-left') dxPct += 60 * k;
    else if (a === 'slide-right') dxPct -= 60 * k;
    else if (a === 'slide-up') dyPct += 40 * k;
    else if (a === 'slide-down') dyPct -= 40 * k;
    else if (a === 'pop-bounce') {
      dyPct += 14 * k * Math.cos(p * 5.2);
      scale *= 1 - 0.22 * k * Math.cos(p * 4.8);
      if (p < 0.25) alphaMul *= Math.max(0, p / 0.25);
    } else if (a === 'bounce-up') {
      dyPct += 42 * spring;
    } else if (a === 'bounce-down') {
      dyPct -= 42 * spring;
    } else if (a === 'bounce-left') {
      dxPct += 58 * spring;
    } else if (a === 'bounce-right') {
      dxPct -= 58 * spring;
    } else if (a === 'drop-bounce') {
      dyPct -= 45 * Math.abs(Math.cos(p * 4.7)) * k * k;
    } else if (a === 'shake') {
      dxPct += 5.5 * k * Math.sin(p * 38);
      dyPct += 2.5 * k * Math.cos(p * 50);
    } else if (a === 'swing') {
      dxPct += 18 * k * k * Math.sin(p * 12);
      dyPct -= 10 * k * k;
    } else if (a === 'neon') {
      const flick = Math.sin(p * 42) > 0 ? 1 : 0.12;
      alphaMul *= p > 0.85 ? 1 : flick * p;
    } else if (a === 'zoom-elastic') {
      scale *= Math.max(0.15, 1 - 0.85 * spring);
    } else if (a === 'zoom-in') {
      scale *= Math.max(0.15, 1 - 0.7 * k);
    } else if (a === 'zoom-out') {
      scale *= 1 + 0.6 * k;
    }
  };
  if (animIn !== 'none' && inDur > 0 && lt < inDur) apply(animIn, 1 - Math.max(0, Math.min(1, lt / inDur)));
  if (animOut !== 'none' && outDur > 0 && lt > dur - outDur) apply(animOut, Math.max(0, Math.min(1, (lt - (dur - outDur)) / outDur)));
  return { dxPct, dyPct, scale, alphaMul };
}

// Expresiones FFmpeg equivalentes a animOffsets para el filtro \`overlay\`, \`scale\` y \`drawtext\`.
function animExprFF(animIn: OverlayAnim, animOut: OverlayAnim, inDur: number, outDur: number, s: number, e: number, W: number, H: number): { dxExpr: string; dyExpr: string; scaleMulExpr: string; alphaMulExpr: string } {
  const kIn = inDur > 0 ? \`clip((\${s.toFixed(3)}+\${inDur.toFixed(3)}-t)/\${inDur.toFixed(3)},0,1)\` : '0';
  const kOut = outDur > 0 ? \`clip((t-\${(e - outDur).toFixed(3)})/\${outDur.toFixed(3)},0,1)\` : '0';
  const dxTerms: string[] = []; const dyTerms: string[] = []; const scTerms: string[] = []; const alTerms: string[] = [];

  const push = (a: OverlayAnim, k: string) => {
    const p = \`(1-\${k})\`;
    const spring = \`(\${k}*\${k}*cos(\${p}*4.5))\`;
    if (a === 'slide-left') dxTerms.push(\`(\${(0.6 * W).toFixed(1)}*\${k})\`);
    else if (a === 'slide-right') dxTerms.push(\`(-\${(0.6 * W).toFixed(1)}*\${k})\`);
    else if (a === 'slide-up') dyTerms.push(\`(\${(0.4 * H).toFixed(1)}*\${k})\`);
    else if (a === 'slide-down') dyTerms.push(\`(-\${(0.4 * H).toFixed(1)}*\${k})\`);
    else if (a === 'pop-bounce') {
      dyTerms.push(\`(\${(0.14 * H).toFixed(1)}*\${k}*cos(\${p}*5.2))\`);
      scTerms.push(\`max(0.2,1-0.22*\${k}*cos(\${p}*4.8))\`);
      alTerms.push(\`clip(\${p}/0.25,0,1)\`);
    } else if (a === 'bounce-up') {
      dyTerms.push(\`(\${(0.42 * H).toFixed(1)}*\${spring})\`);
    } else if (a === 'bounce-down') {
      dyTerms.push(\`(-\${(0.42 * H).toFixed(1)}*\${spring})\`);
    } else if (a === 'bounce-left') {
      dxTerms.push(\`(\${(0.58 * W).toFixed(1)}*\${spring})\`);
    } else if (a === 'bounce-right') {
      dxTerms.push(\`(-\${(0.58 * W).toFixed(1)}*\${spring})\`);
    } else if (a === 'drop-bounce') {
      dyTerms.push(\`(-\${(0.45 * H).toFixed(1)}*abs(cos(\${p}*4.7))*\${k}*\${k})\`);
    } else if (a === 'shake') {
      dxTerms.push(\`(\${(0.055 * W).toFixed(1)}*\${k}*sin(\${p}*38))\`);
      dyTerms.push(\`(\${(0.025 * H).toFixed(1)}*\${k}*cos(\${p}*50))\`);
    } else if (a === 'swing') {
      dxTerms.push(\`(\${(0.18 * W).toFixed(1)}*\${k}*\${k}*sin(\${p}*12))\`);
      dyTerms.push(\`(-\${(0.10 * H).toFixed(1)}*\${k}*\${k})\`);
    } else if (a === 'neon') {
      alTerms.push(\`if(gt(\${k},0),if(lt(\${p},0.85),if(gt(sin(\${p}*42),0),\${p},0.12*\${p}),1),1)\`);
    } else if (a === 'zoom-elastic') {
      scTerms.push(\`max(0.15,1-0.85*\${spring})\`);
    } else if (a === 'zoom-in') {
      scTerms.push(\`max(0.15,1-0.7*\${k})\`);
    } else if (a === 'zoom-out') {
      scTerms.push(\`(1+0.6*\${k})\`);
    }
  };

  if (animIn !== 'none' && inDur > 0) push(animIn, kIn);
  if (animOut !== 'none' && outDur > 0) push(animOut, kOut);
  return {
    dxExpr: dxTerms.length ? dxTerms.join('+') : '0',
    dyExpr: dyTerms.length ? dyTerms.join('+') : '0',
    scaleMulExpr: scTerms.length ? scTerms.join('*') : '1',
    alphaMulExpr: alTerms.length ? alTerms.join('*') : '1',
  };
}`;

  src = src.slice(0, startIdx) + replacement1 + src.slice(endBraceIdx + 1);
  console.log('✅ Parche 1 aplicado: Nuevas animaciones en OverlayAnim, animOffsets y animExprFF');
}

// 2. Conectar alphaMulExpr en buildTextChainFF (reemplazo quirúrgico línea por línea dentro de buildTextChainFF)
{
  const fnIdx = src.indexOf('function buildTextChainFF(');
  if (fnIdx === -1) {
    console.error('❌ No se encontró function buildTextChainFF');
    process.exit(1);
  }
  const openBrace = src.indexOf('{', src.indexOf('):', fnIdx));
  const closeBrace = findClosingBrace(src, openBrace);
  let fnBody = src.slice(fnIdx, closeBrace + 1);

  // 2a: Asegurar que desestructure alphaMulExpr de animExprFF(...)
  fnBody = fnBody.replace(
    /const\s+\{\s*dxExpr\s*,\s*dyExpr(?:\s*,\s*alphaMulExpr)?\s*\}\s*=\s*animExprFF\(/g,
    'const { dxExpr, dyExpr, alphaMulExpr } = animExprFF('
  );

  // 2b: Inyectar if (alphaMulExpr !== '1') aParts.push(...) justo antes de const alphaOpt =
  if (!fnBody.includes("alphaMulExpr !== '1'")) {
    fnBody = fnBody.replace(
      /const\s+alphaOpt\s*=/g,
      "if (alphaMulExpr !== '1') aParts.push(`(${alphaMulExpr})`);\n    const alphaOpt ="
    );
  }

  src = src.slice(0, fnIdx) + fnBody + src.slice(closeBrace + 1);
  console.log('✅ Parche 2 aplicado: alphaMulExpr integrado en buildTextChainFF');
}

// 3. Conectar alphaMul en el Preview DOM de Imágenes, Videos V2 y Textos
{
  src = src.replace(
    /width:\s*`\$\{img\.scale\s*\*\s*anim\.scale\}%`,\s*opacity:\s*op(?:\s*\*\s*anim\.alphaMul)?,/,
    'width: `${img.scale * anim.scale}%`, opacity: op * anim.alphaMul,'
  );
  src = src.replace(
    /width:\s*`\$\{vo\.scale\s*\*\s*anim\.scale\}%`,\s*opacity:\s*visible\s*\?\s*op(?:\s*\*\s*anim\.alphaMul)?\s*:\s*0,/,
    'width: `${vo.scale * anim.scale}%`, opacity: visible ? op * anim.alphaMul : 0,'
  );
  src = src.replace(
    /top:\s*`\$\{txt\.y\s*\+\s*anim\.dyPct\}%`,\s*opacity:\s*op(?:\s*\*\s*anim\.alphaMul)?,/,
    'top: `${txt.y + anim.dyPct}%`, opacity: op * anim.alphaMul,'
  );
  console.log('✅ Parche 3 aplicado: alphaMul en Preview DOM (Imágenes, Videos V2 y Textos)');
}

// 4. Actualizar applyStyleToAllSubtitles usando el contador de llaves
{
  const fnStart = src.indexOf('function applyStyleToAllSubtitles(');
  if (fnStart === -1) {
    console.error('❌ No se encontró function applyStyleToAllSubtitles');
    process.exit(1);
  }
  const openBrace = src.indexOf('{', fnStart);
  const closeBrace = findClosingBrace(src, openBrace);
  src =
    src.slice(0, fnStart) +
    `function applyStyleToAllSubtitles(src: TextOverlay) {
    setTextOverlays((prev) => prev.map((x) => x.kind !== 'subtitulo' ? x : {
      ...x, fontSize: src.fontSize, fontFamily: src.fontFamily, color: src.color,
      strokeColor: src.strokeColor, strokeWidth: src.strokeWidth,
      bgColor: src.bgColor, bgOpacity: src.bgOpacity, y: src.y,
      karaokeMode: src.karaokeMode, highlightColor: src.highlightColor,
      animIn: src.animIn, animOut: src.animOut,
      animInDur: src.animInDur, animOutDur: src.animOutDur,
      fadeIn: src.fadeIn, fadeOut: src.fadeOut,
    }));
    showToast('✨ Estilo y animaciones aplicados a todos los subtítulos', 'info', 2200);
  }` +
    src.slice(closeBrace + 1);
  console.log('✅ Parche 4 aplicado: applyStyleToAllSubtitles propaga también animaciones');
}

// 5. Quitar la pestaña redundante "Subtítulo" cuando hay un bloque de subtítulo seleccionado
{
  src = src.replace(
    /\(\s*selectedText\.kind\s*===\s*'subtitulo'\s*\?\s*\['recorte',\s*'estilo',\s*'subtitulo',\s*'animacion',\s*'herramientas'\]\s*:\s*\['recorte',\s*'estilo',\s*'animacion',\s*'herramientas'\]\s*\)/,
    "['recorte', 'estilo', 'animacion', 'herramientas']"
  );
  console.log('✅ Parche 5 aplicado: Ocultada pestaña redundante Subtítulo en bloques de subtítulo');
}

// 6. Agregar el botón "📑 Aplicar a todos los subtítulos" en Estilo y en Animación
{
  const bgOpacityMarker = `{Math.round(selectedText.bgOpacity * 100)}%</span>`;
  const idxBg = src.indexOf(bgOpacityMarker);
  if (idxBg !== -1) {
    const closeDivAfterBg = src.indexOf('</div>', idxBg);
    const alreadyHasBtn = src.slice(closeDivAfterBg, closeDivAfterBg + 250).includes('applyStyleToAllSubtitles');
    if (!alreadyHasBtn) {
      const insertPos = closeDivAfterBg + '</div>'.length;
      src =
        src.slice(0, insertPos) +
        `\n{selectedText.kind === 'subtitulo' && (
  <div className="pt-1.5 border-t border-slate-800/80">
    <button
      type="button"
      onClick={() => applyStyleToAllSubtitles(selectedText)}
      className="w-full rounded-lg border border-fuchsia-400/50 bg-gradient-to-r from-fuchsia-500/20 to-cyan-500/15 py-2 text-xs font-bold text-fuchsia-100 shadow-sm transition hover:border-fuchsia-400 hover:from-fuchsia-500/30 hover:to-cyan-500/25"
      title="Copia fuente, tamaño, colores, posición vertical, modo Karaoke y animaciones a todos los subtítulos"
    >
      📑 Aplicar a todos los subtítulos ({textOverlays.filter((x) => x.kind === 'subtitulo').length})
    </button>
  </div>
)}` +
        src.slice(insertPos);
    }
  }

  // Eliminar el bloque viejo de propsTab === 'subtitulo' para selectedText
  const oldSubTabBlockRx = /\{selectedText\s*&&\s*propsTab\s*===\s*'subtitulo'\s*&&\s*selectedText\.kind\s*===\s*'subtitulo'\s*&&\s*\([\s\S]*?\)\}\s*/;
  src = src.replace(oldSubTabBlockRx, '');

  // Agregar botón al pie de Animación de texto/subtítulo
  const animOutDurMarker = `onChange={(e) => updateText(selectedText.id, { animOutDur: Math.max(0.05, Number(e.target.value)) })}`;
  const idxAnimOut = src.indexOf(animOutDurMarker);
  if (idxAnimOut !== -1) {
    const endGridDiv = src.indexOf('</div>', idxAnimOut);
    const alreadyHasAnimBtn = src.slice(endGridDiv, endGridDiv + 250).includes('applyStyleToAllSubtitles');
    if (!alreadyHasAnimBtn) {
      const insertPos = endGridDiv + '</div>'.length;
      src =
        src.slice(0, insertPos) +
        `\n{selectedText.kind === 'subtitulo' && (
  <div className="pt-1.5 border-t border-slate-800/80">
    <button
      type="button"
      onClick={() => applyStyleToAllSubtitles(selectedText)}
      className="w-full rounded-lg border border-fuchsia-400/50 bg-gradient-to-r from-fuchsia-500/20 to-cyan-500/15 py-2 text-xs font-bold text-fuchsia-100 shadow-sm transition hover:border-fuchsia-400 hover:from-fuchsia-500/30 hover:to-cyan-500/25"
      title="Copia estilo y estas animaciones de entrada/salida a todos los demás subtítulos"
    >
      📑 Aplicar a todos los subtítulos ({textOverlays.filter((x) => x.kind === 'subtitulo').length})
    </button>
  </div>
)}` +
        src.slice(insertPos);
    }
  }
  console.log('✅ Parche 6 aplicado: Botón de propagación global integrado en Estilo y Animación');
}

const finalOutput = hasCRLF ? src.replace(/\n/g, '\r\n') : src;
fs.writeFileSync(targetPath, finalOutput, 'utf8');
console.log(`\n🎉 ¡Listo! ${path.basename(targetPath)} actualizado con todas las animaciones y mejoras de subtítulos.`);