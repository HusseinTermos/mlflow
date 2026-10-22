import { createLazyRouteElement } from '../common/utils/RoutingUtils';

export const getAlphaArcRouteDefs = () => [
  {
    path: '/alphaarc/launch',
    element: createLazyRouteElement(() => import('./LaunchPage')),
    pageId: 'mlflow.alphaarc.launch',
    handle: { getPageTitle: () => 'Launch evaluation' },
  },
  {
    path: '/alphaarc/jobs',
    element: createLazyRouteElement(() => import('./JobsPage')),
    pageId: 'mlflow.alphaarc.jobs',
    handle: { getPageTitle: () => 'Evaluation jobs' },
  },
  {
    path: '/alphaarc/metrics',
    element: createLazyRouteElement(() => import('./MetricsPage')),
    pageId: 'mlflow.alphaarc.metrics',
    handle: { getPageTitle: () => 'Metric comparison' },
  },
];
