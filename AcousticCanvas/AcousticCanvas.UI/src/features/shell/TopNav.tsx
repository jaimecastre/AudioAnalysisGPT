import { SegmentedControl } from '@mantine/core';
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
  const modeOptions = [
    { label: 'Manual Analysis', value: 'manual' },
    { label: 'Agent', value: 'agent' },
  ];

  return (
    <SegmentedControl
      value={activeMode}
      onChange={(selectedValue) => onModeChange(selectedValue as ActiveMode)}
      data={modeOptions}
      size="xs"
      aria-label="Workspace mode"
      classNames={{
        root: styles.modeSwitcherRoot,
        indicator: styles.modeSwitcherIndicator,
        label: styles.modeSwitcherLabel,
      }}
    />
  );
}

function TopNavSpacer() {
  return <div className={styles.spacer} aria-hidden="true" />;
}
