import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DesignSystemProvider } from '@databricks/design-system';
import { IntlProvider } from 'react-intl';
import { QueryClient, QueryClientProvider } from '../common/utils/reactQueryHooks';
import { testRoute, TestRouter } from '../common/utils/RoutingTestUtils';
import { evaluationApi } from './api';
import LaunchPage from './LaunchPage';

jest.mock('./api', () => ({
  evaluationApi: { catalog: jest.fn(), datasets: jest.fn(), preview: jest.fn(), launch: jest.fn() },
}));

const basics = { id: 'basics', name: 'Basics', digest: 'basics-digest' };
const quick = { id: 'quick', name: 'Quick check', digest: 'quick-digest' };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <IntlProvider locale="en">
      <TestRouter
        routes={[
          testRoute(
            <DesignSystemProvider>
              <QueryClientProvider client={client}>
                <LaunchPage />
              </QueryClientProvider>
            </DesignSystemProvider>,
            '/',
          ),
        ]}
      />
    </IntlProvider>,
  );
}

describe('evaluation launch selections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(evaluationApi.catalog).mockResolvedValue({
      experiments: [
        { id: 'task-1', name: 'First task' },
        { id: 'task-2', name: 'Empty task' },
      ],
      agents: [
        { id: 'concise', name: 'Concise', version: '1', model: 'claude-haiku-4-5-20251001', max_output_tokens: 64 },
        { id: 'explanatory', name: 'Explanatory', version: '2', model: 'claude-sonnet-4-6', max_output_tokens: 96 },
      ],
      model: 'test-model',
      max_output_tokens: 64,
    });
    jest
      .mocked(evaluationApi.datasets)
      .mockImplementation(async (experimentId) => (experimentId === 'task-1' ? [basics, quick] : []));
    jest.mocked(evaluationApi.preview).mockImplementation(async (_, datasetId) => ({
      ...(datasetId === 'quick' ? quick : basics),
      case_count: datasetId === 'quick' ? 2 : 6,
      cases: Array.from({ length: datasetId === 'quick' ? 2 : 6 }, (_, index) => ({
        id: `${index}`,
        question: `${datasetId} question ${index}`,
        expected: 'Answer',
      })),
    }));
    jest.mocked(evaluationApi.launch).mockRejectedValue(new Error('Temporary network failure'));
  });

  test('defaults to the entire selected dataset and retains the request id on retry', async () => {
    renderPage();
    await screen.findByText('basics question 0');
    await userEvent.click(screen.getByRole('combobox', { name: 'Dataset' }));
    await userEvent.click(screen.getByText(/Quick check · quick-di/));
    await screen.findByText('quick question 0');
    expect(screen.queryByText('basics question 0')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('combobox', { name: 'Agent configuration' }));
    await userEvent.click(screen.getByText('Explanatory · v2'));
    const submit = screen.getByRole('button', { name: 'Launch evaluation' });
    await waitFor(() => expect(submit).toBeEnabled());
    await userEvent.click(submit);
    await screen.findByText('Error: Temporary network failure');
    expect(evaluationApi.launch).toHaveBeenCalledWith(
      expect.objectContaining({
        experiment_id: 'task-1',
        dataset_id: 'quick',
        dataset_digest: 'quick-digest',
        agent: 'explanatory',
        case_limit: null,
        concurrency: 2,
      }),
    );
    await userEvent.click(submit);
    await waitFor(() => expect(evaluationApi.launch).toHaveBeenCalledTimes(2));
    expect(jest.mocked(evaluationApi.launch).mock.calls[0][0].request_id).toBe(
      jest.mocked(evaluationApi.launch).mock.calls[1][0].request_id,
    );
  });

  test('shows the selected agent model and token limit instead of global defaults', async () => {
    renderPage();
    await screen.findByText('basics question 0');
    expect(screen.getByText(/claude-haiku-4-5-20251001/)).toBeInTheDocument();
    expect(screen.getByText(/up to 64 output tokens/)).toBeInTheDocument();
    expect(screen.queryByText(/test-model/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('combobox', { name: 'Agent configuration' }));
    await userEvent.click(screen.getByText('Explanatory · v2'));
    expect(screen.getByText(/claude-sonnet-4-6/)).toBeInTheDocument();
    expect(screen.getByText(/up to 96 output tokens/)).toBeInTheDocument();
    expect(screen.queryByText(/claude-haiku-4-5-20251001/)).not.toBeInTheDocument();
    expect(screen.queryByText(/up to 64 output tokens/)).not.toBeInTheDocument();
  });

  test('accepts numeric limits and concurrency and prevents invalid counts', async () => {
    renderPage();
    await screen.findByText('basics question 0');
    const limit = screen.getByRole('spinbutton', { name: 'Case limit (optional)' });
    const concurrency = screen.getByRole('spinbutton', { name: 'Concurrent cases' });
    const submit = screen.getByRole('button', { name: 'Launch evaluation' });
    expect(limit).toHaveValue(null);
    expect(concurrency).toHaveValue(2);
    await userEvent.type(limit, '2');
    await userEvent.clear(concurrency);
    await userEvent.type(concurrency, '4');
    await waitFor(() => expect(submit).toBeEnabled());
    await userEvent.click(submit);
    await screen.findByText('Error: Temporary network failure');
    expect(evaluationApi.launch).toHaveBeenCalledWith(expect.objectContaining({ case_limit: 2, concurrency: 4 }));
    await userEvent.clear(limit);
    await userEvent.type(limit, '7');
    expect(submit).toBeDisabled();
    await userEvent.clear(limit);
    await userEvent.type(limit, '1.5');
    expect(submit).toBeDisabled();
    await userEvent.clear(limit);
    await userEvent.clear(concurrency);
    expect(submit).toBeDisabled();
    expect(evaluationApi.launch).toHaveBeenCalledTimes(1);
  });

  test('changing to an experiment without datasets clears the old preview and prevents launching', async () => {
    renderPage();
    await screen.findByText('basics question 0');
    await userEvent.click(screen.getByRole('combobox', { name: 'Experiment' }));
    await userEvent.click(screen.getByText('Empty task'));
    await screen.findByText(/No evaluation datasets are linked/);
    expect(screen.queryByText('basics question 0')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Launch evaluation' })).toBeDisabled();
    expect(evaluationApi.datasets).toHaveBeenCalledWith('task-2');
    expect(evaluationApi.launch).not.toHaveBeenCalled();
  });
});
