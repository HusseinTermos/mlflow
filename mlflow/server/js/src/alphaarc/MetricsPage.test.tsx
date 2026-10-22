import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DesignSystemProvider } from '@databricks/design-system';
import { IntlProvider } from 'react-intl';
import { QueryClient, QueryClientProvider } from '../common/utils/reactQueryHooks';
import { testRoute, TestRouter } from '../common/utils/RoutingTestUtils';
import { evaluationApi, runMetricsSchema, type Job, type RunMetrics } from './api';
import { matchingCases, metricValue } from './metricComparison';
import MetricsPage from './MetricsPage';

jest.mock('./api', () => ({
  ...jest.requireActual<typeof import('./api')>('./api'),
  evaluationApi: { jobs: jest.fn(), metrics: jest.fn() },
}));

function job(id: string, model: string): Job {
  return {
    id,
    request: { name: `${model} evaluation`, agent: id, concurrency: 2 },
    experiment_name: 'Showcase',
    dataset_name: 'Basics',
    agent_name: `Workflow showcase · ${model}`,
    agent_version: '1',
    status: 'completed',
    created_at: '2026-10-20T10:00:00Z',
    started_at: '2026-10-20T10:00:00Z',
    finished_at: '2026-10-20T10:00:01Z',
    run_id: `${id}-run`,
    experiment_id: '1',
    error: null,
    cancellation_requested: false,
    completed: 2,
    total: 2,
    passed: 2,
    cases: [],
  };
}

function metrics(id: string, model: string): RunMetrics {
  const isA = id === 'haiku';
  return {
    job_id: id,
    run_id: `${id}-run`,
    experiment_id: '1',
    run_name: `${model} evaluation`,
    agent_name: `Workflow showcase · ${model}`,
    dataset_name: 'Basics',
    dataset_digest: 'frozen-data',
    status: 'completed',
    total_cases: 2,
    completed_cases: 2,
    score_storage: 'mlflow-ensemble-v1',
    score_nodes: {
      overall_score: {
        aggregation: 'mean',
        unit: 'score (0–1)',
        direction: 'higher',
        description: 'Weighted sum.',
        children: { quality_score: 0.7, token_efficiency: 0.2, latency_efficiency: 0.1 },
      },
      quality_score: {
        aggregation: 'mean',
        unit: 'score (0–1)',
        direction: 'higher',
        description: 'Weighted sum.',
        children: { correctness: 0.6, answer_similarity: 0.25, format_compliance: 0.15 },
      },
      correctness: {
        aggregation: 'mean',
        unit: 'score (0–1)',
        direction: 'higher',
        description: 'Exact agreement.',
        children: {},
      },
      answer_similarity: {
        aggregation: 'mean',
        unit: 'score (0–1)',
        direction: 'higher',
        description: 'Similarity.',
        children: {},
      },
      format_compliance: {
        aggregation: 'mean',
        unit: 'score (0–1)',
        direction: 'higher',
        description: 'Format.',
        children: {},
      },
      token_efficiency: {
        aggregation: 'mean',
        unit: 'score (0–1)',
        direction: 'higher',
        description: 'Tokens.',
        children: {},
      },
      latency_efficiency: {
        aggregation: 'mean',
        unit: 'score (0–1)',
        direction: 'higher',
        description: 'Latency efficiency.',
        children: {},
      },
      workflow_success: {
        aggregation: 'mean',
        unit: 'score (0–1)',
        direction: 'higher',
        description: 'Success.',
        children: {},
      },
      latency_ms: { aggregation: 'p90', unit: 'ms', direction: 'lower', description: 'Latency.', children: {} },
      total_tokens: { aggregation: 'mean', unit: 'tokens', direction: 'lower', description: 'Tokens.', children: {} },
    },
    definitions: {
      version: '1',
      aggregations: ['mean', 'min', 'p90'],
      correctness: 'Exact agreement.',
      answer_similarity: 'Lexical and character similarity.',
      format_compliance: 'One short line.',
      token_efficiency: '64 / (64 + total_tokens)',
      latency_efficiency: '5000 / (5000 + latency_ms)',
      workflow_success: 'Completed workflow.',
      latency_ms: 'End-to-end duration in milliseconds.',
      total_tokens: 'Input plus output tokens.',
      quality_score: { weighted_mean: { correctness: 0.6, answer_similarity: 0.25, format_compliance: 0.15 } },
      overall_score: { weighted_mean: { quality_score: 0.7, token_efficiency: 0.2, latency_efficiency: 0.1 } },
      weighted_accuracy: { category_weights: { arithmetic: 2, general: 1 } },
      macro_category_accuracy: 'Mean of category means.',
    },
    metrics: {
      'overall_score/mean': isA ? 0.75 : 0.8,
      'overall_score/min': isA ? 0.7 : 0.75,
      'overall_score/p90': isA ? 0.79 : 0.84,
      'quality_score/mean': isA ? 0.8 : 0.9,
      'quality_score/min': isA ? 0.6 : 0.7,
      'quality_score/p90': isA ? 0.95 : 0.98,
      'correctness/mean': isA ? 0.9 : 1,
      'answer_similarity/mean': isA ? 0.7 : 0.9,
      'format_compliance/mean': isA ? 0.566666 : 0.5,
      'token_efficiency/mean': isA ? 0.7 : 0.6,
      'latency_efficiency/mean': 0.5,
      'latency_ms/mean': isA ? 2000 : 4000,
      'total_tokens/mean': isA ? 80 : 90,
    },
    cases: [
      {
        id: 'addition',
        question: 'What is 2 + 2?',
        category: 'arithmetic',
        metrics: { overall_score: isA ? 0.7 : 0.75 },
      },
      {
        id: 'capital',
        question: 'Capital of France?',
        category: 'geography',
        metrics: { overall_score: isA ? 0.8 : 0.85 },
      },
    ],
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <IntlProvider locale="en">
      <TestRouter
        routes={[
          testRoute(
            <DesignSystemProvider>
              <QueryClientProvider client={client}>
                <MetricsPage />
              </QueryClientProvider>
            </DesignSystemProvider>,
            '/',
          ),
        ]}
      />
    </IntlProvider>,
  );
}

