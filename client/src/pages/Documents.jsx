import { FileText, FileImage, Download, Trash2, Pencil, Images } from 'lucide-react';
import ResourcePage from '../components/data/ResourcePage';
import { documents, REF } from '../config/resources';
import { Card, Badge, EmptyState, IconButton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { DOCUMENT_CATEGORIES } from '../lib/constants';
import { fmtDate, isImage } from '../lib/format';

const sizeOf = (b) => (!b ? '' : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

function Gallery({ rows, loading, edit, remove }) {
  const { can } = useAuth();
  const canEdit = can('documents', 'edit');
  if (loading) return <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-4 xl:grid-cols-6">{Array.from({ length: 12 }).map((_, i) => <div key={i} className="aspect-square animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}</div>;
  if (!rows.length) return <EmptyState icon={Images} title="No documents yet" description="Upload site photos, before/after shots, drawings, 3D designs, agreements and receipts." />;
  return (
    <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-4 xl:grid-cols-6">
      {rows.map((d) => (
        <Card key={d._id} className="group overflow-hidden">
          <a href={d.fileUrl} target="_blank" rel="noreferrer" className="relative block aspect-[4/3] bg-slate-100 dark:bg-slate-800">
            {isImage(d.fileUrl) ? <img src={d.fileUrl} alt={d.title} loading="lazy" className="size-full object-cover transition group-hover:scale-105" /> : (
              <div className="flex size-full flex-col items-center justify-center gap-1 text-slate-400">
                {d.mimeType?.includes('pdf') ? <FileText className="size-10" /> : <FileImage className="size-10" />}
                <span className="text-[11px] uppercase">{d.fileUrl.split('.').pop()}</span>
              </div>
            )}
            <span className="absolute top-2 left-2"><Badge tone="brand">{d.category}</Badge></span>
          </a>
          <div className="p-3">
            <p className="truncate text-sm font-medium" title={d.title}>{d.title}</p>
            <p className="truncate text-[11px] text-slate-500">{d.project?.code || 'General'} · {fmtDate(d.createdAt, 'dd MMM')} {sizeOf(d.size) && `· ${sizeOf(d.size)}`}</p>
            <div className="mt-2 flex justify-end gap-0.5 opacity-70 group-hover:opacity-100">
              <a href={d.fileUrl} download={d.fileName} className="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Download className="size-4" /></a>
              {canEdit && <IconButton icon={Pencil} label="Edit" onClick={() => edit(d)} />}
              {canEdit && <IconButton icon={Trash2} label="Delete" className="hover:!text-red-600" onClick={() => remove(d)} />}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function Documents({ projectId, embedded }) {
  const config = {
    ...documents,
    description: 'Site photos, before/after, drawings, floor plans, 3D designs, agreements, invoices and approvals.',
    createLabel: 'Upload document',
    pageSize: 60,
    filters: [
      ...(projectId ? [] : [{ name: 'project', label: 'Project', ref: REF.project }]),
      { name: 'category', label: 'Category', options: DOCUMENT_CATEGORIES },
    ],
    renderList: (p) => <Gallery {...p} />,
  };
  return <ResourcePage embedded={embedded} config={config} fixed={projectId ? { project: projectId } : {}} title={embedded ? 'Documents & photos' : undefined} />;
}
