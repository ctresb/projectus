function App() {
  const [view, setView] = React.useState('projects');
  const [openId, setOpenId] = React.useState(null);
  const [kOpen, setKOpen] = React.useState(false);

  const projects = [
    { id: 'apex',         name: 'apex',         domain: 'apex.zenship.dev',         status: 'ok',   statusLabel: 'live',  latency: '38ms', ago: '4m ago',  commit: 'a7c91d · main' },
    { id: 'apex-staging', name: 'apex-staging', domain: 'staging.apex.zenship.dev', status: 'warn', statusLabel: 'build', latency: '----', ago: '14s ago', commit: 'b81012 · dev' },
    { id: 'blog',         name: 'blog',         domain: 'notes.zenship.dev',        status: 'ok',   statusLabel: 'live',  latency: '52ms', ago: '2d ago',  commit: '0c2f44 · main' },
    { id: 'pay-fn',       name: 'pay-fn',       domain: 'fn-pay.zenship.dev',       status: 'err',  statusLabel: 'fail',  latency: '----', ago: 'just now',commit: '11ccd0 · main' },
  ];
  const open = projects.find(p => p.id === openId);

  React.useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setKOpen(o => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Render the shell + inject children into its <main>
  return (
    <ZdShell
      active={view}
      onNav={(v) => { setView(v); setOpenId(null); }}
      onOpenK={() => setKOpen(true)}
      project={open ? open.name : null}
    >
      {open
        ? <DeployDetail project={open} onBack={() => setOpenId(null)} />
        : <ProjectList projects={projects} onOpen={(id) => setOpenId(id)} />}
      <Composer open={kOpen} onClose={() => setKOpen(false)} />
    </ZdShell>
  );
}

// Shell rewritten to accept children
function ZdShell({ children, active, onNav, onOpenK, project }) {
  const nav = [
    { id: 'projects', label: 'projects' },
    { id: 'logs', label: 'logs' },
    { id: 'env', label: 'env' },
    { id: 'billing', label: 'billing' },
  ];
  return (
    <div className="zd-shell">
      <header className="zd-top">
        <a href="#" className="zd-brand">
          <img src="../../assets/logo-paper.svg" alt="Zenship" className="zd-brand__logo" />
        </a>
        <div className="zd-crumbs">
          <span>you</span>
          <span className="zd-sep">/</span>
          <span>{project || 'projects'}</span>
        </div>
        <button className="zd-k" onClick={onOpenK}>
          <span className="zd-acc">$</span> command
          <kbd>⌘K</kbd>
        </button>
        <div className="zd-user">
          <span className="zd-user__dot"></span>
          <span>you@local</span>
        </div>
      </header>
      <div className="zd-body">
        <nav className="zd-rail">
          <ul>
            {nav.map(n => (
              <li key={n.id}>
                <button
                  className={active === n.id ? 'zd-rail__btn zd-rail__btn--active' : 'zd-rail__btn'}
                  onClick={() => onNav(n.id)}
                >
                  <span className="zd-acc-dim">{active === n.id ? '❯' : ' '}</span> {n.label}
                </button>
              </li>
            ))}
          </ul>
          <div className="zd-rail__foot">
            <div className="zd-eyebrow">region</div>
            <div className="zd-rail__region">us-east-1 <span className="zd-status zd-status--ok">●</span></div>
            <div className="zd-eyebrow" style={{marginTop: '16px'}}>plan</div>
            <div className="zd-rail__plan">team · $12/mo</div>
            <div className="zd-rail__hint">
              hit <kbd>⌘K</kbd> anywhere
            </div>
          </div>
        </nav>
        <main className="zd-main">{children}</main>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
