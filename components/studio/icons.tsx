// components/studio/icons.tsx
// Iconos SVG inline del rail del Studio. Heredan color vía currentColor.
import { useId } from 'react';
type IconProps = { className?: string };

export function IconVideo({ className = 'h-5 w-6' }: IconProps) {
  return (
    <svg viewBox="0 -2645.83 17638.9 17638.9" fill="none" className={className} aria-hidden="true">
      <path
        d="M4450.91 8755.79l0 -5291.66 4798.86 2538.84 -4798.86 2752.82zm7896.32 -4346.06l2272.59 -1363.56c699.47,-419.7 1049.25,-629.55 1337.03,-602.73 250.91,23.39 479.87,153.01 629,356.15 171.1,232.97 171.1,640.84 171.1,1456.59l0 3834.88c0,815.71 0,1223.61 -171.1,1456.61 -149.13,203.12 -378.09,332.76 -629,356.13 -287.78,26.82 -637.56,-183 -1337.03,-602.72l-2272.59 -1363.57m-8643.06 3527.78l5820.84 0c987.86,0 1481.84,0 1859.13,-192.27 331.88,-169.07 601.76,-438.94 770.82,-770.82 192.27,-377.29 192.27,-871.27 192.27,-1859.14l0 -4938.88c0,-987.87 0,-1481.81 -192.27,-1859.13 -169.06,-331.9 -438.94,-601.74 -770.82,-770.84 -377.29,-192.26 -871.27,-192.26 -1859.13,-192.26l-5820.84 0c-987.86,0 -1481.81,0 -1859.12,192.26 -331.9,169.1 -601.74,438.94 -770.84,770.84 -192.26,377.32 -192.26,871.25 -192.26,1859.13l0 4938.88c0,987.87 0,1481.85 192.26,1859.14 169.1,331.88 438.94,601.75 770.84,770.82 377.31,192.27 871.25,192.27 1859.12,192.27z"
        stroke="currentColor"
        strokeWidth={1763.89}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconImage({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M14.2639 15.9375L12.5958 14.2834C11.7909 13.4851 11.3884 13.086 10.9266 12.9401C10.5204 12.8118 10.0838 12.8165 9.68048 12.9536C9.22188 13.1095 8.82814 13.5172 8.04068 14.3326L4.04409 18.2801M14.2639 15.9375L14.6053 15.599C15.4112 14.7998 15.8141 14.4002 16.2765 14.2543C16.6831 14.126 17.12 14.1311 17.5236 14.2687C17.9824 14.4251 18.3761 14.8339 19.1634 15.6514L20 16.4934M14.2639 15.9375L18.275 19.9565M18.275 19.9565C17.9176 20 17.4543 20 16.8 20H7.2C6.07989 20 5.51984 20 5.09202 19.782C4.71569 19.5903 4.40973 19.2843 4.21799 18.908C4.12796 18.7313 4.07512 18.5321 4.04409 18.2801M18.275 19.9565C18.5293 19.9256 18.7301 19.8727 18.908 19.782C19.2843 19.5903 19.5903 19.2843 19.782 18.908C20 18.4802 20 17.9201 20 16.8V16.4934M4.04409 18.2801C4 17.9221 4 17.4575 4 16.8V7.2C4 6.0799 4 5.51984 4.21799 5.09202C4.40973 4.71569 4.71569 4.40973 5.09202 4.21799C5.51984 4 6.07989 4 7.2 4H16.8C17.9201 4 18.4802 4 18.908 4.21799C19.2843 4.40973 19.5903 4.71569 19.782 5.09202C20 5.51984 20 6.0799 20 7.2V16.4934M17 8.99989C17 10.1045 16.1046 10.9999 15 10.9999C13.8954 10.9999 13 10.1045 13 8.99989C13 7.89532 13.8954 6.99989 15 6.99989C16.1046 6.99989 17 7.89532 17 8.99989Z" />
    </svg>
  );
}

export function IconText({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M8 4V20M17 12V20M6 20H10M15 20H19M13 7V4H3V7M21 14V12H13V14" />
    </svg>
  );
}

export function IconAudio({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M13,4V20a1,1,0,0,1-2,0V4a1,1,0,0,1,2,0ZM8,5A1,1,0,0,0,7,6V18a1,1,0,0,0,2,0V6A1,1,0,0,0,8,5ZM4,7A1,1,0,0,0,3,8v8a1,1,0,0,0,2,0V8A1,1,0,0,0,4,7ZM16,5a1,1,0,0,0-1,1V18a1,1,0,0,0,2,0V6A1,1,0,0,0,16,5Zm4,2a1,1,0,0,0-1,1v8a1,1,0,0,0,2,0V8A1,1,0,0,0,20,7Z" />
    </svg>
  );
}

export function IconUndo({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11" />
    </svg>
  );
}

export function IconRedo({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5 5.5 5.5 0 0 0 9.5 20H13" />
    </svg>
  );
}

export function IconScissors({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4 8.12 15.88" />
      <path d="M14.47 14.48 20 20" />
      <path d="M8.12 8.12 12 12" />
    </svg>
  );
}

export function IconTrash({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export function IconCrop({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6 2v14a2 2 0 0 0 2 2h14" />
      <path d="M18 22V8a2 2 0 0 0-2-2H2" />
    </svg>
  );
}

export function IconFit({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

export function IconPlay({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86a1 1 0 0 0-1.5.86Z" />
    </svg>
  );
}

export function IconPause({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

export function IconSkipBack({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polygon points="19 20 9 12 19 4 19 20" />
      <line x1="5" y1="19" x2="5" y2="5" />
    </svg>
  );
}

export function IconSkipForward({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polygon points="5 4 15 12 5 20 5 4" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </svg>
  );
}

export function IconSparkles({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z" />
    </svg>
  );
}

export function IconPlayCorel({ className = 'h-16 w-16' }: IconProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const outer = `cpO${uid}`;
  const inner = `cpI${uid}`;
  return (
    <svg viewBox="0 0 121.99 121.99" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={outer} gradientUnits="userSpaceOnUse" x1="36.46" y1="7.16" x2="95.66" y2="111.18">
          <stop offset="0" stopColor="#2BBFED" />
          <stop offset="1" stopColor="#833AEC" />
        </linearGradient>
        <linearGradient id={inner} gradientUnits="userSpaceOnUse" x1="35.61" y1="17.11" x2="92.45" y2="93">
          <stop offset="0" stopColor="#007BC8" />
          <stop offset="1" stopColor="#4024C6" />
        </linearGradient>
      </defs>
      <circle fill={`url(#${outer})`} cx="60.99" cy="60.99" r="60.99" />
      <circle fill={`url(#${inner})`} cx="60.99" cy="60.99" r="54.22" />
      <path fill="#FEFEFE" d="M46.42 43.46l0 33.33c-0.16,6.51 3.03,7.72 8.94,4.62l24.38 -14.43c6.46,-3.72 5.95,-8.42 1.15,-11.11l-25.97 -15.87c-4.57,-2.56 -7.48,-1.56 -8.51,3.46z" />
    </svg>
  );
}

export function IconPauseCorel({ className = 'h-16 w-16' }: IconProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const outer = `csO${uid}`;
  const inner = `csI${uid}`;
  return (
    <svg viewBox="0 0 135.09 135.09" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={outer} gradientUnits="userSpaceOnUse" x1="40.38" y1="7.93" x2="105.94" y2="123.13">
          <stop offset="0" stopColor="#2BBFED" />
          <stop offset="1" stopColor="#833AEC" />
        </linearGradient>
        <linearGradient id={inner} gradientUnits="userSpaceOnUse" x1="39.43" y1="18.95" x2="102.38" y2="102.98">
          <stop offset="0" stopColor="#007BC8" />
          <stop offset="1" stopColor="#4024C6" />
        </linearGradient>
      </defs>
      <circle fill={`url(#${outer})`} cx="67.55" cy="67.55" r="67.55" />
      <circle fill={`url(#${inner})`} cx="67.55" cy="67.55" r="60.04" />
      <rect fill="#FEFEFE" x="50.11" y="42.75" width="12.38" height="49.08" rx="3.23" ry="3.23" />
      <rect fill="#FEFEFE" x="72.6" y="42.75" width="12.38" height="49.08" rx="3.23" ry="3.23" />
    </svg>
  );
}

export function Icon480p({ className = 'h-5 w-4' }: IconProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const doc = `cfD${uid}`;
  const glyph = `cfG${uid}`;
  return (
    <svg viewBox="0 0 23.83 29.29" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={doc} gradientUnits="userSpaceOnUse" x1="5.14" y1="3.11" x2="20.67" y2="25.31">
          <stop offset="0" stopColor="#2BBFED" />
          <stop offset="1" stopColor="#833AEC" />
        </linearGradient>
        <linearGradient id={glyph} gradientUnits="userSpaceOnUse" x1="11.72" y1="17.97" x2="13.53" y2="25.59">
          <stop offset="0" stopColor="#2BBFED" />
          <stop offset="1" stopColor="#833AEC" />
        </linearGradient>
      </defs>
      <path fill={`url(#${doc})`} d="M18.92 -0l-9.73 0 -0.75 0 -0.53 0.53 -7.37 7.37 -0.53 0.53 0 0.75 0 15.19c0,2.71 2.2,4.91 4.91,4.91l14 0c2.71,0 4.91,-2.2 4.91,-4.91l0 -19.46c0,-2.71 -2.2,-4.91 -4.91,-4.91zm3.09 24.37c0,1.71 -1.39,3.09 -3.09,3.09l-14 0c-1.71,0 -3.09,-1.39 -3.09,-3.09l0 -15.19 4.79 0c1.42,0 2.58,-1.15 2.58,-2.58l0 -4.79 9.73 0c1.71,0 3.09,1.39 3.09,3.09l0 19.46z" />
      <path fill={`url(#${glyph})`} d="M5.66 23.92l0 -1.12 -2.27 0 0 -0.93 2.41 -3.54 0.9 0 0 3.54 0.69 0 0 0.93 -0.69 0 0 1.12 -1.03 0zm0 -2.05l0 -1.9 -1.27 1.9 1.27 0zm3.08 -0.96c-0.27,-0.12 -0.48,-0.28 -0.6,-0.48 -0.13,-0.2 -0.19,-0.43 -0.19,-0.67 0,-0.42 0.15,-0.76 0.43,-1.03 0.29,-0.27 0.7,-0.41 1.23,-0.41 0.53,0 0.94,0.14 1.23,0.41 0.29,0.27 0.44,0.61 0.44,1.03 0,0.26 -0.07,0.49 -0.2,0.69 -0.13,0.2 -0.32,0.36 -0.57,0.46 0.31,0.12 0.54,0.31 0.71,0.54 0.16,0.24 0.24,0.51 0.24,0.83 0,0.52 -0.16,0.93 -0.49,1.26 -0.33,0.32 -0.76,0.48 -1.31,0.48 -0.51,0 -0.93,-0.13 -1.26,-0.4 -0.4,-0.31 -0.59,-0.75 -0.59,-1.29 0,-0.3 0.07,-0.58 0.22,-0.83 0.15,-0.25 0.38,-0.45 0.7,-0.58zm0.22 -1.07c0,0.21 0.06,0.38 0.18,0.5 0.12,0.12 0.28,0.18 0.48,0.18 0.2,0 0.36,-0.06 0.48,-0.18 0.12,-0.12 0.18,-0.29 0.18,-0.5 0,-0.2 -0.06,-0.36 -0.18,-0.48 -0.12,-0.12 -0.28,-0.18 -0.47,-0.18 -0.2,0 -0.37,0.06 -0.49,0.18 -0.12,0.12 -0.18,0.28 -0.18,0.48zm-0.1 2.39c0,0.3 0.07,0.53 0.23,0.69 0.15,0.17 0.34,0.25 0.56,0.25 0.22,0 0.4,-0.08 0.55,-0.24 0.14,-0.16 0.22,-0.39 0.22,-0.69 0,-0.26 -0.07,-0.47 -0.22,-0.63 -0.15,-0.16 -0.33,-0.24 -0.56,-0.24 -0.26,0 -0.45,0.09 -0.58,0.27 -0.13,0.18 -0.19,0.38 -0.19,0.59zm5.01 -3.9c0.54,0 0.96,0.19 1.26,0.58 0.36,0.46 0.54,1.21 0.54,2.27 0,1.06 -0.18,1.82 -0.55,2.28 -0.3,0.38 -0.72,0.57 -1.26,0.57 -0.54,0 -0.98,-0.21 -1.31,-0.63 -0.33,-0.42 -0.5,-1.16 -0.5,-2.23 0,-1.05 0.18,-1.81 0.55,-2.27 0.3,-0.38 0.72,-0.57 1.26,-0.57zm0 0.89c-0.13,0 -0.24,0.04 -0.34,0.12 -0.1,0.08 -0.18,0.23 -0.23,0.44 -0.07,0.28 -0.11,0.74 -0.11,1.4 0,0.66 0.03,1.11 0.1,1.35 0.06,0.24 0.15,0.41 0.25,0.49 0.1,0.08 0.21,0.12 0.34,0.12 0.13,0 0.24,-0.04 0.34,-0.12 0.1,-0.08 0.18,-0.23 0.23,-0.44 0.07,-0.27 0.11,-0.74 0.11,-1.39 0,-0.65 -0.03,-1.1 -0.1,-1.35 -0.06,-0.24 -0.15,-0.41 -0.24,-0.49 -0.1,-0.08 -0.21,-0.12 -0.34,-0.12zm2.64 0.68l1 0 0 0.59c0.13,-0.2 0.3,-0.37 0.52,-0.49 0.22,-0.12 0.47,-0.19 0.73,-0.19 0.47,0 0.87,0.18 1.19,0.55 0.33,0.37 0.49,0.88 0.49,1.54 0,0.68 -0.16,1.2 -0.49,1.57 -0.33,0.37 -0.73,0.56 -1.2,0.56 -0.22,0 -0.43,-0.04 -0.61,-0.13 -0.18,-0.09 -0.37,-0.24 -0.57,-0.45l0 2.02 -1.07 0 0 -5.57zm1.05 1.96c0,0.45 0.09,0.79 0.27,1.01 0.18,0.22 0.4,0.33 0.65,0.33 0.25,0 0.45,-0.1 0.62,-0.3 0.16,-0.2 0.25,-0.53 0.25,-0.98 0,-0.42 -0.08,-0.74 -0.25,-0.95 -0.17,-0.21 -0.38,-0.31 -0.63,-0.31 -0.26,0 -0.48,0.1 -0.65,0.3 -0.17,0.2 -0.26,0.5 -0.26,0.9z" />
    </svg>
  );
}