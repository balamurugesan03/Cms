import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer, Wallet, Ban, ExternalLink } from 'lucide-react';
import { useApi, useAction } from '../lib/hooks';
import { useAuth } from '../context/AuthContext';
import { Button, PageHeader, PageLoader, Modal, Field, Input, Select, Card, CardHeader, EmptyState, useConfirm } from '../components/ui';
import PrintDocument, { PartyBlock } from '../components/data/PrintDocument';
import { PAYMENT_MODES } from '../lib/constants';
import { fmtDate, money, today } from '../lib/format';

const TITLES = { Client: 'Tax Invoice', Vendor: 'Purchase Invoice', Contractor: 'Contractor Bill' };
const PAY_CATEGORY = { Client: 'Client Receipt', Vendor: 'Vendor Payment', Contractor: 'Contractor Payment' };

export default function BillView() {
  const { id } = useParams();
  const { can, isExternal } = useAuth();
  const confirm = useConfirm();
  const action = useAction();
  const { data: b, isLoading } = useApi(`/bills/${id}`);
  const { data: pays } = useApi(can('payments') ? '/payments' : null, { bill: id, limit: 100 });
  const [paying, setPaying] = useState(false);
  const [pay, setPay] = useState({});

  if (isLoading || !b) return <PageLoader />;
  const party = b.client || b.vendor || b.subcontractor || {};
  const isOut = b.billType !== 'Client';

  const openPay = () => {
    setPay({ amount: b.balance, date: today(), mode: 'Bank Transfer', reference: '' });
    setPaying(true);
  };
  const submitPay = () => action.mutate(
    { url: '/payments', body: { ...pay, bill: id, category: PAY_CATEGORY[b.billType] }, success: isOut ? 'Payment recorded' : 'Receipt recorded' },
    { onSuccess: () => setPaying(false) },
  );
  const cancelBill = async () => {
    if (await confirm({ title: 'Cancel this bill?', message: 'Cancelled bills are excluded from revenue / cost.', confirmText: 'Cancel bill' })) {
      action.mutate({ url: `/bills/${id}`, method: 'put', body: { status: 'Cancelled' }, success: 'Bill cancelled' });
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Bills & Invoices', to: '/finance/bills' }, { label: b.code }]}
        title={`${TITLES[b.billType]} ${b.code}`}
        description={`${party.name || ''}${b.project ? ` · ${b.project.name}` : ''}`}
        actions={
          <>
            <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print / PDF</Button>
            {b.project && !isExternal && <Button variant="secondary" icon={ExternalLink} to={`/projects/${b.project._id}?tab=finance`}>Project</Button>}
            {can('bills', 'edit') && b.paidAmount === 0 && b.status !== 'Cancelled' && <Button variant="secondary" icon={Ban} onClick={cancelBill}>Cancel</Button>}
            {can('payments', 'edit') && b.balance > 0 && !['Draft', 'Cancelled'].includes(b.status) && <Button icon={Wallet} onClick={openPay}>{isOut ? 'Record payment' : 'Record receipt'}</Button>}
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <PrintDocument
          docTitle={TITLES[b.billType]}
          code={b.code}
          status={b.status}
          partyLabel={isOut ? 'Payable to' : 'Bill to'}
          party={<PartyBlock name={party.name} lines={[party.address, party.phone, party.gstin && `GSTIN: ${party.gstin}`]} />}
          meta={[
            { label: 'Bill date', value: fmtDate(b.billDate) },
            { label: 'Due date', value: fmtDate(b.dueDate) },
            b.partyInvoiceNo && { label: 'Party invoice', value: b.partyInvoiceNo },
            b.project && { label: 'Project', value: b.project.code },
            b.purchaseOrder && { label: 'PO', value: b.purchaseOrder.code },
            b.measurement && { label: 'Measurement', value: b.measurement.code },
            b.workOrder && { label: 'Work order', value: b.workOrder.code },
          ]}
          columns={[
            { key: 'description', label: 'Description' },
            { key: 'unit', label: 'Unit' },
            { key: 'quantity', label: 'Qty', num: true },
            { key: 'rate', label: 'Rate', num: true, money: true },
            { key: 'amount', label: 'Amount', num: true, money: true },
          ]}
          items={b.items}
          totals={[
            { label: 'Subtotal', value: money(b.subtotal, true) },
            { label: `GST (${b.gstPercent}%)`, value: money(b.gstAmount, true) },
            b.retentionAmount > 0 && { label: `Retention (${b.retentionPercent}%)`, value: `− ${money(b.retentionAmount, true)}` },
            { label: 'Total', value: money(b.total, true), strong: true },
            { label: 'Paid', value: money(b.paidAmount, true) },
            { label: 'Balance due', value: money(b.balance, true) },
          ]}
          footer={b.notes && <p className="whitespace-pre-line">{b.notes}</p>}
        />
        {can('payments') && (
          <Card className="no-print h-fit">
            <CardHeader title="Payment history" subtitle={`${money(b.paidAmount)} of ${money(b.total)}`} icon={Wallet} />
            {pays?.items?.length ? (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {pays.items.map((p) => (
                  <li key={p._id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div><p className="font-medium">{p.code}</p><p className="text-xs text-slate-500">{fmtDate(p.date)} · {p.mode}{p.reference ? ` · ${p.reference}` : ''}</p></div>
                    <b className="tabular-nums">{money(p.amount)}</b>
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="No payments yet" className="py-8" />}
          </Card>
        )}
      </div>

      <Modal open={paying} onClose={() => setPaying(false)} title={isOut ? `Pay ${party.name}` : `Receive from ${party.name}`} description={`Balance ${money(b.balance, true)}`}
        footer={<><Button variant="secondary" onClick={() => setPaying(false)}>Cancel</Button><Button loading={action.isPending} onClick={submitPay}>Save</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount" required><Input type="number" value={pay.amount ?? ''} onChange={(e) => setPay({ ...pay, amount: Number(e.target.value) })} /></Field>
          <Field label="Date"><Input type="date" value={pay.date || ''} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></Field>
          <Field label="Mode"><Select value={pay.mode} options={PAYMENT_MODES} onChange={(e) => setPay({ ...pay, mode: e.target.value })} /></Field>
          <Field label="Reference / UTR"><Input value={pay.reference || ''} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
