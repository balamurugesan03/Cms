import { MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { Menu, StatusBadge, Progress, EmptyState, Button } from '../ui';
import { cn, fmtDate, get, money, number } from '../../lib/format';

export function renderCell(col, row) {
  if (col.render) return col.render(row);
  const v = get(row, col.key);
  switch (col.type) {
    case 'currency': return <span className="tabular-nums">{money(v)}</span>;
    case 'number': return <span className="tabular-nums">{number(v)}</span>;
    case 'percent': return <span className={cn('tabular-nums', v < 0 && 'text-red-600')}>{v == null ? '—' : `${number(v)}%`}</span>;
    case 'date': return fmtDate(v);
    case 'status': return <StatusBadge value={v} />;
    case 'progress': return <Progress value={v} className="w-28" size="sm" />;
    case 'code': return <span className="font-mono text-xs font-semibold text-brand-700 dark:text-brand-400">{v}</span>;
    case 'ref': return v ? (typeof v === 'object' ? v.name || v.title || v.code : v) : <span className="text-slate-400">—</span>;
    default: return v == null || v === '' ? <span className="text-slate-400">—</span> : String(v);
  }
}

const isNumeric = (c) => ['currency', 'number', 'percent'].includes(c.type) || c.align === 'right';

export default function DataTable({ columns, rows, loading, onRowClick, actions, empty, page, pages, total, onPage, footer }) {
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/30">
            <tr>
              {columns.map((c) => <th key={c.key} className={cn('th', isNumeric(c) && 'text-right', c.className)}>{c.label}</th>)}
              {actions && <th className="th w-12" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {columns.map((c) => <td key={c.key} className="td"><div className="h-4 w-3/4 animate-pulse rounded bg-slate-100 dark:bg-slate-800" /></td>)}
                    {actions && <td />}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr key={row._id || row.code || JSON.stringify(row)} onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn('group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40', onRowClick && 'cursor-pointer')}>
                    {columns.map((c) => <td key={c.key} className={cn('td', isNumeric(c) && 'text-right', c.className)}>{renderCell(c, row)}</td>)}
                    {actions && (
                      <td className="td !py-1 text-right" onClick={(e) => e.stopPropagation()}>
                        <Menu items={actions(row)} trigger={<button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"><MoreHorizontal className="size-4" /></button>} />
                      </td>
                    )}
                  </tr>
                ))}
          </tbody>
          {footer}
        </table>
      </div>
      {!loading && !rows.length && (empty || <EmptyState />)}
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500 dark:border-slate-800">
          <span>Page {page} of {pages} · {total} records</span>
          <div className="flex gap-1">
            <Button variant="secondary" size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</Button>
            <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next <ChevronRight className="size-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
