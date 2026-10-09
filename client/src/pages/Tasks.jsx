import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, List, CalendarDays, Link2 } from 'lucide-react';
import ResourcePage from '../components/data/ResourcePage';
import { tasks } from '../config/resources';
import { Segmented, Progress, Badge, Avatar } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useLocalStorage } from '../lib/hooks';
import { put, toastError } from '../lib/api';
import { TASK_STATUS, STATUS_TONE } from '../lib/constants';
import { fmtDate, cn } from '../lib/format';

const COL_ACCENT = { 'To Do': 'bg-slate-400', 'In Progress': 'bg-blue-500', 'On Hold': 'bg-amber-500', Done: 'bg-emerald-500' };

function Board({ rows, loading, ctx, edit }) {
  const { can } = useAuth();
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const canEdit = can('tasks', 'edit');

  const move = async (task, status) => {
    if (task.status === status) return;
    try {
      await put(`/tasks/${task._id}`, { status });
      ctx.refresh();
    } catch (e) {
      toastError(e);
    }
  };

  if (loading) return <div className="grid gap-4 p-4 md:grid-cols-4">{TASK_STATUS.map((s) => <div key={s} className="h-80 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}</div>;
  return (
    <div className="grid gap-4 overflow-x-auto p-4 md:grid-cols-2 xl:grid-cols-4">
      {TASK_STATUS.map((status) => {
        const items = rows.filter((t) => t.status === status);
        return (
          <div key={status}
            onDragOver={(e) => { if (canEdit) { e.preventDefault(); setOver(status); } }}
            onDragLeave={() => setOver(null)}
            onDrop={() => { setOver(null); if (drag) move(drag, status); setDrag(null); }}
            className={cn('flex min-h-64 flex-col rounded-xl bg-slate-50 p-2 transition dark:bg-slate-800/30', over === status && 'ring-2 ring-brand-400')}>
            <div className="flex items-center gap-2 px-2 py-2">
              <span className={cn('size-2 rounded-full', COL_ACCENT[status])} />
              <h4 className="text-sm font-semibold">{status}</h4>
              <span className="ml-auto rounded-full bg-white px-2 text-xs text-slate-500 dark:bg-slate-900">{items.length}</span>
            </div>
            <div className="flex-1 space-y-2">
              {items.map((t) => {
                const late = t.dueDate && new Date(t.dueDate) < new Date(new Date().toDateString()) && t.status !== 'Done';
                return (
                  <div key={t._id} draggable={canEdit} onDragStart={() => setDrag(t)} onClick={() => canEdit && edit(t)}
                    className={cn('cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-brand-300 hover:shadow dark:border-slate-700 dark:bg-slate-900', drag?._id === t._id && 'opacity-50')}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug">{t.title}</p>
                      <Badge tone={STATUS_TONE[t.priority]}>{t.priority}</Badge>
                    </div>
                    <Link to={`/projects/${t.project?._id}`} onClick={(e) => e.stopPropagation()} className="mt-1 block truncate text-xs text-slate-500 hover:text-brand-600">{t.project?.code} · {t.area || t.project?.name}</Link>
                    {t.status !== 'Done' && t.status !== 'To Do' && <Progress value={t.progress} size="sm" className="mt-2" />}
                    <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500">
                      <span className={cn('flex items-center gap-1', late && 'font-medium text-red-600')}><CalendarDays className="size-3.5" />{fmtDate(t.dueDate, 'dd MMM')}</span>
                      <div className="flex items-center gap-2">
                        {t.dependsOn?.length > 0 && <span className="flex items-center gap-0.5" title={`Depends on ${t.dependsOn.map((d) => d.title).join(', ')}`}><Link2 className="size-3.5" />{t.dependsOn.length}</span>}
                        {t.assignedTo && <Avatar name={t.assignedTo.name} className="size-5 text-[9px]" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Tasks() {
  const [view, setView] = useLocalStorage('tasks-view', 'list');
  const config = { ...tasks, pageSize: view === 'board' ? 200 : 25, renderList: view === 'board' ? (p) => <Board {...p} /> : undefined };
  return (
    <ResourcePage key={view} config={config}
      extraActions={<Segmented value={view} onChange={setView} options={[{ value: 'list', label: 'List', icon: List }, { value: 'board', label: 'Board', icon: LayoutGrid }]} />} />
  );
}
