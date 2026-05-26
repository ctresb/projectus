function FeatureGrid() {
  const items = [
    { glyph: '❯', t: 'MCP server bundled', b: 'Coding agents deploy directly from your editor. No webhooks. No PATs to rotate.' },
    { glyph: '↘', t: 'Cold start: 38ms', b: 'Honest number. Measured at the edge, p50. We publish the p99 in the changelog.' },
    { glyph: '┌', t: 'Roll back in one keystroke', b: 'zenship rollback. Pins the previous release. No "are you sure" modal.' },
    { glyph: '$', t: 'No yaml', b: 'Configuration is a single zenship.config file or none at all. Reads your package.json.' },
    { glyph: '→', t: 'Tail logs from the terminal', b: 'zenship tail apex --since 5m. Local grep, no web UI required.' },
    { glyph: '█', t: 'Cheap', b: '$0 for solo. $12/mo if you want the team stuff. Nothing in between.' },
  ];

  return (
    <section className="zs-features">
      <div className="zs-section__head">
        <div className="zs-eyebrow">six things</div>
        <h2 className="zs-section__h">Things we did, things we didn't.</h2>
      </div>
      <ul className="zs-feat__grid">
        {items.map((f, i) => (
          <li key={i} className="zs-feat">
            <div className="zs-feat__glyph">{f.glyph}</div>
            <h3 className="zs-feat__t">{f.t}</h3>
            <p className="zs-feat__b">{f.b}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

window.FeatureGrid = FeatureGrid;
