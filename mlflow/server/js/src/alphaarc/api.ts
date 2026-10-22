import { z } from 'zod';
import { fetchAPI } from '../common/utils/FetchUtils';

const caseSchema = z.object({
  id: z.string(),
  question: z.string(),
  expected: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  output: z.string().nullable(),
  score: z.number().nullable(),
  error: z.string().nullable(),
  input_tokens: z.number(),
  output_tokens: z.number(),
});

export const jobSchema = z.object({
  id: z.string(),
  request: z.object({ name: z.string(), agent: z.string(), concurrency: z.number() }),
  experiment_name: z.string().nullable(),
  dataset_name: z.string().nullable(),
  agent_name: z.string().nullable(),
  agent_version: z.string().nullable(),
  status: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']),
  created_at: z.string(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  run_id: z.string().nullable(),
  experiment_id: z.string().nullable(),
  error: z.string().nullable(),
  cancellation_requested: z.boolean(),
  completed: z.number(),
  total: z.number(),
  passed: z.number(),
  cases: z.array(caseSchema),
});

export const catalogSchema = z.object({
  agents: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      version: z.string(),
      model: z.string(),
      max_output_tokens: z.number().int().positive(),
    }),
  ),
  experiments: z.array(z.object({ id: z.string(), name: z.string() })),
  model: z.string(),
  max_output_tokens: z.number(),
});

const datasetSchema = z.object({ id: z.string(), name: z.string(), digest: z.string() });
const previewSchema = datasetSchema.extend({
  case_count: z.number().int().positive(),
  cases: z.array(z.object({ id: z.string(), question: z.string(), expected: z.string() })).min(1),
});
export type Catalog = z.infer<typeof catalogSchema>;
export type Job = z.infer<typeof jobSchema>;
export type LaunchRequest = {
  request_id: string;
  name: string;
  agent: string;
  experiment_id: string;
  dataset_id: string;
  dataset_digest: string;
  case_limit: number | null;
  concurrency: number;
};

export const metricKeySchema = z.string().min(1);
export const metricDefinitionsSchema = z.object({
  version: z.literal('1'),
  aggregations: z.array(z.enum(['mean', 'min', 'p90'])),
  correctness: z.string(),
  answer_similarity: z.string(),
  format_compliance: z.string(),
  token_efficiency: z.string(),
  latency_efficiency: z.string(),
  workflow_success: z.string(),
  latency_ms: z.string(),
  total_tokens: z.string(),
  quality_score: z.object({
    weighted_mean: z.object({ correctness: z.number(), answer_similarity: z.number(), format_compliance: z.number() }),
  }),
  overall_score: z.object({
    weighted_mean: z.object({
      quality_score: z.number(),
      token_efficiency: z.number(),
      latency_efficiency: z.number(),
    }),
  }),
  weighted_accuracy: z.object({ category_weights: z.record(z.number()) }),
  macro_category_accuracy: z.string(),
});
export const runMetricsSchema = z.object({
  job_id: z.string(),
  run_id: z.string(),
  experiment_id: z.string(),
  run_name: z.string(),
  agent_name: z.string().nullable(),
  dataset_name: z.string().nullable(),
  dataset_digest: z.string(),
  status: z.string(),
  total_cases: z.number().int().nonnegative(),
  completed_cases: z.number().int().nonnegative(),
  definitions: metricDefinitionsSchema.nullable(),
  metrics: z.record(z.number().finite()),
  score_storage: z.enum(['mlflow-ensemble-v1', 'legacy-artifact']),
  score_nodes: z.record(
    z.object({
      aggregation: z.enum(['mean', 'min', 'max', 'median', 'variance', 'p90']),
      description: z.string(),
      unit: z.string().min(1),
      direction: z.enum(['higher', 'lower']),
      children: z.record(metricKeySchema, z.number().finite().min(0).max(1)),
    }),
  ),
  cases: z.array(
    z.object({ id: z.string(), question: z.string(), category: z.string(), metrics: z.record(z.number().finite()) }),
  ),
});
export type MetricKey = z.infer<typeof metricKeySchema>;
export type RunMetrics = z.infer<typeof runMetricsSchema>;
export type MetricAggregation = 'mean' | 'min' | 'p90';

export const evaluationApi = {
  catalog: async () => catalogSchema.parse(await fetchAPI('/api/alphaarc/catalog')),
  datasets: async (experimentId: string) =>
    z
      .array(datasetSchema)
      .parse(await fetchAPI(`/api/alphaarc/experiments/${encodeURIComponent(experimentId)}/datasets`)),
  preview: async (experimentId: string, datasetId: string) =>
    previewSchema.parse(
      await fetchAPI(
        `/api/alphaarc/experiments/${encodeURIComponent(experimentId)}/datasets/${encodeURIComponent(datasetId)}`,
      ),
    ),
  jobs: async () => z.array(jobSchema).parse(await fetchAPI('/api/alphaarc/jobs')),
  job: async (id: string) => jobSchema.parse(await fetchAPI(`/api/alphaarc/jobs/${encodeURIComponent(id)}`)),
  metrics: async (id: string) =>
    runMetricsSchema.parse(await fetchAPI(`/api/alphaarc/jobs/${encodeURIComponent(id)}/metrics`)),
  launch: async (request: LaunchRequest) =>
    jobSchema.parse(await fetchAPI('/api/alphaarc/jobs', { method: 'POST', body: request })),
  cancel: async (id: string) =>
    jobSchema.parse(await fetchAPI(`/api/alphaarc/jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST' })),
};
