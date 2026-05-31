import type { WaveformBin } from '../audioUpload/audioUploadApi';

const Y_AXIS_WIDTH = 52;
const PADDING_TOP = 8;
const PADDING_BOTTOM = 8;
const TICK_COUNT = 5;
const TICK_LINE_LENGTH = 5;
const FONT_SIZE = 10;
const FONT_FAMILY = 'monospace';
const AXIS_COLOR = 'rgba(255, 255, 255, 0.25)';
const GRID_COLOR = 'rgba(255, 255, 255, 0.06)';
const CENTER_LINE_COLOR = 'rgba(255, 255, 255, 0.18)';
const TICK_LABEL_COLOR = 'rgba(255, 255, 255, 0.55)';
const UNIT_LABEL_COLOR = 'rgba(255, 255, 255, 0.4)';

interface DrawWaveformOptions {
  context: CanvasRenderingContext2D;
  waveformBins: WaveformBin[];
  width: number;
  height: number;
  color: string;
  backgroundColor: string;
  amplitudeUnit: string;
}

function formatTickValue(value: number): string {
  if (value === 0) {
    return '0';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

export function drawWaveformCanvas(options: DrawWaveformOptions): void {
  const { context, waveformBins, width, height, color, backgroundColor, amplitudeUnit } = options;

  const plotWidth = width - Y_AXIS_WIDTH;
  const plotHeight = height - PADDING_TOP - PADDING_BOTTOM;
  const centerY = PADDING_TOP + plotHeight / 2;
  const amplitudeScale = plotHeight / 2;

  context.fillStyle = backgroundColor;
  context.fillRect(0, 0, width, height);

  const tickValues = Array.from({ length: TICK_COUNT }, (_, tickIndex) => {
    const normalizedPosition = tickIndex / (TICK_COUNT - 1);
    return 1.0 - normalizedPosition * 2.0;
  });

  context.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
  context.textAlign = 'right';
  context.textBaseline = 'middle';

  tickValues.forEach((tickAmplitudeValue) => {
    const tickY = centerY - tickAmplitudeValue * amplitudeScale;

    context.strokeStyle = tickAmplitudeValue === 0 ? CENTER_LINE_COLOR : GRID_COLOR;
    context.lineWidth = tickAmplitudeValue === 0 ? 1 : 0.5;
    context.beginPath();
    context.moveTo(Y_AXIS_WIDTH, tickY);
    context.lineTo(width, tickY);
    context.stroke();

    context.strokeStyle = AXIS_COLOR;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(Y_AXIS_WIDTH - TICK_LINE_LENGTH, tickY);
    context.lineTo(Y_AXIS_WIDTH, tickY);
    context.stroke();

    context.fillStyle = TICK_LABEL_COLOR;
    context.fillText(
      formatTickValue(tickAmplitudeValue),
      Y_AXIS_WIDTH - TICK_LINE_LENGTH - 3,
      tickY,
    );
  });

  context.strokeStyle = AXIS_COLOR;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(Y_AXIS_WIDTH, PADDING_TOP);
  context.lineTo(Y_AXIS_WIDTH, height - PADDING_BOTTOM);
  context.stroke();

  context.save();
  context.translate(FONT_SIZE + 2, height / 2);
  context.rotate(-Math.PI / 2);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = UNIT_LABEL_COLOR;
  context.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
  context.fillText(amplitudeUnit, 0, 0);
  context.restore();

  if (waveformBins.length === 0) {
    return;
  }

  context.strokeStyle = color;
  context.lineWidth = 1;
  context.beginPath();

  const binsPerPixel = waveformBins.length / plotWidth;

  Array.from({ length: plotWidth }, (_, plotPixelX) => {
    const binIndex = Math.floor(plotPixelX * binsPerPixel);
    const bin = waveformBins[binIndex];

    if (!bin) {
      return;
    }

    const canvasX = Y_AXIS_WIDTH + plotPixelX;
    const topY = centerY - bin.yMax * amplitudeScale;
    const bottomY = centerY - bin.yMin * amplitudeScale;

    context.moveTo(canvasX, topY);
    context.lineTo(canvasX, bottomY);
  });

  context.stroke();
}
