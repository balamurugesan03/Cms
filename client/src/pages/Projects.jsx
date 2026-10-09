import { Link } from 'react-router-dom';
import { LayoutGrid, List, MapPin, CalendarDays, User } from 'lucide-react';
import ResourcePage from '../components/data/ResourcePage';
import { projects } from '../config/resources';
import { Card, Progress, StatusBadge, Segmented, Badge, EmptyState } from '../components/ui';
import { useLocalStorage } from '../lib/hooks';
import { fmtDate, moneyShort, cn } from '../lib/format';

const TYPE_GRADIENT = {
  Construction: 'from-amber-500 to-orange-600',
  Interior: 'from-violet-500 to-fuchsia-600',
  Renovation: 'from-cyan-500 to-blue-600',
};

function ProjectCards({ rows, loading }) {
  if (loading) return <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-52 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}</div>;
  if (!rows.length) return <EmptyState title="No projects found" description="Approved quotations convert into projects, or create one directly." />;
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((p) => {
        const late = p.endDate && new Date(p.endDate) < new Date() && !['Completed', 'Cancelled'].includes(p.status);
        return (
          <Link key={p._id} to={`/projects/${p._id}`} className="group">
            <Card className="h-full overflow-hidden transition group-hover:-translate-y-0.5 group-hover:shadow-lg">
              <div className={cn('h-1.5 bg-gradient-to-r', TYPE_GRADIENT[p.projectType])} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] font-semibold text-slate-400">{p.code}</p>
                    <h3 className="mt-0.5 truncate font-semibold text-slate-900 group-hover:text-brand-700 dark:text-white">{p.name}</h3>
                    <p className="truncate text-sm text-slate-500">{p.client?.name}</p>
                  </div>
                  <StatusBadge value={p.status} />
                </div>
                <div className="mt-4"><Progress value={p.progress} /></div>
                <div className="mt-4 grid grid-cols-2 gap-y-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5 truncate"><MapPin className="size-3.5" />{p.city || p.siteAddress || '—'}</span>
                  <span className={cn('flex items-center gap-1.5', late && 'font-medium text-red-600')}><CalendarDays className="size-3.5" />{fmtDate(p.endDate)}</span>
                  <span className="flex items-center gap-1.5 truncate"><User className="size-3.5" />{p.manager?.name || '—'}</span>
                  <span className="flex items-center gap-1.5"><Badge tone="slate">{p.projectType}</Badge></span>
                </div>
                <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                  <div><p className="text-[11px] text-slate-400">Contract value</p><p className="font-semibold tabular-nums">{moneyShort(p.contractValue)}</p></div>
                  <div className="text-right"><p className="text-[11px] text-slate-400">Budget</p><p className="font-semibold tabular-nums">{moneyShort(p.budget)}</p></div>
                </div>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

export default function Projects() {
  const [view, setView] = useLocalStorage('projects-view', 'grid');
  const config = { ...projects, pageSize: view === 'grid' ? 24 : 25, renderList: view === 'grid' ? (p) => <ProjectCards {...p} /> : undefined };
  return (
    <ResourcePage
      key={view}
      config={config}
      extraActions={<Segmented value={view} onChange={setView} options={[{ value: 'grid', label: 'Cards', icon: LayoutGrid }, { value: 'list', label: 'Table', icon: List }]} />}
    />
  );
}