describe('hierarchical metric comparison', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(evaluationApi.jobs)
      .mockResolvedValue([
        { ...job('legacy', 'Old dummy'), agent_name: 'Dummy' },
        job('haiku', 'Haiku'),
        job('sonnet', 'Sonnet'),
      ]);
    jest
      .mocked(evaluationApi.metrics)
      .mockImplementation(async (id) => metrics(id, id === 'haiku' ? 'Haiku' : 'Sonnet'));
  });

  test('defaults to different showcase agents and explores the hierarchy with real aggregations', async () => {
    renderPage();
    await screen.findByRole('button', { name: 'Quality score' });
    expect(evaluationApi.metrics).toHaveBeenCalledWith('haiku');
    expect(evaluationApi.metrics).toHaveBeenCalledWith('sonnet');
    expect(evaluationApi.metrics).not.toHaveBeenCalledWith('legacy');
    expect(
      screen.getAllByText('0.7 × Quality score + 0.2 × Token efficiency + 0.1 × Latency efficiency', { exact: false })
        .length,
    ).toBe(2);
    expect(screen.getAllByText('mean · 70% of parent').length).toBe(2);
    expect(screen.getByText('+0.050')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Collapse Quality score' }));
    expect(screen.queryByRole('button', { name: 'Correctness' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Expand Quality score' }));
    await userEvent.click(screen.getByRole('button', { name: 'Quality score' }));
    expect(screen.getByRole('heading', { name: 'Quality score' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Aggregation' })).not.toBeInTheDocument();
  });

  test('retains only the comparison chart and withholds differences across different case sets', async () => {
    jest.mocked(evaluationApi.metrics).mockImplementation(async (id) => ({ ...metrics(id, id), dataset_digest: id }));
    renderPage();
    await screen.findByText(/different dataset snapshots or evaluated cases/);
    expect(screen.queryByRole('tab', { name: 'Contributions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Distribution' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByRole('figure', { name: 'Metric comparison chart' })).toBeInTheDocument();
    expect(screen.getAllByText('Different cases').length).toBeGreaterThan(0);
    expect(screen.queryByText('+0.050')).not.toBeInTheDocument();
  });

  test('reports unavailable definitions instead of inventing metrics for old runs', async () => {
    jest.mocked(evaluationApi.metrics).mockRejectedValue(new Error('No saved metric definitions'));
    renderPage();
    await screen.findByText('Run A: Error: No saved metric definitions');
    expect(screen.queryByRole('button', { name: 'Quality score' })).not.toBeInTheDocument();
  });

  test('adds a third run to the table and every chart, then removes it without duplicate selections', async () => {
    renderPage();
    await screen.findByRole('button', { name: 'Quality score' });
    await userEvent.click(screen.getByRole('button', { name: '+ Add run' }));
    await userEvent.click(screen.getByRole('combobox', { name: 'Run C' }));
    await userEvent.click(screen.getByText(/Old dummy evaluation/));
    await screen.findByText('C − A');
    expect(evaluationApi.metrics).toHaveBeenCalledWith('legacy');
    expect(screen.getByLabelText('Overall score, C: 0.800 score (0–1)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove run B' }));
    expect(screen.queryByText('C − A')).not.toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
    expect(screen.getByLabelText('Overall score, B: 0.800 score (0–1)')).toBeInTheDocument();
  });

  test('suppresses deltas when reporting aggregations differ', async () => {
    jest.mocked(evaluationApi.metrics).mockImplementation(async (id) => {
      const run = metrics(id, id);
      if (id === 'sonnet') run.score_nodes['overall_score'].aggregation = 'p90';
      return run;
    });
    renderPage();
    await screen.findByText(/different saved definitions across runs/);
    expect(screen.queryByText('+0.050')).not.toBeInTheDocument();
  });

  test('unions arbitrary metrics, shows absent values without bars, and detects changed nested formulas', async () => {
    jest.mocked(evaluationApi.metrics).mockImplementation(async (id) => {
      const run = metrics(id, id);
      if (id === 'sonnet') {
        delete run.score_nodes['workflow_success'];
        delete run.score_nodes['answer_similarity'];
        delete run.metrics['answer_similarity/mean'];
        run.score_nodes['groundedness'] = {
          aggregation: 'mean',
          description: 'Evidence support.',
          unit: 'score (0–1)',
          direction: 'higher',
          children: {},
        };
        run.score_nodes['cost_usd'] = {
          aggregation: 'mean',
          description: 'Cost per case.',
          unit: 'USD',
          direction: 'lower',
          children: {},
        };
        run.score_nodes['quality_score'].children = { correctness: 0.6, groundedness: 0.25, format_compliance: 0.15 };
        run.metrics['groundedness/mean'] = 0;
        run.metrics['cost_usd/mean'] = 0.004;
      }
      return run;
    });
    renderPage();
    await screen.findByText(/missing scores are not treated as zero/);
    expect(screen.getByRole('button', { name: 'Groundedness' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cost usd' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Workflow success' })).toBeInTheDocument();
    expect(screen.getAllByText('Different definition').length).toBeGreaterThan(0);
    expect(screen.queryByText('+0.050')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Groundedness' }));
    expect(screen.queryByLabelText(/Groundedness, A:/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Groundedness, B: 0.000 score (0–1)')).toBeInTheDocument();
    expect(screen.getAllByText('Not recorded').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Collapse Quality score' }));
    expect(screen.queryByRole('button', { name: 'Groundedness' })).not.toBeInTheDocument();
  });

  test('validates metric responses and distinguishes missing values from zero', () => {
    const run = metrics('haiku', 'Haiku');
    expect(runMetricsSchema.safeParse(run).success).toBe(true);
    expect(runMetricsSchema.safeParse({ ...run, definitions: {} }).success).toBe(false);
    expect(runMetricsSchema.safeParse({ ...run, metrics: { invalid: Number.NaN } }).success).toBe(false);
    expect(metricValue({ ...run, metrics: { 'correctness/mean': 0 } }, 'correctness')).toBe(0);
    expect(metricValue(run, 'workflow_success')).toBeUndefined();
    expect(matchingCases(run, { ...run, cases: [...run.cases].reverse() })).toBe(true);
    expect(matchingCases(run, { ...run, cases: run.cases.slice(0, 1) })).toBe(false);
  });
});
