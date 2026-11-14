import Link from 'next/link';
import './landing.css';

// Character-shaded frames of the Civitas c / outward-arrow mark.
function logoFrame(frame: number) {
  const rows: string[] = [];
  for (let y = 0; y < 38; y++) {
    let row = '';
    for (let x = 0; x < 76; x++) {
      const radius = ((x - 32) / 26) ** 2 + ((y - 21) / 15) ** 2;
      const c = radius < 1 && radius > .4 && !(x > 33 && Math.abs(y - 21) < 10);
      const arrow = (Math.abs(x + y - 66) < 2.5 && x >= 47 && x <= 64 && y >= 2 && y <= 19)
        || (y >= 2 && y <= 4 && x >= 49 && x <= 65)
        || (x >= 61 && x <= 65 && y >= 2 && y <= 12);
      const shade = Math.sin(x * .13 + y * .2 - frame * Math.PI / 6);
      row += c || arrow ? '.:=+*#'[Math.min(5, Math.floor((shade + 1) * 2.9))] : ' ';
    }
    rows.push(row);
  }
  return rows.join('\n');
}

export default function Landing() {
  return <div className="landing">
    <header className="landing-nav">
      <Link href="/" className="landing-wordmark">civitas</Link>
      <Link href="/settings" className="landing-login">Log in</Link>
    </header>
    <main className="landing-main" aria-label="Civitas">
      <div className="ascii-logo" role="img" aria-label="Animated ASCII Civitas logo">
        {Array.from({ length: 12 }, (_, frame) => <pre key={frame} aria-hidden="true" style={{ animationDelay: `${frame * .2}s` }}>{logoFrame(frame)}</pre>)}
      </div>
    </main>
  </div>;
}
