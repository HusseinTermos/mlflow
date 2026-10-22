import type { MetricKey, RunMetrics } from './api';

const knownLabels = new Map(
  Object.entries({
    overall_score: 'Overall score',
    quality_score: 'Quality score',
    correctness: 'Correctness',
    answer_similarity: 'Answer similarity',
    format_compliance: 'Format compliance',
    token_efficiency: 'Token efficiency',
    latency_efficiency: 'Latency efficiency',
    workflow_success: 'Workflow success',
    latency_ms: 'Latency',
    total_tokens: 'Total tokens',
  }),
);

export function metricLabel(metric: MetricKey): string {
  const label = knownLabels.get(metric);
  return label ?? metric.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
}

export type ComparisonRun = { label: string; color: string; data: RunMetrics };

export function runLabel(index: number): string {
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
}

export function metricChildren(run: RunMetrics, metric: MetricKey): [MetricKey, number][] {
  return Object.entries(run.score_nodes[metric]?.children ?? {});
}

export function rootMetrics(run: RunMetrics): MetricKey[] {
  const children = new Set(Object.values(run.score_nodes).flatMap((node) => Object.keys(node.children)));
  return Object.keys(run.score_nodes)
    .filter((name) => !children.has(name))
    .sort((a, b) => Number(b === 'overall_score') - Number(a === 'overall_score') || a.localeCompare(b));
}

export function allMetricKeys(runs: ComparisonRun[]): MetricKey[] {
  return Array.from(new Set(runs.flatMap((run) => Object.keys(run.data.score_nodes))));
}

export function metricValue(run: RunMetrics, metric: MetricKey): number | undefined {
  const node = run.score_nodes[metric];
  return node ? run.metrics[`${metric}/${node.aggregation}`] : undefined;
}

export function metricAggregation(run: RunMetrics, metric: MetricKey): string {
  return run.score_nodes[metric]?.aggregation ?? 'Not recorded';
}

export function metricUnit(run: RunMetrics, metric: MetricKey): string {
  return run.score_nodes[metric]?.unit ?? '';
}

export function formatMetric(value: number | undefined, metric: MetricKey): string {
  if (value === undefined) return 'Not recorded';
  return value.toLocaleString('en', {
    minimumFractionDigits: metric === 'total_tokens' ? 0 : 3,
    maximumFractionDigits: 3,
  });
}

export function metricFormula(run: RunMetrics, metric: MetricKey): string {
  const children = metricChildren(run, metric);
  return children.length > 0
    ? children.map(([key, weight]) => `${weight} × ${metricLabel(key)}`).join(' + ')
    : (run.score_nodes[metric]?.description ?? 'Not recorded');
}

function definitionSignature(run: RunMetrics, metric: MetricKey): string {
  const node = run.score_nodes[metric];
  if (!node) return 'missing';
  return JSON.stringify([
    node.aggregation,
    node.description,
    node.unit,
    node.direction,
    metricChildren(run, metric)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([child, weight]) => [child, weight, definitionSignature(run, child)]),
  ]);
}

export function sameMetricDefinition(a: RunMetrics, b: RunMetrics, metric: MetricKey): boolean {
  return (
    Boolean(a.score_nodes[metric] && b.score_nodes[metric]) &&
    definitionSignature(a, metric) === definitionSignature(b, metric)
  );
}

export function matchingCases(a: RunMetrics, b: RunMetrics): boolean {
  const aIds = a.cases.map((row) => row.id).sort();
  const bIds = b.cases.map((row) => row.id).sort();
  return (
    a.dataset_digest === b.dataset_digest &&
    a.completed_cases === b.completed_cases &&
    aIds.length === bIds.length &&
    aIds.every((id, index) => id === bIds[index])
  );
}

export function deltaReason(a: RunMetrics, b: RunMetrics, metric: MetricKey): string | undefined {
  if (metricValue(a, metric) === undefined || metricValue(b, metric) === undefined) return 'Not recorded';
  if (!sameMetricDefinition(a, b, metric)) return 'Different definition';
  if (!matchingCases(a, b)) return 'Different cases';
  return undefined;
}
