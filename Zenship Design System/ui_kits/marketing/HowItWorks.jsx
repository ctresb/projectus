function HowItWorks() {
  const steps = [
    {
      n: '01',
      h: 'Install one binary.',
      body: 'No daemon. No background process. No telemetry on by default.',
      code: '$ npm i -g zenship',
    },
    {
      n: '02',
      h: 'Point it at a folder.',
      body: 'Zenship reads your package.json, your framework, your routes. It guesses right.',
      code: '$ cd apex && zenship init',
    },
    {
      n: '03',
      h: 'Ship.',
      body: 'Frontend, backend, and serverless functions go live in one round-trip.',
      code: '$ zenship send --prod',
    },
  ];

  return (
    <section id="how" className="zs-how">
      <div className="zs-section__head">
        <div className="zs-eyebrow">how</div>
        <h2 className="zs-section__h">Three commands. That's the product.</h2>
      </div>
      <ol className="zs-steps">
        {steps.map(s => (
          <li key={s.n} className="zs-step">
            <div className="zs-step__n">{s.n}</div>
            <h3 className="zs-step__h">{s.h}</h3>
            <p className="zs-step__body">{s.body}</p>
            <div className="zs-step__code">
              <span className="zs-acc">{s.code.slice(0,1)}</span>
              <span>{s.code.slice(1)}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

window.HowItWorks = HowItWorks;
