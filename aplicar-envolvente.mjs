// aplicar-envolvente.mjs — línea verde de envolvente (RMS suavizado) sobre la onda de audio
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-env', src);
const re = /(ctx\.fillRect\(i \* barWidth, center - h \/ 2, Math\.max\(1, barWidth \* 0\.8\), h\);\s*\}\s*)(ctx\.globalAlpha = 1;)/;
const m = src.match(re);
if (!m) { console.error('❌ No encontré el final del loop de barritas en WaveformCanvas. NO se tocó el archivo.'); process.exit(1); }
const ENV = [
'// ===== ENVOLVENTE DE AMPLITUD: línea verde neón (RMS suavizado) sobre las barritas =====',
'const env = new Array(bars);',
'if (audioDataMap.has(id)) {',
'const d0 = audioDataMap.get(id);',
'const s0 = offset + visS * speed;',
'const s1 = offset + visE * speed;',
'const a0 = Math.max(0, Math.floor(s0 * d0.sampleRate));',
'const a1 = Math.min(d0.channelData.length, Math.max(a0 + 1, Math.ceil(s1 * d0.sampleRate)));',
'const span = a1 - a0;',
'for (let i = 0; i < bars; i++) {',
'const b0 = a0 + Math.floor((i * span) / bars);',
'const b1 = Math.max(b0 + 1, a0 + Math.floor(((i + 1) * span) / bars));',
'let sum = 0;',
'for (let j = b0; j < b1; j++) { const v = d0.channelData[j] || 0; sum += v * v; }',
'env[i] = Math.sqrt(sum / (b1 - b0));',
'}',
'} else {',
'for (let i = 0; i < bars; i++) env[i] = Number(vals[i]) || 0;',
'}',
'for (let pass = 0; pass < 2; pass++) {',
'const sm = new Array(bars);',
'for (let i = 0; i < bars; i++) {',
'const a = env[Math.max(0, i - 2)]; const b = env[Math.max(0, i - 1)]; const c = env[i];',
'const d = env[Math.min(bars - 1, i + 1)]; const e = env[Math.min(bars - 1, i + 2)];',
'sm[i] = (a + 2 * b + 3 * c + 2 * d + e) / 9;',
'}',
'for (let i = 0; i < bars; i++) env[i] = sm[i];',
'}',
'ctx.save();',
'ctx.beginPath();',
'for (let i = 0; i < bars; i++) {',
'const y = center - clamp(env[i], 0, 1) * 19;',
'if (i === 0) ctx.moveTo(0, y); else ctx.lineTo(i * barWidth + barWidth / 2, y);',
'}',
'ctx.strokeStyle = \'rgba(74, 222, 128, 0.95)\';',
'ctx.lineWidth = 1.6;',
'ctx.shadowColor = \'rgba(74, 222, 128, 0.7)\';',
'ctx.shadowBlur = 4;',
'ctx.stroke();',
'ctx.restore();',
].join('\n');
src = src.replace(re, (mm, p1, p2) => p1 + ENV + '\n' + p2);
fs.writeFileSync(PATH, src);
console.log('✅ Envolvente verde aplicada sobre WaveformCanvas.');
console.log('📦 Backup en:', PATH + '.bak-env');