const MIN_Y_TICK_SPACING_PX = 16;

export function chooseSpectrumYAxisStep(yMin: number, yMax: number, plotHeight: number): number {
  const range = Math.max(1, yMax - yMin);
  const maxTickIntervals = Math.max(1, Math.floor(plotHeight / MIN_Y_TICK_SPACING_PX));
  const rawStep = range / maxTickIntervals;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalised = rawStep / magnitude;

  if (normalised <= 1) {
    return magnitude;
  }

  if (normalised <= 2) {
    return 2 * magnitude;
  }

  if (normalised <= 5) {
    return 5 * magnitude;
  }

  return 10 * magnitude;
}