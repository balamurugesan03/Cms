import { useState } from 'react';
import { AlertTriangle, Boxes, Warehouse, IndianRupee, PackageX } from 'lucide-react';
import { useApi } from '../lib/hooks';
import ResourcePage from '../components/data/ResourcePage';
import RefSelect from '../components/data/RefSelect';
import { stockTxns, REF } from '../config/resources';
import { Card, PageHeader, Tabs, Select, SearchInput, StatCard, Badge, EmptyState } from '../components/ui';
import { MATERIAL_CATEGORIES } from '../lib/constants';
import { useDebounce } from '../lib/hooks';
import { money, moneyShort, number, cn } from '../lib/format';

function Summary() {
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [q, setQ] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const dq = useDebounce(q);
  const loc = location === null ? 'warehouse' : location;
  const { data, isLoading } = useApi('/stock/summary', { category: category || undefined, location: loc || undefined, q: dq || undefined });
  const rows = (data?.items || []).filter((r) => !lowOnly || r.low);
  const all = data?.items || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Materials in stock" value={all.filter((r) => r.total > 0).length} icon={Boxes} tone="blue" />
        <StatCard label="Stock value" value={moneyShort(all.reduce((s, r) => s + r.value, 0))} icon={IndianRupee} tone="green" />
        <StatCard label="Warehouse items" value={all.filter((r) => r.warehouse > 0).length} icon={Warehouse} tone="violet" />
        <StatCard label="Low-stock alerts" value={all.filter((r) => r.low).length} icon={PackageX} tone="red" />
      </div>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-slate-100 p-3 md:flex-row md:items-center dark:border-slate-800">
          <SearchInput value={q} onChange={setQ} placeholder="Search material…" className="md:max-w-xs" />
          <Select className="md:w-48" value={category} placeholder="All categories" options={MATERIAL_CATEGORIES} onChange={(e) => setCategory(e.target.value)} />
          <div className="md:w-60"><RefSelect {...REF.project} labelOf={REF.project.label} nullLabel="Main Warehouse" placeholder="All locations" value={location} onChange={setLocation} /></div>
          <label className="flex items-center gap-2 text-sm text-slate-600 md:ml-auto dark:text-slate-400">
            <input type="checkbox" className="size-4 accent-brand-600" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> Low stock only
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/70 dark:bg-slate-800/30">
              <tr><th className="th">Material</th><th className="th">Category</th><th className="th">Where</th><th className="th text-right">Available</th><th className="th text-right">Min</th><th className="th text-right">Value</th><th className="th">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? <tr><td colSpan={7} className="td text-center text-slate-400">Loading…</td></tr> : rows.map((r) => (
                <tr key={r._id} className={cn(r.low && 'bg-red-50/40 dark:bg-red-500/5')}>
                  <td className="td"><p className="font-medium text-slate-900 dark:text-white">{r.name}</p><p className="text-xs text-slate-500">{r.code} · {r.brand || '—'}</p></td>
                  <td className="td text-slate-500">{r.category}</td>
                  <td className="td">
                    <div className="flex max-w-md flex-wrap gap-1">
                      {r.locations.length ? r.locations.map((l) => <Badge key={l.location} tone={l.location === 'warehouse' ? 'violet' : 'slate'}>{l.locationName.split(' · ').pop()}: {number(l.quantity)}</Badge>) : <span className="text-xs text-slate-400">No stock</span>}
                    </div>
                  </td>
                  <td className="td text-right font-semibold tabular-nums">{number(r.total)} <span className="font-normal text-slate-500">{r.unit}</span></td>
                  <td className="td text-right text-slate-500 tabular-nums">{number(r.minStock)}</td>
                  <td className="td text-right tabular-nums">{money(r.value)}</td>
                  <td className="td">{r.low ? <Badge tone="red" dot><AlertTriangle className="size-3" /> Low</Badge> : r.total > 0 ? <Badge tone="green" dot>OK</Badge> : <Badge tone="slate">Empty</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && !rows.length && <EmptyState title="No materials match" />}
        </div>
      </Card>
    </div>
  );
}

export default function Stock() {
  const [tab, setTab] = useState('summary');
  return (
    <div>
      <PageHeader title="Stock" description="Warehouse and site-wise stock. Receipts, transfers, consumption and wastage are all tracked." />
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[{ value: 'summary', label: 'Stock summary' }, { value: 'moves', label: 'Movements (in / out / transfer / wastage)' }]} />
      {tab === 'summary' ? <Summary /> : <ResourcePage embedded config={stockTxns} title="Stock movements" />}
    </div>
  );
}
