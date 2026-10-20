import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { DesignSystemProvider } from '@databricks/design-system';
import { IntlProvider } from 'react-intl';
import { QueryClient, QueryClientProvider } from '../common/utils/reactQueryHooks';
import { testRoute, TestRouter } from '../common/utils/RoutingTestUtils';
import { evaluationApi, type Job } from './api';
import JobsPage from './JobsPage';

jest.mock('./api', () => ({ evaluationApi: { jobs: jest.fn(), job: jest.fn(), cancel: jest.fn() } }));

const newest: Job = {
  id: 'newest',
  request: { name: 'Newest evaluation', agent: 'concise', concurrency: 2 },
  experiment_name: 'Task',
  dataset_name: 'Basics',
  agent_name: 'Dummy',
  agent_version: '1',
  status: 'completed',
  created_at: '2026-10-20T10:00:00Z',
  started_at: null,
  finished_at: null,
  run_id: null,
  experiment_id: '1',
  error: null,
  cancellation_requested: false,
  completed: 1,
  total: 1,
  passed: 1,
  cases: [
    {
      id: 'case',
      question: 'Question?',
      expected: 'Answer',
      status: 'completed',
      output: 'Answer',
      score: 1,
      error: null,
      input_tokens: 1,
      output_tokens: 1,
    },
  ],
};

function renderPage(url: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <IntlProvider locale="en">
      <TestRouter
        initialEntries={[url]}
        routes={[
          testRoute(
            <DesignSystemProvider>
              <QueryClientProvider client={queryClient}>
                <JobsPage />
              </QueryClientProvider>
            </DesignSystemProvider>,
            '/alphaarc/jobs',
          ),
        ]}
      />
    </IntlProvider>,
  );
}

describe('requested evaluation jobs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(evaluationApi.jobs).mockResolvedValue([newest]);
  });

  test('fetches an older job directly even when it is outside the recent list', async () => {
    jest
      .mocked(evaluationApi.job)
      .mockResolvedValue({ ...newest, id: 'older', request: { ...newest.request, name: 'Older evaluation' } });
    renderPage('/alphaarc/jobs?job=older');
    await screen.findByRole('heading', { name: 'Older evaluation', level: 3 });
    expect(evaluationApi.job).toHaveBeenCalledWith('older');
    expect(screen.queryByRole('heading', { name: 'Newest evaluation', level: 3 })).not.toBeInTheDocument();
  });

  test('shows a missing-job error instead of substituting the newest evaluation', async () => {
    jest.mocked(evaluationApi.job).mockRejectedValue(new Error('Evaluation job missing was not found'));
    renderPage('/alphaarc/jobs?job=missing');
    await screen.findByText(/Could not load evaluation job missing/);
    expect(screen.queryByRole('heading', { name: 'Newest evaluation', level: 3 })).not.toBeInTheDocument();
  });

  test('reports a service failure without presenting another run as the requested result', async () => {
    jest.mocked(evaluationApi.job).mockRejectedValue(new Error('Service unavailable'));
    renderPage('/alphaarc/jobs?job=older');
    await screen.findByText(/Could not load evaluation job older.*Service unavailable/);
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
  });

  test('asks for a selection when no job is requested', async () => {
    renderPage('/alphaarc/jobs');
    await screen.findByText('Select an evaluation job to view its progress and results.');
    expect(evaluationApi.job).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
  });
});
