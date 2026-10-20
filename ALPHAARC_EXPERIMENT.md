# AlphaArc evaluation UI experiment

Base: upstream **v3.17.1**, `7fc49ae9fcd65ed125e46cf68b976060e5a38c77`.
Fork: <https://github.com/HusseinTermos/mlflow>.
Local branch: `codex/alphaarc-evaluation-ui`.

The upstream remote is `upstream`; `origin` points to the personal fork. No experiment
changes have been pushed. The extension is intended to stay easy to update from stable tags.

## Changes to upstream

- `mlflow/server/js/src/alphaarc/`: evaluation-launch and job-progress pages, API contracts,
  and route definitions.
- `mlflow/server/js/src/MlflowRouter.tsx`: register the additional routes.
- `mlflow/server/js/src/common/components/MlflowSidebar.tsx`: two navigation entries.
- `mlflow/server/js/src/lang/default/en.json`: generated English message entries.

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
<http://127.0.0.1:5051/#/alphaarc/launch> and <http://127.0.0.1:5051/#/alphaarc/jobs>.
