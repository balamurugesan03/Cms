import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, CornerDownLeft, FolderKanban, Contact, FileText } from 'lucide-react';
import { NAV } from '../../config/nav';
import { useAuth } from '../../context/AuthContext';
import { get } from '../../lib/api';
import { useDebounce } from '../../lib/hooks';
import { cn } from '../../lib/format';

/** Ctrl+K: jump to any module or search projects / clients / quotations */
export default function CommandPalette({ open, onClose }) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const dq = useDebounce(q, 200);
  const nav = useNavigate();
  const { can } = useAuth();

  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
    }
  }, [open]);

  const enabled = open && dq.length > 1;
  const search = (url, mod) => ({
    queryKey: ['palette', url, dq],
    queryFn: () => get(url, { q: dq, limit: 5 }),
    enabled: enabled && can(mod),
  });
  const { data: projects } = useQuery(search('/projects', 'projects'));
  const { data: clients } = useQuery(search('/clients', 'clients'));
  const { data: quotes } = useQuery(search('/quotations', 'quotations'));

  const items = useMemo(() => {
    const pages = NAV.flatMap((g) => g.items.filter((i) => can(i.module)).map((i) => ({ label: i.label, hint: g.group, icon: i.icon, to: i.to })))
      .filter((p) => !q || p.label.toLowerCase().includes(q.toLowerCase()));
    return [
      ...pages,
      ...(projects?.items || []).map((p) => ({ label: `${p.code} · ${p.name}`, hint: 'Project', icon: FolderKanban, to: `/projects/${p._id}` })),
      ...(clients?.items || []).map((c) => ({ label: `${c.code} · ${c.name}`, hint: 'Client', icon: Contact, to: `/projects?client=${c._id}` })),
      ...(quotes?.items || []).map((x) => ({ label: `${x.code} v${x.version} · ${x.title}`, hint: 'Quotation', icon: FileText, to: `/quotations/${x._id}` })),
    ].slice(0, 14);
  }, [q, projects, clients, quotes, can]);

  if (!open) return null;
  const goTo = (it) => {
    nav(it.to);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl animate-pop overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 dark:border-slate-800">
          <Search className="size-5 text-slate-400" />
          <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} placeholder="Search modules, projects, clients, quotations…"
            className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
              if (e.key === 'Enter' && items[idx]) goTo(items[idx]);
            }} />
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {items.length ? items.map((it, i) => (
            <button key={it.to + it.label} onMouseEnter={() => setIdx(i)} onClick={() => goTo(it)}
              className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm', i === idx ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200' : 'text-slate-700 dark:text-slate-300')}>
              <it.icon className="size-4 shrink-0 opacity-70" />
              <span className="flex-1 truncate">{it.label}</span>
              <span className="text-xs text-slate-400">{it.hint}</span>
              {i === idx && <CornerDownLeft className="size-3.5 text-slate-400" />}
            </button>
          )) : <p className="py-8 text-center text-sm text-slate-500">No results</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
