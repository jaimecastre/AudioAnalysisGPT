import type { JSX, ReactNode } from 'react';
import { useState } from 'react';
import { AppShell } from '@mantine/core';
import { TopNav } from '../features/shell/TopNav';
import { initialProjectState, type ProjectState } from '../store/projectState';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps): JSX.Element => {
  const [activeMode, setActiveMode] = useState<'manual' | 'agent'>('manual');
  const [projectState] = useState<ProjectState>(initialProjectState);

  return (
    <AppShell header={{ height: 48 }} padding={0}>
      <AppShell.Header>
        <TopNav
          activeMode={activeMode}
          onModeChange={setActiveMode}
          projectName={projectState.projectName}
          projectStatus={projectState.status}
        />
      </AppShell.Header>
      <AppShell.Main>
        {children}
      </AppShell.Main>
    </AppShell>
  );
}
