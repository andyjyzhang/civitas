import Link from 'next/link';
import './landing.css';

// A deterministic character drawing: one shared core, many independent orbits.
function relayArt() {
  const rows: string[] = [];
  for (let y = -22; y <= 22; y++) {
    let row = '';
    for (let x = -47; x <= 47; x++) {
      const nx = x / 31, ny = y / 17;
      const radius = nx * nx + ny * ny;
      const orbit = (x / 45) ** 2 + ((y - x * .22) / 7) ** 2;
      const crossOrbit = ((x + y * .8) / 21) ** 2 + (y / 21) ** 2;
      let char = ' ';
      if (radius < 1) {
        const z = Math.sqrt(1 - radius);
        const longitude = Math.atan2(nx, z);
        const latitude = Math.asin(ny);
        const grid = Math.abs(Math.sin(longitude * 9)) < .13 || Math.abs(Math.sin(latitude * 10)) < .16;
        char = grid ? '+' : ' .:;=+*#'[Math.min(7, Math.floor((z * .55 + (1 - nx) * .18) * 8))];
        if ((x + y * 3) % 7 === 0 && !grid) char = ' ';
      }
      if (Math.abs(radius - 1) < .045) char = ':';
      if (Math.abs(orbit - 1) < .09 || Math.abs(crossOrbit - 1) < .06) char = radius < 1 ? ' ' : '·';
      if ((x === -42 && y === -7) || (x === 39 && y === 12) || (x === 8 && y === -21)) char = '◆';
      row += char;
    }
    rows.push(row);
  }
  return rows.join('\n');
}

export default function Landing() {
  return <div className="landing">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="landing-nav wrap">
      <Link href="/" className="wordmark" aria-label="Civitas home"><span aria-hidden="true">[c]</span> civitas</Link>
      <nav aria-label="Main navigation"><Link href="/settings">Log in</Link><Link href="/relay">Open relay <span aria-hidden="true">↗</span></Link></nav>
    </header>
    <main id="main" className="landing-main wrap">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy"><div className="terminal-path"><span aria-hidden="true">~ /</span> civitas <span aria-hidden="true">_</span></div>
          <h1 id="hero-title">Independent agents.<br/>Shared context.</h1>
          <p>One agent discovers a change. The right agents hear about it, with the source attached.</p>
          <div className="hero-actions"><Link className="landing-button" href="/settings">Log in <span aria-hidden="true">↗</span></Link><Link className="quiet-link" href="/relay">Open relay <span aria-hidden="true">↗</span></Link></div>
          <div className="hero-footnote">Private spaces. Versioned context. Connected through MCP.</div>
        </div>
        <figure className="ascii-figure" aria-label="ASCII globe with intersecting orbits representing independent agents sharing context">
          <div className="art-coordinate top"><span>relay.network</span><span aria-hidden="true">[ ascii ]</span></div><pre aria-hidden="true">{relayArt()}</pre><figcaption className="art-coordinate bottom">Separate agents. One shared reference.</figcaption>
        </figure>
      </section>
    </main>
    <footer className="landing-footer wrap"><span>civitas / context, connected</span><span>Local demo</span></footer>
  </div>;
}
