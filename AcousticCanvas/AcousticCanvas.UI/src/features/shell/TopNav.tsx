import styles from './TopNav.module.scss';

type ActiveMode = 'manual' | 'agent';

interface TopNavProps {
  activeMode: ActiveMode;
  onModeChange: (selectedMode: ActiveMode) => void;
}

export function TopNav({ activeMode, onModeChange }: TopNavProps) {
  return (
    <nav className={styles.topNav} aria-label="Main navigation">
      <TopNavLogo />
      <TopNavModeSwitcher activeMode={activeMode} onModeChange={onModeChange} />
      <TopNavSpacer />
    </nav>
  );
}

function TopNavLogo() {
  return (
    <div className={styles.logoArea}>
      <img src="/logo.svg" width={28} height={28} alt="AcousticCanvas logo" />
      <span className={styles.logoName}>AcousticCanvas</span>
    </div>
  );
}

interface TopNavModeSwitcherProps {
  activeMode: ActiveMode;
  onModeChange: (selectedMode: ActiveMode) => void;
}

function TopNavModeSwitcher({ activeMode, onModeChange }: TopNavModeSwitcherProps) {
  return (
    <div className={styles.modeSwitcher} role="tablist" aria-label="Workspace mode">
      <button
        role="tab"
        aria-selected={activeMode === 'manual'}
        className={activeMode === 'manual' ? styles.modeButtonActive : styles.modeButton}
        onClick={() => onModeChange('manual')}
      >
        Manual Analysis
      </button>
      <button
        role="tab"
        aria-selected={activeMode === 'agent'}
        className={activeMode === 'agent' ? styles.modeButtonActive : styles.modeButton}
        onClick={() => onModeChange('agent')}
      >
        Agent
      </button>
    </div>
  );
}

function TopNavSpacer() {
  return <div className={styles.spacer} aria-hidden="true" />;
}
