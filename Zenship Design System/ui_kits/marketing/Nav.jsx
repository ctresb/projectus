function Nav({ theme, onToggleTheme }) {
  // Logo name = its own color. Use paper-colored logo on the dark page,
  // ink-colored logo on the light page.
  const logo = theme === 'dark' ? '../../assets/logo-paper.svg' : '../../assets/logo-ink.svg';
  return (
    <nav className="zs-nav">
      <a href="#" className="zs-nav__brand" aria-label="Zenship">
        <img src={logo} alt="Zenship" className="zs-nav__logo" />
      </a>
      <ul className="zs-nav__links">
        <li><a href="#how">how</a></li>
        <li><a href="#pricing">pricing</a></li>
        <li><a href="#docs">docs</a></li>
        <li><a href="#changelog">changelog</a></li>
      </ul>
      <div className="zs-nav__right">
        <button
          className="zs-theme"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'switch to light mode' : 'switch to dark mode'}
          aria-label="toggle theme"
        >
          <span className={theme === 'light' ? 'zs-theme__on' : ''}>light</span>
          <span className="zs-theme__sep">/</span>
          <span className={theme === 'dark' ? 'zs-theme__on' : ''}>dark</span>
        </button>
        <a href="#" className="zs-nav__signin">sign in</a>
        <button className="zs-nav__cta" onClick={() => navigator.clipboard?.writeText('npm i -g zenship')}>
          <span className="zs-acc">$</span> npm i -g zenship
        </button>
      </div>
    </nav>
  );
}

window.Nav = Nav;
