// aplicar-zorder.mjs — aplica el z-order por timeline (regla Vegas) al Studio.tsx multipista
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
const BAK = PATH + '.bak';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(BAK, src);
const BS = String.fromCharCode(92);
const DQ = String.fromCharCode(34);
const TE = "const textEscaped = txt.text.replace(/" + BS + BS + "/g, '" + BS + BS + BS + BS + "').replace(/'/g, " + DQ + BS + BS + "'" + DQ + ").replace(/:/g, '" + BS + BS + ":');";
const ops = [];
function rep(name, search, replace) {
  const count = src.split(search).length - 1;
  if (count !== 1) { console.error('❌ [' + name + '] ancla encontrada ' + count + ' veces (esperaba 1). NO se tocó el archivo.'); process.exit(1); }
  src = src.replace(search, replace);
  ops.push(name);
}
function span(name, startAnchor, endAnchor, replace) {
  const s = src.indexOf(startAnchor);
  const e = src.indexOf(endAnchor);
  if (s === -1 || e === -1 || e <= s) { console.error('❌ [' + name + '] anclas de tramo no encontradas (start=' + s + ', end=' + e + '). NO se tocó el archivo.'); process.exit(1); }
  src = src.slice(0, s) + replace + src.slice(e);
  ops.push(name);
}
// ===== 1) Helpers de paint-key =====
rep('helpers',
"function laneList(kind: TimelineLaneKind) { return timelineLanes.filter((lane) => lane.kind === kind); }",
"function laneList(kind: TimelineLaneKind) { return timelineLanes.filter((lane) => lane.kind === kind); }\n// ===== Z-ORDER SEGÚN TIMELINE (regla Vegas: la fila de arriba = capa al frente) =====\n// Familias en el orden de filas de la timeline (V profundas → SUB al frente);\n// dentro de cada familia, la pista más arriba (posición 0) se pinta al final.\nconst FAMILY_RANK: Record<'video' | 'text' | 'image' | 'subtitle', number> = { video: 0, text: 1, image: 2, subtitle: 3 };\nfunction lanePosOf(kind: TimelineLaneKind, laneId?: string): number {\nconst list = laneList(kind);\nconst idx = list.findIndex((l) => l.id === laneId);\nreturn idx < 0 ? 0 : idx;\n}\nfunction paintKeyOf(laneId: string | undefined, family: 'video' | 'text' | 'image' | 'subtitle', arrayIdx: number): number {\nreturn FAMILY_RANK[family] * 100000 - lanePosOf(family, laneId) * 1000 + arrayIdx;\n}");
// ===== 2) Preview: zIndex por paint-key =====
rep('preview-img-map', "{activeImages.map((activeImage) => {", "{activeImages.map((activeImage, ai) => {");
rep('preview-img-z', "style={{ left: activeImage.x, top: activeImage.y, width: (activeImage.size / 100) * REF_WIDTH, transform: `translate(-50%, -50%) rotate(${activeImage.rotate}deg)`, opacity: alpha }}", "style={{ left: activeImage.x, top: activeImage.y, width: (activeImage.size / 100) * REF_WIDTH, transform: `translate(-50%, -50%) rotate(${activeImage.rotate}deg)`, opacity: alpha, zIndex: paintKeyOf(activeImage.laneId, 'image', ai) }}");
rep('preview-txt-map', "{activeTexts.map((activeText) => {", "{activeTexts.map((activeText, ati) => {");
rep('preview-txt-z', "style={{ left: activeText.x, top: activeText.y, transform: 'translate(-50%, -50%)', opacity: alpha }}", "style={{ left: activeText.x, top: activeText.y, transform: 'translate(-50%, -50%)', opacity: alpha, zIndex: paintKeyOf(activeText.laneId, activeText.kind === 'subtitulo' ? 'subtitle' : 'text', ati) }}");
rep('preview-vo-map', "{videoOverlays.map((vo) => {", "{videoOverlays.map((vo, vi) => {");
rep('preview-vo-z', "style={{ left: vo.x, top: vo.y, width: (vo.size / 100) * REF_WIDTH, transform: `translate(-50%, -50%) rotate(${vo.rotate}deg)`, opacity: voAlpha, visibility: inWin && !isLaneMuted(vo.laneId) ? 'visible' : 'hidden', clipPath: voClip }}", "style={{ left: vo.x, top: vo.y, width: (vo.size / 100) * REF_WIDTH, transform: `translate(-50%, -50%) rotate(${vo.rotate}deg)`, opacity: voAlpha, visibility: inWin && !isLaneMuted(vo.laneId) ? 'visible' : 'hidden', clipPath: voClip, zIndex: paintKeyOf(vo.laneId, 'video', vi) }}");
// ===== 3) Export clásico: cadena de overlays en orden de timeline =====
const R8 = [
"const appendImage = (i: number, cur: string): string => {",
"const img = imageOverlays[i];",
"const imgInputIdx = clips.length + i;",
"const imgWidth = Math.round((img.size / 100) * REF_WIDTH);",
"const dur = img.end - img.start;",
"let fades = '';",
"if (img.fadeIn > 0) fades += `fade=t=in:st=0:d=${img.fadeIn}:alpha=1,`;",
"if (img.fadeOut > 0) fades += `fade=t=out:st=${Math.max(dur - img.fadeOut, 0)}:d=${img.fadeOut}:alpha=1,`;",
"let irot = '';",
"if (img.rotate === 90) irot = 'transpose=1,';",
"else if (img.rotate === 180) irot = 'hflip,vflip,';",
"else if (img.rotate === 270) irot = 'transpose=2,';",
"filterComplex += `[${imgInputIdx}:v]scale=${imgWidth}:-2,format=rgba,${fades}${irot}trim=0:${dur},setpts=PTS+${img.start}/TB[img${i}_f];`;",
"filterComplex += `[${cur}][img${i}_f]overlay=x=${img.x}-overlay_w/2:y=${img.y}-overlay_h/2:eof_action=pass:enable='between(t,${img.start},${img.end})'[img${i}_out];`;",
"return `img${i}_out`;",
"};",
"const appendVo = (i: number, cur: string): string => {",
"const vo = videoOverlays[i];",
"const voInputIdx = clips.length + imageOverlays.length + i;",
"const sW = vo.srcW || 16; const sH = vo.srcH || 9;",
"const voWidth = Math.max(2, Math.round((vo.size / 100) * REF_WIDTH));",
"const voHeight = Math.max(2, 2 * Math.round((voWidth * sH / sW) / 2));",
"const dur = vo.end - vo.start;",
"let fades = '';",
"if (vo.fadeIn > 0) fades += `fade=t=in:st=0:d=${vo.fadeIn}:alpha=1,`;",
"if (vo.fadeOut > 0) fades += `fade=t=out:st=${Math.max(dur - vo.fadeOut, 0)}:d=${vo.fadeOut}:alpha=1,`;",
"let vrot = '';",
"if (vo.rotate === 90) vrot = 'transpose=1,';",
"else if (vo.rotate === 180) vrot = 'hflip,vflip,';",
"else if (vo.rotate === 270) vrot = 'transpose=2,';",
"const mi = voMaskIdx[i];",
"if (mi !== null && mi !== undefined) {",
"filterComplex += `[${voInputIdx}:v]trim=${vo.offset}:${vo.offset + dur},setpts=PTS-STARTPTS,fps=30,scale=${voWidth}:${voHeight},format=rgba[vo${i}_rgb];`;",
"filterComplex += `[${mi}:v]format=gray[mask${i}g];`;",
"filterComplex += `[vo${i}_rgb][mask${i}g]alphamerge,${vrot}${fades}setpts=PTS+${vo.start}/TB[vo${i}_f];`;",
"} else {",
"filterComplex += `[${voInputIdx}:v]trim=${vo.offset}:${vo.offset + dur},setpts=PTS-STARTPTS,fps=30,scale=${voWidth}:${voHeight},format=rgba,${vrot}${fades}setpts=PTS+${vo.start}/TB[vo${i}_f];`;",
"}",
"filterComplex += `[${cur}][vo${i}_f]overlay=x=${vo.x}-overlay_w/2:y=${vo.y}-overlay_h/2:eof_action=pass:enable='between(t,${vo.start},${vo.end})'[vo${i}_out];`;",
"return `vo${i}_out`;",
"};",
"const appendText = (i: number, cur: string): string => {",
"const txt = textOverlays[i];",
"const variant = FONT_VARIANTS[txt.font];",
"let fontFile = (txt.bold ? variant.bold : variant.regular).split('/').pop() as string;",
"if (!loadedFontFiles.has(fontFile)) {",
"const familyRegular = variant.regular.split('/').pop() as string;",
"if (loadedFontFiles.has(familyRegular)) fontFile = familyRegular;",
"else {",
"const anyFont = Array.from(loadedFontFiles)[0];",
"if (!anyFont) { filterComplex += `[${cur}]null[txt${i}_out];`; return `txt${i}_out`; }",
"fontFile = anyFont;",
"}",
"}",
TE,
"const S = txt.start; const E = txt.end;",
"let alphaExpr = '';",
"if (txt.fadeIn > 0 && txt.fadeOut > 0) alphaExpr = `:alpha='max(0,min(1,min((t-${S})/${txt.fadeIn},(${E}-t)/${txt.fadeOut})))'`;",
"else if (txt.fadeIn > 0) alphaExpr = `:alpha='max(0,min(1,(t-${S})/${txt.fadeIn}))'`;",
"else if (txt.fadeOut > 0) alphaExpr = `:alpha='max(0,min(1,(${E}-t)/${txt.fadeOut}))'`;",
"const outline = (txt as any).outline ? ':borderw=4:bordercolor=black' : '';",
"filterComplex += `[${cur}]drawtext=text='${textEscaped}':x=${txt.x}-text_w/2:y=${txt.y}-text_h/2:fontsize=${txt.size}:fontcolor=${txt.color.replace('#', '0x')}:fontfile=${fontFile}${outline}${alphaExpr}:enable='between(t,${S},${E})'[txt${i}_out];`;",
"return `txt${i}_out`;",
"};",
"const overlayOrder: { family: 'image' | 'text' | 'subtitle' | 'video'; idx: number; key: number }[] = [",
"...imageOverlays.map((img, i) => ({ family: 'image' as const, idx: i, key: paintKeyOf(img.laneId, 'image', i) })),",
"...textOverlays.map((t, i) => ({ family: (t.kind === 'subtitulo' ? 'subtitle' : 'text') as 'subtitle' | 'text', idx: i, key: paintKeyOf(t.laneId, t.kind === 'subtitulo' ? 'subtitle' : 'text', i) })),",
"...videoOverlays.map((v, i) => ({ family: 'video' as const, idx: i, key: paintKeyOf(v.laneId, 'video', i) })),",
"].sort((a, b) => a.key - b.key);",
"let currentVideoLabel = 'basev';",
"for (const ov of overlayOrder) {",
"if (ov.family === 'image') { if (isLaneMuted(imageOverlays[ov.idx].laneId)) continue; currentVideoLabel = appendImage(ov.idx, currentVideoLabel); }",
"else if (ov.family === 'video') { if (isLaneMuted(videoOverlays[ov.idx].laneId)) continue; currentVideoLabel = appendVo(ov.idx, currentVideoLabel); }",
"else { if (isLaneMuted(textOverlays[ov.idx].laneId)) continue; currentVideoLabel = appendText(ov.idx, currentVideoLabel); }",
"}",
"const finalVideoLabel = currentVideoLabel;",
""].join("\n");
span('export-clasico', "let currentVideoLabel = 'basev';", "filterComplex += `[${finalVideoLabel}]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2[finalv];`;", R8);
// ===== 4) Export chunked: mismo orden =====
const R9 = [
"// Overlays EN ORDEN DE TIMELINE (fila de arriba = al frente = se encadena último)",
"let nextInput = inChunk.length;",
"const overlayOrderC: { family: 'image' | 'text' | 'subtitle'; idx: number; key: number }[] = [",
"...imageOverlays.map((img, i) => ({ family: 'image' as const, idx: i, key: paintKeyOf(img.laneId, 'image', i) })),",
"...textOverlays.map((t, i) => ({ family: (t.kind === 'subtitulo' ? 'subtitle' : 'text') as 'subtitle' | 'text', idx: i, key: paintKeyOf(t.laneId, t.kind === 'subtitulo' ? 'subtitle' : 'text', i) })),",
"].sort((a, b) => a.key - b.key);",
"for (const ov of overlayOrderC) {",
"if (ov.family === 'image') {",
"const img = imageOverlays[ov.idx];",
"if (isLaneMuted(img.laneId)) continue;",
"const oS = Math.max(img.start, cs); const oE = Math.min(img.end, ce);",
"if (oE <= oS) continue;",
"const idx = nextInput++;",
"inputArgs.push('-loop', '1', '-i', `img${ov.idx}.png`);",
"const localStart = oS - cs; const overlapDur = oE - oS;",
"const durImg = img.end - img.start;",
"const imgStartInWindow = oS - img.start;",
"const imgWidth = Math.round((img.size / 100) * REF_WIDTH);",
"let fades = '';",
"if (img.fadeIn > 0) fades += `fade=t=in:st=0:d=${img.fadeIn}:alpha=1,`;",
"if (img.fadeOut > 0) fades += `fade=t=out:st=${Math.max(durImg - img.fadeOut, 0)}:d=${img.fadeOut}:alpha=1,`;",
"fc += `[${idx}:v]scale=${imgWidth}:-2,format=rgba,${fades}${rotOf(img.rotate)}trim=${imgStartInWindow.toFixed(6)}:${(imgStartInWindow + overlapDur).toFixed(6)},setpts=PTS-STARTPTS,setpts=PTS+${localStart.toFixed(6)}/TB[imgc${ov.idx}];`;",
"fc += `[${currentVideoLabel}][imgc${ov.idx}]overlay=x=${img.x}-overlay_w/2:y=${img.y}-overlay_h/2:eof_action=pass:enable='between(t,${localStart.toFixed(6)},${(localStart + overlapDur).toFixed(6)})'[imgo${ov.idx}];`;",
"currentVideoLabel = `imgo${ov.idx}`;",
"} else {",
"const txt = textOverlays[ov.idx];",
"if (isLaneMuted(txt.laneId)) continue;",
"const oS = Math.max(txt.start, cs); const oE = Math.min(txt.end, ce);",
"if (oE <= oS) continue;",
"const S = txt.start - cs; const E = txt.end - cs;",
"const variant = FONT_VARIANTS[txt.font];",
"let fontFile = (txt.bold ? variant.bold : variant.regular).split('/').pop() as string;",
"if (!loadedFontFiles.has(fontFile)) {",
"const familyRegular = variant.regular.split('/').pop() as string;",
"if (loadedFontFiles.has(familyRegular)) fontFile = familyRegular;",
"else { const anyFont = Array.from(loadedFontFiles)[0]; if (!anyFont) continue; fontFile = anyFont; }",
"}",
TE,
"let alphaExpr = '';",
"if (txt.fadeIn > 0 && txt.fadeOut > 0) alphaExpr = `:alpha='max(0,min(1,min((t-${S.toFixed(6)})/${txt.fadeIn},(${E.toFixed(6)}-t)/${txt.fadeOut})))'`;",
"else if (txt.fadeIn > 0) alphaExpr = `:alpha='max(0,min(1,(t-${S.toFixed(6)})/${txt.fadeIn}))'`;",
"else if (txt.fadeOut > 0) alphaExpr = `:alpha='max(0,min(1,(${E.toFixed(6)}-t)/${txt.fadeOut}))'`;",
"const outline = txt.outline ? ':borderw=4:bordercolor=black' : '';",
"fc += `[${currentVideoLabel}]drawtext=text='${textEscaped}':x=${txt.x}-text_w/2:y=${txt.y}-text_h/2:fontsize=${txt.size}:fontcolor=${txt.color.replace('#', '0x')}:fontfile=${fontFile}${outline}${alphaExpr}:enable='between(t,${S.toFixed(6)},${E.toFixed(6)})'[txtc${ov.idx}];`;",
"currentVideoLabel = `txtc${ov.idx}`;",
"}",
"}",
"const finalVideoLabel = currentVideoLabel;",
""].join("\n");
span('export-chunked', "// Overlays de IMAGEN (solape real: jamás PTS negativo)", "fc += `[${finalVideoLabel}]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2[chunkv]`;", R9);
fs.writeFileSync(PATH, src);
console.log('✅ Cambios aplicados (' + ops.length + '):', ops.join(', '));
console.log('📦 Backup del original en:', BAK);