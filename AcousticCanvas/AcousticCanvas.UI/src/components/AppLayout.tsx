import styles from './AppLayout.module.scss';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className={styles.appLayout}>
      {children}
    </div>
  );
}
