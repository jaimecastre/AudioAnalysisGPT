import { useState } from 'react';
import styles from './AppLayout.module.scss';
import { TopNav } from '../features/shell/TopNav';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [activeMode, setActiveMode] = useState<'manual' | 'agent'>('manual');

  return (
    <div className={styles.appLayout}>
      <TopNav activeMode={activeMode} onModeChange={setActiveMode} />
      <main className={styles.mainContent}>
        {children}
      </main>
    </div>
  );
}
