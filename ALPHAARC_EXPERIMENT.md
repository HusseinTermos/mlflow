# AlphaArc evaluation UI experiment

Base: upstream **v3.17.1**, `7fc49ae9fcd65ed125e46cf68b976060e5a38c77`.
Fork: <https://github.com/HusseinTermos/mlflow>.
Local branch: `codex/alphaarc-evaluation-ui`.

The upstream remote is `upstream`; `origin` points to the personal fork.
Compare this branch against the unmodified `v3.17.1` tag to review the complete
AlphaArc extension. The extension is intended to stay easy to update from stable tags.

## Changes to upstream

- `mlflow/server/js/src/alphaarc/`: evaluation-launch, job-progress, and hierarchical metric comparison pages, API contracts,
  and route definitions.
- `mlflow/server/js/src/MlflowRouter.tsx`: register the additional routes.
- `mlflow/server/js/src/common/components/MlflowSidebar.tsx`: three navigation entries.
- `mlflow/server/js/src/lang/default/en.json`: generated English message entries.
- `mlflow/server/js/scripts/componentId-registry.js`: generated AlphaArc component IDs.

There are no upstream Python changes. The separately installed `alphaarc` server application
entry point mounts the job API before MLflow's native authenticated ASGI application. It
reuses MLflow's request-security middleware, authentication, and permission resolver. The
native application and its lifespan remain intact.

The job API, worker, test dataset, tests, and setup scripts live in the neighboring AlphaLab
checkout at `experiments/alphamind/benchmarking-kit/mlflow-integration`. The actual dummy
agent lives in `apps/alphalab/signal-lab/src/signal_lab/agents/evaluation_dummy` and uses
AlphaLab's current LangGraph and chat-client conventions.

The launch page selects active MLflow experiments, their associated native evaluation
datasets, and AlphaLab evaluation configurations indexed by their six-part definition
(system prompt, skills, tools, workflow, formats, and model). Submitted jobs retain snapshots
of the selected cases and resolved agent settings; later edits cannot silently alter queued
work. Six separate native run parameters support comparison, and a JSON artifact stores the
full agent definition. Restart recovery checks all running jobs, independently of the recent
job list. Local administrator and team roles are provisioned by the integration scripts.

Use the integration README for setup and start commands. The experiment is served at
<http://127.0.0.1:5051/#/alphaarc/launch>, <http://127.0.0.1:5051/#/alphaarc/jobs>,
and <http://127.0.0.1:5051/#/alphaarc/metrics>. Metric comparison supports multiple removable run selections, with run A as baseline.
New evaluations store nested composite feedback through MLflow scorer ensembles;
the presentation reads that persisted hierarchy and each scorer's reporting aggregation.
Historical artifact-based runs remain readable with an explicit legacy notice.
No extra model calls are needed to display saved results.

Metric comparison accepts arbitrary metric names from native feedback, shows the union
of run schemas, and distinguishes unrecorded scores from zero. Saved definitions include
units and direction, and differences require compatible recursive definitions and cases.
Only the comparison chart remains. The integration's `seed_metric_demo` module creates
three labeled demo runs for inspecting mixed metric coverage without model calls.
