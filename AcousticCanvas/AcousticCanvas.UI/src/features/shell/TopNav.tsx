import type { JSX } from 'react';
import { SegmentedControl } from '@mantine/core';
import styles from './TopNav.module.scss';
import type { ProjectStatus } from '../../store/projectState';

type ActiveMode = 'manual' | 'agent';

interface TopNavProps {
  activeMode: ActiveMode;
  onModeChange: (selectedMode: ActiveMode) => void;
  projectName: string | null;
  projectStatus: ProjectStatus;
}

export const TopNav = ({ activeMode, onModeChange, projectName, projectStatus }: TopNavProps): JSX.Element => {
  return (
    <nav className={styles.topNav} aria-label="Main navigation">
      <TopNavLogo />
      <TopNavModeSwitcher activeMode={activeMode} onModeChange={onModeChange} />
      <TopNavSpacer />
      <TopNavProjectName projectName={projectName} />
      <TopNavStatus projectStatus={projectStatus} />
    </nav>
  );
}

const TopNavLogo = (): JSX.Element => {
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

const TopNavModeSwitcher = ({ activeMode, onModeChange }: TopNavModeSwitcherProps): JSX.Element => {
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

const TopNavSpacer = (): JSX.Element => {
  return <div className={styles.spacer} aria-hidden="true" />;
}

interface TopNavProjectNameProps {
  projectName: string | null;
}

const TopNavProjectName = ({ projectName }: TopNavProjectNameProps): JSX.Element => {
  const displayName = projectName ?? 'Untitled Project';
  const isPlaceholder = projectName === null;

  return (
    <span
      className={isPlaceholder ? styles.projectNamePlaceholder : styles.projectName}
      aria-label="Project name"
    >
      {displayName}
    </span>
  );
}

const statusLabelMap: Record<ProjectStatus, string> = {
  'no-project': 'No project loaded',
  'ready': 'Ready',
  'loading': 'Loading…',
  'error': 'Error',
};

const statusStyleMap: Record<ProjectStatus, string> = {
  'no-project': 'statusMuted',
  'ready': 'statusReady',
  'loading': 'statusLoading',
  'error': 'statusError',
};

interface TopNavStatusProps {
  projectStatus: ProjectStatus;
}

const TopNavStatus = ({ projectStatus }: TopNavStatusProps): JSX.Element => {
  const statusLabel = statusLabelMap[projectStatus];
  const statusStyleKey = statusStyleMap[projectStatus] as keyof typeof styles;

  return (
    <span className={styles[statusStyleKey]} aria-label="Project status">
      {statusLabel}
    </span>
  );
}
