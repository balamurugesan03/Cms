import { useState } from 'react';
import { Sofa, CheckCircle2, MessageSquareWarning, Send, Pencil, History, Ruler, Image as ImageIcon } from 'lucide-react';
import ResourcePage from '../components/data/ResourcePage';
import { rooms, REF } from '../config/resources';
import { Card, StatusBadge, Button, Modal, Field, Textarea, EmptyState, Badge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useAction } from '../lib/hooks';
import { DESIGN_STATUS, ROOM_TYPES } from '../lib/constants';
import { money, fmtDate, isImage } from '../lib/format';

function RoomCards({ rows, loading, edit, onRespond, onHistory }) {
  const { can, role } = useAuth();
  const action = useAction();
  const canDesign = can('rooms', 'edit');
  const canApprove = role === 'Client' || ['Project Manager', 'Admin', 'Super Admin'].includes(role);

  if (loading) return <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((i) => <div key={i} className="h-72 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}</div>;
  if (!rows.length) return <EmptyState icon={Sofa} title="No rooms yet" description="Add rooms / areas (Kitchen, Master Bedroom…) to manage designs, materials and approvals." />;

  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((r) => {
        const img = r.designImages?.find(isImage);
        const furnitureCost = (r.furniture || []).reduce((s, f) => s + (f.quantity || 0) * (f.cost || 0), 0);
        return (
          <Card key={r._id} className="flex flex-col overflow-hidden">
            <div className="relative flex h-40 items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
              {img ? <img src={img} alt={r.name} className="size-full object-cover" /> : <ImageIcon className="size-10 text-slate-300 dark:text-slate-600" />}
              <div className="absolute top-3 left-3"><StatusBadge value={r.designStatus} /></div>
              {r.designImages?.length > 1 && <span className="absolute right-3 bottom-3 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">+{r.designImages.length - 1} images</span>}
            </div>
            <div className="flex flex-1 flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{r.name}</h3>
                  <p className="text-xs text-slate-500">{r.roomType} · {r.project?.code} · {r.designer?.name || 'No designer'}</p>
                </div>
                {r.areaSqft && <Badge tone="slate"><Ruler className="size-3" />{r.areaSqft} sqft</Badge>}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2.5 text-center text-xs dark:bg-slate-800/50">
                <div><p className="font-semibold">{r.materials?.length || 0}</p><p className="text-slate-500">Materials</p></div>
                <div><p className="font-semibold">{r.furniture?.length || 0}</p><p className="text-slate-500">Furniture</p></div>
                <div><p className="font-semibold">{money(furnitureCost)}</p><p className="text-slate-500">Furniture cost</p></div>
              </div>
              {r.customWork && <p className="mt-3 line-clamp-2 text-xs text-slate-600 dark:text-slate-400"><b>Custom:</b> {r.customWork}</p>}
              {r.designStatus === 'Changes Requested' && r.revisions?.length > 0 && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">“{r.revisions[r.revisions.length - 1].notes}”</p>
              )}
              {r.approvedAt && r.designStatus === 'Approved' && <p className="mt-3 text-xs text-emerald-600">✓ Approved on {fmtDate(r.approvedAt)}</p>}
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                {canDesign && <Button size="sm" variant="secondary" icon={Pencil} onClick={() => edit(r)}>Edit</Button>}
                {canDesign && ['Concept', 'In Design', 'Changes Requested'].includes(r.designStatus) && (
                  <Button size="sm" variant="soft" icon={Send} onClick={() => action.mutate({ url: `/rooms/${r._id}/submit`, success: 'Sent for client approval' })}>Send for approval</Button>
                )}
                {canApprove && r.designStatus === 'Pending Approval' && (
                  <>
                    <Button size="sm" variant="success" icon={CheckCircle2} onClick={() => action.mutate({ url: `/rooms/${r._id}/respond`, body: { action: 'approve' }, success: 'Design approved' })}>Approve</Button>
                    <Button size="sm" variant="secondary" icon={MessageSquareWarning} onClick={() => onRespond(r)}>Request changes</Button>
                  </>
                )}
                {r.revisions?.length > 0 && <Button size="sm" variant="ghost" icon={History} onClick={() => onHistory(r)}>{r.revisions.length} revision(s)</Button>}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export default function Interior({ projectId, embedded }) {
  const action = useAction();
  const [responding, setResponding] = useState(null);
  const [history, setHistory] = useState(null);
  const [comments, setComments] = useState('');

  const config = {
    ...rooms,
    title: 'Interior Design',
    description: 'Room-wise design references, material & furniture selection, client approvals and revision tracking.',
    filters: [
      ...(projectId ? [] : [{ name: 'project', label: 'Project', ref: REF.project }]),
      { name: 'designStatus', label: 'Design status', options: DESIGN_STATUS },
      { name: 'roomType', label: 'Room type', options: ROOM_TYPES },
    ],
    pageSize: 60,
    renderList: (p) => <RoomCards {...p} onRespond={(r) => { setResponding(r); setComments(''); }} onHistory={setHistory} />,
  };

  return (
    <>
      <ResourcePage embedded={embedded} config={config} fixed={projectId ? { project: projectId } : {}} title={embedded ? 'Rooms & areas' : undefined} />
      <Modal open={!!responding} onClose={() => setResponding(null)} title={`Request changes · ${responding?.name}`}
        footer={<><Button variant="secondary" onClick={() => setResponding(null)}>Cancel</Button><Button disabled={!comments.trim()} onClick={() => { action.mutate({ url: `/rooms/${responding._id}/respond`, body: { action: 'changes', comments }, success: 'Changes requested — designer notified' }); setResponding(null); }}>Submit</Button></>}>
        <Field label="What should change?" required><Textarea rows={5} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="e.g. Change laminate to walnut, add a study table near the window…" /></Field>
      </Modal>
      <Modal open={!!history} onClose={() => setHistory(null)} title={`Revision history · ${history?.name}`}>
        <ol className="relative space-y-5 border-l border-slate-200 pl-5 dark:border-slate-700">
          {history?.revisions?.slice().reverse().map((rv) => (
            <li key={rv._id}>
              <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-white bg-brand-500 dark:border-slate-900" />
              <p className="text-sm font-semibold">Revision {rv.version} <span className="font-normal text-slate-500">· {rv.requestedBy} · {fmtDate(rv.date)}</span></p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{rv.notes}</p>
            </li>
          ))}
        </ol>
      </Modal>
    </>
  );
}
