import type { JSX } from 'react';

export const AppLogo = (): JSX.Element => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
      <AppLogoIcon />
      <AppLogoText />
    </div>
  );
}

const AppLogoIcon = (): JSX.Element => {
  return (
    <img
      src="/logo.svg"
      width={80}
      height={80}
      alt="SoundLens logo icon"
    />
  );
}

const AppLogoText = (): JSX.Element => {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 600,
          fontSize: '1.25rem',
          letterSpacing: '0.04em',
          color: 'white',
        }}
      >
        SoundLens
      </div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 400,
          fontSize: '0.65rem',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.35)',
          marginTop: '4px',
        }}
      >
        Audio Analysis
      </div>
    </div>
  );
}
