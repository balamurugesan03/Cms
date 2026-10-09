import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Download, X, Filter } from 'lucide-react';
import DataTable from './DataTable';
import ResourceForm from './ResourceForm';
import RefSelect from './RefSelect';
import { Button, Card, Drawer, PageHeader, SearchInput, Select, useConfirm, EmptyState } from '../ui';
import { get, post, put, del, errMsg } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useDebounce, useAction } from '../../lib/hooks';
import { downloadCSV, get as getPath, fmtDate } from '../../lib/format';

/**
 * Generic list + create/edit/delete screen driven by a resource config (see config/resources.jsx).
 *  fixed:    filters locked by the parent (e.g. { project: id } inside Project detail); also pre-fills the form
 *  embedded: renders without the page header (for tabs)
 */
export default function ResourcePage({ config, fixed = {}, embedded = false, title, extraActions, ctxExtra = {} }) {
  const { can } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const action = useAction();
  const [params, setParams] = useSearchParams();

  const initialFilters = useMemo(() => {
    if (embedded || params.get('create')) return {};
    const f = {};
    for (const flt of config.filters || []) if (params.get(flt.name)) f[flt.name] = params.get(flt.name);
    return f;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [q, setQ] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null); // null | 'new' | record
  const [saving, setSaving] = useState(false);
  const dq = useDebounce(q);
  const [prefill, setPrefill] = useState({});

  useEffect(() => setPage(1), [dq, filters]);

  const query = { q: dq || undefined, page, limit: config.pageSize || 25, ...config.params, ...filters, ...fixed };
  const { data, isLoading } = useQuery({ queryKey: [config.endpoint, query], queryFn: () => get(config.endpoint, query), placeholderData: (p) => p });

  const canEdit = can(config.module, 'edit') && config.editable !== false;
  const refresh = () => qc.invalidateQueries();
  const ctx = { nav, refresh, action, confirm, can, fixed, ...ctxExtra };

  const openEdit = (row) => setEditing(row);

  // Workflow deep-link: /module?create=1&field=value opens a pre-filled create form
  useEffect(() => {
    if (embedded || !params.get('create') || !canEdit) return;
    const p = Object.fromEntries([...params.entries()].filter(([k]) => config.fields.some((f) => f.name === k)));
    setPrefill(p);
    setEditing('new');
    setParams({}, { replace: true });
  }, [canEdit]); // eslint-disable-line react-hooks/exhaustive-deps
  const remove = async (row) => {
    if (!(await confirm({ title: `Delete ${config.singular || 'record'}?`, message: `${row.code || row.name || row.title || 'This record'} will be permanently deleted.`, confirmText: 'Delete' }))) return;
    try {
      await del(`${config.endpoint}/${row._id}`);
      toast.success('Deleted');
      refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const rowActions = (row) => [
    ...(config.rowActions?.(row, ctx) || []),
    canEdit && config.canEditRow?.(row) !== false && { label: 'Edit', icon: Pencil, onClick: () => openEdit(row) },
    canEdit && config.deletable !== false && config.canEditRow?.(row) !== false && { divider: true },
    canEdit && config.deletable !== false && config.canEditRow?.(row) !== false && { label: 'Delete', icon: Trash2, danger: true, onClick: () => remove(row) },
  ].filter(Boolean);

  const submit = async (payload) => {
    setSaving(true);
    try {
      const body = config.transform ? config.transform(payload, editing) : payload;
      const res = editing === 'new' ? await post(config.endpoint, body) : await put(`${config.endpoint}/${editing._id}`, body);
      toast.success(editing === 'new' ? `${config.singular || 'Record'} created` : 'Changes saved');
      setEditing(null);
      refresh();
      if (editing === 'new' && config.afterCreate) config.afterCreate(res, ctx);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const columns = config.columns.filter((c) => !(c.hideWhenFixed && Object.keys(fixed).some((k) => c.key.startsWith(k))));
  const activeFilters = (config.filters || []).filter((f) => !(f.name in fixed) && (!f.ref?.module || can(f.ref.module)));
  const hasFilters = Object.values(filters).some(Boolean);

  const exportCsv = async () => {
    const all = await get(config.endpoint, { ...query, page: 1, limit: 1000 });
    const cols = columns.filter((c) => !c.noExport);
    downloadCSV(`${config.key}.csv`, cols, all.items.map((r) => Object.fromEntries(cols.map((c) => {
      const v = c.exportValue ? c.exportValue(r) : getPath(r, c.key);
      return [c.key, c.type === 'date' ? fmtDate(v) : typeof v === 'object' && v ? v.name || v.code || v.title : v];
    }))));
  };

  const createBtn = canEdit && config.creatable !== false && (
    <Button icon={Plus} onClick={() => setEditing('new')} size={embedded ? 'sm' : 'md'}>{config.createLabel || `New ${config.singular || ''}`}</Button>
  );

  return (
    <div>
      {!embedded && (
        <PageHeader title={title || config.title} description={config.description}
          actions={<>{config.headerActions?.(ctx)}{extraActions}<Button variant="secondary" icon={Download} onClick={exportCsv}>Export</Button>{createBtn}</>} />
      )}
      {config.banner?.(ctx)}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-slate-100 p-3 lg:flex-row lg:items-center dark:border-slate-800">
          {embedded && title && <h3 className="mr-2 text-sm font-semibold">{title}</h3>}
          <SearchInput value={q} onChange={setQ} placeholder={config.searchPlaceholder || 'Search…'} className="w-full lg:max-w-xs" />
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {activeFilters.length > 0 && <Filter className="hidden size-4 text-slate-400 lg:block" />}
            {activeFilters.map((f) => (
              <div key={f.name} className="w-[calc(50%-4px)] sm:w-44">
                {f.ref ? (
                  <RefSelect endpoint={f.ref.endpoint} params={f.ref.params} lookup={f.ref.lookup} labelOf={f.ref.label} placeholder={f.label} value={filters[f.name] || ''} onChange={(v) => setFilters((s) => ({ ...s, [f.name]: v || undefined }))} />
                ) : (
                  <Select value={filters[f.name] || ''} placeholder={`All ${f.label.toLowerCase()}`} options={f.options} onChange={(e) => setFilters((s) => ({ ...s, [f.name]: e.target.value || undefined }))} />
                )}
              </div>
            ))}
            {hasFilters && <Button variant="ghost" size="sm" icon={X} onClick={() => { setFilters({}); if (!embedded) setParams({}); }}>Clear</Button>}
          </div>
          {embedded && <div className="flex gap-2">{extraActions}{createBtn}</div>}
        </div>
        {config.renderList ? (
          config.renderList({ rows: data?.items || [], loading: isLoading, ctx, edit: openEdit, remove, rowActions })
        ) : (
          <DataTable
            columns={columns}
            rows={data?.items || []}
            loading={isLoading}
            onRowClick={config.onRowClick ? (r) => config.onRowClick(r, ctx) : canEdit ? openEdit : undefined}
            actions={rowActions}
            page={data?.page}
            pages={data?.pages}
            total={data?.total}
            onPage={setPage}
            empty={<EmptyState icon={config.icon} title={`No ${(config.title || '').toLowerCase()} found`} description={hasFilters || dq ? 'Try changing the search or filters.' : config.emptyText} action={!hasFilters && !dq && createBtn} />}
          />
        )}
      </Card>

      <Drawer open={!!editing} onClose={() => { setEditing(null); setPrefill({}); }} width={config.formWidth || 'max-w-2xl'}
        title={editing === 'new' ? config.createLabel || `New ${config.singular}` : `Edit ${config.singular}${editing?.code ? ` · ${editing.code}` : ''}`}
        description={config.formDescription}
        footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" form="resource-form" loading={saving}>{editing === 'new' ? 'Create' : 'Save changes'}</Button></>}>
        {editing && (
          <ResourceForm
            key={editing === 'new' ? 'new' : editing._id}
            fields={config.fields}
            record={editing === 'new' ? null : editing}
            defaults={{ ...(config.defaults?.() || {}), ...prefill, ...fixed }}
            hidden={editing === 'new' ? fixed : Object.fromEntries(Object.keys(fixed).filter((k) => config.fields.some((f) => f.name === k)).map((k) => [k, fixed[k]]))}
            summary={config.summary}
            onSubmit={submit}
          />
        )}
      </Drawer>
    </div>
  );
}
