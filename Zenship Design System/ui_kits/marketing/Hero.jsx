function Hero({ tweaks }) {
  const t = tweaks || {};
  const [step, setStep] = React.useState(0);
  const lines = [
    { kind: 'cmd',  t: 'zenship send --full' },
    { kind: 'do',   t: 'resolving apex.zenship.dev' },
    { kind: 'ok',   t: 'bundling functions   [ok] 38ms' },
    { kind: 'ok',   t: 'deploying edge       [ok] 1.2s' },
    { kind: 'warn', t: 'flushing cache       [skip] --no-cache' },
    { kind: 'gap',  t: '' },
    { kind: 'link', t: 'shipped → https://apex.zenship.dev' },
  ];

  React.useEffect(() => {
    if (step >= lines.length) return;
    const id = setTimeout(() => setStep(s => s + 1), step === 0 ? 500 : 380);
    return () => clearTimeout(id);
  }, [step]);

  function renderLine(l, i) {
    if (l.kind === 'gap')  return <div key={i} className="zs-line">{'\u00A0'}</div>;
    if (l.kind === 'cmd')  return <div key={i} className="zs-line"><span className="zs-acc">$</span> {l.t}</div>;
    if (l.kind === 'link') return <div key={i} className="zs-line zs-line--link">{l.t}</div>;
    const cls = 'zs-line--' + (l.kind === 'ok' ? 'ok' : l.kind === 'warn' ? 'warn' : 'dim');
    return <div key={i} className={'zs-line ' + cls}><span className="zs-acc">→</span> {l.t}</div>;
  }

  const heroStyle = {
    fontSize:      t.heroSize != null          ? t.heroSize + 'px'          : undefined,
    lineHeight:    t.heroLineHeight != null    ? t.heroLineHeight           : undefined,
    letterSpacing: t.heroLetterSpacing != null ? t.heroLetterSpacing + 'px' : undefined,
    textTransform: t.heroUppercase === false   ? 'none'                     : 'uppercase',
  };
  const line1 = t.heroLine1 != null ? t.heroLine1 : 'One command.';
  const line2 = t.heroLine2 != null ? t.heroLine2 : 'Your stuff is in prod';

  return (
    <section className="zs-hero">
      <div className="zs-hero__left">
        <div className="zs-eyebrow">v0.4 · live now</div>
        <h1 className="zs-hero__h1" style={heroStyle}>
          {line1}<br/>
          {line2}<span className="zs-acc">.</span>
        </h1>
        <p className="zs-hero__sub">
          Zenship ships your frontend, backend, and serverless functions to production in
          a single command. No yaml. No build steps. No tutorial.
        </p>
        <div className="zs-hero__ctas">
          <button className="zs-btn zs-btn--primary">
            <span className="zs-acc">$</span> zenship send
          </button>
          <a href="#how" className="zs-btn zs-btn--ghost">read the source <span className="zs-acc">→</span></a>
        </div>
        <div className="zs-hero__meta">
          <span>made by 1 person</span>
          <span>·</span>
          <span>47kb CLI</span>
          <span>·</span>
          <span>no signup to try</span>
        </div>
      </div>
      <div className="zs-hero__right">
        <div className="zs-term">
          <div className="zs-term__bar">
            <span className="zs-term__dot"></span>
            <span className="zs-term__dot"></span>
            <span className="zs-term__dot"></span>
            <span className="zs-term__title">~/projects/apex — zenship send</span>
          </div>
          <pre className="zs-term__body">
{lines.slice(0, step).map((l, i) => renderLine(l, i))}
{step >= lines.length ? <div className="zs-line"><span className="zs-acc">❯ </span><span className="zs-cursor"></span></div> : null}
          </pre>
        </div>
      </div>
    </section>
  );
}

window.Hero = Hero;
