// Isolated controls: callbacks only update memory; no API, auth or mutations.
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DashboardCounters, DashboardTimeForm } from '../../src/features/dashboard/components/DashboardView';
import { KnowledgeSearchForm } from '../../src/features/knowledge/components/KnowledgeView';
import { CaseFiltersForm } from '../../src/features/cases/components/CaseFiltersForm';
import { EvidenceForm } from '../../src/features/cases/components/EvidenceForm';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../src/components/ui/Table';
import { Button } from '../../src/components/ui/Button';
import { LoadingState } from '../../src/components/ui/LoadingState';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { ErrorState } from '../../src/components/ui/ErrorState';
import '../../src/index.css';

export function ShadcnFixture() {
  const [result, setResult] = useState('Chưa submit');
  const [waiting, setWaiting] = useState(false);
  const [mode, setMode] = useState('Dashboard');
  const [note, setNote] = useState(false);
  function record(value: unknown) { setResult(JSON.stringify(value)); }
  return <>
    <header className="bg-chrome p-4 text-white"><h1 className="type-h2">TraceWeaver — Kiểm thử shadcn</h1><p>Fixture cô lập, không gọi API.</p></header>
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <nav aria-label="Chọn form kiểm thử" className="flex flex-wrap gap-2">{['Dashboard', 'Knowledge', 'Cases', 'Evidence'].map(item => <Button key={item} variant={mode === item ? 'primary' : 'secondary'} aria-pressed={mode === item} onClick={() => setMode(item)}>{item}</Button>)}</nav>
      {mode === 'Dashboard' && <>
        <DashboardCounters data={{ runs: 13, degraded_runs: 4, unresolved_events: 6, waiting_cases: 5, filters: {} }} waiting={waiting} showWaiting={() => setWaiting(value => !value)} />
        <DashboardTimeForm filters={{}} apply={record} />
      </>}
      {mode === 'Knowledge' && <KnowledgeSearchForm filters={{ limit: 50 }} apply={record} />}
      {mode === 'Cases' && <CaseFiltersForm filters={{ limit: 50 }} onSearch={record} />}
      {mode === 'Evidence' && <EvidenceForm snapshot={{ status: 'ready', runId: '55555555-5555-4555-8555-555555555555', events: [], error: null }} mutation={{ status: 'idle', savedId: null, error: null }} detailReady canWrite closed={false} loadSnapshot={async () => {}} submit={async value => { record(value); setNote(true); }} beginNew={() => {}} />}
      {note && mode === 'Evidence' && <p role="status">Đã nhận note trong memory.</p>}
      <section aria-label="Kết quả submit"><h2 className="type-h3">Dữ liệu form</h2><pre className="whitespace-pre-wrap break-all">{result}</pre></section>
      <Table caption="Kiểm thử bảng với UUID dài"><TableHeader><TableRow><TableHead>Workspace</TableHead><TableHead>Nội dung</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>10000000-0000-4000-8000-000000000001</TableCell><TableCell>{'<script>Được escape an toàn</script>'}</TableCell></TableRow></TableBody></Table>
      <div className="grid gap-4 md:grid-cols-3"><LoadingState /><EmptyState title="Chưa có kết quả" /><ErrorState message="Không thể tải dữ liệu kiểm thử." requestId="fixture-only" /></div>
    </main>
  </>;
}
const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><ShadcnFixture /></StrictMode>);
