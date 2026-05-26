function Composer({ open, onClose }) {
  const [history, setHistory] = React.useState([]);
  const [input, setInput] = React.useState('');
  const ref = React.useRef(null);
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    if (open) {
      setTimeout(() => ref.current?.focus(), 60);
    }
  }, [open]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: 99999 });
  }, [history]);

  function run(cmd) {
    const c = cmd.trim();
    if (!c) return;
    const out = [{ kind: 'cmd', t: c }];
    if (c === 'help' || c === '?' || c === 'zenship' || c === 'zen') {
      out.push({ kind: 'dim', t: 'commands:' });
      out.push({ kind: 'dim', t: '  zenship send          deploy current folder to prod' });
      out.push({ kind: 'dim', t: '  zenship ls            list projects' });
      out.push({ kind: 'dim', t: '  zenship tail <name>   tail logs' });
      out.push({ kind: 'dim', t: '  zenship rollback      pin previous release' });
      out.push({ kind: 'dim', t: '  clear             clear screen' });
    } else if (c === 'clear') {
      setHistory([]); setInput(''); return;
    } else if (c === 'zenship ls') {
      out.push({ kind: 'ok',  t: '  apex            ● live    38ms    4m ago' });
      out.push({ kind: 'ok',  t: '  blog            ● live    52ms    2d ago' });
      out.push({ kind: 'warn',t: '  apex-staging    ● build   ----    14s ago' });
      out.push({ kind: 'err', t: '  pay-fn          ● err     ----    just now' });
    } else if (c.startsWith('zenship send')) {
      out.push({ kind: 'dim', t: '→ resolving apex.zenship.dev' });
      out.push({ kind: 'ok',  t: '→ bundling functions   [ok] 38ms' });
      out.push({ kind: 'ok',  t: '→ deploying edge       [ok] 1.2s' });
      out.push({ kind: 'warn',t: '→ flushing cache       [skip]' });
      out.push({ kind: 'link',t: 'shipped → https://apex.zenship.dev' });
    } else if (c.startsWith('zenship tail')) {
      out.push({ kind: 'dim',  t: '14:02:18  edge.us-east-1   [info]  GET / 200 38ms' });
      out.push({ kind: 'dim',  t: '14:02:19  fn.api           [info]  /api/health 200 6ms' });
      out.push({ kind: 'warn', t: '14:02:20  fn.api           [warn]  rate-limit near (84/100)' });
      out.push({ kind: 'err',  t: '14:02:23  fn.pay           [err]   stripe webhook 401' });
      out.push({ kind: 'dim',  t: '...' });
    } else if (c.startsWith('zenship rollback')) {
      out.push({ kind: 'dim', t: '→ pinning previous release e210f0' });
      out.push({ kind: 'ok',  t: '→ done. apex now serves e210f0' });
    } else {
      out.push({ kind: 'err', t: 'unknown: ' + c });
      out.push({ kind: 'dim', t: 'try: help' });
    }
    setHistory(h => [...h, ...out]);
    setInput('');
  }

  function onKey(e) {
    if (e.key === 'Enter')  { e.preventDefault(); run(input); }
    if (e.key === 'Escape') { onClose(); }
  }

  if (!open) return null;
  return (
    <div className="zd-composer" onClick={onClose}>
      <div className="zd-composer__win" onClick={e => e.stopPropagation()}>
        <div className="zd-composer__bar">
          <span className="zd-term__dot"></span>
          <span className="zd-term__dot"></span>
          <span className="zd-term__dot"></span>
          <span className="zd-composer__title">command palette · esc to close</span>
        </div>
        <div className="zd-composer__body" ref={scrollRef}>
          <div className="zd-log__line zd-log__line--info">
            <span className="zd-acc">→</span> hit enter. type <span className="zd-mono">help</span> if you're stuck.
          </div>
          {history.map((l, i) => {
            if (l.kind === 'cmd') return (
              <div key={i} className="zd-log__line"><span className="zd-acc">❯</span> {l.t}</div>
            );
            return <div key={i} className={'zd-log__line zd-log__line--' + l.kind}>{l.t}</div>;
          })}
          <div className="zd-composer__input">
            <span className="zd-acc">❯</span>
            <input
              ref={ref}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              autoFocus
              spellCheck={false}
              autoComplete="off"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

window.Composer = Composer;
