import type { JSX } from 'react';
import { useState } from 'react';
import { useAppDispatch } from '../../../store/reduxHooks';
import { agentPromptPrefillSet, setActiveMode } from '../../navigation/store/navigationSlice';
import type { CompareResult, CompareFileSummary, PairwiseDiff, CompareBandEnergy, CompareCpbBand, CompareSoundQuality, CompareSoundQualityDelta } from '../../agent/types/agentToolTypes';
import { ComparisonSpectrumCanvas } from './ComparisonSpectrumCanvas';
import { buildSoundQualityRows, getSoundQualityUnavailableMessage } from '../utils/soundQualityComparisonRows';
import styles from './ComparisonView.module.scss';

interface IComparisonViewProps {
  result: CompareResult;
}


function formatDb(value: number): string {
  if (!isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)} dB`;
}

function formatDeltaDb(value: number): string {
  if (!isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)} dB`;
}

function formatNullableDb(value: number | null): string {
  if (value === null || !isFinite(value)) return '—';
  return `${value.toFixed(1)} dB`;
}

interface ISoundQualityTableProps {
  sqA: CompareSoundQuality;
  sqB: CompareSoundQuality;
  delta: CompareSoundQualityDelta;
  fileIdA: string;
  fileIdB: string;
  labelA: string;
  labelB: string;
}

