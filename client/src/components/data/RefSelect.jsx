import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Loader2, X } from 'lucide-react';
import { get } from '../../lib/api';
import { cn } from '../../lib/format';
import { useDebounce } from '../../lib/hooks';

// id -> label cache shared by every select (populated objects + loaded options)
const labelCache = new Map();
export const defaultLabel = (o) => {
  if (!o || typeof o !== 'object') return '';
  const main = o.name || o.title || o.email || '';
  return o.code ? `${o.code} · ${main}` : main;
};
export const rememberLabel = (obj, labelOf = defaultLabel) => {
  if (obj && typeof obj === 'object' && obj._id) labelCache.set(String(obj._id), labelOf(obj));
};

/**
 * Searchable async select backed by any list endpoint.
 *  value: id (or array of ids when `multiple`)
 *  nullLabel: adds an explicit "empty" option (e.g. "Main Warehouse")
 */
export default function RefSelect({ endpoint, params, value, onChange, labelOf = defaultLabel, sub, placeholder = 'Select…', multiple, nullLabel, disabled, initial, className, lookup }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 250);
  const btn = useRef();
  const [pos, setPos] = useState(null);

  useEffect(() => {
    (Array.isArray(initial) ? initial : [initial]).forEach((o) => rememberLabel(o, labelOf));
  }, [initial, labelOf]);

  const { data, isFetching } = useQuery({
    queryKey: [endpoint, { ...params, q: lookup ? undefined : dq, limit: lookup ? 500 : 30, _sel: 1 }],
    queryFn: () => get(endpoint, { ...params, q: lookup ? undefined : dq || undefined, limit: lookup ? 500 : 30 }),
    enabled: open || (lookup && !!value),
    staleTime: 30_000,
  });
  let options = data?.items || [];
  if (lookup && dq) options = options.filter((o) => labelOf(o).toLowerCase().includes(dq.toLowerCase()));
  useMemo(() => options.forEach((o) => rememberLabel(o, labelOf)), [options, labelOf]);

  // Resolve label of a value we have never seen (e.g. from URL)
  const ids = multiple ? value || [] : value ? [value] : [];
  const missing = ids.filter((id) => !labelCache.has(String(id)));
  const { data: fetched } = useQuery({
    queryKey: [endpoint, 'byId', missing[0]],
    queryFn: () => get(`${endpoint}/${missing[0]}`),
    enabled: !lookup && missing.length > 0,
    retry: false,
  });
  if (fetched) rememberLabel(fetched, labelOf);

  const openMenu = () => {
    if (disabled) return;
    const r = btn.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    setPos({ left: r.left, width: Math.max(r.width, 240), ...(below < 300 ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }) });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!e.target.closest?.('[data-refselect-menu]') && !btn.current?.contains(e.target)) setOpen(false);
    };
    const onScroll = (e) => {
      if (!e.target.closest?.('[data-refselect-menu]')) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const select = (o) => {
    if (multiple) {
      const id = o._id;
      const cur = value || [];
      onChange(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id], o);
    } else {
      onChange(o ? o._id : nullLabel ? null : '', o);
      setOpen(false);
      setQ('');
    }
  };

  const labelFor = (id) => labelCache.get(String(id)) || '…';
  const display = multiple ? null : value ? labelFor(value) : value === null && nullLabel ? nullLabel : '';

  return (
    <>
      <div ref={btn} onClick={() => (open ? setOpen(false) : openMenu())}
        className={cn('input flex min-h-9 cursor-pointer items-center gap-1.5 !h-auto py-1.5', disabled && 'cursor-not-allowed opacity-60', className)}>
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {multiple ? (
            ids.length ? ids.map((id) => (
              <span key={id} className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">
                {labelFor(id)}
                <X className="size-3 cursor-pointer opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); onChange(ids.filter((x) => x !== id)); }} />
              </span>
            )) : <span className="text-slate-400">{placeholder}</span>
          ) : (
            <span className={cn('truncate', !display && 'text-slate-400')}>{display || placeholder}</span>
          )}
        </div>
        {!multiple && value && !disabled ? (
          <X className="size-3.5 shrink-0 text-slate-400 hover:text-slate-700" onClick={(e) => { e.stopPropagation(); onChange(nullLabel ? null : '', null); }} />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-slate-400" />
        )}
      </div>
      {open && pos && createPortal(
        <div data-refselect-menu className="fixed z-[70] animate-pop overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900" style={pos}>
          <div className="border-b border-slate-100 p-2 dark:border-slate-800">
            <input autoFocus className="input h-8" placeholder="Type to search…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {nullLabel && !multiple && (
              <Option active={value === null} onClick={() => select(null)} label={nullLabel} />
            )}
            {isFetching && !options.length ? (
              <div className="flex justify-center py-4"><Loader2 className="size-4 animate-spin text-slate-400" /></div>
            ) : options.length ? (
              options.map((o) => (
                <Option key={o._id} active={ids.includes(o._id)} onClick={() => select(o)} label={labelOf(o)} sub={sub?.(o)} />
              ))
            ) : (
              <p className="px-3 py-4 text-center text-sm text-slate-500">No results</p>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function Option({ active, onClick, label, sub }) {
  return (
    <button type="button" onClick={onClick} className={cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-slate-800', active && 'bg-brand-50 dark:bg-brand-500/10')}>
      <div className="min-w-0 flex-1">
        <div className="truncate text-slate-800 dark:text-slate-200">{label}</div>
        {sub && <div className="truncate text-xs text-slate-500">{sub}</div>}
      </div>
      {active && <Check className="size-4 shrink-0 text-brand-600" />}
    </button>
  );
}
