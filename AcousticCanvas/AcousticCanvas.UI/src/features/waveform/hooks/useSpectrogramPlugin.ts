import { useRef, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js';
import SpectrogramPlugin from 'wavesurfer.js/dist/plugins/spectrogram.esm.js';
import type { ChannelSpectrogramAnalysis } from '../../analysis/spectrogramTypes';

const SPECTROGRAM_HEIGHT_PX = 160;

interface UseSpectrogramPluginOptions {
  wavesurferRef: React.MutableRefObject<WaveSurfer | null>;
  isWaveSurferReady: boolean;
  channelData: ChannelSpectrogramAnalysis | null;
  sampleRate: number;
}

interface UseSpectrogramPluginReturn {
  spectrogramContainerRef: React.RefObject<HTMLDivElement | null>;
}

// Converts backend number[][] (values 0-255) to Uint8Array[][] as required by
// wavesurfer SpectrogramPlugin.drawSpectrogram. Shape: [channel][frame][bin].
function buildUint8FrequencyData(frequencyData: number[][]): Uint8Array[][] {
  const frames = frequencyData.map((frame) => new Uint8Array(frame));
  return [frames];
}

type PluginWithDraw = { drawSpectrogram: (data: Uint8Array[][]) => void };

export const useSpectrogramPlugin = ({
  wavesurferRef,
  isWaveSurferReady,
  channelData,
  sampleRate,
}: UseSpectrogramPluginOptions): UseSpectrogramPluginReturn => {
  const spectrogramContainerRef = useRef<HTMLDivElement | null>(null);
  const pluginRef = useRef<ReturnType<typeof SpectrogramPlugin.create> | null>(null);
  // Track whether the plugin has fired its 'ready' event (DOM fully initialised).
  const pluginReadyRef = useRef(false);
  // Hold the latest data so we can draw it as soon as the plugin is ready.
  const pendingDataRef = useRef<Uint8Array[][] | null>(null);
  // Keep sampleRate as a ref so plugin isn't torn down when the value updates.
  const sampleRateRef = useRef(sampleRate);
  useEffect(() => { sampleRateRef.current = sampleRate; }, [sampleRate]);

  // Create the plugin once WaveSurfer is ready and attach it to the container div.
  useEffect(() => {
    const wavesurfer = wavesurferRef.current;
    const container = spectrogramContainerRef.current;

    if (!wavesurfer || !isWaveSurferReady || !container) {
      return;
    }

    pluginReadyRef.current = false;

    // Use the sample rate known at creation time; it gets updated via sampleRateRef
    // but we do not want plugin recreation just because sampleRate changed.
    const nyquist = sampleRateRef.current / 2;

    const plugin = SpectrogramPlugin.create({
      container,
      height: SPECTROGRAM_HEIGHT_PX,
      labels: true,
      labelsBackground: 'rgba(0,0,0,0)',
      labelsColor: 'rgba(0,0,0,0.5)',
      labelsHzColor: 'rgba(0,0,0,0.3)',
      frequencyMax: nyquist,
      frequencyMin: 0,
      gainDB: 20,
      rangeDB: 80,
      colorMap: buildDefaultColorMap(),
    });

    wavesurfer.registerPlugin(plugin);
    pluginRef.current = plugin;

    // The plugin appends its wrapper to the container in onInit, which runs
    // synchronously during registerPlugin. Give the browser one frame to lay
    // out the container so getWidth() returns a non-zero value.
    const initTimer = window.setTimeout(() => {
      pluginReadyRef.current = true;
      if (pendingDataRef.current) {
        (plugin as unknown as PluginWithDraw).drawSpectrogram(pendingDataRef.current);
        pendingDataRef.current = null;
      }
    }, 0);

    return () => {
      window.clearTimeout(initTimer);
      plugin.destroy();
      pluginRef.current = null;
      pluginReadyRef.current = false;
      pendingDataRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWaveSurferReady]);

  // Feed backend frequency data into the plugin whenever it changes.
  useEffect(() => {
    const plugin = pluginRef.current;
    if (!channelData || channelData.frequencyData.length === 0) {
      return;
    }

    const uint8Data = buildUint8FrequencyData(channelData.frequencyData);

    if (!plugin || !pluginReadyRef.current) {
      // Plugin not ready yet — store for when 'ready' fires.
      pendingDataRef.current = uint8Data;
      return;
    }

    (plugin as unknown as PluginWithDraw).drawSpectrogram(uint8Data);
  }, [channelData]);

  return { spectrogramContainerRef };
};

// Produces a 256-entry heat colormap: dark blue → teal → yellow → white.
// Each entry is [r, g, b, alpha] with values 0-1 as expected by the plugin.
function buildDefaultColorMap(): number[][] {
  const colorMap: number[][] = [];
  const stops: Array<{ pos: number; r: number; g: number; b: number }> = [
    { pos: 0, r: 0.05, g: 0.01, b: 0.13 },
    { pos: 0.25, r: 0.04, g: 0.23, b: 0.42 },
    { pos: 0.5, r: 0.1, g: 0.5, b: 0.56 },
    { pos: 0.75, r: 0.96, g: 0.73, b: 0.26 },
    { pos: 1.0, r: 1.0, g: 1.0, b: 1.0 },
  ];

  for (let i = 0; i < 256; i++) {
    const normalised = i / 255;

    let stopIndex = 0;
    for (let s = 0; s < stops.length - 1; s++) {
      if (normalised >= stops[s].pos && normalised <= stops[s + 1].pos) {
        stopIndex = s;
        break;
      }
    }

    const fromStop = stops[stopIndex];
    const toStop = stops[stopIndex + 1];
    const segmentRange = toStop.pos - fromStop.pos;
    const segmentT = segmentRange > 0 ? (normalised - fromStop.pos) / segmentRange : 0;

    const r = fromStop.r + (toStop.r - fromStop.r) * segmentT;
    const g = fromStop.g + (toStop.g - fromStop.g) * segmentT;
    const b = fromStop.b + (toStop.b - fromStop.b) * segmentT;

    colorMap.push([r, g, b, 1.0]);
  }

  return colorMap;
}
