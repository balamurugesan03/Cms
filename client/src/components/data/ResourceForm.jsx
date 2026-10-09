import { useMemo, useState } from 'react';
import { Control, ItemsEditor } from './FormFields';
import { Field } from '../ui';
import { cn, dateInput, get } from '../../lib/format';

const idOf = (v) => (v && typeof v === 'object' ? v._id : v);

function toFormValue(field, raw) {
  if (field.type === 'ref') return raw === null && field.ref?.nullLabel ? null : idOf(raw) ?? '';
  if (field.type === 'multiref') return (raw || []).map(idOf);
  if (field.type === 'date') return dateInput(raw);
  if (field.type === 'items') {
    return (raw || []).map((row) => {
      const out = { ...row };
      for (const c of field.columns) if (!c.computed) out[c.name] = toFormValue(c, row[c.name]);
      return out;
    });
  }
  if (field.type === 'files') return raw || [];
  return raw ?? (field.type === 'checkbox' ? false : '');
}

function toPayload(field, v) {
  if (['ref', 'date', 'number', 'currency', 'percent'].includes(field.type) && v === '') return null;
  if (field.type === 'items') {
    return (v || []).map((row) => {
      const out = { ...row };
      for (const c of field.columns) {
        if (c.computed) continue;
        out[c.name] = toPayload(c, row[c.name]);
      }
      return out;
    });
  }
  return v;
}

export function buildInitial(fields, record, defaults = {}) {
  const v = {};
  for (const f of fields) {
    const raw = record ? get(record, f.name) : defaults[f.name] ?? f.default;
    v[f.name] = toFormValue(f, typeof raw === 'function' ? raw() : raw);
  }
  return v;
}

export function buildPayload(fields, values, hidden = {}) {
  const out = { ...hidden };
  for (const f of fields) {
    if (f.showIf && !f.showIf(values)) continue;
    if (f.readOnly) continue;
    out[f.name] = toPayload(f, values[f.name]);
  }
  return out;
}

/**
 * Config-driven form. Fields are grouped by `section` and laid out on a 2-column grid
 * (`span: 2` = full width). `summary(values)` renders a live totals panel.
 */
export default function ResourceForm({ id = 'resource-form', fields, record, defaults, hidden = {}, onSubmit, summary }) {
  const [values, setValues] = useState(() => buildInitial(fields, record, defaults));
  const [errors, setErrors] = useState({});
  const set = (name, v, obj, field) => {
    setValues((s) => {
      const next = { ...s, [name]: v };
      if (field?.onSelect && obj !== undefined) Object.assign(next, field.onSelect(obj, next) || {});
      return next;
    });
    setErrors((e) => ({ ...e, [name]: undefined }));
  };

  const visible = fields.filter((f) => !(f.name in hidden) && !f.hidden && (!f.showIf || f.showIf(values)));
  const sections = useMemo(() => {
    const out = [];
    for (const f of visible) {
      const s = f.section || '';
      let sec = out.find((x) => x.name === s);
      if (!sec) out.push((sec = { name: s, fields: [] }));
      sec.fields.push(f);
    }
    return out;
  }, [visible]);

  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    for (const f of visible) {
      const v = values[f.name];
      if (f.required && (v === '' || v == null || (Array.isArray(v) && !v.length))) errs[f.name] = `${f.label} is required`;
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSubmit(buildPayload(fields, values, hidden), values);
  };

  const sum = summary?.({ ...hidden, ...values });

  return (
    <form id={id} onSubmit={submit} className="space-y-6">
      {sections.map((sec) => (
        <div key={sec.name}>
          {sec.name && <h4 className="mb-3 text-xs font-semibold tracking-wider text-slate-400 uppercase">{sec.name}</h4>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {sec.fields.map((f) => (
              <Field key={f.name} label={f.type === 'items' ? null : f.label} required={f.required} error={errors[f.name]} hint={f.help} className={cn((f.span === 2 || ['items', 'textarea', 'files'].includes(f.type)) && 'sm:col-span-2')}>
                {f.type === 'items' ? (
                  <>
                    <div className="mb-2 flex items-center justify-between"><span className="label !mb-0">{f.label}</span></div>
                    <ItemsEditor field={f} rows={values[f.name]} values={values} initialRows={record?.[f.name]} onChange={(rows) => set(f.name, rows)} />
                  </>
                ) : (
                  <Control field={f} value={values[f.name]} values={values} initial={record ? get(record, f.name) : undefined} onChange={(v, obj) => set(f.name, v, obj, f)} />
                )}
              </Field>
            ))}
          </div>
        </div>
      ))}
      {sum?.length > 0 && (
        <div className="ml-auto w-full max-w-sm rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/40">
          {sum.map((s) => (
            <div key={s.label} className={cn('flex justify-between py-1 text-sm', s.strong && 'mt-1 border-t border-slate-200 pt-2 text-base font-bold text-slate-900 dark:border-slate-700 dark:text-white')}>
              <span className={s.strong ? '' : 'text-slate-500'}>{s.label}</span>
              <span className="tabular-nums">{s.value}</span>
            </div>
          ))}
        </div>
      )}
    </form>
  );
}
