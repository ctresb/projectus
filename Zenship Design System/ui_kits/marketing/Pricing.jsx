function Pricing() {
  // Per-tier quantitative stats (always present, just different value)
  const tiers = [
    {
      name: 'dev',
      price: '$7',
      sub: 'per month',
      tagline: 'for solo devs shipping side projects.',
      stats: ['unlimited projects', '2 regions', '10GB egress / mo'],
      cta: 'start dev',
      featured: false,
    },
    {
      name: 'live',
      price: '$29',
      sub: 'per month',
      tagline: 'for indie hackers running multiple products.',
      stats: ['unlimited projects', 'all regions', '100GB egress / mo'],
      cta: 'start live',
      featured: true,
    },
    {
      name: 'prod',
      price: '$149',
      sub: 'per month',
      tagline: 'for teams running real production workloads.',
      stats: ['unlimited projects', 'all regions', '1TB egress / mo'],
      cta: 'start prod',
      featured: false,
    },
  ];

  // Binary feature list — shown on every card, ✕ + strikethrough when not included
  // Indices align: [dev, live, prod]
  const binary = [
    { label: 'preview deploys on every push', has: [true,  true,  true ] },
    { label: 'custom domains, unlimited',     has: [true,  true,  true ] },
    { label: 'always-on functions',           has: [false, true,  true ] },
    { label: 'email when we feel like it',    has: [false, true,  true ] },
    { label: 'staging environments',          has: [false, false, true ] },
    { label: 'audit log + SSO',               has: [false, false, true ] },
    { label: 'SLA on the bits we control',    has: [false, false, true ] },
    { label: 'a real human in the loop',      has: [false, false, true ] },
  ];

  return (
    <section id="pricing" className="zs-pricing">
      <div className="zs-section__head">
        <div className="zs-eyebrow">pricing</div>
        <h2 className="zs-section__h">Three prices. No "contact sales."</h2>
      </div>
      <div className="zs-tiers zs-tiers--3">
        {tiers.map((t, ti) => (
          <div key={t.name} className={'zs-tier' + (t.featured ? ' zs-tier--featured' : '')}>
            <div className="zs-tier__head">
              <div className="zs-tier__name">{t.name}</div>
              {t.featured ? <div className="zs-tier__tag">recommended</div> : null}
            </div>
            <div className="zs-tier__price">
              <span className="zs-tier__amount">{t.price}</span>
              <span className="zs-tier__sub">{t.sub}</span>
            </div>
            <div className="zs-tier__tagline">{t.tagline}</div>

            <ul className="zs-tier__bullets">
              {t.stats.map(s => (
                <li key={s}><span className="zs-acc-dim">→</span> {s}</li>
              ))}
            </ul>

            <div className="zs-tier__sep"></div>

            <ul className="zs-tier__bullets zs-tier__bullets--binary">
              {binary.map(b => (
                <li key={b.label} className={b.has[ti] ? 'zs-bin zs-bin--on' : 'zs-bin zs-bin--off'}>
                  <span className="zs-bin__mark">{b.has[ti] ? '→' : '✕'}</span>
                  <span className="zs-bin__label">{b.label}</span>
                </li>
              ))}
            </ul>

            <button className={'zs-btn ' + (t.featured ? 'zs-btn--primary' : 'zs-btn--secondary')}>
              <span className="zs-acc">$</span> {t.cta}
            </button>
          </div>
        ))}
      </div>
      <div className="zs-pricing__foot">
        <span className="zs-acc-dim">→</span> need more egress, or self-hosting? email <a href="mailto:hi@zenship.dev">hi@zenship.dev</a>. we'll figure it out.
      </div>
    </section>
  );
}

window.Pricing = Pricing;
