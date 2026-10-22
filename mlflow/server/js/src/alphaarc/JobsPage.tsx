import {
  Alert,
  Button,
  Empty,
  Progress,
  Spinner,
  Table,
  TableCell,
  TableHeader,
  TableRow,
  Tag,
  Typography,
  useDesignSystemTheme,
} from '@databricks/design-system';
import { FormattedMessage } from 'react-intl';
import { useMutation, useQuery, useQueryClient } from '../common/utils/reactQueryHooks';
import { ScrollablePageWrapper } from '../common/components/ScrollablePageWrapper';
import { Link, useSearchParams } from '../common/utils/RoutingUtils';
import { evaluationApi } from './api';

export default function JobsPage() {
  const { theme } = useDesignSystemTheme();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const requestedJobId = params.get('job');
  const jobs = useQuery(['alphaarc', 'jobs'], {
    queryFn: evaluationApi.jobs,
    refetchInterval: 1500,
    retry: false,
  });
  const detail = useQuery(['alphaarc', 'job', requestedJobId], {
    queryFn: () => evaluationApi.job(requestedJobId ?? ''),
    enabled: requestedJobId !== null,
    refetchInterval: 1500,
    retry: false,
  });
  const selected = requestedJobId === null ? undefined : detail.data;
  const cancel = useMutation({
    mutationFn: evaluationApi.cancel,
    onSuccess: () => {
      queryClient.invalidateQueries(['alphaarc', 'jobs']);
      queryClient.invalidateQueries(['alphaarc', 'job', requestedJobId]);
    },
  });

  return (
    <ScrollablePageWrapper>
      <div css={{ padding: theme.spacing.lg, maxWidth: 1200, margin: '0 auto' }}>
        <Typography.Title level={2}>
          <FormattedMessage defaultMessage="Evaluation jobs" description="Evaluation jobs title" />
        </Typography.Title>
        <Typography.Paragraph>
          <FormattedMessage
            defaultMessage="Jobs run independently of this page. Progress updates automatically as cases are evaluated."
            description="Evaluation jobs explanation"
          />
        </Typography.Paragraph>
        <Link componentId="alphaarc.jobs.launch" to="/alphaarc/launch">
          <FormattedMessage defaultMessage="Launch another evaluation" description="Launch another evaluation link" />
        </Link>
        <Link componentId="alphaarc.jobs.metrics" to="/alphaarc/metrics" css={{ marginLeft: theme.spacing.lg }}>
          <FormattedMessage
            defaultMessage="Compare hierarchical metrics"
            description="Compare evaluation metrics link"
          />
        </Link>
        {jobs.isLoading && <Spinner />}
        {jobs.isError && (
          <Alert componentId="alphaarc.jobspage.alert.1" type="error" message={String(jobs.error)} closable={false} />
        )}
        {requestedJobId !== null && detail.isLoading && <Spinner />}
        {requestedJobId !== null && detail.isError && (
          <Alert
            componentId="alphaarc.jobs.detail-error"
            type="error"
            closable={false}
            message={
              <FormattedMessage
                defaultMessage="Could not load evaluation job {id}. {error}"
                description="Requested evaluation job could not be loaded"
                values={{ id: requestedJobId, error: String(detail.error) }}
              />
            }
          />
        )}
        {requestedJobId === null && jobs.data && jobs.data.length > 0 && (
          <Typography.Paragraph css={{ marginTop: theme.spacing.md }}>
            <FormattedMessage
              defaultMessage="Select an evaluation job to view its progress and results."
              description="Select an evaluation job instruction"
            />
          </Typography.Paragraph>
        )}
        {cancel.isError && (
          <Alert componentId="alphaarc.jobspage.alert.2" type="error" message={String(cancel.error)} closable={false} />
        )}
        {jobs.data?.length === 0 && (
          <div
            css={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 400,
              height: '100%',
              width: '100%',
              '& > div': {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                width: '100%',
              },
            }}
          >
            <Empty
              description={
                <FormattedMessage
                  defaultMessage="No evaluations yet. Launch your first evaluation to see progress here."
                  description="Empty evaluation jobs"
                />
              }
            />
          </div>
        )}
        {jobs.data && jobs.data.length > 0 && (
          <Table css={{ marginTop: theme.spacing.lg }}>
            <TableRow isHeader>
              <TableHeader componentId="alphaarc.jobspage.tableheader.1">
                <FormattedMessage defaultMessage="Evaluation" description="Evaluation job name column" />
              </TableHeader>
              <TableHeader componentId="alphaarc.jobspage.tableheader.2">
                <FormattedMessage defaultMessage="Status" description="Evaluation job status column" />
              </TableHeader>
              <TableHeader componentId="alphaarc.jobspage.tableheader.3">
                <FormattedMessage defaultMessage="Progress" description="Evaluation job progress column" />
              </TableHeader>
              <TableHeader componentId="alphaarc.jobspage.tableheader.4">
                <FormattedMessage defaultMessage="Created" description="Evaluation creation column" />
              </TableHeader>
            </TableRow>
            {jobs.data.map((job) => (
              <TableRow key={job.id}>
                <TableCell>
                  <Link componentId="alphaarc.jobs.select" to={`/alphaarc/jobs?job=${job.id}`}>
                    {job.request.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Tag componentId="alphaarc.jobspage.tag.1">{job.status}</Tag>
                </TableCell>
                <TableCell>
                  {job.completed} / {job.total}
                </TableCell>
                <TableCell>{new Date(job.created_at).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </Table>
        )}
        {selected && !detail.isError && (
          <section css={{ marginTop: theme.spacing.xl }}>
            <Typography.Title level={3}>{selected.request.name}</Typography.Title>
            <Typography.Paragraph>
              {selected.agent_name ?? selected.request.agent}
              {selected.agent_version && ` · v${selected.agent_version}`} · {selected.completed}/{selected.total} cases
              · {selected.passed} exact matches
            </Typography.Paragraph>
            {selected.experiment_name && (
              <Typography.Paragraph>
                {selected.experiment_name} · {selected.dataset_name}
              </Typography.Paragraph>
            )}
            <Progress.Root value={selected.completed} max={selected.total} aria-label="Completed evaluation cases">
              <Progress.Indicator
                style={{ transform: `translateX(-${100 - (selected.completed / selected.total) * 100}%)` }}
              />
            </Progress.Root>
            <div css={{ display: 'flex', gap: theme.spacing.md, marginBlock: theme.spacing.md }}>
              {selected.run_id && selected.experiment_id && (
                <Link
                  componentId="alphaarc.jobs.results"
                  to={`/experiments/${selected.experiment_id}/evaluation-runs?selectedRunUuid=${selected.run_id}`}
                >
                  <FormattedMessage
                    defaultMessage="Open MLflow results and traces"
                    description="MLflow evaluation result link"
                  />
                </Link>
              )}
              {['queued', 'running'].includes(selected.status) && (
                <Button
                  componentId="alphaarc.jobs.cancel"
                  loading={cancel.isLoading}
                  disabled={selected.cancellation_requested}
                  onClick={() => cancel.mutate(selected.id)}
                >
                  {selected.cancellation_requested ? (
                    <FormattedMessage
                      defaultMessage="Cancellation requested"
                      description="Cancellation requested label"
                    />
                  ) : (
                    <FormattedMessage defaultMessage="Cancel evaluation" description="Cancel evaluation button" />
                  )}
                </Button>
              )}
            </div>
            {selected.error && (
              <Alert componentId="alphaarc.jobspage.alert.3" type="error" message={selected.error} closable={false} />
            )}
            <Table>
              <TableRow isHeader>
                <TableHeader componentId="alphaarc.jobspage.tableheader.5">
                  <FormattedMessage defaultMessage="Case" description="Evaluation case column" />
                </TableHeader>
                <TableHeader componentId="alphaarc.jobspage.tableheader.6">
                  <FormattedMessage defaultMessage="Status" description="Evaluation case status column" />
                </TableHeader>
                <TableHeader componentId="alphaarc.jobspage.tableheader.7">
                  <FormattedMessage defaultMessage="Answer / error" description="Evaluation output column" />
                </TableHeader>
                <TableHeader componentId="alphaarc.jobspage.tableheader.8">
                  <FormattedMessage defaultMessage="Expected" description="Evaluation expected answer column" />
                </TableHeader>
                <TableHeader componentId="alphaarc.jobspage.tableheader.9">
                  <FormattedMessage defaultMessage="Score" description="Evaluation score column" />
                </TableHeader>
              </TableRow>
              {selected.cases.map((item) => (
                <TableRow key={item.id}>
                  <TableCell multiline>{item.question}</TableCell>
                  <TableCell>{item.status}</TableCell>
                  <TableCell multiline>{item.error ?? item.output ?? '—'}</TableCell>
                  <TableCell>{item.expected}</TableCell>
                  <TableCell>{item.score === null ? '—' : `${Math.round(item.score * 100)}%`}</TableCell>
                </TableRow>
              ))}
            </Table>
          </section>
        )}
      </div>
    </ScrollablePageWrapper>
  );
}
