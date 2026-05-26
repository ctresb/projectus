function LogStream() {
  const seed = [
    { ts: '14:02:18', lvl: 'info', src: 'edge.us-east-1', msg: 'request GET / 200 38ms' },
    { ts: '14:02:18', lvl: 'info', src: 'fn.api',         msg: '/api/health 200 6ms' },
    { ts: '14:02:19', lvl: 'info', src: 'edge.us-east-1', msg: 'request GET /pricing 200 42ms' },
    { ts: '14:02:20', lvl: 'warn', src: 'fn.api',         msg: 'rate-limit near (84/100) ip=192.0.2.14' },
    { ts: '14:02:21', lvl: 'info', src: 'edge.us-east-1', msg: 'cache hit /static/app.css' },
    { ts: '14:02:23', lvl: 'err',  src: 'fn.pay',         msg: 'stripe webhook 401: rotated key not synced' },
    { ts: '14:02:24', lvl: 'info', src: 'edge.us-east-1', msg: 'request GET /docs 200 51ms' },
  ];
  const [lines, setLines] = React.useState(seed);

  React.useEffect(() => {
    const id = setInterval(() => {
      const t = new Date();
      const ts = t.toTimeString().slice(0,8);
      const choices = [
        { lvl: 'info', src: 'edge.us-east-1', msg: 'request GET / 200 ' + (30 + Math.floor(Math.random()*40)) + 'ms' },
        { lvl: 'info', src: 'fn.api',         msg: '/api/health 200 ' + (4 + Math.floor(Math.random()*8)) + 'ms' },
        { lvl: 'info', src: 'edge.us-east-1', msg: 'cache hit /static/' + ['app','vendor','fonts'][Math.floor(Math.random()*3)] + '.css' },
      ];
      const next = { ts, ...choices[Math.floor(Math.random()*choices.length)] };
      setLines(l => [...l.slice(-40), next]);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="zd-logs">
      <div className="zd-panel__head">
        <div className="zd-eyebrow"><span className="zd-status zd-status--ok">●</span> tail · live</div>
        <span className="zd-mono zd-dim">$ zenship tail apex</span>
      </div>
      <div className="zd-log__body">
        {lines.map((l, i) => (
          <div key={i} className={'zd-log__line zd-log__line--' + l.lvl}>
            <span className="zd-log__ts">{l.ts}</span>
            <span className="zd-log__src">{l.src.padEnd(16, ' ')}</span>
            <span className={'zd-log__lvl zd-log__lvl--' + l.lvl}>[{l.lvl}]</span>
            <span className="zd-log__msg">{l.msg}</span>
          </div>
        ))}
        <div className="zd-log__line zd-log__cursor">
          <span className="zd-cursor"></span>
        </div>
      </div>
    </section>
  );
}

window.LogStream = LogStream;
