import { useState } from 'react';
import {
  Alert,
  Button,
  FormUI,
  Input,
  SimpleSelect,
  SimpleSelectOption,
  Spinner,
  Table,
  TableCell,
  TableHeader,
  TableRow,
  Typography,
  useDesignSystemTheme,
} from '@databricks/design-system';
import { FormattedMessage, useIntl } from 'react-intl';
import { useMutation, useQuery, useQueryClient } from '../common/utils/reactQueryHooks';
import { ScrollablePageWrapper } from '../common/components/ScrollablePageWrapper';
import { Link, useNavigate } from '../common/utils/RoutingUtils';
import { evaluationApi, type LaunchRequest } from './api';

export default function LaunchPage() {
  const { theme } = useDesignSystemTheme();
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const catalog = useQuery(['alphaarc', 'catalog'], { queryFn: evaluationApi.catalog, retry: false });
  const data = catalog.data;
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [name, setName] = useState('AlphaLab dummy evaluation');
  const [agent, setAgent] = useState('concise');
  const [selectedExperimentId, setSelectedExperimentId] = useState('');
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [caseLimit, setCaseLimit] = useState('');
  const [concurrency, setConcurrency] = useState('2');
  const experimentId =
    data?.experiments.find((item) => item.id === selectedExperimentId)?.id ?? data?.experiments[0]?.id ?? '';
  const selectedAgent = data?.agents.find((item) => item.id === agent) ?? data?.agents[0];
  const datasets = useQuery(['alphaarc', 'datasets', experimentId], {
    queryFn: () => evaluationApi.datasets(experimentId),
    enabled: Boolean(experimentId),
    retry: false,
  });
  const selectedDataset = datasets.data?.find((item) => item.id === selectedDatasetId) ?? datasets.data?.[0];
  const datasetId = selectedDataset?.id ?? '';
  const preview = useQuery(['alphaarc', 'preview', experimentId, datasetId], {
    queryFn: () => evaluationApi.preview(experimentId, datasetId),
    enabled: Boolean(experimentId && datasetId),
    retry: false,
  });
  const limit = caseLimit === '' ? null : Number(caseLimit);
  const validLimit =
    limit === null || (Number.isSafeInteger(limit) && limit > 0 && (!preview.data || limit <= preview.data.case_count));
  const workers = Number(concurrency);
  const validConcurrency = Number.isSafeInteger(workers) && workers > 0;
  const caseCount = limit ?? preview.data?.case_count ?? 0;
  const previewCount = Math.min(5, validLimit ? caseCount : (preview.data?.case_count ?? 0));
  const launch = useMutation({
    mutationFn: (request: LaunchRequest) => evaluationApi.launch(request),
    onSuccess: (job) => navigate(`/alphaarc/jobs?job=${job.id}`),
    retry: false,
  });
  const canLaunch = Boolean(
    name.trim() &&
    selectedAgent &&
    preview.data &&
    validLimit &&
    validConcurrency &&
    !launch.isLoading &&
    !preview.isFetching &&
    !preview.isError &&
    !datasets.isFetching &&
    !datasets.isError &&
    !catalog.isFetching,
  );
  const fieldCss = { display: 'flex', flexDirection: 'column' as const, gap: theme.spacing.xs, minWidth: 0 };
  const cardCss = {
    padding: theme.spacing.lg,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borders.borderRadiusLg,
    backgroundColor: theme.colors.backgroundPrimary,
  };
  const columnsCss = {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    gap: theme.spacing.lg,
    '@media (max-width: 760px)': { gridTemplateColumns: '1fr' },
  };

  return (
    <ScrollablePageWrapper>
      <div css={{ padding: theme.spacing.xl, maxWidth: 1040, margin: '0 auto' }}>
        <div
          css={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: theme.spacing.md,
            flexWrap: 'wrap',
            marginBottom: theme.spacing.lg,
          }}
        >
          <div>
            <Typography.Title level={2} css={{ marginTop: 0, marginBottom: theme.spacing.xs }}>
              <FormattedMessage defaultMessage="Launch evaluation" description="AlphaArc launch page title" />
            </Typography.Title>
            <Typography.Text css={{ color: theme.colors.textSecondary }}>
              <FormattedMessage
                defaultMessage="Choose an agent and dataset, then configure your run."
                description="Evaluation setup introduction"
              />
            </Typography.Text>
          </div>
          <Link componentId="alphaarc.launch.jobs" to="/alphaarc/jobs">
            <FormattedMessage defaultMessage="View evaluation jobs" description="Link to evaluation jobs" />
          </Link>
        </div>
        {catalog.isLoading && <Spinner />}
        {catalog.isError && (
          <Alert
            componentId="alphaarc.launch.catalog-error"
            type="error"
            message={String(catalog.error)}
            closable={false}
          />
        )}
        {data && (
          <>
            <form
              css={{ ...cardCss, display: 'grid', gap: theme.spacing.lg }}
              onSubmit={(event) => {
                event.preventDefault();
                if (!canLaunch || !selectedAgent || !preview.data) return;
                launch.mutate({
                  request_id: requestId,
                  name: name.trim(),
                  agent: selectedAgent.id,
                  experiment_id: experimentId,
                  dataset_id: preview.data.id,
                  dataset_digest: preview.data.digest,
                  case_limit: limit,
                  concurrency: workers,
                });
              }}
            >
              <div
                css={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md }}
              >
                <Typography.Title level={3} css={{ margin: 0 }}>
                  <FormattedMessage defaultMessage="Evaluation setup" description="Evaluation setup section title" />
                </Typography.Title>
                <Button
                  componentId="alphaarc.launch.refresh"
                  onClick={() => {
                    setRequestId(crypto.randomUUID());
                    launch.reset();
                    queryClient.invalidateQueries(['alphaarc']);
                  }}
                >
                  <FormattedMessage defaultMessage="Refresh choices" description="Refresh evaluation catalogs" />
                </Button>
              </div>
              <div css={fieldCss}>
                <FormUI.Label htmlFor="alphaarc-name">
                  <FormattedMessage defaultMessage="Evaluation name" description="Evaluation name field" />
                </FormUI.Label>
                <Input
                  id="alphaarc-name"
                  componentId="alphaarc.launch.name"
                  value={name}
                  maxLength={100}
                  required
                  onChange={(e) => {
                    setName(e.target.value);
                    setRequestId(crypto.randomUUID());
                  }}
                />
              </div>
              <div css={columnsCss}>
                <div css={fieldCss}>
                  <FormUI.Label htmlFor="alphaarc-experiment">
                    <FormattedMessage defaultMessage="Experiment" description="Evaluation experiment selector" />
                  </FormUI.Label>
                  <SimpleSelect
                    id="alphaarc-experiment"
                    componentId="alphaarc.launch.experiment"
                    aria-label="Experiment"
                    css={{ width: '100%' }}
                    value={experimentId}
                    disabled={data.experiments.length === 0}
                    onChange={(e) => {
                      setSelectedExperimentId(e.target.value);
                      setSelectedDatasetId('');
                      setCaseLimit('');
                      setRequestId(crypto.randomUUID());
                    }}
                  >
                    {data.experiments.map((item) => (
                      <SimpleSelectOption key={item.id} value={item.id}>
                        {item.name}
                      </SimpleSelectOption>
                    ))}
                  </SimpleSelect>
                </div>
                <div css={fieldCss}>
                  <FormUI.Label htmlFor="alphaarc-agent">
                    <FormattedMessage defaultMessage="Agent" description="Evaluation agent selector" />
                  </FormUI.Label>
                  <SimpleSelect
                    id="alphaarc-agent"
                    componentId="alphaarc.launch.agent"
                    aria-label="Agent configuration"
                    css={{ width: '100%' }}
                    value={selectedAgent?.id ?? ''}
                    disabled={data.agents.length === 0}
                    onChange={(e) => {
                      setAgent(e.target.value);
                      setRequestId(crypto.randomUUID());
                    }}
                  >
                    {data.agents.map((item) => (
                      <SimpleSelectOption key={item.id} value={item.id}>
                        {item.name} · v{item.version}
                      </SimpleSelectOption>
                    ))}
                  </SimpleSelect>
                </div>
              </div>
              {data.experiments.length === 0 && (
                <Alert
                  componentId="alphaarc.launch.no-experiments"
                  type="info"
                  closable={false}
                  message={
                    <FormattedMessage
                      defaultMessage="Create an experiment in MLflow, then refresh choices."
                      description="No evaluation experiments"
                    />
                  }
                />
              )}
              {data.agents.length === 0 && (
                <Alert
                  componentId="alphaarc.launch.no-agents"
                  type="info"
                  closable={false}
                  message={
                    <FormattedMessage
                      defaultMessage="No evaluation agents are registered."
                      description="No registered evaluation agents"
                    />
                  }
                />
              )}
              <div css={fieldCss}>
                <FormUI.Label htmlFor="alphaarc-dataset">
                  <FormattedMessage defaultMessage="Dataset" description="Evaluation dataset selector" />
                </FormUI.Label>
                <SimpleSelect
                  id="alphaarc-dataset"
                  componentId="alphaarc.launch.dataset"
                  aria-label="Dataset"
                  css={{ width: '100%' }}
                  value={datasetId}
                  disabled={!datasets.data?.length || datasets.isFetching}
                  onChange={(e) => {
                    setSelectedDatasetId(e.target.value);
                    setCaseLimit('');
                    setRequestId(crypto.randomUUID());
                  }}
                >
                  {datasets.data?.map((item) => (
                    <SimpleSelectOption
                      key={item.id}
                      value={item.id}
                    >{`${item.name} · ${item.digest.slice(0, 8)}`}</SimpleSelectOption>
                  ))}
                </SimpleSelect>
                {preview.data && !preview.isError && (
                  <Typography.Text css={{ color: theme.colors.textSecondary }}>
                    <FormattedMessage
                      defaultMessage="{count} cases available"
                      description="Selected dataset case count"
                      values={{ count: preview.data.case_count }}
                    />
                  </Typography.Text>
                )}
              </div>
              {(datasets.isFetching || preview.isFetching) && <Spinner />}
              {datasets.isError && (
                <Alert
                  componentId="alphaarc.launch.datasets-error"
                  type="error"
                  closable={false}
                  message={String(datasets.error)}
                />
              )}
              {experimentId && datasets.data?.length === 0 && (
                <Alert
                  componentId="alphaarc.launch.no-datasets"
                  type="info"
                  closable={false}
                  message={
                    <FormattedMessage
                      defaultMessage="No evaluation datasets are linked to this experiment. Add one in MLflow's Datasets page, then refresh choices."
                      description="No linked evaluation datasets"
                    />
                  }
                />
              )}
              {preview.isError && (
                <Alert
                  componentId="alphaarc.launch.preview-error"
                  type="error"
                  closable={false}
                  message={String(preview.error)}
                />
              )}
              <div
                css={{
                  borderTop: `1px solid ${theme.colors.border}`,
                  paddingTop: theme.spacing.lg,
                  display: 'grid',
                  gap: theme.spacing.md,
                }}
              >
                <Typography.Title level={4} css={{ margin: 0 }}>
                  <FormattedMessage defaultMessage="Run settings" description="Evaluation run settings section" />
                </Typography.Title>
                <div css={columnsCss}>
                  <div css={fieldCss}>
                    <FormUI.Label htmlFor="alphaarc-cases">
                      <FormattedMessage
                        defaultMessage="Case limit (optional)"
                        description="Optional evaluation case limit label"
                      />
                    </FormUI.Label>
                    <Input
                      id="alphaarc-cases"
                      componentId="alphaarc.launch.cases"
                      type="number"
                      min={1}
                      max={preview.data?.case_count}
                      step={1}
                      value={caseLimit}
                      aria-describedby="alphaarc-cases-hint"
                      aria-invalid={!validLimit}
                      placeholder={intl.formatMessage({
                        defaultMessage: 'All cases',
                        description: 'Entire dataset case limit placeholder',
                      })}
                      onChange={(e) => {
                        setCaseLimit(e.target.value);
                        setRequestId(crypto.randomUUID());
                      }}
                    />
                    <Typography.Text id="alphaarc-cases-hint" css={{ color: theme.colors.textSecondary }}>
                      <FormattedMessage
                        defaultMessage="Leave blank to run the entire dataset."
                        description="Optional evaluation case limit help"
                      />
                    </Typography.Text>
                    {!validLimit && (
                      <FormUI.Message
                        type="error"
                        message={
                          <FormattedMessage
                            defaultMessage="Enter a positive whole number within the dataset size."
                            description="Invalid evaluation case limit"
                          />
                        }
                      />
                    )}
                  </div>
                  <div css={fieldCss}>
                    <FormUI.Label htmlFor="alphaarc-concurrency">
                      <FormattedMessage defaultMessage="Concurrent cases" description="Evaluation concurrency label" />
                    </FormUI.Label>
                    <Input
                      id="alphaarc-concurrency"
                      componentId="alphaarc.launch.concurrency"
                      type="number"
                      min={1}
                      step={1}
                      required
                      value={concurrency}
                      aria-describedby="alphaarc-concurrency-hint"
                      aria-invalid={!validConcurrency}
                      onChange={(e) => {
                        setConcurrency(e.target.value);
                        setRequestId(crypto.randomUUID());
                      }}
                    />
                    <Typography.Text id="alphaarc-concurrency-hint" css={{ color: theme.colors.textSecondary }}>
                      <FormattedMessage
                        defaultMessage="Cases evaluated in parallel. Default: 2."
                        description="Evaluation concurrency help"
                      />
                    </Typography.Text>
                    {!validConcurrency && (
                      <FormUI.Message
                        type="error"
                        message={
                          <FormattedMessage
                            defaultMessage="Enter a positive whole number."
                            description="Invalid evaluation concurrency"
                          />
                        }
                      />
                    )}
                  </div>
                </div>
                <Typography.Text css={{ color: theme.colors.textSecondary }}>
                  {selectedAgent && (
                    <>
                      {selectedAgent.model} ·{' '}
                      <FormattedMessage
                        defaultMessage="One LLM call per case, up to {tokens} output tokens."
                        description="Evaluation model usage hint"
                        values={{ tokens: selectedAgent.max_output_tokens }}
                      />
                    </>
                  )}
                </Typography.Text>
              </div>
              {launch.isError && (
                <Alert
                  componentId="alphaarc.launch.submit-error"
                  type="error"
                  message={String(launch.error)}
                  closable={false}
                />
              )}
              <div
                css={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: theme.spacing.md,
                  paddingTop: theme.spacing.lg,
                  borderTop: `1px solid ${theme.colors.border}`,
                }}
              >
                <Typography.Text css={{ color: theme.colors.textSecondary }}>
                  {preview.data && validLimit && validConcurrency && (
                    <FormattedMessage
                      defaultMessage="{count} cases · {workers} at a time"
                      description="Evaluation run size summary"
                      values={{ count: caseCount, workers }}
                    />
                  )}
                </Typography.Text>
                <Button
                  componentId="alphaarc.launch.submit"
                  type="primary"
                  htmlType="submit"
                  loading={launch.isLoading}
                  disabled={!canLaunch}
                >
                  <FormattedMessage defaultMessage="Launch evaluation" description="Launch evaluation button" />
                </Button>
              </div>
            </form>
            {preview.data && !preview.isError && (
              <section css={{ ...cardCss, marginTop: theme.spacing.lg }}>
                <div
                  css={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: theme.spacing.md,
                    marginBottom: theme.spacing.md,
                  }}
                >
                  <Typography.Title level={3} css={{ margin: 0 }}>
                    <FormattedMessage defaultMessage="Dataset preview" description="Dataset preview heading" />
                  </Typography.Title>
                  <Typography.Text css={{ color: theme.colors.textSecondary }}>
                    <FormattedMessage
                      defaultMessage="Showing {count} of {total} cases"
                      description="Dataset preview sample count"
                      values={{ count: previewCount, total: preview.data.case_count }}
                    />
                  </Typography.Text>
                </div>
                <Table>
                  <TableRow isHeader>
                    <TableHeader componentId="alphaarc.launch.question">
                      <FormattedMessage defaultMessage="Question" description="Dataset question column" />
                    </TableHeader>
                    <TableHeader componentId="alphaarc.launch.expected">
                      <FormattedMessage defaultMessage="Expected answer" description="Dataset expectation column" />
                    </TableHeader>
                  </TableRow>
                  {preview.data.cases.slice(0, previewCount).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell multiline>{item.question}</TableCell>
                      <TableCell>{item.expected}</TableCell>
                    </TableRow>
                  ))}
                </Table>
              </section>
            )}
          </>
        )}
      </div>
    </ScrollablePageWrapper>
  );
}
