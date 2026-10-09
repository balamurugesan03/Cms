import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Printer, Send, CheckCircle2, XCircle, Copy, FolderKanban, Pencil, History, ExternalLink } from 'lucide-react';
import { useApi, useAction } from '../lib/hooks';
import { useAuth } from '../context/AuthContext';
import { put, errMsg } from '../lib/api';
import { Button, PageHeader, PageLoader, Drawer, Modal, Field, Input, Card, CardHeader, StatusBadge, Textarea } from '../components/ui';
import PrintDocument, { PartyBlock } from '../components/data/PrintDocument';
import ResourceForm from '../components/data/ResourceForm';
import RefSelect from '../components/data/RefSelect';
import { quotations, REF } from '../config/resources';
import { fmtDate, money, dateInput, cn } from '../lib/format';

export default function QuotationView() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { can, role } = useAuth();
  const action = useAction();
  const { data: q, isLoading } = useApi(`/quotations/${id}`);
  const { data: versions } = useApi(q ? '/quotations' : null, { baseCode: q?.baseCode, limit: 50, sort: '-version' });
  const [editing, setEditing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [conv, setConv] = useState({});
  const [saving, setSaving] = useState(false);

  if (isLoading || !q) return <PageLoader />;
  const canEdit = can('quotations', 'edit');
  const canRespond = role === 'Client' || canEdit;
  const run = (url, body, success, after) => action.mutate({ url, body, success }, { onSuccess: after });

  const save = async (payload) => {
    setSaving(true);
    try {
      await put(`/quotations/${id}`, payload);
      toast.success('Quotation updated');
      setEditing(false);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const openConvert = () => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 90);
    setConv({ name: q.title, startDate: dateInput(start), endDate: dateInput(end), siteAddress: q.siteAddress, budget: q.boq?.costTotal || Math.round(q.taxable * 0.8), manager: '' });
    setConverting(true);
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Quotations', to: '/quotations' }, { label: `${q.code} v${q.version}` }]}
        title={q.title}
        description={`${q.client?.name} · ${q.projectType}`}
        actions={
          <>
            <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print / PDF</Button>
            {canEdit && ['Draft', 'Rejected', 'Sent'].includes(q.status) && <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>}
            {canEdit && !['Converted', 'Revised'].includes(q.status) && <Button variant="secondary" icon={Copy} onClick={() => run(`/quotations/${id}/revise`, null, 'New version created', (r) => nav(`/quotations/${r._id}`))}>New version</Button>}
            {canEdit && ['Draft', 'Rejected'].includes(q.status) && <Button icon={Send} onClick={() => run(`/quotations/${id}/send`, null, 'Marked as sent to client')}>Send to client</Button>}
            {canRespond && q.status === 'Sent' && (
              <>
                <Button variant="secondary" icon={XCircle} onClick={() => setRejecting(true)}>Reject</Button>
                <Button variant="success" icon={CheckCircle2} onClick={() => run(`/quotations/${id}/respond`, { action: 'approve' }, 'Quotation approved')}>Approve</Button>
              </>
            )}
            {canEdit && q.status === 'Approved' && <Button icon={FolderKanban} onClick={openConvert}>Convert to project</Button>}
            {q.project && <Button icon={ExternalLink} variant="soft" to={`/projects/${q.project._id}`}>Open project</Button>}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        <PrintDocument
          docTitle="Quotation"
          code={`${q.code} · v${q.version}`}
          status={q.status}
          partyLabel="Quotation for"
          party={<PartyBlock name={q.client?.name} lines={[q.client?.address, q.client?.phone, q.client?.email, q.client?.gstin && `GSTIN: ${q.client.gstin}`]} />}
          meta={[
            { label: 'Date', value: fmtDate(q.createdAt) },
            { label: 'Valid until', value: fmtDate(q.validUntil) },
            { label: 'Project type', value: q.projectType },
            q.siteAddress && { label: 'Site', value: q.siteAddress },
          ]}
          columns={[
            { key: 'description', label: 'Description', render: (it) => <><p className="font-medium">{it.description}</p>{it.area && <p className="text-xs text-slate-500">{it.area}</p>}</> },
            { key: 'unit', label: 'Unit' },
            { key: 'quantity', label: 'Qty', num: true },
            { key: 'rate', label: 'Rate', num: true, money: true },
            { key: 'amount', label: 'Amount', num: true, money: true },
          ]}
          items={q.items}
          totals={[
            { label: 'Subtotal', value: money(q.subtotal, true) },
            q.discountAmount > 0 && { label: `Discount (${q.discountPercent}%)`, value: `− ${money(q.discountAmount, true)}` },
            q.discountAmount > 0 && { label: 'Taxable value', value: money(q.taxable, true) },
            { label: `GST (${q.gstPercent}%)`, value: money(q.gstAmount, true) },
            { label: 'Grand Total', value: money(q.grandTotal, true), strong: true },
          ]}
          footer={q.terms && <div><p className="mb-1 font-semibold text-slate-700 dark:text-slate-300">Terms & Conditions</p><p className="whitespace-pre-line">{q.terms}</p></div>}
        />

        <div className="no-print space-y-4">
          <Card>
            <CardHeader title="Versions" icon={History} />
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {(versions?.items || []).map((v) => (
                <li key={v._id}>
                  <button onClick={() => nav(`/quotations/${v._id}`)} className={cn('flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/40', v._id === q._id && 'bg-brand-50/60 dark:bg-brand-500/10')}>
                    <div><p className="font-medium">v{v.version} <span className="font-mono text-xs text-slate-400">{v.code}</span></p><p className="text-xs text-slate-500">{money(v.grandTotal)}</p></div>
                    <StatusBadge value={v.status} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {q.boq && (
            <Card className="p-4 text-sm">
              <p className="text-xs text-slate-500">Based on estimate</p>
              <p className="font-medium">{q.boq.code} · {q.boq.title}</p>
              {canEdit && (
                <div className="mt-2 flex justify-between text-xs">
                  <span className="text-slate-500">Estimated cost</span><b>{money(q.boq.costTotal)}</b>
                </div>
              )}
              {canEdit && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Margin on taxable</span><b className="text-emerald-600">{q.taxable ? Math.round(((q.taxable - q.boq.costTotal) / q.taxable) * 100) : 0}%</b>
                </div>
              )}
            </Card>
          )}
          {q.notes && <Card className="p-4 text-sm"><p className="mb-1 text-xs text-slate-500">Notes</p><p className="whitespace-pre-line">{q.notes}</p></Card>}
        </div>
      </div>

      <Drawer open={editing} onClose={() => setEditing(false)} title={`Edit ${q.code} v${q.version}`} width="max-w-5xl"
        footer={<><Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button><Button type="submit" form="resource-form" loading={saving}>Save</Button></>}>
        {editing && <ResourceForm fields={quotations.fields} record={q} summary={quotations.summary} onSubmit={save} />}
      </Drawer>

      <Modal open={rejecting} onClose={() => setRejecting(false)} title="Reject quotation" size="sm"
        footer={<><Button variant="secondary" onClick={() => setRejecting(false)}>Cancel</Button><Button variant="danger" onClick={() => { run(`/quotations/${id}/respond`, { action: 'reject', notes: note }, 'Quotation rejected'); setRejecting(false); }}>Reject</Button></>}>
        <Field label="Reason / changes required"><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} /></Field>
      </Modal>

      <Modal open={converting} onClose={() => setConverting(false)} title="Convert to project" description={`Contract value ${money(q.grandTotal)} will be set from this quotation.`}
        footer={<><Button variant="secondary" onClick={() => setConverting(false)}>Cancel</Button><Button icon={FolderKanban} loading={action.isPending} onClick={() => run(`/quotations/${id}/convert`, { ...conv, manager: conv.manager || undefined }, 'Project created 🎉', (p) => nav(`/projects/${p._id}`))}>Create project</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Project name" className="sm:col-span-2"><Input value={conv.name || ''} onChange={(e) => setConv({ ...conv, name: e.target.value })} /></Field>
          <Field label="Site address" className="sm:col-span-2"><Input value={conv.siteAddress || ''} onChange={(e) => setConv({ ...conv, siteAddress: e.target.value })} /></Field>
          <Field label="Start date"><Input type="date" value={conv.startDate || ''} onChange={(e) => setConv({ ...conv, startDate: e.target.value })} /></Field>
          <Field label="Expected end"><Input type="date" value={conv.endDate || ''} onChange={(e) => setConv({ ...conv, endDate: e.target.value })} /></Field>
          <Field label="Cost budget" hint="Defaults to BOQ cost"><Input type="number" value={conv.budget || ''} onChange={(e) => setConv({ ...conv, budget: Number(e.target.value) })} /></Field>
          <Field label="Project manager"><RefSelect {...REF.staff} labelOf={REF.staff.label} params={{ role: 'Project Manager' }} value={conv.manager} onChange={(v) => setConv({ ...conv, manager: v })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
