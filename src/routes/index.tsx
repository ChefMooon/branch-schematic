import { createFileRoute } from '@tanstack/react-router'
import { DashboardMain } from "../features/dashboard/components/DashboardMain";

export const Route = createFileRoute('/')({
    component: Index,
})

function Index() {
    return (
    <main className="app-layout-main-viewport">
      <DashboardMain />
    </main>
  );
}