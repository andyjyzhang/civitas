'use client';

import { useEffect, useRef } from 'react';

export default function AsciiLogo({ art }: { art: string }) {
  const pre = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const element = pre.current;
    if (!element) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const rows = art.split('\n');
    const shades = '.:-=+*#%@';
    let frame = 0;
    let elapsed = 0;
    let previous = 0;
    let lastDraw = -Infinity;

    function animate(now: number) {
      if (previous && !document.hidden) elapsed += Math.min(now - previous, 50);
      previous = now;
      if (!document.hidden && now - lastDraw >= 1000 / 30) {
        const phase = elapsed / 650;
        element!.textContent = rows.map((row, y) => Array.from(row, (character, x) => {
          if (character === ' ') return ' ';
          const wave = (Math.sin(x * .16 + y * .22 - phase) + 1) / 2;
          return shades[Math.min(shades.length - 1, Math.floor(wave * shades.length))];
        }).join('')).join('\n');
        lastDraw = now;
      }
      frame = requestAnimationFrame(animate);
    }

    function restart() {
      cancelAnimationFrame(frame);
      previous = 0; lastDraw = -Infinity;
      if (motion.matches) element!.textContent = art;
      else frame = requestAnimationFrame(animate);
    }
    restart();
    motion.addEventListener('change', restart);
    return () => { cancelAnimationFrame(frame); motion.removeEventListener('change', restart); };
  }, [art]);

  return <div className="ascii-logo" role="img" aria-label="Animated ASCII Civitas logo">
    <pre ref={pre} aria-hidden="true">{art}</pre>
  </div>;
}
