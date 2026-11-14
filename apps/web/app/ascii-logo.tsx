'use client';

import { useEffect, useRef, useState } from 'react';

export default function AsciiLogo({ art }: { art: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const rows = art.split('\n');
    let frame = 0;
    let elapsed = 0;
    let previous = 0;

    function draw(now: number) {
      if (!context) return;
      // Pause the light sweep in background tabs and keep the logo still for reduced motion.
      if (previous && !document.hidden && !motion.matches) elapsed += Math.min(now - previous, 50);
      previous = now;
      context.clearRect(0, 0, 912, 874);
      const center = 456 + Math.sin(elapsed / 2600) * 560;
      const light = context.createLinearGradient(center - 600, 0, center + 600, 874);
      light.addColorStop(0, '#56694d');
      light.addColorStop(.5, '#e1efc4');
      light.addColorStop(1, '#56694d');
      context.fillStyle = light;
      context.font = '20px "Courier New", monospace';
      context.textBaseline = 'top';
      rows.forEach((row, index) => context.fillText(row, 0, index * 23));
      if (!motion.matches) frame = requestAnimationFrame(draw);
    }

    function restart() { cancelAnimationFrame(frame); previous = 0; draw(performance.now()); }
    restart(); setReady(true);
    motion.addEventListener('change', restart);
    return () => { cancelAnimationFrame(frame); motion.removeEventListener('change', restart); };
  }, [art]);

  return <div className="ascii-logo" role="img" aria-label="Animated ASCII Civitas logo">
    <pre aria-hidden="true" style={{ visibility: ready ? 'hidden' : 'visible' }}>{art}</pre>
    <canvas ref={canvas} width={912} height={874} aria-hidden="true" style={{ visibility: ready ? 'visible' : 'hidden' }}/>
  </div>;
}
