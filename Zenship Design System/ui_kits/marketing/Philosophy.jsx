function Philosophy() {
  return (
    <section className="zs-philo">
      <div className="zs-philo__head">
        <div className="zs-eyebrow">how we price</div>
        <div className="zs-philo__file">pricing.config</div>
      </div>

      <div className="zs-philo__grid">
        <ol className="zs-philo__nos">
          <li>
            <span className="zs-philo__n">01</span>
            <span className="zs-philo__no">No</span>
            <span className="zs-philo__what">free tier.</span>
          </li>
          <li>
            <span className="zs-philo__n">02</span>
            <span className="zs-philo__no">No</span>
            <span className="zs-philo__what">enterprise theater.</span>
          </li>
          <li>
            <span className="zs-philo__n">03</span>
            <span className="zs-philo__no">No</span>
            <span className="zs-philo__what">"contact sales."</span>
          </li>
        </ol>

        <aside className="zs-philo__yes">
          <div className="zs-eyebrow zs-philo__yes-eb">what we do</div>
          <p>
            We charge what it costs to run, plus enough to keep building<span className="zs-acc">.</span>
          </p>
        </aside>
      </div>

      <div className="zs-philo__kicker">
        <span className="zs-acc-dim">→</span>
        <span>Fair price.</span>
        <span>Real product.</span>
        <span>That's it.</span>
      </div>
    </section>
  );
}

window.Philosophy = Philosophy;
