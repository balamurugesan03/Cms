import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { X, Loader2, Inbox, AlertTriangle, ChevronRight, Search } from 'lucide-react';
import { cn, initials } from '../../lib/format';
import { STATUS_TONE } from '../../lib/constants';

/* ---------------- Button ---------------- */
const VARIANTS = {
  primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-600/50',
  secondary: 'border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:bg-red-600/50',
  success: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 disabled:bg-emerald-600/50',
  soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20',
};
const SIZES = { xs: 'h-7 px-2 text-xs gap-1', sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-9 px-3.5 text-sm gap-2', lg: 'h-11 px-5 text-sm gap-2' };

export function Button({ variant = 'primary', size = 'md', icon: Icon, loading, className, children, to, ...props }) {
  const cls = cn(
    'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg font-medium transition outline-none focus-visible:ring-3 focus-visible:ring-brand-500/30 disabled:cursor-not-allowed',
    VARIANTS[variant], SIZES[size], className,
  );
  const content = (
    <>
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon && <Icon className={size === 'xs' ? 'size-3.5' : 'size-4'} />}
      {children}
    </>
  );
  if (to) return <Link to={to} className={cls}>{content}</Link>;
  return <button type="button" className={cls} disabled={loading || props.disabled} {...props}>{content}</button>;
}

export function IconButton({ icon: Icon, className, label, ...props }) {
  return (
    <button type="button" title={label} aria-label={label} className={cn('inline-flex size-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100', className)} {...props}>
      <Icon className="size-4" />
    </button>
  );
}

/* ---------------- Form controls ---------------- */
export function Field({ label, required, error, hint, className, children }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}{required && <span className="ml-0.5 text-red-500">*</span>}</label>}
      {children}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export const Input = ({ className, ...p }) => <input className={cn('input', className)} {...p} />;
export const Textarea = ({ className, rows = 3, ...p }) => <textarea rows={rows} className={cn('input', className)} {...p} />;
export function Select({ options = [], placeholder, className, ...p }) {
  return (
    <select className={cn('input pr-8', className)} {...p}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => {
        const v = typeof o === 'object' ? o.value : o;
        const l = typeof o === 'object' ? o.label : o;
        return <option key={v} value={v}>{l}</option>;
      })}
    </select>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
      <input className="input pl-9" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/* ---------------- Badges ---------------- */
const TONES = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-500/15 dark:bg-slate-800 dark:text-slate-300',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/15 dark:bg-blue-500/10 dark:text-blue-300',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/15 dark:bg-indigo-500/10 dark:text-indigo-300',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/15 dark:bg-violet-500/10 dark:text-violet-300',
  cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-600/15 dark:bg-cyan-500/10 dark:text-cyan-300',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300',
  red: 'bg-red-50 text-red-700 ring-red-600/15 dark:bg-red-500/10 dark:text-red-300',
  brand: 'bg-brand-50 text-brand-700 ring-brand-600/15 dark:bg-brand-500/10 dark:text-brand-300',
};
const DOT = { slate: 'bg-slate-400', blue: 'bg-blue-500', indigo: 'bg-indigo-500', violet: 'bg-violet-500', cyan: 'bg-cyan-500', green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500', brand: 'bg-brand-500' };

export function Badge({ tone = 'slate', dot, className, children }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset', TONES[tone], className)}>
      {dot && <span className={cn('size-1.5 rounded-full', DOT[tone])} />}
      {children}
    </span>
  );
}

export const StatusBadge = ({ value, className }) =>
  value ? <Badge tone={STATUS_TONE[value] || 'slate'} dot className={className}>{value}</Badge> : <span className="text-slate-400">—</span>;

/* ---------------- Layout pieces ---------------- */
export function Card({ className, children, ...p }) {
  return <div className={cn('card', className)} {...p}>{children}</div>;
}

