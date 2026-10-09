import { useRef, useState } from 'react';
import { Plus, Trash2, Upload, FileText, X, Loader2 } from 'lucide-react';
import RefSelect from './RefSelect';
import { Input, Select, Textarea, Field } from '../ui';
import { uploadFiles, toastError } from '../../lib/api';
import { cn, isImage, money } from '../../lib/format';

/** Renders one input control for a field definition */
export function Control({ field, value, onChange, values, initial }) {
  const common = { disabled: field.readOnly || (field.disabledIf && field.disabledIf(values)), placeholder: field.placeholder };
  switch (field.type) {
    case 'textarea':
      return <Textarea rows={field.rows || 3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...common} />;
    case 'select':
      return <Select value={value ?? ''} options={typeof field.options === 'function' ? field.options(values) : field.options} placeholder={field.required ? 'Select…' : '—'} onChange={(e) => onChange(e.target.value)} {...common} />;
    case 'ref':
    case 'multiref':
      return (
        <RefSelect
          endpoint={field.ref.endpoint}
          params={typeof field.ref.params === 'function' ? field.ref.params(values) : field.ref.params}
          labelOf={field.ref.label}
          sub={field.ref.sub}
          lookup={field.ref.lookup}
          nullLabel={field.ref.nullLabel}
          multiple={field.type === 'multiref'}
          value={value}
          initial={initial}
          onChange={(v, obj) => onChange(v, obj)}
          {...common}
        />
      );
    case 'checkbox':
      return (
        <label className="flex h-9 cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 rounded accent-brand-600" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          {field.checkboxLabel || 'Yes'}
        </label>
      );
    case 'files':
      return <FilesInput value={value || []} onChange={onChange} />;
    case 'file':
      return <FileInput value={value} onChange={onChange} />;
    case 'number':
    case 'currency':
    case 'percent':
      return (
        <div className="relative">
          {field.type === 'currency' && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-400">₹</span>}
          <Input type="number" step="any" min={field.min} max={field.max} className={cn(field.type === 'currency' && 'pl-7', field.type === 'percent' && 'pr-8')}
            value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} {...common} />
          {field.type === 'percent' && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-400">%</span>}
        </div>
      );
    default:
      return <Input type={field.type || 'text'} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...common} />;
  }
}

/* ---------------- Line items editor ---------------- */
export function ItemsEditor({ field, rows = [], onChange, values, initialRows = [] }) {
  const cols = field.columns;
  const blank = () => Object.fromEntries(cols.filter((c) => !c.computed).map((c) => [c.name, c.default ?? '']));
  const update = (i, name, v, obj) => {
    const next = rows.map((r, idx) => {
      if (idx !== i) return r;
      const row = { ...r, [name]: v };
      const col = cols.find((c) => c.name === name);
      if (col?.onSelect && obj) Object.assign(row, col.onSelect(obj, row));
      return row;
    });
    onChange(next);
  };
  const total = field.total ? rows.reduce((s, r) => s + (Number(field.total(r)) || 0), 0) : null;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="th w-8 !px-2 text-center">#</th>
              {cols.map((c) => <th key={c.name} className={cn('th !px-2', c.computed && 'text-right')} style={{ width: c.width }}>{c.label}</th>)}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row, i) => (
              <tr key={row._id || i} className="align-top">
                <td className="px-2 py-2 pt-4 text-center text-xs text-slate-400">{i + 1}</td>
                {cols.map((c) => (
                  <td key={c.name} className="px-1.5 py-1.5">
                    {c.computed ? (
                      <div className="pt-2 pr-1 text-right font-medium tabular-nums">{c.format === 'number' ? c.computed(row) : money(c.computed(row))}</div>
                    ) : (
                      <Control field={c} value={row[c.name]} values={row} initial={initialRows[i]?.[c.name]} onChange={(v, obj) => update(i, c.name, v, obj)} />
                    )}
                  </td>
                ))}
                <td className="px-1 py-1.5">
                  <button type="button" className="mt-0.5 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10" onClick={() => onChange(rows.filter((_, idx) => idx !== i))}>
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={cols.length + 2} className="py-6 text-center text-sm text-slate-400">No items yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/30">
        <button type="button" onClick={() => onChange([...rows, blank()])} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10">
          <Plus className="size-4" /> Add {field.itemLabel || 'item'}
        </button>
        {total != null && <span className="text-sm text-slate-500">Total <b className="ml-1 text-slate-900 tabular-nums dark:text-white">{money(total)}</b></span>}
      </div>
    </div>
  );
}

/* ---------------- Uploads ---------------- */
function useUploader(onDone) {
  const [busy, setBusy] = useState(false);
  const ref = useRef();
  const pick = () => ref.current?.click();
  const input = (
    <input ref={ref} type="file" multiple className="hidden" onChange={async (e) => {
      const files = [...e.target.files];
      e.target.value = '';
      if (!files.length) return;
      setBusy(true);
      try {
        onDone(await uploadFiles(files));
      } catch (err) {
        toastError(err);
      } finally {
        setBusy(false);
      }
    }} />
  );
  return { busy, pick, input };
}

export function FilesInput({ value, onChange }) {
  const { busy, pick, input } = useUploader((files) => onChange([...value, ...files.map((f) => f.url)]));
  return (
    <div className="flex flex-wrap gap-2">
      {value.map((u) => (
        <div key={u} className="group relative size-20 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
          {isImage(u) ? <img src={u} alt="" className="size-full object-cover" /> : <FileText className="m-auto mt-6 size-7 text-slate-400" />}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== u))} className="absolute top-1 right-1 rounded-full bg-slate-900/70 p-0.5 text-white opacity-0 transition group-hover:opacity-100"><X className="size-3" /></button>
        </div>
      ))}
      <button type="button" onClick={pick} className="flex size-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-xs text-slate-500 hover:border-brand-400 hover:text-brand-600 dark:border-slate-700">
        {busy ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
        Upload
      </button>
      {input}
    </div>
  );
}

export function FileInput({ value, onChange }) {
  const { busy, pick, input } = useUploader((files) => onChange(files[0]?.url, files[0]));
  return (
    <div className="flex items-center gap-3">
      {value ? (
        <a href={value} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-brand-700 hover:bg-slate-50 dark:border-slate-700">
          {isImage(value) ? <img src={value} alt="" className="size-8 rounded object-cover" /> : <FileText className="size-4" />}
          <span className="truncate">{value.split('/').pop()}</span>
        </a>
      ) : null}
      <button type="button" onClick={pick} className="inline-flex h-9 items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 text-sm text-slate-600 hover:border-brand-400 hover:text-brand-600 dark:border-slate-700 dark:text-slate-400">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} {value ? 'Replace' : 'Choose file'}
      </button>
      {input}
    </div>
  );
}

export { Field };
