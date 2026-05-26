const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "heroLine1": "One command.",
  "heroLine2": "Your stuff is in prod",
  "heroSize": 40,
  "heroLineHeight": 1.65,
  "heroLetterSpacing": -0.8,
  "heroUppercase": true
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [theme, setTheme] = React.useState(() => {
    try { return localStorage.getItem('zs-theme') || 'dark'; }
    catch { return 'dark'; }
  });

  React.useEffect(() => {
    try { localStorage.setItem('zs-theme', theme); } catch {}
  }, [theme]);

  function toggle() {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  }

  return (
    <div className="zs-page" data-theme={theme}>
      <Nav theme={theme} onToggleTheme={toggle} />
      <main>
        <Hero tweaks={t} />
        <HowItWorks />
        <FeatureGrid />
        <Philosophy />
        <Pricing />
      </main>
      <Footer theme={theme} />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Hero copy" />
        <TweakText label="Line 1" value={t.heroLine1}
                   onChange={(v) => setTweak('heroLine1', v)} />
        <TweakText label="Line 2" value={t.heroLine2}
                   onChange={(v) => setTweak('heroLine2', v)} />

        <TweakSection label="Hero type" />
        <TweakSlider label="Font size" value={t.heroSize}
                     min={40} max={180} step={1} unit="px"
                     onChange={(v) => setTweak('heroSize', v)} />
        <TweakSlider label="Line height" value={t.heroLineHeight}
                     min={0.85} max={1.8} step={0.05}
                     onChange={(v) => setTweak('heroLineHeight', v)} />
        <TweakSlider label="Letter spacing" value={t.heroLetterSpacing}
                     min={-2} max={6} step={0.1} unit="px"
                     onChange={(v) => setTweak('heroLetterSpacing', v)} />
        <TweakToggle label="Uppercase (brand face requires it)"
                     value={t.heroUppercase}
                     onChange={(v) => setTweak('heroUppercase', v)} />
      </TweaksPanel>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
