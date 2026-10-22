import { Fragment, useState } from 'react';
import {
  Button,
  Table,
  TableCell,
  TableHeader,
  TableRow,
  Typography,
  useDesignSystemTheme,
} from '@databricks/design-system';
import type { MetricKey } from './api';
import {
  type ComparisonRun,
  formatMetric,
  metricAggregation,
  metricChildren,
  metricLabel,
  deltaReason,
  allMetricKeys,
  metricUnit,
  metricValue,
  rootMetrics,
} from './metricComparison';

export default function MetricHierarchy({
  runs,
  metric,
  onSelect,
}: {
  runs: ComparisonRun[];
  metric: MetricKey;
  onSelect: (metric: MetricKey) => void;
}) {
  const { theme } = useDesignSystemTheme();
  const [expanded, setExpanded] = useState<Set<MetricKey>>(() => new Set(['overall_score', 'quality_score']));
  const rows: { key: MetricKey; depth: number; parent?: MetricKey }[] = [];
  const visited = new Set<MetricKey>();
  function childrenOf(key: MetricKey): MetricKey[] {
    return Array.from(new Set(runs.flatMap((run) => metricChildren(run.data, key).map(([child]) => child))));
  }
  function addRows(key: MetricKey, depth: number, parent?: MetricKey, visible = true) {
    if (visited.has(key)) return;
    visited.add(key);
    if (visible) rows.push({ key, depth, parent });
    for (const child of childrenOf(key)) {
      addRows(child, depth + 1, key, visible && expanded.has(key));
    }
  }
  runs.flatMap((run) => rootMetrics(run.data)).forEach((key) => addRows(key, 0));
  allMetricKeys(runs).forEach((key) => addRows(key, 0));
  const baseline = runs[0];
  return (
    <Table>
      <TableRow isHeader>
        <TableHeader componentId="alphaarc.metrics.metric-heading">Metric hierarchy</TableHeader>
        {runs.map((run, index) => (
          <Fragment key={run.data.job_id}>
            <TableHeader componentId="alphaarc.metrics.run-heading">
              <Typography.Text css={{ color: run.color }}>
                {run.label}
                {index === 0 ? ' · Baseline' : ''}
              </Typography.Text>
            </TableHeader>
            {index > 0 && (
              <TableHeader componentId="alphaarc.metrics.delta-heading">
                {run.label} − {baseline.label}
              </TableHeader>
            )}
          </Fragment>
        ))}
      </TableRow>
      {rows.map(({ key, depth, parent }) => {
        const baselineValue = metricValue(baseline.data, key);
        return (
          <TableRow key={key} css={{ backgroundColor: key === metric ? theme.colors.backgroundSecondary : undefined }}>
            <TableCell multiline>
              <div
                css={{
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: theme.spacing.md * depth,
                  gap: theme.spacing.xs,
                }}
              >
                {childrenOf(key).length > 0 && (
                  <Button
                    componentId="alphaarc.metrics.expand"
                    type="tertiary"
                    size="small"
                    aria-label={`${expanded.has(key) ? 'Collapse' : 'Expand'} ${metricLabel(key)}`}
                    aria-expanded={expanded.has(key)}
                    onClick={() => {
                      const next = new Set(expanded);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      setExpanded(next);
                    }}
                  >
                    {expanded.has(key) ? '−' : '+'}
                  </Button>
                )}
                <Button
                  componentId="alphaarc.metrics.select"
                  type="link"
                  size="small"
                  aria-pressed={key === metric}
                  onClick={() => onSelect(key)}
                >
                  {metricLabel(key)}
                </Button>
              </div>
              <Typography.Text
                css={{
                  display: 'block',
                  paddingLeft: theme.spacing.md * depth + theme.spacing.sm,
                  color: theme.colors.textSecondary,
                }}
              >
                {key}
              </Typography.Text>
            </TableCell>
            {runs.map((run, index) => {
              const value = metricValue(run.data, key);
              const reason = deltaReason(baseline.data, run.data, key);
              const delta =
                reason === undefined && value !== undefined && baselineValue !== undefined
                  ? value - baselineValue
                  : undefined;
              const weight = parent ? run.data.score_nodes[parent]?.children[key] : undefined;
              return (
                <Fragment key={run.data.job_id}>
                  <TableCell multiline>
                    {value === undefined ? (
                      <span title="Not recorded">—</span>
                    ) : (
                      <>
                        <span css={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatMetric(value, key)} {metricUnit(run.data, key)}
                        </span>
                        <Typography.Text css={{ display: 'block', color: theme.colors.textSecondary }}>
                          {metricAggregation(run.data, key)}
                          {weight === undefined ? '' : ` · ${weight * 100}% of parent`}
                        </Typography.Text>
                      </>
                    )}
                  </TableCell>
                  {index > 0 && (
                    <TableCell>
                      {delta === undefined ? (
                        reason === 'Not recorded' ? (
                          <span title="Not recorded">—</span>
                        ) : (
                          reason
                        )
                      ) : (
                        `${delta > 0 ? '+' : ''}${formatMetric(delta, key)}`
                      )}
                    </TableCell>
                  )}
                </Fragment>
              );
            })}
          </TableRow>
        );
      })}
    </Table>
  );
}
