import { createFileRoute } from '@tanstack/react-router'
import { BranchMap } from '../features/branch-map/branch-map';

export const Route = createFileRoute('/branch-map')({
  component: RouteComponent,
})

function RouteComponent() {
  return <BranchMap />;
}