function SoundQualityTable({ sqA, sqB, delta, fileIdA, fileIdB, labelA, labelB }: ISoundQualityTableProps): JSX.Element {
  const rows = buildSoundQualityRows({
    soundQualityA: sqA,
    soundQualityB: sqB,
    soundQualityDelta: delta,
    fileIdA,
    fileIdB,
    labelA,
    labelB,
  });

  return (
    <table className={styles.metricsTable}>
      <thead>
        <tr>
          <th className={styles.tableHeadLabel}>Metric</th>
          <th className={styles.tableHeadLabel}>Unit</th>
          <th className={styles.tableHeadA}>{labelA}</th>
          <th className={styles.tableHeadB}>{labelB}</th>
          <th className={styles.tableHeadDelta}>Δ (B − A)</th>
          <th className={styles.tableHeadWinner}>Higher</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const sign = row.delta > 0 ? '+' : '';
          const deltaFormatted = `${sign}${row.delta.toFixed(3)}`;
          const isPositiveDelta = row.delta > 0;
          const isNegativeDelta = row.delta < 0;

          return (
            <tr key={row.label} className={styles.tableRow}>
              <td className={styles.tableLabel}>{row.label}</td>
              <td className={styles.tableMeta}>{row.unit}</td>
              <td className={styles.tableValueA}>{row.valueA}</td>
              <td className={styles.tableValueB}>{row.valueB}</td>
              <td className={`${styles.tableDelta} ${isPositiveDelta ? styles.deltaPositive : ''} ${isNegativeDelta ? styles.deltaNegative : ''}`}>
                {deltaFormatted}
              </td>
              <td className={styles.tableWinner}>{row.higherLabel}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

interface ILevelMetricsTableProps {
  fileA: CompareFileSummary;
  fileB: CompareFileSummary;
  diff: PairwiseDiff;
  labelA: string;
  labelB: string;
}

function LevelMetricsTable({ fileA, fileB, diff, labelA, labelB }: ILevelMetricsTableProps): JSX.Element {
  const rows = [
    {
      label: 'Peak',
      valueA: `${fileA.peakDb.toFixed(2)} dBFS`,
      valueB: `${fileB.peakDb.toFixed(2)} dBFS`,
      delta: diff.peakDeltaDb,
      higherLabel: diff.higherPeakFileId === fileA.fileId ? labelA : labelB,
    },
    {
      label: 'RMS',
      valueA: `${fileA.rmsDb.toFixed(2)} dBFS`,
      valueB: `${fileB.rmsDb.toFixed(2)} dBFS`,
      delta: diff.rmsDeltaDb,
      higherLabel: diff.higherRmsFileId === fileA.fileId ? labelA : labelB,
    },
    {
      label: 'Crest Factor',
      valueA: `${fileA.crestFactorDb.toFixed(2)} dB`,
      valueB: `${fileB.crestFactorDb.toFixed(2)} dB`,
      delta: diff.crestFactorDeltaDb,
      higherLabel: diff.higherCrestFactorFileId === fileA.fileId ? labelA : labelB,
    },
    {
      label: 'Peak Freq',
      valueA: `${(fileA.peakFrequencyHz / 1000).toFixed(2)} kHz`,
      valueB: `${(fileB.peakFrequencyHz / 1000).toFixed(2)} kHz`,
      delta: diff.peakFrequencyDeltaHz,
      higherLabel: diff.higherPeakFrequencyFileId === fileA.fileId ? labelA : labelB,
      deltaUnit: 'Hz',
    },
  ];

  return (
    <table className={styles.metricsTable}>
      <thead>
        <tr>
          <th className={styles.tableHeadLabel}>Metric</th>
          <th className={styles.tableHeadA}>{labelA}</th>
          <th className={styles.tableHeadB}>{labelB}</th>
          <th className={styles.tableHeadDelta}>Δ (B − A)</th>
          <th className={styles.tableHeadWinner}>Higher</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const deltaFormatted = row.deltaUnit === 'Hz'
            ? `${row.delta > 0 ? '+' : ''}${row.delta.toFixed(0)} Hz`
            : formatDb(row.delta);
          const isPositiveDelta = row.delta > 0;
          const isNegativeDelta = row.delta < 0;

          return (
            <tr key={row.label} className={styles.tableRow}>
              <td className={styles.tableLabel}>{row.label}</td>
              <td className={styles.tableValueA}>{row.valueA}</td>
              <td className={styles.tableValueB}>{row.valueB}</td>
              <td className={`${styles.tableDelta} ${isPositiveDelta ? styles.deltaPositive : ''} ${isNegativeDelta ? styles.deltaNegative : ''}`}>
                {deltaFormatted}
              </td>
              <td className={styles.tableWinner}>{row.higherLabel}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

interface IBandEnergyTableProps {
  bandEnergiesA: CompareBandEnergy[];
  bandEnergiesB: CompareBandEnergy[];
  bandEnergyDeltas: CompareBandEnergy[];
  labelA: string;
  labelB: string;
}

function BandEnergyTable({ bandEnergiesA, bandEnergiesB, bandEnergyDeltas, labelA, labelB }: IBandEnergyTableProps): JSX.Element {
  return (
    <table className={styles.metricsTable}>
      <colgroup>
        <col style={{ width: '7%' }} />
        <col style={{ width: '10%' }} />
        <col style={{ width: '33%' }} />
        <col style={{ width: '33%' }} />
        <col style={{ width: '17%' }} />
      </colgroup>
      <thead>
        <tr>
          <th className={styles.tableHeadLabel}>Band</th>
          <th className={styles.tableHeadLabel}>Range</th>
          <th className={styles.tableHeadA}>{labelA}</th>
          <th className={styles.tableHeadB}>{labelB}</th>
          <th className={styles.tableHeadDelta}>Δ (B − A)</th>
        </tr>
      </thead>
      <tbody>
        {bandEnergiesA.map((bandA, index) => {
          const bandB = bandEnergiesB[index];
          const bandDelta = bandEnergyDeltas[index];
          if (!bandB || !bandDelta) return null;

          const deltaValue = bandDelta.energyDb;
          const isPositiveDelta = isFinite(deltaValue) && deltaValue > 0;
          const isNegativeDelta = isFinite(deltaValue) && deltaValue < 0;
          const rangeLabel = bandA.highHz >= 10000
            ? `${(bandA.lowHz / 1000).toFixed(0)}–${(bandA.highHz / 1000).toFixed(0)}k`
            : `${bandA.lowHz >= 1000 ? `${(bandA.lowHz / 1000).toFixed(0)}k` : bandA.lowHz}–${bandA.highHz >= 1000 ? `${(bandA.highHz / 1000).toFixed(0)}k` : bandA.highHz}`;

          return (
            <tr key={bandA.bandName} className={styles.tableRow}>
              <td className={styles.tableLabel}>{bandA.bandName}</td>
              <td className={styles.tableMeta}>{rangeLabel} Hz</td>
              <td className={styles.tableValueA}>{formatDb(bandA.energyDb)}</td>
              <td className={styles.tableValueB}>{formatDb(bandB.energyDb)}</td>
              <td className={`${styles.tableDelta} ${isPositiveDelta ? styles.deltaPositive : ''} ${isNegativeDelta ? styles.deltaNegative : ''}`}>
                {formatDeltaDb(deltaValue)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

interface ICpbDeltaTableProps {
  cpbBandsA?: CompareCpbBand[];
  cpbBandsB?: CompareCpbBand[];
  cpbBandDeltas?: CompareCpbBand[];
  labelA: string;
  labelB: string;
}

function CpbDeltaTable({ cpbBandsA, cpbBandsB, cpbBandDeltas, labelA, labelB }: ICpbDeltaTableProps): JSX.Element {
  const bandsA = cpbBandsA ?? [];
  const bandsB = cpbBandsB ?? [];
  const deltas = cpbBandDeltas ?? [];

  if (bandsA.length === 0 || bandsB.length === 0 || deltas.length === 0) {
    return (
      <div className={styles.tableEmptyState}>
        Run comparison again to include CPB band deltas.
      </div>
    );
  }

  return (
    <table className={styles.metricsTable}>
      <thead>
        <tr>
          <th className={styles.tableHeadLabel}>Band</th>
          <th className={styles.tableHeadA}>{labelA}</th>
          <th className={styles.tableHeadB}>{labelB}</th>
          <th className={styles.tableHeadDelta}>Δ (B − A)</th>
        </tr>
      </thead>
      <tbody>
        {bandsA.map((bandA, index) => {
          const bandB = bandsB[index];
          const bandDelta = deltas[index];
          if (!bandB || !bandDelta) return null;

          const deltaValue = bandDelta.levelDb;
          const isPositiveDelta = deltaValue !== null && deltaValue > 0;
          const isNegativeDelta = deltaValue !== null && deltaValue < 0;

          return (
            <tr key={bandA.label} className={styles.tableRow}>
              <td className={styles.tableLabel}>
                {bandA.label} Hz
                <span className={styles.inlineMeta}>
                  {bandA.lowerFrequencyHz.toFixed(0)}-{bandA.upperFrequencyHz.toFixed(0)} Hz
                </span>
              </td>
              <td className={styles.tableValueA}>{formatNullableDb(bandA.levelDb)}</td>
              <td className={styles.tableValueB}>{formatNullableDb(bandB.levelDb)}</td>
              <td className={`${styles.tableDelta} ${isPositiveDelta ? styles.deltaPositive : ''} ${isNegativeDelta ? styles.deltaNegative : ''}`}>
                {deltaValue === null ? '—' : formatDeltaDb(deltaValue)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function CpbDeltaChart({
  cpbBandDeltas,
  labelA,
  labelB,
}: {
  cpbBandDeltas?: CompareCpbBand[];
  labelA: string;
  labelB: string;
}): JSX.Element {
  const topDeltas = (cpbBandDeltas ?? [])
    .filter((band) => band.levelDb !== null && isFinite(band.levelDb))
    .sort((a, b) => Math.abs(b.levelDb ?? 0) - Math.abs(a.levelDb ?? 0))
    .slice(0, 6);

  if (topDeltas.length === 0) {
    return (
      <div className={styles.cpbEmptyState}>
        Run comparison again to include CPB band deltas.
      </div>
    );
  }

  const maxAbsDelta = Math.max(3, ...topDeltas.map((band) => Math.abs(band.levelDb ?? 0)));
  const weightingLabel = topDeltas[0]?.weighting?.toUpperCase() ?? 'Z';
  const weightingMethod = topDeltas[0]?.weightingMethod ?? 'Z-weighting unweighted flat response';

  return (
    <div className={styles.cpbDeltaChart}>
      <div className={styles.cpbDeltaHeader}>
        <div>
          <div className={styles.cpbDeltaTitle}>Largest CPB Differences</div>
          <div className={styles.cpbDeltaSubtitle}>Δ is {labelB} minus {labelA} · {weightingLabel}-weighted · {weightingMethod}</div>
        </div>
        <div className={styles.cpbDeltaScale}>Max |Δ| {maxAbsDelta.toFixed(1)} dB</div>
      </div>
      <div className={styles.cpbDeltaCards}>
        {topDeltas.map((band) => {
          const delta = band.levelDb ?? 0;
          const widthPercent = Math.min(100, Math.abs(delta) / maxAbsDelta * 100);
          const isPositive = delta >= 0;
          const higherLabel = isPositive ? labelB : labelA;

          return (
            <div key={band.label} className={styles.cpbDeltaCard}>
              <div className={styles.cpbDeltaCardTop}>
                <span className={styles.cpbBandLabel}>{band.label} Hz</span>
                <span className={`${styles.cpbDeltaValue} ${isPositive ? styles.deltaPositive : styles.deltaNegative}`}>
                  {formatDeltaDb(delta)}
                </span>
              </div>
              <div className={styles.cpbDeltaTrack}>
                <div
                  className={`${styles.cpbDeltaBar} ${isPositive ? styles.cpbDeltaPositive : styles.cpbDeltaNegative}`}
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
              <div className={styles.cpbDeltaDirection}>{higherLabel} higher</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ComparisonView({ result }: IComparisonViewProps): JSX.Element {
  const [showDelta, setShowDelta] = useState(true);
  const hasCpbComparison = Boolean(result.files[0]?.cpbBands?.length && result.files[1]?.cpbBands?.length && result.pairwiseDiffs[0]?.cpbBandDeltas?.length);
  const [activeTab, setActiveTab] = useState<'cpb' | 'bands' | 'level' | 'psych'>(hasCpbComparison ? 'cpb' : 'bands');
  // Derive the effective tab: if CPB data is unavailable, fall back to 'bands' without a setState-in-effect.
  const effectiveTab = activeTab === 'cpb' && !hasCpbComparison ? 'bands' : activeTab;
  const dispatch = useAppDispatch();

  if (result.files.length < 2 || result.pairwiseDiffs.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span>Comparison requires at least two files.</span>
      </div>
    );
  }

  const fileA = result.files[0];
  const fileB = result.files[1];
  const diff = result.pairwiseDiffs[0];

  const labelA = fileA.fileName;
  const labelB = fileB.fileName;

  return (
    <div className={styles.comparisonView}>

      {/* File legend strip */}
      <div className={styles.legendStrip}>
        <div className={styles.legendItem}>
          <span className={styles.legendSwatch} style={{ background: '#1971c2' }} />
          <span className={styles.legendLabel} title={labelA}>{labelA}</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendSwatch} style={{ background: '#e8590c' }} />
          <span className={styles.legendLabel} title={labelB}>{labelB}</span>
        </div>
        {showDelta && (
          <div className={styles.legendItem}>
            <span className={styles.legendSwatchDashed} style={{ borderColor: '#2f9e44' }} />
            <span className={styles.legendLabel}>Δ (B − A)</span>
          </div>
        )}
        <label className={styles.deltaToggle}>
          <input
            type="checkbox"
            checked={showDelta}
            onChange={(e) => setShowDelta(e.target.checked)}
          />
          Show Δ curve
        </label>
        <button
          type="button"
          className={styles.askAgentButton}
          onClick={() => {
            dispatch(agentPromptPrefillSet('Explain the comparison results. Which file has higher loudness, sharpness, and where are the biggest spectral differences?'));
            dispatch(setActiveMode('agent'));
          }}
          title="Ask agent to explain this comparison"
        >
          Explain this comparison →
        </button>
      </div>

      {effectiveTab !== 'cpb' && (
        <div className={styles.canvasSection}>
          <ComparisonSpectrumCanvas
            curveA={fileA.spectrumCurve}
            curveB={fileB.spectrumCurve}
            delta={diff.spectrumDelta}
            labelA={labelA}
            labelB={labelB}
            showDelta={showDelta}
          />
        </div>
      )}

      {/* Tab switcher for tables */}
      <div className={styles.tabBar}>
        <button
          type="button"
          className={`${styles.tabButton} ${effectiveTab === 'cpb' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('cpb')}
          disabled={!hasCpbComparison}
          title={hasCpbComparison ? 'Show CPB band deltas' : 'Run comparison again to include CPB deltas'}
        >
          CPB Δ
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${effectiveTab === 'bands' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('bands')}
        >
          Band Energy
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${effectiveTab === 'level' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('level')}
        >
          Level Metrics
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${effectiveTab === 'psych' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('psych')}
          title={'Show psychoacoustic deltas (loudness, sharpness, roughness)'}
        >
          Psych Δ
        </button>
      </div>

      {/* Tables */}
      <div className={styles.tableSection}>
        {effectiveTab === 'cpb' && (
          <>
            <CpbDeltaChart cpbBandDeltas={diff.cpbBandDeltas} labelA={labelA} labelB={labelB} />
            <CpbDeltaTable
              cpbBandsA={fileA.cpbBands}
              cpbBandsB={fileB.cpbBands}
              cpbBandDeltas={diff.cpbBandDeltas}
              labelA={labelA}
              labelB={labelB}
            />
          </>
        )}
        {effectiveTab === 'bands' && (
          <BandEnergyTable
            bandEnergiesA={fileA.bandEnergies}
            bandEnergiesB={fileB.bandEnergies}
            bandEnergyDeltas={diff.bandEnergyDeltas}
            labelA={labelA}
            labelB={labelB}
          />
        )}
        {effectiveTab === 'level' && (
          <LevelMetricsTable
            fileA={fileA}
            fileB={fileB}
            diff={diff}
            labelA={labelA}
            labelB={labelB}
          />
        )}
        {effectiveTab === 'psych' && diff.soundQualityDelta && fileA.soundQuality && fileB.soundQuality && (
          <>
            <SoundQualityTable
              sqA={fileA.soundQuality}
              sqB={fileB.soundQuality}
              delta={diff.soundQualityDelta}
              fileIdA={fileA.fileId}
              fileIdB={fileB.fileId}
              labelA={labelA}
              labelB={labelB}
            />
            <div className={styles.tableEmptyState}>
              Relative comparison only: values are computed on uncalibrated digital-amplitude samples until physical SPL calibration is configured.
            </div>
          </>
        )}
        {effectiveTab === 'psych' && (!diff.soundQualityDelta || !fileA.soundQuality || !fileB.soundQuality) && (
          <div className={styles.tableEmptyState}>
            {getSoundQualityUnavailableMessage(diff.soundQualityUnavailableReason)}
          </div>
        )}
      </div>

    </div>
  );
}
