function ProjectList({ projects, onOpen }) {
  return (
    <div className="zd-projects">
      <div className="zd-section__head">
        <div>
          <div className="zd-eyebrow">deployments · 4 projects</div>
          <h1 className="zd-h1">Your stuff.</h1>
        </div>
        <div className="zd-section__cmd">
          <span className="zd-acc">$</span> zenship ls
        </div>
      </div>
      <div className="zd-table">
        <div className="zd-table__head">
          <div>project</div>
          <div>status</div>
          <div>latency</div>
          <div>last deploy</div>
          <div>commit</div>
          <div></div>
        </div>
        {projects.map(p => (
          <button key={p.id} className="zd-table__row" onClick={() => onOpen(p.id)}>
            <div className="zd-table__name">
              {p.name}
              <span className="zd-table__sub">{p.domain}</span>
            </div>
            <div>
              <span className={'zd-status zd-status--' + p.status}>●</span>
              <span className="zd-table__statusLabel">{p.statusLabel}</span>
            </div>
            <div className="zd-mono">{p.latency}</div>
            <div className="zd-mono zd-dim">{p.ago}</div>
            <div className="zd-mono zd-dim">{p.commit}</div>
            <div className="zd-table__arrow">→</div>
          </button>
        ))}
      </div>
      <div className="zd-empty-hint">
        <span className="zd-acc-dim">→</span> new project? <span className="zd-mono">cd</span> into a folder and run <span className="zd-mono">zenship init</span>.
      </div>
    </div>
  );
}

window.ProjectList = ProjectList;
