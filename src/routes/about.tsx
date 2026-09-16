import { createFileRoute } from '@tanstack/react-router'
import { AutoUpdatePanel } from '../features/auto-update/AutoUpdatePanel'

export const Route = createFileRoute('/about')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <main className="settings-shell" aria-label="About Branch Schematic">
      <header className="settings-header">
        <p className="settings-kicker">About</p>
        <h1 className="settings-title">Branch Schematic</h1>
        <p className="settings-subtitle">Application information and signed desktop update controls.</p>
      </header>
      <AutoUpdatePanel />
    </main>
  )
}
