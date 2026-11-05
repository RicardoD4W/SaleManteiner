import { useCallback, useEffect, useMemo, useState } from 'react';
import { readHiddenSeries, writeHiddenSeries } from '../lib/chartPreferences';

export interface ChartSeriesVisibility {
  hiddenSeries: ReadonlySet<string>;
  toggleSeries: (seriesKey: string) => void;
}

export function useChartSeriesVisibility(
  chartId: string,
  knownSeries: readonly string[],
): ChartSeriesVisibility {
  const [hidden, setHidden] = useState<string[]>(() =>
    readHiddenSeries(chartId).filter((key) => knownSeries.includes(key)),
  );

  useEffect(() => {
    writeHiddenSeries(chartId, hidden);
  }, [chartId, hidden]);

  const toggleSeries = useCallback((seriesKey: string) => {
    setHidden((current) =>
      current.includes(seriesKey)
        ? current.filter((key) => key !== seriesKey)
        : [...current, seriesKey],
    );
  }, []);

  const hiddenSeries = useMemo(() => new Set(hidden), [hidden]);

  return { hiddenSeries, toggleSeries };
}
