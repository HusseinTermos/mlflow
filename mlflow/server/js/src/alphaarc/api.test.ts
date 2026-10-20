import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fetchAPI } from '../common/utils/FetchUtils';
import { evaluationApi, jobSchema } from './api';

jest.mock('../common/utils/FetchUtils', () => ({ fetchAPI: jest.fn() }));

const job = {
  id: 'job-1',
  request: { name: 'Test evaluation', agent: 'concise', concurrency: 2 },
  experiment_name: 'Task',
  dataset_name: 'Basics',
  agent_name: 'Dummy',
  agent_version: '1',
  status: 'running',
  created_at: '2026-10-20T10:00:00Z',
  started_at: '2026-10-20T10:00:01Z',
  finished_at: null,
  run_id: null,
  experiment_id: null,
  error: null,
  cancellation_requested: false,
  completed: 0,
  total: 1,
  passed: 0,
  cases: [
    {
      id: 'addition',
      question: '2+2?',
      expected: '4',
      status: 'running',
      output: null,
      score: null,
      error: null,
      input_tokens: 0,
      output_tokens: 0,
    },
  ],
};

describe('evaluation API boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('accepts in-progress jobs before MLflow creates a run', async () => {
    jest.mocked(fetchAPI).mockResolvedValue([job]);
    const jobs = await evaluationApi.jobs();
    expect(jobs[0].run_id).toBeNull();
    expect(jobs[0].cases[0].score).toBeNull();
  });

  test('rejects malformed progress instead of displaying an invented status', async () => {
    jest.mocked(fetchAPI).mockResolvedValue([{ ...job, status: 'unexpected' }]);
    await expect(evaluationApi.jobs()).rejects.toThrow();
    expect(jobSchema.safeParse({ ...job, completed: 'six' }).success).toBe(false);
  });

  test('preserves the caller request id when submitting a paid evaluation', async () => {
    const request = {
      request_id: 'stable-request-id',
      name: 'Test',
      agent: 'concise',
      experiment_id: '2',
      dataset_id: 'dummy-basics-v1',
      dataset_digest: 'snapshot',
      case_limit: 1,
      concurrency: 1,
    };
    jest.mocked(fetchAPI).mockResolvedValue(job);
    await evaluationApi.launch(request);
    expect(fetchAPI).toHaveBeenCalledWith('/api/alphaarc/jobs', { method: 'POST', body: request });
    expect(fetchAPI).toHaveBeenCalledTimes(1);
  });

  test('loads datasets and previews within the selected experiment', async () => {
    const dataset = { id: 'data-2', name: 'Second dataset', digest: 'abc' };
    jest
      .mocked(fetchAPI)
      .mockResolvedValueOnce([dataset])
      .mockResolvedValueOnce({
        ...dataset,
        case_count: 1,
        cases: [{ id: 'case-1', question: 'Question?', expected: 'Answer' }],
      });
    expect(await evaluationApi.datasets('experiment/2')).toEqual([dataset]);
    expect((await evaluationApi.preview('experiment/2', dataset.id)).cases).toHaveLength(1);
    expect(fetchAPI).toHaveBeenNthCalledWith(1, '/api/alphaarc/experiments/experiment%2F2/datasets');
    expect(fetchAPI).toHaveBeenNthCalledWith(2, '/api/alphaarc/experiments/experiment%2F2/datasets/data-2');
  });
});
