import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart3, Download, Printer, TrendingUp, IndianRupee, Scale, Package, PackageX, HardHat, ShoppingCart, Store,
  Contact, Briefcase, Activity, Wallet, ListChecks,
} from 'lucide-react';
import { useApi } from '../lib/hooks';
import { Card, PageHeader, Button, Input, EmptyState, PageLoader } from '../components/ui';
import RefSelect from '../components/data/RefSelect';
import { renderCell } from '../components/data/DataTable';
import { REF } from '../config/resources';
import { downloadCSV, fmtDate, money, number, cn } from '../lib/format';

const REPORTS = [
  { key: 'project-progress', label: 'Project Progress', icon: ListChecks, filters: ['project'] },
  { key: 'project-cost', label: 'Project Cost', icon: IndianRupee, filters: ['project'] },
  { key: 'budget-vs-actual', label: 'Budget vs Actual', icon: Scale, filters: ['project'] },
  { key: 'profit-loss', label: 'Profit / Loss', icon: TrendingUp, filters: ['project'] },
  { key: 'material-consumption', label: 'Material Consumption', icon: Package, filters: ['project', 'date'] },
  { key: 'material-wastage', label: 'Material Wastage', icon: PackageX, filters: ['project', 'date'] },
  { key: 'labour-cost', label: 'Labour Cost & Productivity', icon: HardHat, filters: ['project', 'date'] },
  { key: 'purchase', label: 'Purchase Report', icon: ShoppingCart, filters: ['project', 'date'] },
  { key: 'vendor-outstanding', label: 'Vendor Outstanding', icon: Store, filters: [] },
  { key: 'client-outstanding', label: 'Client Outstanding', icon: Contact, filters: [] },
  { key: 'contractor', label: 'Contractor Report', icon: Briefcase, filters: [] },
  { key: 'site-performance', label: 'Site Performance', icon: Activity, filters: ['project'] },
  { key: 'payments', label: 'Payment Report', icon: Wallet, filters: ['project', 'date'] },
];

export default function Reports() {
  const [params, setParams] = useSearchParams();
  const key = params.get('r') || 'profit-loss';
  const meta = REPORTS.find((r) => r.key === key) || REPORTS[0];
  const [project, setProject] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const query = { project: meta.filters.includes('project') ? project || undefined : undefined, ...(meta.filters.includes('date') ? { from: from || undefined, to: to || undefined } : {}) };
  const { data, isLoading } = useApi(`/reports/${key}`, query);

  const exportCsv = () => {
    const rows = data.rows.map((r) => Object.fromEntries(data.columns.map((c) => [c.key, c.type === 'date' ? fmtDate(r[c.key]) : r[c.key]])));
    downloadCSV(`${key}-${new Date().toISOString().slice(0, 10)}.csv`, data.columns, rows);
  };

  return (
    <div>
      <PageHeader title="Reports" description="Real-time operational and financial reports. Export to CSV / Excel or print."
        actions={data && <><Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print</Button><Button icon={Download} onClick={exportCsv}>Export CSV</Button></>} />
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <Card className="no-print h-fit p-2">
          {REPORTS.map((r) => (
            <button key={r.key} onClick={() => setParams({ r: r.key })}
              className={cn('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition', r.key === key ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800')}>
              <r.icon className="size-4 shrink-0" />{r.label}
            </button>
          ))}
        </Card>

        <Card className="print-area min-w-0 overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-end dark:border-slate-800">
            <div className="flex-1">
              <h2 className="flex items-center gap-2 text-base font-semibold"><BarChart3 className="size-4 text-brand-600" />{data?.title || meta.label}</h2>
              <p className="text-xs text-slate-500">{data ? `${data.rows.length} rows · generated ${fmtDate(data.generatedAt, 'dd MMM yyyy, hh:mm a')}` : ''}</p>
            </div>
            <div className="no-print flex flex-wrap gap-2">
              {meta.filters.includes('project') && <div className="w-56"><RefSelect {...REF.project} labelOf={REF.project.label} placeholder="All projects" value={project} onChange={(v) => setProject(v || '')} /></div>}
              {meta.filters.includes('date') && (
                <>
                  <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} title="From" />
                  <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} title="To" />
                </>
              )}
            </div>
          </div>
          {isLoading || !data ? <PageLoader /> : data.rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50/70 dark:bg-slate-800/30">
                  <tr>{data.columns.map((c) => <th key={c.key} className={cn('th', ['currency', 'number', 'percent'].includes(c.type) && 'text-right')}>{c.label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.rows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      {data.columns.map((c) => (
                        <td key={c.key} className={cn('td', ['currency', 'number', 'percent'].includes(c.type) && 'text-right', c.type === 'currency' && Number(r[c.key]) < 0 && 'text-red-600')}>
                          {renderCell(c, r)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {Object.keys(data.totals || {}).length > 0 && (
                  <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold dark:border-slate-700 dark:bg-slate-800/50">
                    <tr>
                      {data.columns.map((c, i) => (
                        <td key={c.key} className={cn('td', ['currency', 'number', 'percent'].includes(c.type) && 'text-right', Number(data.totals[c.key]) < 0 && 'text-red-600')}>
                          {i === 0 ? 'Total' : c.key in data.totals ? (c.type === 'currency' ? money(data.totals[c.key]) : number(data.totals[c.key])) : ''}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ) : <EmptyState title="No data for the selected filters" />}
        </Card>
      </div>
    </div>
  );
}
