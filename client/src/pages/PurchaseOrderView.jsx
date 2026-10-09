import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Printer, CheckCircle2, PackageCheck, Receipt, Ban } from 'lucide-react';
import { useApi, useAction } from '../lib/hooks';
import { useAuth } from '../context/AuthContext';
import { Button, PageHeader, PageLoader, Modal, Input, Field, Progress, useConfirm } from '../components/ui';
import PrintDocument, { PartyBlock } from '../components/data/PrintDocument';
import { fmtDate, money, number, today } from '../lib/format';

export default function PurchaseOrderView() {
  const { id } = useParams();
  const nav = useNavigate();
  const { can } = useAuth();
  const confirm = useConfirm();
  const action = useAction();
  const { data: po, isLoading } = useApi(`/purchase-orders/${id}`);
  const [receiving, setReceiving] = useState(false);
  const [grn, setGrn] = useState({});
  const [grnDate, setGrnDate] = useState(today());
  const [billing, setBilling] = useState(false);
  const [inv, setInv] = useState('');

  if (isLoading || !po) return <PageLoader />;
  const canEdit = can('purchaseOrders', 'edit');
  const pendingQty = (it) => it.quantity - it.receivedQty;

  const openGrn = () => {
    setGrn(Object.fromEntries(po.items.map((it) => [it._id, pendingQty(it)])));
    setReceiving(true);
  };
  const submitGrn = () => action.mutate(
    { url: `/purchase-orders/${id}/receive`, body: { date: grnDate, items: Object.entries(grn).map(([itemId, quantity]) => ({ itemId, quantity: Number(quantity) })).filter((x) => x.quantity > 0) }, success: 'Goods received into stock' },
    { onSuccess: () => setReceiving(false) },
  );
  const cancel = async () => {
    if (await confirm({ title: 'Cancel purchase order?', message: `${po.code} will be cancelled.`, confirmText: 'Cancel PO' })) {
      action.mutate({ url: `/purchase-orders/${id}`, method: 'put', body: { status: 'Cancelled' }, success: 'PO cancelled' });
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Purchase Orders', to: '/purchase/orders' }, { label: po.code }]}
        title={`Purchase Order ${po.code}`}
        description={`${po.vendor?.name} → ${po.project ? po.project.name : 'Main Warehouse'}`}
        actions={
          <>
            <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print / PDF</Button>
            {canEdit && po.status === 'Draft' && <Button variant="secondary" icon={Ban} onClick={cancel}>Cancel</Button>}
            {canEdit && po.status === 'Draft' && <Button icon={CheckCircle2} onClick={() => action.mutate({ url: `/purchase-orders/${id}/approve`, success: 'PO approved' })}>Approve PO</Button>}
            {canEdit && ['Approved', 'Partially Received'].includes(po.status) && <Button icon={PackageCheck} onClick={openGrn}>Receive goods (GRN)</Button>}
            {can('bills', 'edit') && !['Draft', 'Cancelled'].includes(po.status) && <Button variant="secondary" icon={Receipt} onClick={() => setBilling(true)}>Book purchase invoice</Button>}
          </>
        }
      />
      <PrintDocument
        docTitle="Purchase Order"
        code={po.code}
        status={po.status}
        partyLabel="Vendor"
        party={<PartyBlock name={po.vendor?.name} lines={[po.vendor?.address, po.vendor?.phone, po.vendor?.gstin && `GSTIN: ${po.vendor.gstin}`]} />}
        meta={[
          { label: 'Order date', value: fmtDate(po.orderDate) },
          { label: 'Expected', value: fmtDate(po.expectedDate) },
          { label: 'Deliver to', value: po.project ? `${po.project.code} · ${po.project.name}` : 'Main Warehouse' },
          po.materialRequest && { label: 'Against MR', value: po.materialRequest.code },
        ]}
        columns={[
          { key: 'material', label: 'Material', render: (it) => <><p className="font-medium">{it.material?.name}</p><p className="text-xs text-slate-500">{it.material?.code}</p></> },
          { key: 'quantity', label: 'Qty', num: true, render: (it) => `${number(it.quantity)} ${it.material?.unit}` },
          { key: 'received', label: 'Received', num: true, render: (it) => <span className={it.receivedQty >= it.quantity ? 'text-emerald-600' : ''}>{number(it.receivedQty)}</span> },
          { key: 'rate', label: 'Rate', num: true, money: true },
          { key: 'amount', label: 'Amount', num: true, money: true },
        ]}
        items={po.items}
        totals={[
          { label: 'Subtotal', value: money(po.subtotal, true) },
          { label: `GST (${po.gstPercent}%)`, value: money(po.gstAmount, true) },
          { label: 'Total', value: money(po.total, true), strong: true },
        ]}
        footer={po.notes && <p className="whitespace-pre-line">{po.notes}</p>}
      />

      <Modal open={receiving} onClose={() => setReceiving(false)} title="Goods Receipt Note" size="lg" description={`Stock will be added to ${po.project ? po.project.name : 'Main Warehouse'}`}
        footer={<><Button variant="secondary" onClick={() => setReceiving(false)}>Cancel</Button><Button icon={PackageCheck} loading={action.isPending} onClick={submitGrn}>Receive</Button></>}>
        <Field label="Receipt date" className="mb-4 max-w-48"><Input type="date" value={grnDate} onChange={(e) => setGrnDate(e.target.value)} /></Field>
        <div className="space-y-3">
          {po.items.map((it) => (
            <div key={it._id} className="flex items-center gap-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{it.material?.name}</p>
                <Progress value={(it.receivedQty / it.quantity) * 100} size="sm" className="mt-1.5 max-w-56" />
                <p className="mt-1 text-xs text-slate-500">Ordered {number(it.quantity)} · received {number(it.receivedQty)} · pending {number(pendingQty(it))} {it.material?.unit}</p>
              </div>
              <Input type="number" className="w-28" min={0} max={pendingQty(it)} disabled={pendingQty(it) <= 0} value={grn[it._id] ?? 0} onChange={(e) => setGrn({ ...grn, [it._id]: e.target.value })} />
            </div>
          ))}
        </div>
      </Modal>

      <Modal open={billing} onClose={() => setBilling(false)} title="Book purchase invoice" size="sm" description={`Creates a vendor bill for ${money(po.total)} linked to ${po.code}.`}
        footer={<><Button variant="secondary" onClick={() => setBilling(false)}>Cancel</Button><Button loading={action.isPending} onClick={() => action.mutate({ url: `/purchase-orders/${id}/bill`, body: { partyInvoiceNo: inv }, success: 'Purchase invoice created' }, { onSuccess: (b) => nav(`/finance/bills/${b._id}`) })}>Create</Button></>}>
        <Field label="Vendor's invoice number"><Input value={inv} onChange={(e) => setInv(e.target.value)} /></Field>
      </Modal>
    </div>
  );
}
