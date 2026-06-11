import type { JSX } from 'react';
import { AreaChart } from '@mantine/charts';
import { Box } from '@mantine/core';

interface WaveformBin {
  x: number;
  yMin: number;
  yMax: number;
}

interface WaveformChartProps {
  waveformBins: WaveformBin[];
  currentTime: number;
  duration: number;
}

export const WaveformChart = ({
  waveformBins,
  currentTime,
  duration,
}: WaveformChartProps): JSX.Element => {
  if (waveformBins.length === 0) {
    return (
      <Box
        style={{
          height: 120,
          backgroundColor: 'var(--mantine-color-gray-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        No waveform data available
      </Box>
    );
  }

  // Transform bins to chart data - x is 0-1 normalized position
  const data = waveformBins.map((bin) => ({
    x: bin.x,
    amplitude: Math.max(Math.abs(bin.yMin), Math.abs(bin.yMax)),
  }));

  // Playhead position aligned with timeline (0-1 normalized, then to percent)
  const playheadPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <Box style={{ position: 'relative', height: 120, width: '100%' }}>
      <AreaChart
        data={data}
        dataKey="x"
        series={[{ name: 'amplitude', color: 'blue' }]}
        curveType="linear"
        fillOpacity={0.6}
        strokeWidth={1}
        gridAxis="none"
        withXAxis={false}
        withYAxis={false}
        withDots={false}
        withTooltip={false}
        withLegend={false}
        style={{ height: '100%' }}
      />
      <Box
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${playheadPercent}%`,
          width: 2,
          backgroundColor: 'var(--mantine-color-red-6)',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
          transition: 'left 0.05s linear',
        }}
      />
    </Box>
  );
};
