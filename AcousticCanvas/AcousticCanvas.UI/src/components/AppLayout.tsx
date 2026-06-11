import type { JSX, ReactNode } from 'react';
import { useState } from 'react';
import { AppShell } from '@mantine/core';
import { TopNav } from '../features/shell/components/TopNav';
import { Sidebar } from './Sidebar';
import { useAppSelector } from '../store/reduxHooks';
import { activeModeSelector } from '../features/navigation/store/navigationSlice';
import { projectNameSelector, projectStatusSelector } from '../features/project/store/projectSlice';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps): JSX.Element => {
  const activeMode = useAppSelector(activeModeSelector);
  const projectName = useAppSelector(projectNameSelector);
  const projectStatus = useAppSelector(projectStatusSelector);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleToggleSidebar = (): void => {
    setIsSidebarCollapsed((previous) => !previous);
  };

  const sidebarWidth = isSidebarCollapsed ? 56 : 200;

  return (
    <AppShell
      header={{ height: 48 }}
      navbar={{ width: sidebarWidth, breakpoint: 'sm' }}
      padding={0}
      styles={{
        header: {
          zIndex: 100,
        },
        navbar: {
          top: 0,
          height: '100vh',
          width: sidebarWidth,
          transition: 'width 0.2s ease',
          zIndex: 200,
        },
        main: {
          paddingLeft: sidebarWidth,
          transition: 'padding-left 0.2s ease',
        },
      }}
    >
      <AppShell.Header>
        <TopNav
          activeMode={activeMode}
          projectName={projectName}
          projectStatus={projectStatus}
          sidebarWidth={sidebarWidth}
        />
      </AppShell.Header>
      <AppShell.Navbar>
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
        />
      </AppShell.Navbar>
      <AppShell.Main>
        {children}
      </AppShell.Main>
    </AppShell>
  );
}
