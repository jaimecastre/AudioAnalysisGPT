import type { JSX } from 'react';
import { IconBug, IconChartLine, IconSparkles } from '@tabler/icons-react';
import styles from './InvestigationStartPrompt.module.scss';

interface IInvestigationStartPromptProps {
  onOpenFindings: () => void;
  onAddSpectrum: () => void;
  onAddSoundQuality: () => void;
}

interface IStartTile {
  icon: JSX.Element;
  label: string;
  description: string;
  onClick: () => void;
  accentClass: string;
}

export function InvestigationStartPrompt({
  onOpenFindings,
  onAddSpectrum,
  onAddSoundQuality,
}: IInvestigationStartPromptProps): JSX.Element {
  const tiles: IStartTile[] = [
    {
      icon: <IconBug size={22} />,
      label: 'Detect findings',
      description: 'Scan for clipping, silence, tonal peaks, and DC offset',
      onClick: onOpenFindings,
      accentClass: styles.tileOrange,
    },
    {
      icon: <IconChartLine size={22} />,
      label: 'Spectrum analysis',
      description: 'Inspect frequency content and dominant peaks',
      onClick: onAddSpectrum,
      accentClass: styles.tileTeal,
    },
    {
      icon: <IconSparkles size={22} />,
      label: 'Sound quality',
      description: 'Measure loudness, sharpness, and roughness',
      onClick: onAddSoundQuality,
      accentClass: styles.tilePurple,
    },
  ];

  return (
    <div className={styles.promptWrapper}>
      <p className={styles.promptHeadline}>Where would you like to start?</p>
      <div className={styles.tileRow}>
        {tiles.map((tile) => (
          <button
            key={tile.label}
            type="button"
            className={`${styles.tile} ${tile.accentClass}`}
            onClick={tile.onClick}
            aria-label={tile.label}
          >
            <span className={styles.tileIcon}>{tile.icon}</span>
            <span className={styles.tileLabel}>{tile.label}</span>
            <span className={styles.tileDescription}>{tile.description}</span>
          </button>
        ))}
      </div>
      <p className={styles.promptHint}>Or open a tool from the sidebar →</p>
    </div>
  );
}
