import { useState } from 'react';
import { AppShell } from '@mantine/core';
import { TopNav } from '../features/shell/TopNav';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [activeMode, setActiveMode] = useState<'manual' | 'agent'>('manual');

  return (
    <AppShell header={{ height: 48 }} padding={0}>
      <AppShell.Header>
        <TopNav activeMode={activeMode} onModeChange={setActiveMode} />
      </AppShell.Header>
      <AppShell.Main>
        {children}
      </AppShell.Main>
    </AppShell>
  );
}
