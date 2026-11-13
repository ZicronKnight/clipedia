// aplicar-claqueta-export.mjs — claqueta oficial de la fundadora en el modal de export
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';

// 0) El SVG tiene que estar en public/ antes de tocar nada
if (!fs.existsSync('public/claqueta-export.svg')) {
  console.error('❌ Falta public/claqueta-export.svg. Guardá ahí el SVG de Corel y volvé a correr. NO se tocó nada.');
  process.exit(1);
}

let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-claqueta', src);
const ops = ['svg-verificado'];

// 1) Fuera la claqueta placeholder, entra la oficial
const re = /<svg viewBox="0 0 220 170"[\s\S]*?<\/svg>/;
if (!re.test(src)) {
  console.error('❌ No encontré la claqueta placeholder (viewBox "0 0 220 170") en el modal de export. NO se tocó nada.');
  process.exit(1);
}
src = src.replace(re, '<img src="/claqueta-export.svg" alt="" aria-hidden="true" draggable={false} className="h-auto w-full select-none drop-shadow-[0_0_30px_rgba(99,102,241,0.55)]" />');
ops.push('claqueta-oficial');

// 2) El hueco del hero se ensancha: tu obra es 2:1, la mía era 1.3:1
const CONT = '<div className="w-36 shrink-0 sm:w-44">';
if (src.split(CONT).length - 1 === 1) {
  src = src.replace(CONT, '<div className="w-36 shrink-0 sm:w-56">');
  ops.push('hero-ensanchado');
} else {
  ops.push('hero-sin-cambios');
}

fs.writeFileSync(PATH, src);
console.log('✅ Claqueta oficial instalada:', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-claqueta');