import type { JSX, KeyboardEvent } from 'react';
import { useState } from 'react';
import { SegmentedControl, TextInput, Tooltip } from '@mantine/core';
import { IconPencil } from '@tabler/icons-react';
import styles from './TopNav.module.scss';
import type { ActiveMode, ProjectStatus } from '../../../store/projectState';
import { useAppDispatch } from '../../../store/reduxHooks';
import { setActiveMode } from '../../navigation/store/navigationSlice';
import { setProjectName } from '../../project/store/projectSlice';

interface ITopNavProps {
  activeMode: ActiveMode;
  projectName: string;
  projectStatus: ProjectStatus;
  sidebarWidth?: number;
}

export const TopNav = ({ activeMode, projectName, projectStatus, sidebarWidth = 200 }: ITopNavProps): JSX.Element => {
  const dispatch = useAppDispatch();

  const handleModeChange = (selectedMode: ActiveMode): void => {
    dispatch(setActiveMode(selectedMode));
  };
  return (
    <nav
      className={styles.topNav}
      aria-label="Main navigation"
      style={{ marginLeft: sidebarWidth }}
    >
      <TopNavModeSwitcher activeMode={activeMode} onModeChange={handleModeChange} />
      <TopNavSpacer />
      <TopNavProjectName projectName={projectName} />
      <TopNavStatus projectStatus={projectStatus} />
    </nav>
  );
}

interface ITopNavModeSwitcherProps {
  activeMode: ActiveMode;
  onModeChange: (selectedMode: ActiveMode) => void;
}

const TopNavModeSwitcher = ({ activeMode, onModeChange }: ITopNavModeSwitcherProps): JSX.Element => {
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

interface ITopNavProjectNameProps {
  projectName: string;
}

const TopNavProjectName = ({ projectName }: ITopNavProjectNameProps): JSX.Element => {
  const dispatch = useAppDispatch();
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(projectName);

  const startEditing = (): void => {
    setDraftName(projectName);
    setIsEditing(true);
  };

  const commitEditing = (): void => {
    const trimmedName = draftName.trim();
    if (trimmedName.length > 0 && trimmedName !== projectName) {
      dispatch(setProjectName(trimmedName));
    }
    setIsEditing(false);
  };

  const cancelEditing = (): void => {
    setIsEditing(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      commitEditing();
    } else if (event.key === 'Escape') {
      cancelEditing();
    }
  };

  if (isEditing) {
    return (
      <TextInput
        size="xs"
        value={draftName}
        onChange={(event) => setDraftName(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
        onBlur={commitEditing}
        aria-label="Project name"
        autoFocus
      />
    );
  }

  return (
    <Tooltip label="Rename project" withArrow position="bottom">
      <button
        type="button"
        className={styles.projectName}
        onClick={startEditing}
        aria-label={`Project name: ${projectName}. Click to rename.`}
      >
        {projectName}
        <IconPencil size={12} className={styles.projectNameEditIcon} />
      </button>
    </Tooltip>
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

interface ITopNavStatusProps {
  projectStatus: ProjectStatus;
}

const TopNavStatus = ({ projectStatus }: ITopNavStatusProps): JSX.Element => {
  const statusLabel = statusLabelMap[projectStatus];
  const statusStyleKey = statusStyleMap[projectStatus] as keyof typeof styles;

  return (
    <span className={styles[statusStyleKey]} aria-label="Project status">
      {statusLabel}
    </span>
  );
}
