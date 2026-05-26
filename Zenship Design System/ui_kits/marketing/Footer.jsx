function Footer({ theme }) {
  const logoSrc = theme === 'dark' ? '../../assets/logo-paper.svg' : '../../assets/logo-ink.svg';
  return (
    <footer className="zs-footer">
      <div className="zs-footer__top">
        <a href="#" className="zs-footer__brand">
          <img src={logoSrc} alt="Zenship" />
        </a>
        <div className="zs-footer__cols">
          <div className="zs-footer__col">
            <div className="zs-eyebrow">product</div>
            <a href="#">cli</a>
            <a href="#">mcp server</a>
            <a href="#">dashboard</a>
            <a href="#">changelog</a>
          </div>
          <div className="zs-footer__col">
            <div className="zs-eyebrow">docs</div>
            <a href="#">getting started</a>
            <a href="#">deploy a function</a>
            <a href="#">env vars</a>
            <a href="#">api reference</a>
          </div>
          <div className="zs-footer__col">
            <div className="zs-eyebrow">elsewhere</div>
            <a href="#">github</a>
            <a href="#">@zenshipdev</a>
            <a href="#">status</a>
            <a href="#">rss</a>
          </div>
        </div>
      </div>
      <div className="zs-footer__bottom">
        <span>© 2026 zenship · made by 1 person</span>
        <span>v0.4.2 · built {new Date().toISOString().slice(0,10)}</span>
      </div>
    </footer>
  );
}

window.Footer = Footer;
