import { useState } from 'react';
import {
  Alert,
  Button,
  FormUI,
  SimpleSelect,
  SimpleSelectOption,
  Spinner,
  Typography,
  useDesignSystemTheme,
} from '@databricks/design-system';
import { ScrollablePageWrapper } from '../common/components/ScrollablePageWrapper';
import { useQueries, useQuery } from '../common/utils/reactQueryHooks';
import { Link, useSearchParams } from '../common/utils/RoutingUtils';
import { evaluationApi, type MetricKey } from './api';
import MetricHierarchy from './MetricHierarchy';
import MetricsChart from './MetricsChart';
import {
  matchingCases,
  metricAggregation,
  metricFormula,
  metricLabel,
  sameMetricDefinition,
  allMetricKeys,
  metricUnit,
  runLabel,
} from './metricComparison';

export default function MetricsPage() {
  const { theme } = useDesignSystemTheme();
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const [searchParams] = useSearchParams();
  const requestedIds = Array.from(new Set(searchParams.getAll('run')));
  const [selectedMetric, setMetric] = useState<MetricKey | null>(null);
  const jobs = useQuery(['alphaarc', 'jobs'], { queryFn: evaluationApi.jobs, retry: false });
  const completed = (jobs.data ?? [])
    .filter((job) => job.status === 'completed')
    .sort((a, b) => Number(b.agent_name?.includes('showcase')) - Number(a.agent_name?.includes('showcase')));
  const first = completed[0];
  const second = completed.find((job) => job.agent_name !== first?.agent_name) ?? completed[1];
  const ids =
    selectedIds ??
    (requestedIds.length > 0 ? requestedIds : [first?.id, second?.id].filter((id): id is string => id !== undefined));
  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['alphaarc', 'metrics', id],
      queryFn: () => evaluationApi.metrics(id),
      enabled: id !== '',
      retry: false,
    })),
  });
  const colors = [theme.colors.blue500, theme.colors.green500, theme.colors.purple, theme.colors.red500];
  const runs = queries.flatMap((query, index) =>
    query.data ? [{ label: runLabel(index), color: colors[index % colors.length], data: query.data }] : [],
  );
  const ready = ids.filter(Boolean).length > 0 && queries.every((query, index) => ids[index] === '' || query.isSuccess);
  const baseline = runs[0];
  const mismatch = ready && runs.some((run) => !matchingCases(baseline.data, run.data));
  const keys = allMetricKeys(runs);
  const metric =
    selectedMetric && keys.includes(selectedMetric)
      ? selectedMetric
      : keys.includes('overall_score')
        ? 'overall_score'
        : (keys[0] ?? '');
  const metricRuns = runs.filter((run) => run.data.score_nodes[metric] !== undefined);
  const differentDefinitions =
    ready && metricRuns.some((run) => !sameMetricDefinition(metricRuns[0].data, run.data, metric));
  const missingMetrics = ready && keys.some((key) => runs.some((run) => run.data.score_nodes[key] === undefined));
  const cardCss = {
    backgroundColor: theme.colors.backgroundPrimary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borders.borderRadiusLg,
    padding: theme.spacing.lg,
  };
  return (
    <ScrollablePageWrapper>
      <div
        css={{ padding: theme.spacing.lg, maxWidth: 1800, margin: '0 auto', display: 'grid', gap: theme.spacing.lg }}
      >
        <div>
          <Typography.Title level={2} css={{ marginBottom: theme.spacing.sm }}>
            Metric comparison
          </Typography.Title>
          <Typography.Paragraph css={{ color: theme.colors.textSecondary }}>
            Compare runs against a shared baseline. Expand a score to explore its components; each metric uses its saved
            reporting aggregation.
          </Typography.Paragraph>
        </div>
        <section css={cardCss}>
          <div
            css={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: theme.spacing.md,
            }}
          >
            {ids.map((id, index) => (
              <div
                key={index}
                css={{
                  border: `1px solid ${theme.colors.border}`,
                  borderTop: `3px solid ${colors[index % colors.length]}`,
                  borderRadius: theme.borders.borderRadiusSm,
                  padding: theme.spacing.md,
                }}
              >
                <div
                  css={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: theme.spacing.sm,
                  }}
                >
                  <FormUI.Label htmlFor={`alphaarc-metrics-run-${index}`}>
                    Run {runLabel(index)}
                    {index === 0 ? ' · Baseline' : ''}
                  </FormUI.Label>
                  {ids.length > 1 && (
                    <Button
                      componentId="alphaarc.metrics.remove-run"
                      type="tertiary"
                      size="small"
                      aria-label={`Remove run ${runLabel(index)}`}
                      onClick={() => setSelectedIds(ids.filter((_, position) => position !== index))}
                    >
                      ×
                    </Button>
                  )}
                </div>
                <SimpleSelect
                  id={`alphaarc-metrics-run-${index}`}
                  aria-label={`Run ${runLabel(index)}`}
                  componentId="alphaarc.metrics.run"
                  css={{ width: '100%' }}
                  value={id}
                  onChange={(event) =>
                    setSelectedIds(ids.map((current, position) => (position === index ? event.target.value : current)))
                  }
                >
                  <SimpleSelectOption value="" disabled>
                    Choose a run…
                  </SimpleSelectOption>
                  {completed.map((job) => (
                    <SimpleSelectOption
                      key={job.id}
                      value={job.id}
                      disabled={ids.some((selected, position) => position !== index && selected === job.id)}
                    >
                      {job.request.name} · {job.agent_name ?? job.request.agent} · {job.id.slice(0, 8)}
                    </SimpleSelectOption>
                  ))}
                </SimpleSelect>
              </div>
            ))}
          </div>
          <Button
            componentId="alphaarc.metrics.add-run"
            type="tertiary"
            css={{ marginTop: theme.spacing.md }}
            disabled={ids.includes('') || ids.length >= completed.length}
            onClick={() => setSelectedIds([...ids, ''])}
          >
            + Add run
          </Button>
          <Typography.Paragraph
            css={{ color: theme.colors.textSecondary, marginTop: theme.spacing.md, marginBottom: 0 }}
          >
            A is the baseline. Differences are shown only for matching saved definitions and cases. Each metric defines
            whether higher or lower is better.
          </Typography.Paragraph>
        </section>
        {jobs.isLoading && <Spinner />}
        {jobs.isError && (
          <Alert componentId="alphaarc.metrics.jobs-error" type="error" closable={false} message={String(jobs.error)} />
        )}
        {jobs.data && completed.length === 0 && (
          <Alert
            componentId="alphaarc.metrics.no-runs"
            type="info"
            closable={false}
            message="Complete an evaluation to explore its saved metrics."
          />
        )}
        {queries.some((query) => query.isFetching) && <Spinner />}
        {queries.map(
          (query, index) =>
            query.isError && (
              <Alert
                key={ids[index]}
                componentId="alphaarc.metrics.run-error"
                type="error"
                closable={false}
                message={`Run ${runLabel(index)}: ${String(query.error)}`}
              />
            ),
        )}
        {ready && (
          <>
            {missingMetrics && (
              <Alert
                componentId="alphaarc.metrics.missing-metrics"
                type="info"
                closable={false}
                message="Some metrics were not recorded in every run. All recorded metrics are listed; missing scores are not treated as zero."
              />
            )}
            {mismatch && (
              <Alert
                componentId="alphaarc.metrics.dataset-mismatch"
                type="warning"
                closable={false}
                message="These runs have different dataset snapshots or evaluated cases. Values are shown as recorded; the comparison is not like-for-like."
              />
            )}
            {differentDefinitions && (
              <Alert
                componentId="alphaarc.metrics.definition-mismatch"
                type="warning"
                closable={false}
                message="This metric name has different saved definitions across runs, including its components, units, or aggregation. Differences are withheld for incompatible definitions."
              />
            )}
            {runs.some((run) => run.data.score_storage === 'legacy-artifact') && (
              <Alert
                componentId="alphaarc.metrics.legacy"
                type="info"
                closable={false}
                message="Some runs predate native ensemble storage. Their original artifact definitions and recorded values are shown."
              />
            )}
            <div css={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: theme.spacing.md }}>
              <Typography.Text css={{ color: theme.colors.textSecondary }}>
                {runs
                  .map((run) => `${run.label}: ${run.data.completed_cases}/${run.data.total_cases} scored cases`)
                  .join(' · ')}
              </Typography.Text>
              <Link
                componentId="alphaarc.metrics.native-comparison"
                to={`/compare-runs?runs=${encodeURIComponent(JSON.stringify(runs.map((run) => run.data.run_id)))}&experiments=${encodeURIComponent(JSON.stringify(runs.map((run) => run.data.experiment_id)))}`}
              >
                Open native MLflow comparison
              </Link>
            </div>
            <section css={{ ...cardCss, overflowX: 'auto' }}>
              <MetricHierarchy runs={runs} metric={metric} onSelect={setMetric} />
            </section>
            <section css={cardCss}>
              <Typography.Title level={3} css={{ marginTop: 0 }}>
                {metricLabel(metric)}
              </Typography.Title>
              <Typography.Text css={{ color: theme.colors.textSecondary }}>Metric key: {metric}</Typography.Text>
              <div
                css={{
                  display: 'grid',
                  gap: theme.spacing.sm,
                  marginBlock: theme.spacing.md,
                  padding: theme.spacing.md,
                  backgroundColor: theme.colors.backgroundSecondary,
                  borderRadius: theme.borders.borderRadiusSm,
                }}
              >
                {runs.map((run) => (
                  <Typography.Text key={run.data.job_id}>
                    <span css={{ color: run.color }}>{run.label}</span> · {metricAggregation(run.data, metric)} ·{' '}
                    {metricFormula(run.data, metric)}
                    {run.data.score_nodes[metric]
                      ? ` · ${metricUnit(run.data, metric)} · ${run.data.score_nodes[metric].direction} is better`
                      : ''}
                  </Typography.Text>
                ))}
              </div>
              <Typography.Title level={4}>Comparison</Typography.Title>
              <MetricsChart runs={runs} metric={metric} />
            </section>
          </>
        )}
      </div>
    </ScrollablePageWrapper>
  );
}
