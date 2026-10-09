import { useApi } from '../../lib/hooks';
import { Card, StatusBadge } from '../ui';
import { fmtDate, money, number } from '../../lib/format';

/**
 * A4-style business document with company letterhead (from Settings).
 * Print with window.print() — the app chrome is hidden by @media print rules.
 */
export default function PrintDocument({ docTitle, code, status, meta = [], party, partyLabel = 'Bill To', columns, items, totals = [], footer, children }) {
  const { data: company } = useApi('/settings');
  return (
    <Card className="print-area mx-auto max-w-4xl p-6 sm:p-10">
      <div className="flex flex-col justify-between gap-6 border-b-2 border-brand-600 pb-6 sm:flex-row">
        <div className="flex gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-600">
            <svg viewBox="0 0 32 32" className="size-7"><path d="M8 23V13l8-5 8 5v10h-5v-6h-6v6z" fill="#fff" /></svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{company?.companyName}</h2>
            <p className="text-xs text-slate-500">{company?.tagline}</p>
            <p className="mt-1 max-w-xs text-xs text-slate-500">{company?.address}</p>
            <p className="text-xs text-slate-500">{company?.phone} · {company?.email}</p>
            {company?.gstin && <p className="text-xs text-slate-500">GSTIN: {company.gstin}</p>}
          </div>
        </div>
        <div className="sm:text-right">
          <p className="text-2xl font-bold tracking-tight text-brand-700 uppercase">{docTitle}</p>
          <p className="mt-1 font-mono text-sm font-semibold">{code}</p>
          {status && <div className="mt-2"><StatusBadge value={status} /></div>}
        </div>
      </div>

      <div className="grid gap-6 py-6 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{partyLabel}</p>
          {party}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:justify-self-end">
          {meta.filter(Boolean).map((m) => (
            <div key={m.label} className="contents">
              <dt className="text-slate-500">{m.label}</dt>
              <dd className="text-right font-medium">{m.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">#</th>
              {columns.map((c) => <th key={c.key} className={`px-3 py-2 text-xs font-semibold text-slate-500 ${c.num ? 'text-right' : 'text-left'}`}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((it, i) => (
              <tr key={it._id || i}>
                <td className="px-3 py-2.5 text-slate-400">{i + 1}</td>
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2.5 ${c.num ? 'text-right tabular-nums' : ''}`}>
                    {c.render ? c.render(it) : c.money ? money(it[c.key], true) : c.num ? number(it[c.key]) : it[c.key] || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end">
        <dl className="w-full max-w-xs space-y-1.5 text-sm">
          {totals.filter(Boolean).map((t) => (
            <div key={t.label} className={`flex justify-between ${t.strong ? 'border-t-2 border-slate-900 pt-2 text-base font-bold dark:border-slate-200' : ''}`}>
              <dt className={t.strong ? '' : 'text-slate-500'}>{t.label}</dt>
              <dd className="tabular-nums">{t.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {children}

      <div className="mt-10 grid gap-8 border-t border-slate-200 pt-6 text-xs text-slate-500 sm:grid-cols-2 dark:border-slate-700">
        <div>
          {footer}
          {company?.bankDetails && <p className="mt-2"><b className="text-slate-700 dark:text-slate-300">Bank:</b> {company.bankDetails}</p>}
        </div>
        <div className="sm:text-right">
          <p className="mt-10">For <b className="text-slate-700 dark:text-slate-300">{company?.companyName}</b></p>
          <p className="mt-6">Authorised Signatory</p>
        </div>
      </div>
      <p className="mt-6 text-center text-[10px] text-slate-400">Generated on {fmtDate(new Date(), 'dd MMM yyyy, hh:mm a')}</p>
    </Card>
  );
}

export function PartyBlock({ name, lines = [] }) {
  return (
    <div className="text-sm">
      <p className="font-semibold text-slate-900 dark:text-white">{name}</p>
      {lines.filter(Boolean).map((l, i) => <p key={i} className="text-slate-500">{l}</p>)}
    </div>
  );
}
