import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ResourcePage from '../components/data/ResourcePage';
import RefSelect from '../components/data/RefSelect';
import { materialRequests, REF } from '../config/resources';
import { Button, Field, Modal } from '../components/ui';
import { useAction } from '../lib/hooks';
import { money } from '../lib/format';

/** Material requests with "Raise PO" (pick vendor → draft PO with standard rates) */
export default function MaterialRequests() {
  const nav = useNavigate();
  const action = useAction();
  const [mr, setMr] = useState(null);
  const [vendor, setVendor] = useState('');
  const est = mr?.items.reduce((s, i) => s + i.quantity * (i.material?.rate || 0), 0) || 0;

  return (
    <>
      <ResourcePage config={materialRequests} ctxExtra={{ openPo: (r) => { setMr(r); setVendor(''); } }} />
      <Modal open={!!mr} onClose={() => setMr(null)} title={`Raise PO for ${mr?.code}`} description={`${mr?.items.length} item(s) · estimated ${money(est)} before GST`}
        footer={<><Button variant="secondary" onClick={() => setMr(null)}>Cancel</Button><Button disabled={!vendor} loading={action.isPending}
          onClick={() => action.mutate({ url: `/material-requests/${mr._id}/purchase-order`, body: { vendor }, success: 'Draft purchase order created' }, { onSuccess: (po) => nav(`/purchase/orders/${po._id}`) })}>Create PO</Button></>}>
        <Field label="Vendor" required><RefSelect {...REF.vendor} labelOf={REF.vendor.label} value={vendor} onChange={setVendor} /></Field>
        <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-700">
          {mr?.items.map((i) => (
            <li key={i._id} className="flex justify-between px-3 py-2"><span>{i.material?.name}</span><span className="text-slate-500">{i.quantity} {i.material?.unit} × ₹{i.material?.rate}</span></li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
