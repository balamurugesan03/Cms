import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ListChecks, Wallet, PackageX, Flag, FileCheck2, ShoppingCart, PhoneCall, Ruler, Sofa, ChevronRight } from 'lucide-react';
import { useApi } from '../lib/hooks';
import { Card, PageHeader, PageLoader, EmptyState, Badge } from '../components/ui';
import { fmtDate, cn } from '../lib/format';

const ICON = { task: ListChecks, bill: Wallet, stock: PackageX, deadline: Flag, quote: FileCheck2, design: Sofa, mr: ShoppingCart, po: ShoppingCart, lead: PhoneCall, mb: Ruler };
const SEV = { high: 'border-l-red-500', medium: 'border-l-amber-400', low: 'border-l-slate-300 dark:border-l-slate-600' };
const SEV_ICON = { high: 'bg-red-50 text-red-600 dark:bg-red-500/10', medium: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10', low: 'bg-slate-100 text-slate-500 dark:bg-slate-800' };

export default function Notifications() {
  const { data, isLoading } = useApi('/notifications');
  const [cat, setCat] = useState('All');
  if (isLoading) return <PageLoader />;
  const items = data?.items || [];
  const cats = ['All', ...new Set(items.map((i) => i.category))];
  const shown = cat === 'All' ? items : items.filter((i) => i.category === cat);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Notifications & Follow-ups" description="Live alerts generated from your data — task reminders, payment dues, material shortage, deadlines, pending approvals and follow-ups." />
      <div className="mb-4 flex flex-wrap gap-2">
        {cats.map((c) => {
          const n = c === 'All' ? items.length : items.filter((i) => i.category === c).length;
          return (
            <button key={c} onClick={() => setCat(c)} className={cn('rounded-full border px-3 py-1 text-sm transition', cat === c ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300')}>
              {c} <span className="ml-1 opacity-70">{n}</span>
            </button>
          );
        })}
      </div>
      {shown.length ? (
        <div className="space-y-2">
          {shown.map((n) => {
            const Icon = ICON[n.type] || Bell;
            return (
              <Link key={n.id} to={n.link}>
                <Card className={cn('flex items-center gap-4 border-l-4 p-4 transition hover:shadow-md', SEV[n.severity])}>
                  <div className={cn('rounded-lg p-2', SEV_ICON[n.severity])}><Icon className="size-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-slate-900 dark:text-white">{n.title}</p>
                      <Badge tone={n.severity === 'high' ? 'red' : n.severity === 'medium' ? 'amber' : 'slate'}>{n.category}</Badge>
                    </div>
                    <p className="truncate text-sm text-slate-500">{n.message}</p>
                  </div>
                  <span className="hidden shrink-0 text-xs text-slate-400 sm:block">{fmtDate(n.date, 'dd MMM')}</span>
                  <ChevronRight className="size-4 shrink-0 text-slate-300" />
                </Card>
              </Link>
            );
          })}
        </div>
      ) : <Card><EmptyState icon={Bell} title="You're all caught up" description="No pending reminders right now." /></Card>}
    </div>
  );
}
