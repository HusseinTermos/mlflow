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
  launch: async (request: LaunchRequest) =>
    jobSchema.parse(await fetchAPI('/api/alphaarc/jobs', { method: 'POST', body: request })),
  cancel: async (id: string) =>
    jobSchema.parse(await fetchAPI(`/api/alphaarc/jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST' })),
};
