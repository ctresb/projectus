function DeployDetail({ project, onBack }) {
  const deploys = [
    { id: 'a7c91d', status: 'ok',    msg: 'feat: ship pricing v2',          who: 'you',    ago: '4m ago', dur: '1.2s', live: true },
    { id: 'e210f0', status: 'ok',    msg: 'fix: cold start regression',     who: 'you',    ago: '2h ago', dur: '1.4s', live: false },
    { id: '0011aa', status: 'warn',  msg: 'wip: preview deploys',           who: 'you',    ago: '4h ago', dur: '0.9s', live: false },
    { id: '90fa12', status: 'err',   msg: 'try: edge router',               who: 'you',    ago: '1d ago', dur: 'n/a',  live: false },
    { id: '12dd9b', status: 'ok',    msg: 'init',                           who: 'you',    ago: '3d ago', dur: '2.1s', live: false },
  ];

  return (
    <div className="zd-detail">
      <button className="zd-back" onClick={onBack}>
        <span className="zd-acc-dim">←</span> projects
      </button>
      <div className="zd-detail__head">
        <div>
          <div className="zd-eyebrow">project</div>
          <h1 className="zd-h1">{project.name}<span className="zd-acc">.</span></h1>
          <a href="#" className="zd-detail__domain">{project.domain} <span className="zd-acc-dim">↗</span></a>
        </div>
        <div className="zd-detail__stats">
          <div className="zd-stat">
            <div className="zd-stat__n">38<span className="zd-stat__u">ms</span></div>
            <div className="zd-eyebrow">p50 cold</div>
          </div>
          <div className="zd-stat">
            <div className="zd-stat__n">112<span className="zd-stat__u">ms</span></div>
            <div className="zd-eyebrow">p99 cold</div>
          </div>
          <div className="zd-stat">
            <div className="zd-stat__n">3</div>
            <div className="zd-eyebrow">functions</div>
          </div>
          <div className="zd-stat">
            <div className="zd-stat__n">$0<span className="zd-stat__u">.41</span></div>
            <div className="zd-eyebrow">mo. to date</div>
          </div>
        </div>
      </div>

      <div className="zd-detail__grid">
        <section className="zd-deploys">
          <div className="zd-panel__head">
            <div className="zd-eyebrow">deploys · 5 of 47</div>
            <span className="zd-mono zd-dim">$ zenship deploys ls</span>
          </div>
          <ul className="zd-deploy__list">
            {deploys.map(d => (
              <li key={d.id} className={'zd-deploy ' + (d.live ? 'zd-deploy--live' : '')}>
                <span className={'zd-status zd-status--' + d.status}>●</span>
                <div className="zd-deploy__body">
                  <div className="zd-deploy__msg">{d.msg}</div>
                  <div className="zd-deploy__meta">
                    <span className="zd-mono">{d.id}</span>
                    <span>·</span>
                    <span>{d.who}</span>
                    <span>·</span>
                    <span>{d.ago}</span>
                    <span>·</span>
                    <span>{d.dur}</span>
                  </div>
                </div>
                {d.live ? <span className="zd-deploy__tag">LIVE</span> : (
                  <button className="zd-deploy__rb">rollback to this</button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <LogStream />
      </div>
    </div>
  );
}

window.DeployDetail = DeployDetail;
