import { Typography, useDesignSystemTheme } from '@databricks/design-system';
import type { MetricKey } from './api';
import {
  type ComparisonRun,
  formatMetric,
  metricAggregation,
  metricChildren,
  metricLabel,
  metricUnit,
  metricValue,
} from './metricComparison';

export default function MetricsChart({ runs, metric }: { runs: ComparisonRun[]; metric: MetricKey }) {
  const { theme } = useDesignSystemTheme();
  const keys = Array.from(
    new Set([metric, ...runs.flatMap((run) => metricChildren(run.data, metric).map(([key]) => key))]),
  );
  return (
    <figure css={{ margin: 0 }} aria-label="Metric comparison chart">
      <figcaption css={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
        {runs.map((run) => (
          <Typography.Text key={run.data.job_id} css={{ color: run.color }}>
            {run.label} · {run.data.run_name}
          </Typography.Text>
        ))}
      </figcaption>
      <Typography.Paragraph css={{ color: theme.colors.textSecondary }}>
        Selected metric and its immediate children. Each metric has its own scale; different units use separate scales.
        Missing scores have no bar.
      </Typography.Paragraph>
      <div css={{ display: 'grid', gap: theme.spacing.lg }}>
        {keys.map((key) => {
          const values = runs.map((run) => metricValue(run.data, key));
          return (
            <div key={key}>
              <Typography.Text css={{ display: 'block', marginBottom: theme.spacing.xs }}>
                {metricLabel(key)}
              </Typography.Text>
              {runs.map((run, index) => {
                const value = values[index];
                const unit = metricUnit(run.data, key);
                const matchingUnits = values.filter((_, position) => metricUnit(runs[position].data, key) === unit);
                const min = Math.min(0, ...matchingUnits.map((item) => item ?? 0));
                const max = Math.max(unit === 'score (0–1)' ? 1 : 0, ...matchingUnits.map((item) => item ?? 0));
                const extent = max - min || 1;
                return (
                  <div
                    key={run.data.job_id}
                    css={{
                      display: 'grid',
                      gridTemplateColumns: '20px 1fr minmax(160px, auto)',
                      alignItems: 'center',
                      gap: theme.spacing.sm,
                      marginBottom: theme.spacing.xs,
                    }}
                  >
                    <span>{run.label}</span>
                    {value === undefined ? (
                      <div css={{ height: theme.spacing.md, borderBottom: `1px dashed ${theme.colors.border}` }} />
                    ) : (
                      <div
                        css={{
                          position: 'relative',
                          height: theme.spacing.md,
                          backgroundColor: theme.colors.backgroundSecondary,
                          borderRadius: theme.borders.borderRadiusSm,
                        }}
                      >
                        <div
                          css={{
                            position: 'absolute',
                            left: `${(-min / extent) * 100}%`,
                            height: '100%',
                            borderLeft: `1px solid ${theme.colors.border}`,
                          }}
                        />
                        <div
                          aria-label={`${metricLabel(key)}, ${run.label}: ${formatMetric(value, key)} ${unit}`}
                          css={{
                            position: 'absolute',
                            height: '100%',
                            left: `${((Math.min(value, 0) - min) / extent) * 100}%`,
                            width: `${(Math.abs(value) / extent) * 100}%`,
                            backgroundColor: run.color,
                            borderRadius: theme.borders.borderRadiusSm,
                          }}
                        />
                      </div>
                    )}
                    <span css={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {formatMetric(value, key)}
                      {value === undefined ? '' : ` ${unit} · ${metricAggregation(run.data, key)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </figure>
  );
}
