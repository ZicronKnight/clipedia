// aplicar-vo-chunked.mjs — Puerta A: capas de superposición (VO) en el export chunked
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
const BAK = PATH + '.bak-vo';
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
// 1) Jubilar el fusible que rechazaba VOs
rep('fuse',
L("if (videoOverlays.length > 0) {",
"showToast('⚠️ Export escalable v1 todavía no soporta capas de superposición con clips pesados. Quitá las capas o usa clips livianos.', 'warn', 9000);",
"return;",
"}"),
"// FASE 6.11: las capas de superposición (VO) ya son bienvenidas en el export chunked.");
// 2) VOs y máscaras residentes (una sola escritura por export)
const RES_SEARCH = L("for (let i = 0; i < imageOverlays.length; i++) {",
"const ires = await fetch(imageOverlays[i].url);",
"await ff.writeFile(`img${i}.png`, new Uint8Array(await ires.arrayBuffer()));",
"}");
rep('resident-vo', RES_SEARCH, RES_SEARCH + "\n" + L(
"// Capas de video residentes + máscaras de forma (una sola escritura por export)",
"const voMaskFile: (string | null)[] = [];",
"for (let i = 0; i < videoOverlays.length; i++) {",
"const vo = videoOverlays[i];",
"if (isLaneMuted(vo.laneId)) { voMaskFile.push(null); continue; }",
"const vres = await fetch(vo.url);",
"await ff.writeFile(`vo${i}.webm`, new Uint8Array(await vres.arrayBuffer()));",
"if (vo.shape !== 'none') {",
"const sW = vo.srcW || 16; const sH = vo.srcH || 9;",
"const mW = Math.max(2, Math.round((vo.size / 100) * REF_WIDTH));",
"const mH = Math.max(2, 2 * Math.round((mW * sH / sW) / 2));",
"const maskBlob = await generateShapeMask(vo.shape, mW, mH);",
"if (maskBlob) {",
"await ff.writeFile(`vomask${i}.png`, new Uint8Array(await maskBlob.arrayBuffer()));",
"voMaskFile.push(`vomask${i}.png`);",
"continue;",
"}",
"}",
"voMaskFile.push(null);",
"}"));
// 3) La familia video entra al z-order del chunk
rep('orderC-type',
"const overlayOrderC: { family: 'image' | 'text' | 'subtitle'; idx: number; key: number }[] = [",
"const overlayOrderC: { family: 'image' | 'text' | 'subtitle' | 'video'; idx: number; key: number }[] = [");
rep('orderC-video-map',
L("...textOverlays.map((t, i) => ({ family: (t.kind === 'subtitulo' ? 'subtitle' : 'text') as 'subtitle' | 'text', idx: i, key: paintKeyOf(t.laneId, t.kind === 'subtitulo' ? 'subtitle' : 'text', i) })),",
"].sort((a, b) => a.key - b.key);"),
L("...textOverlays.map((t, i) => ({ family: (t.kind === 'subtitulo' ? 'subtitle' : 'text') as 'subtitle' | 'text', idx: i, key: paintKeyOf(t.laneId, t.kind === 'subtitulo' ? 'subtitle' : 'text', i) })),",
"...videoOverlays.map((v, i) => ({ family: 'video' as const, idx: i, key: paintKeyOf(v.laneId, 'video', i) })),",
"].sort((a, b) => a.key - b.key);"));
// 4) Rama de render de VO por chunk (ventaneo + máscara + fades corridos)
rep('orderC-video-branch',
L("currentVideoLabel = `imgo${ov.idx}`;",
"} else {"),
L("currentVideoLabel = `imgo${ov.idx}`;",
"} else if (ov.family === 'video') {",
"const vo = videoOverlays[ov.idx];",
"if (isLaneMuted(vo.laneId)) continue;",
"const oS = Math.max(vo.start, cs); const oE = Math.min(vo.end, ce);",
"if (oE <= oS) continue;",
"const idx = nextInput++;",
"inputArgs.push('-i', `vo${ov.idx}.webm`);",
"const localStart = oS - cs; const overlapDur = oE - oS;",
"const durVO = vo.end - vo.start;",
"const shift = oS - vo.start;",
"const fA = vo.offset + shift; const fB = fA + overlapDur;",
"const sW = vo.srcW || 16; const sH = vo.srcH || 9;",
"const voWidth = Math.max(2, Math.round((vo.size / 100) * REF_WIDTH));",
"const voHeight = Math.max(2, 2 * Math.round((voWidth * sH / sW) / 2));",
"let fades = '';",
"if (vo.fadeIn > 0 && shift < vo.fadeIn) fades += `fade=t=in:st=0:d=${Math.min(vo.fadeIn - shift, overlapDur).toFixed(6)}:alpha=1,`;",
"if (vo.fadeOut > 0 && shift + overlapDur > durVO - vo.fadeOut) {",
"const stF = Math.max(0, (durVO - vo.fadeOut) - shift);",
"fades += `fade=t=out:st=${stF.toFixed(6)}:d=${Math.min(vo.fadeOut, overlapDur - stF).toFixed(6)}:alpha=1,`;",
"}",
"let vrot = '';",
"if (vo.rotate === 90) vrot = 'transpose=1,';",
"else if (vo.rotate === 180) vrot = 'hflip,vflip,';",
"else if (vo.rotate === 270) vrot = 'transpose=2,';",
"const maskFile = voMaskFile[ov.idx];",
"if (maskFile) {",
"const midx = nextInput++;",
"inputArgs.push('-loop', '1', '-i', maskFile);",
"fc += `[${idx}:v]trim=${fA.toFixed(6)}:${fB.toFixed(6)},setpts=PTS-STARTPTS,fps=${FPS},scale=${voWidth}:${voHeight},format=rgba[vo${ov.idx}_rgb];`;",
"fc += `[${midx}:v]format=gray[vo${ov.idx}_mkg];`;",
"fc += `[vo${ov.idx}_rgb][vo${ov.idx}_mkg]alphamerge,${vrot}${fades}setpts=PTS+${localStart.toFixed(6)}/TB[vo${ov.idx}_f];`;",
"} else {",
"fc += `[${idx}:v]trim=${fA.toFixed(6)}:${fB.toFixed(6)},setpts=PTS-STARTPTS,fps=${FPS},scale=${voWidth}:${voHeight},format=rgba,${vrot}${fades}setpts=PTS+${localStart.toFixed(6)}/TB[vo${ov.idx}_f];`;",
"}",
"fc += `[${currentVideoLabel}][vo${ov.idx}_f]overlay=x=${vo.x}-overlay_w/2:y=${vo.y}-overlay_h/2:eof_action=pass:enable='between(t,${localStart.toFixed(6)},${(localStart + overlapDur).toFixed(6)})'[vo${ov.idx}_out];`;",
"currentVideoLabel = `vo${ov.idx}_out`;",
"} else {"));
// 5) Audio de las VOs entra a la mezcla continua
const AIN_SEARCH = L("const audioInputArgs: string[] = [];",
"audioFiles.forEach((f) => audioInputArgs.push('-i', f));");
rep('vo-audio-inputs', AIN_SEARCH, L(
"// Audio de capas de video (ya residentes en MEMFS) entra a la mezcla continua",
"const voAudioIdx: number[] = [];",
"for (let i = 0; i < videoOverlays.length; i++) {",
"const vo = videoOverlays[i];",
"if (vo.muted || vo.hasAudio === false || isLaneMuted(vo.laneId)) { voAudioIdx.push(-1); continue; }",
"audioFiles.push(`vo${i}.webm`);",
"voAudioIdx.push(audioFiles.length - 1);",
"}") + "\n" + AIN_SEARCH);
rep('vo-audio-labels',
L("let finalAudioLabel = 'outa';",
"if (audioLabels.length > 0) {",
"afc += `${audioLabels.map((l) => `[${l}]`).join('')}amix=inputs=${audioLabels.length}:duration=longest:dropout_transition=0[${finalAudioLabel}]`;"),
L("videoOverlays.forEach((vo, i) => {",
"if (voAudioIdx[i] < 0) return;",
"afc += `[${voAudioIdx[i]}:a]atrim=${vo.offset.toFixed(6)}:${(vo.offset + (vo.end - vo.start)).toFixed(6)},asetpts=PTS-STARTPTS,adelay=${Math.round(vo.start * 1000)}|${Math.round(vo.start * 1000)},volume=1.0[va${i}];`;",
"audioLabels.push(`va${i}`);",
"});",
"let finalAudioLabel = 'outa';",
"if (audioLabels.length > 0) {",
"afc += `${audioLabels.map((l) => `[${l}]`).join('')}amix=inputs=${audioLabels.length}:duration=longest:dropout_transition=0[${finalAudioLabel}]`;"));
// 6) Limpieza de máscaras al final
rep('mask-cleanup',
"for (let i = 0; i < imageOverlays.length; i++) { try { await ff.deleteFile(`img${i}.png`); } catch (e) {} }",
L("for (let i = 0; i < imageOverlays.length; i++) { try { await ff.deleteFile(`img${i}.png`); } catch (e) {} }",
"for (let i = 0; i < videoOverlays.length; i++) { try { await ff.deleteFile(`vomask${i}.png`); } catch (e) {} }"));
fs.writeFileSync(PATH, src);
console.log('✅ Cambios aplicados (' + ops.length + '):', ops.join(', '));
console.log('📦 Backup del original en:', BAK);