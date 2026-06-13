import type { JSX } from 'react';
import { IconUpload, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import styles from './Sidebar.module.scss';
import { useAppSelector, useAppDispatch } from '../store/reduxHooks';
import { setActiveView } from '../features/navigation/store/navigationSlice';

interface ISidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar = ({
  isCollapsed = false,
  onToggleCollapse,
}: ISidebarProps): JSX.Element => {
  const dispatch = useAppDispatch();
  const activeView = useAppSelector((state) => state.navigation.activeView);

  const handleImportClick = (): void => {
    dispatch(setActiveView('import'));
  };

  return (
    <nav
      className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}
      aria-label="Sidebar navigation"
    >
      <div className={styles.header}>
        {isCollapsed ? (
          <div className={styles.collapsedHeader}>
            <div className={styles.logoOnly}>
              <img src="/logo.svg" width={36} height={36} alt="SoundLens" />
            </div>
            <button
              className={styles.expandButton}
              onClick={onToggleCollapse}
              type="button"
              aria-label="Expand sidebar"
            >
              <IconChevronRight size={16} />
            </button>
          </div>
        ) : (
          <>
            <div className={styles.brand}>
              <img src="/logo.svg" width={32} height={32} alt="" className={styles.brandIcon} />
              <span className={styles.brandName}>SoundLens</span>
            </div>
            <button
              className={styles.collapseButton}
              onClick={onToggleCollapse}
              type="button"
              aria-label="Collapse sidebar"
            >
              <IconChevronLeft size={16} />
            </button>
          </>
        )}
      </div>

      <div className={styles.section}>
        <ul className={styles.menuList}>
          <li>
            <button
              className={`${styles.menuItem} ${activeView === 'import' ? styles.active : ''}`}
              onClick={handleImportClick}
              type="button"
              title="Import"
            >
              <div className={styles.menuItemContent}>
                <div className={styles.icon}>
                  <IconUpload size={20} />
                </div>
                {!isCollapsed && <div className={styles.label}>Import</div>}
              </div>
            </button>
          </li>
        </ul>
      </div>

      <div className={styles.spacer} />
    </nav>
  );
};
