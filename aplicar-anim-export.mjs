// aplicar-anim-export.mjs — Etapa 2: paridad de export para animaciones de overlays
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
const BAK = PATH + '.bak-animexport';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(BAK, src);
const ops = [];
const L = (...lines) => lines.join('\n');
function rep(name, search, replace) {
  const count = src.split(search).length - 1;
  if (count !== 1) { console.error('❌ [' + name + '] ancla encontrada ' + count + ' veces (esperaba 1). NO se tocó el archivo.'); process.exit(1); }
  src = src.replace(search, replace);
  ops.push(name);
}
// 1) Helper: mismas curvas del preview como expresiones FFmpeg
rep('helper-expr',
"return { dx, dy, f };\n}",
"return { dx, dy, f };\n}\n" + L(
"// ===== PARIDAD DE EXPORT: mismas animaciones como expresiones FFmpeg =====",
"// ein/eout replican el smoothstep del preview; dx/dy mueven el overlay y f",
"// escala el bitmap (scale eval=frame). t = tiempo del grafo (ya corrido por",
"// chunkStart en el export chunked).",
"function animExprFF(a: { animIn?: OverlayAnim; animInDur?: number; animOut?: OverlayAnimOut; animOutDur?: number }, S: number, E: number, refW: number, refH: number): { dx: string; dy: string; f: string | null } {",
"const ein = a.animIn && a.animIn !== 'none' ? (() => { const d = Math.max(0.05, a.animInDur ?? 0.5); const p = `clip((t-${S.toFixed(6)})/${d.toFixed(6)},0,1)`; return `(${p}*${p}*(3-2*${p}))`; })() : null;",
"const eout = a.animOut && a.animOut !== 'none' ? (() => { const d = Math.max(0.05, a.animOutDur ?? 0.5); const q = `clip((t-${(E - d).toFixed(6)})/${d.toFixed(6)},0,1)`; return `(${q}*${q}*(3-2*${q}))`; })() : null;",
"const dxT: string[] = [];",
"const dyT: string[] = [];",
"if (a.animIn === 'from-left') dxT.push(`-${refW}*(1-${ein})`);",
"if (a.animIn === 'from-right') dxT.push(`${refW}*(1-${ein})`);",
"if (a.animIn === 'from-top') dyT.push(`-${refH}*(1-${ein})`);",
"if (a.animIn === 'from-bottom') dyT.push(`${refH}*(1-${ein})`);",
"if (a.animOut === 'to-left') dxT.push(`-${refW}*${eout}`);",
"if (a.animOut === 'to-right') dxT.push(`${refW}*${eout}`);",
"if (a.animOut === 'to-top') dyT.push(`-${refH}*${eout}`);",
"if (a.animOut === 'to-bottom') dyT.push(`${refH}*${eout}`);",
"const dx = dxT.length ? dxT.join('+') : '0';",
"const dy = dyT.length ? dyT.join('+') : '0';",
"const fT: string[] = [];",
"if (a.animIn === 'zoom-in') fT.push(`(0.6+0.4*${ein})`);",
"if (a.animIn === 'zoom-out') fT.push(`(1.3-0.3*${ein})`);",
"if (a.animOut === 'zoom-out') fT.push(`(1-0.4*${eout})`);",
"if (a.animOut === 'zoom-in') fT.push(`(1+0.3*${eout})`);",
"return { dx, dy, f: fT.length ? fT.join('*') : null };",
"}"));
// 2) Export clásico: imágenes
rep('export-img',
L("filterComplex += `[${imgInputIdx}:v]scale=${imgWidth}:-2,format=rgba,${fades}${irot}trim=0:${dur},setpts=PTS+${img.start}/TB[img${i}_f];`;",
"filterComplex += `[${cur}][img${i}_f]overlay=x=${img.x}-overlay_w/2:y=${img.y}-overlay_h/2:eof_action=pass:enable='between(t,${img.start},${img.end})'[img${i}_out];`;"),
L("const an = animExprFF(img, img.start, img.end, REF_WIDTH, REF_HEIGHT);",
"const zoomPart = an.f ? `,scale=w='max(2,trunc(iw*(${an.f}))':h='max(2,trunc(ih*(${an.f})))':eval=frame` : '';",
"filterComplex += `[${imgInputIdx}:v]scale=${imgWidth}:-2,format=rgba,${fades}${irot}trim=0:${dur},setpts=PTS+${img.start}/TB${zoomPart}[img${i}_f];`;",
"filterComplex += `[${cur}][img${i}_f]overlay=x='${img.x}-overlay_w/2+(${an.dx})':y='${img.y}-overlay_h/2+(${an.dy})':eof_action=pass:enable='between(t,${img.start},${img.end})'[img${i}_out];`;"));
// 3) Export clásico: capas de video (declaraciones + ramas + overlay)
rep('export-vo-decl',
L("const mi = voMaskIdx[i];",
"if (mi !== null && mi !== undefined) {"),
L("const mi = voMaskIdx[i];",
"const anV = animExprFF(vo, vo.start, vo.end, REF_WIDTH, REF_HEIGHT);",
"const zoomPartV = anV.f ? `,scale=w='max(2,trunc(iw*(${anV.f}))':h='max(2,trunc(ih*(${anV.f})))':eval=frame` : '';",
"if (mi !== null && mi !== undefined) {"));
rep('export-vo-mask',
"filterComplex += `[vo${i}_rgb][mask${i}g]alphamerge,${vrot}${fades}setpts=PTS+${vo.start}/TB[vo${i}_f];`;",
"filterComplex += `[vo${i}_rgb][mask${i}g]alphamerge,${vrot}${fades}setpts=PTS+${vo.start}/TB${zoomPartV}[vo${i}_f];`;");
rep('export-vo-nomask',
"filterComplex += `[${voInputIdx}:v]trim=${vo.offset}:${vo.offset + dur},setpts=PTS-STARTPTS,fps=30,scale=${voWidth}:${voHeight},format=rgba,${vrot}${fades}setpts=PTS+${vo.start}/TB[vo${i}_f];`;",
"filterComplex += `[${voInputIdx}:v]trim=${vo.offset}:${vo.offset + dur},setpts=PTS-STARTPTS,fps=30,scale=${voWidth}:${voHeight},format=rgba,${vrot}${fades}setpts=PTS+${vo.start}/TB${zoomPartV}[vo${i}_f];`;");
rep('export-vo-overlay',
"filterComplex += `[${cur}][vo${i}_f]overlay=x=${vo.x}-overlay_w/2:y=${vo.y}-overlay_h/2:eof_action=pass:enable='between(t,${vo.start},${vo.end})'[vo${i}_out];`;",
"filterComplex += `[${cur}][vo${i}_f]overlay=x='${vo.x}-overlay_w/2+(${anV.dx})':y='${vo.y}-overlay_h/2+(${anV.dy})':eof_action=pass:enable='between(t,${vo.start},${vo.end})'[vo${i}_out];`;");
// 4) Export clásico: textos
rep('export-txt',
"filterComplex += `[${cur}]drawtext=text='${textEscaped}':x=${txt.x}-text_w/2:y=${txt.y}-text_h/2:fontsize=${txt.size}:fontcolor=${txt.color.replace('#', '0x')}:fontfile=${fontFile}${outline}${alphaExpr}:enable='between(t,${S},${E})'[txt${i}_out];`;",
"const anT = animExprFF(txt, S, E, REF_WIDTH, REF_HEIGHT);\nfilterComplex += `[${cur}]drawtext=text='${textEscaped}':x='${txt.x}-text_w/2+(${anT.dx})':y='${txt.y}-text_h/2+(${anT.dy})':fontsize=${txt.size}:fontcolor=${txt.color.replace('#', '0x')}:fontfile=${fontFile}${outline}${alphaExpr}:enable='between(t,${S},${E})'[txt${i}_out];`;");
// 5) Export chunked: imágenes (tiempos corridos por chunkStart)
rep('chunk-img',
L("fc += `[${idx}:v]scale=${imgWidth}:-2,format=rgba,${fades}${rotOf(img.rotate)}trim=${imgStartInWindow.toFixed(6)}:${(imgStartInWindow + overlapDur).toFixed(6)},setpts=PTS-STARTPTS,setpts=PTS+${localStart.toFixed(6)}/TB[imgc${ov.idx}];`;",
"fc += `[${currentVideoLabel}][imgc${ov.idx}]overlay=x=${img.x}-overlay_w/2:y=${img.y}-overlay_h/2:eof_action=pass:enable='between(t,${localStart.toFixed(6)},${(localStart + overlapDur).toFixed(6)})'[imgo${ov.idx}];`;"),
L("const anC = animExprFF(img, img.start - cs, img.end - cs, REF_WIDTH, REF_HEIGHT);",
"const zoomPartC = anC.f ? `,scale=w='max(2,trunc(iw*(${anC.f}))':h='max(2,trunc(ih*(${anC.f})))':eval=frame` : '';",
"fc += `[${idx}:v]scale=${imgWidth}:-2,format=rgba,${fades}${rotOf(img.rotate)}trim=${imgStartInWindow.toFixed(6)}:${(imgStartInWindow + overlapDur).toFixed(6)},setpts=PTS-STARTPTS,setpts=PTS+${localStart.toFixed(6)}/TB${zoomPartC}[imgc${ov.idx}];`;",
"fc += `[${currentVideoLabel}][imgc${ov.idx}]overlay=x='${img.x}-overlay_w/2+(${anC.dx})':y='${img.y}-overlay_h/2+(${anC.dy})':eof_action=pass:enable='between(t,${localStart.toFixed(6)},${(localStart + overlapDur).toFixed(6)})'[imgo${ov.idx}];`;"));
// 6) Export chunked: capas de video
rep('chunk-vo-decl',
"const maskFile = voMaskFile[ov.idx];",
L("const maskFile = voMaskFile[ov.idx];",
"const anV = animExprFF(vo, vo.start - cs, vo.end - cs, REF_WIDTH, REF_HEIGHT);",
"const zoomPartV = anV.f ? `,scale=w='max(2,trunc(iw*(${anV.f}))':h='max(2,trunc(ih*(${anV.f})))':eval=frame` : '';"));
rep('chunk-vo-mask',
"fc += `[vo${ov.idx}_rgb][vo${ov.idx}_mkg]alphamerge,${vrot}${fades}setpts=PTS+${localStart.toFixed(6)}/TB[vo${ov.idx}_f];`;",
"fc += `[vo${ov.idx}_rgb][vo${ov.idx}_mkg]alphamerge,${vrot}${fades}setpts=PTS+${localStart.toFixed(6)}/TB${zoomPartV}[vo${ov.idx}_f];`;");
rep('chunk-vo-nomask',
"fc += `[${idx}:v]trim=${fA.toFixed(6)}:${fB.toFixed(6)},setpts=PTS-STARTPTS,fps=${FPS},scale=${voWidth}:${voHeight},format=rgba,${vrot}${fades}setpts=PTS+${localStart.toFixed(6)}/TB[vo${ov.idx}_f];`;",
"fc += `[${idx}:v]trim=${fA.toFixed(6)}:${fB.toFixed(6)},setpts=PTS-STARTPTS,fps=${FPS},scale=${voWidth}:${voHeight},format=rgba,${vrot}${fades}setpts=PTS+${localStart.toFixed(6)}/TB${zoomPartV}[vo${ov.idx}_f];`;");
rep('chunk-vo-overlay',
"fc += `[${currentVideoLabel}][vo${ov.idx}_f]overlay=x=${vo.x}-overlay_w/2:y=${vo.y}-overlay_h/2:eof_action=pass:enable='between(t,${localStart.toFixed(6)},${(localStart + overlapDur).toFixed(6)})'[vo${ov.idx}_out];`;",
"fc += `[${currentVideoLabel}][vo${ov.idx}_f]overlay=x='${vo.x}-overlay_w/2+(${anV.dx})':y='${vo.y}-overlay_h/2+(${anV.dy})':eof_action=pass:enable='between(t,${localStart.toFixed(6)},${(localStart + overlapDur).toFixed(6)})'[vo${ov.idx}_out];`;");
// 7) Export chunked: textos
rep('chunk-txt',
L("const outline = txt.outline ? ':borderw=4:bordercolor=black' : '';",
"fc += `[${currentVideoLabel}]drawtext=text='${textEscaped}':x=${txt.x}-text_w/2:y=${txt.y}-text_h/2:fontsize=${txt.size}:fontcolor=${txt.color.replace('#', '0x')}:fontfile=${fontFile}${outline}${alphaExpr}:enable='between(t,${S.toFixed(6)},${E.toFixed(6)})'[txtc${ov.idx}];`;"),
L("const outline = txt.outline ? ':borderw=4:bordercolor=black' : '';",
"const anCT = animExprFF(txt, S, E, REF_WIDTH, REF_HEIGHT);",
"fc += `[${currentVideoLabel}]drawtext=text='${textEscaped}':x='${txt.x}-text_w/2+(${anCT.dx})':y='${txt.y}-text_h/2+(${anCT.dy})':fontsize=${txt.size}:fontcolor=${txt.color.replace('#', '0x')}:fontfile=${fontFile}${outline}${alphaExpr}:enable='between(t,${S.toFixed(6)},${E.toFixed(6)})'[txtc${ov.idx}];`;"));
fs.writeFileSync(PATH, src);
console.log('✅ Cambios aplicados (' + ops.length + '):', ops.join(', '));
console.log('📦 Backup del original en:', BAK);