export function CardHeader({ title, subtitle, action, icon: Icon, className }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 dark:border-slate-800', className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && <Icon className="size-4 text-slate-400" />}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions, breadcrumbs, children }) {
  return (
    <div className="mb-6">
      {breadcrumbs && (
        <nav className="mb-2 flex items-center gap-1 text-xs text-slate-500">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3" />}
              {b.to ? <Link to={b.to} className="hover:text-brand-600">{b.label}</Link> : <span className="text-slate-700 dark:text-slate-300">{b.label}</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Progress({ value = 0, className, size = 'md', showLabel = true, tone }) {
  const v = Math.max(0, Math.min(100, Math.round(value || 0)));
  const color = tone || (v >= 100 ? 'bg-emerald-500' : v >= 60 ? 'bg-blue-500' : v >= 30 ? 'bg-brand-500' : 'bg-amber-500');
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800', size === 'sm' ? 'h-1.5' : 'h-2')}>
        <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${v}%` }} />
      </div>
      {showLabel && <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums text-slate-600 dark:text-slate-400">{v}%</span>}
    </div>
  );
}

export const Spinner = ({ className }) => <Loader2 className={cn('size-5 animate-spin text-brand-600', className)} />;

export function PageLoader() {
  return <div className="flex h-64 items-center justify-center"><Spinner className="size-7" /></div>;
}

export function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="mb-3 rounded-full bg-slate-100 p-3 dark:bg-slate-800"><Icon className="size-6 text-slate-400" /></div>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Avatar({ name, className }) {
  const hue = [...(name || '')].reduce((s, c) => s + c.charCodeAt(0), 0) % 360;
  return (
    <span className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white', className)} style={{ background: `hsl(${hue} 55% 48%)` }}>
      {initials(name) || '?'}
    </span>
  );
}

export function StatCard({ label, value, icon: Icon, tone = 'brand', hint, trend, to }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10', blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10',
    green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10', red: 'bg-red-50 text-red-600 dark:bg-red-500/10',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10', amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10',
    cyan: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10', slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800',
  };
  const body = (
    <Card className={cn('p-4 transition', to && 'hover:border-brand-300 hover:shadow-md')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs leading-snug font-medium text-slate-500">{label}</p>
          <p className="mt-1.5 truncate text-xl font-bold tracking-tight text-slate-900 tabular-nums dark:text-white">{value}</p>
        </div>
        {Icon && <div className={cn('rounded-lg p-2', tones[tone])}><Icon className="size-4.5" /></div>}
      </div>
      {(hint || trend) && <p className="mt-2 truncate text-xs text-slate-500">{trend}{hint}</p>}
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

/* ---------------- Tabs ---------------- */
export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={cn('no-print -mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1 dark:border-slate-800', className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={cn(
            '-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition',
            value === t.value ? 'border-brand-600 text-brand-700 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200',
          )}
        >
          {t.icon && <t.icon className="size-4" />}
          {t.label}
          {t.count != null && <span className="rounded-full bg-slate-100 px-1.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} title={o.label}
          className={cn('flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition', value === o.value ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white' : 'text-slate-500 hover:text-slate-800')}>
          {o.icon && <o.icon className="size-3.5" />}{o.showLabel !== false && o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Overlays ---------------- */
function useEscape(onClose, open) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', h);
      document.body.style.overflow = prev;
    };
  }, [onClose, open]);
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  useEscape(onClose, open);
  if (!open) return null;
  const w = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cn('relative flex max-h-[92vh] w-full animate-pop flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl dark:bg-slate-900', w)}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, description, children, footer, width = 'max-w-2xl' }) {
  useEscape(onClose, open);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cn('absolute inset-y-0 right-0 flex w-full animate-slide-in flex-col bg-white shadow-2xl dark:bg-slate-900', width)}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-3 dark:border-slate-800 dark:bg-slate-900">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ---------------- Confirm dialog (promise based) ---------------- */
const ConfirmCtx = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolver = useRef();
  const confirm = useCallback((opts) => {
    setState(typeof opts === 'string' ? { message: opts } : opts);
    return new Promise((res) => (resolver.current = res));
  }, []);
  const close = (v) => {
    resolver.current?.(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal open={!!state} onClose={() => close(false)} title={state?.title || 'Are you sure?'} size="sm"
        footer={<><Button variant="secondary" onClick={() => close(false)}>Cancel</Button><Button variant={state?.danger === false ? 'primary' : 'danger'} onClick={() => close(true)}>{state?.confirmText || 'Confirm'}</Button></>}>
        <div className="flex gap-3">
          <div className={cn('h-fit rounded-full p-2', state?.danger === false ? 'bg-brand-50 text-brand-600' : 'bg-red-50 text-red-600 dark:bg-red-500/10')}><AlertTriangle className="size-5" /></div>
          <p className="text-sm text-slate-600 dark:text-slate-300">{state?.message}</p>
        </div>
      </Modal>
    </ConfirmCtx.Provider>
  );
}
export const useConfirm = () => useContext(ConfirmCtx);

/* ---------------- Dropdown menu ---------------- */
export function Menu({ trigger, items, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);
  const visible = items.filter((i) => i && !i.hidden);
  if (!visible.length) return null;
  return (
    <>
      <span ref={ref} onClick={(e) => {
        e.stopPropagation();
        const r = ref.current.getBoundingClientRect();
        const h = visible.length * 36 + 12;
        setPos({ top: r.bottom + h > window.innerHeight ? r.top - h - 4 : r.bottom + 4, left: align === 'right' ? r.right - 208 : r.left });
        setOpen((o) => !o);
      }}>{trigger}</span>
      {open && pos && createPortal(
        <div className="fixed z-[60] w-52 animate-pop rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900" style={{ top: pos.top, left: Math.max(8, pos.left) }} onClick={(e) => e.stopPropagation()}>
          {visible.map((it, i) => it.divider ? <div key={i} className="my-1 h-px bg-slate-100 dark:bg-slate-800" /> : (
            <button key={i} type="button" onClick={() => { setOpen(false); it.onClick?.(); }}
              className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition', it.danger ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}>
              {it.icon && <it.icon className="size-4 opacity-70" />}{it.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

export function KeyValue({ items, cols = 2 }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-4', cols === 3 ? 'sm:grid-cols-3' : cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2')}>
      {items.filter(Boolean).map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-xs font-medium text-slate-500">{it.label}</dt>
          <dd className="mt-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200">{it.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
