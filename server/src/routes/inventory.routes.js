import express from 'express';
import { crud } from '../utils/crud.js';
import { guard } from '../middleware/auth.js';
import { stockLevels, recordStock } from '../services/stock.js';
import {
  Material, StockTxn, MaterialRequest, Vendor, Rfq, PurchaseOrder, Project, Bill,
} from '../models/index.js';
import { ApiError, round2 } from '../utils/helpers.js';

const router = express.Router();
const P = (path, select = 'name code') => ({ path, select });
const MAT = { path: 'items.material', select: 'name code unit rate category' };

/* ---------------- Material master ---------------- */
router.use(
  '/materials',
  guard('materials'),
  crud(Material, {
    search: ['name', 'code', 'brand', 'category'],
    filters: ['category', 'unit'],
    sort: 'name',
    beforeDelete: async (doc) => {
      if (await StockTxn.exists({ material: doc._id })) throw new ApiError(400, 'Material has stock movements and cannot be deleted');
    },
  }),
);

/* ---------------- Stock ---------------- */
// Stock summary: one row per material with warehouse / site breakdown & low-stock flag
router.get('/stock/summary', guard('stock'), async (req, res) => {
  const { category, location, q } = req.query;
  const mFilter = {};
  if (category) mFilter.category = category;
  if (q) mFilter.name = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const [materials, levels, projects] = await Promise.all([
    Material.find(mFilter).sort('name').lean(),
    stockLevels(),
    Project.find().select('name code').lean(),
  ]);
  const pName = new Map(projects.map((p) => [String(p._id), `${p.code} · ${p.name}`]));
  const byMat = new Map();
  for (const l of levels) {
    if (!byMat.has(l.material)) byMat.set(l.material, []);
    byMat.get(l.material).push({ ...l, locationName: l.location === 'warehouse' ? 'Main Warehouse' : pName.get(l.location) || 'Unknown site' });
  }
  const rows = materials
    .map((m) => {
      const locs = (byMat.get(String(m._id)) || []).filter((l) => l.quantity !== 0);
      const scoped = location ? locs.filter((l) => l.location === location) : locs;
      const warehouse = locs.find((l) => l.location === 'warehouse')?.quantity || 0;
      const total = round2(scoped.reduce((s, l) => s + l.quantity, 0));
      return {
        ...m,
        warehouse,
        total,
        value: round2(total * (m.rate || 0)),
        locations: scoped,
        low: m.minStock > 0 && round2(locs.reduce((s, l) => s + l.quantity, 0)) < m.minStock,
      };
    })
    .filter((r) => !location || r.locations.length);
  res.json({ items: rows, total: rows.length });
});

router.get('/stock/available', guard('stock'), async (req, res) => {
  const { material, location } = req.query;
  const rows = await stockLevels({ material, location: location || 'warehouse' });
  res.json({ quantity: rows[0]?.quantity || 0 });
});

router.use(
  '/stock/transactions',
  guard('stock'),
  crud(StockTxn, {
    populate: [P('material', 'name code unit'), P('fromProject'), P('toProject'), P('purchaseOrder', 'code'), P('createdBy', 'name')],
    search: ['code', 'remarks'],
    filters: ['type', 'material', 'fromProject', 'toProject', 'purchaseOrder'],
    dateField: 'date',
    sort: '-date',
    queryFilter: (q) => {
      if (!q.project) return {};
      const p = q.project === 'warehouse' ? null : q.project;
      return { $or: [{ fromProject: p }, { toProject: p }] };
    },
    extend: (r, { fetchPopulated }) => {
      r.post('/', async (req, res) => {
        const txn = await recordStock(req.body, req.user);
        res.status(201).json(await fetchPopulated(txn._id));
      });
      r.put('/:id', () => {
        throw new ApiError(400, 'Stock movements cannot be edited. Delete and record again.');
      });
    },
  }),
);

/* ---------------- Material Requests ---------------- */
router.use(
  '/material-requests',
  guard('materialRequests'),
  crud(MaterialRequest, {
    populate: [P('project'), MAT, P('requestedBy', 'name')],
    search: ['code', 'notes'],
    filters: ['project', 'status', 'priority'],
    dateField: 'requiredDate',
    sanitize: (body, req, isNew) => (isNew ? { ...body, requestedBy: req.user._id } : body),
    extend: (r, { findScoped }) => {
      r.post('/:id/status', async (req, res) => {
        const mr = await findScoped(req);
        const { status } = req.body;
        if (!['Approved', 'Rejected', 'Pending'].includes(status)) throw new ApiError(400, 'Invalid status');
        if (mr.status === 'Ordered') throw new ApiError(400, 'Request already converted to a purchase order');
        mr.status = status;
        await mr.save();
        res.json(mr);
      });

      // Material Request -> Purchase Order (draft)
      r.post('/:id/purchase-order', async (req, res) => {
        const mr = await findScoped(req).then((d) => d.populate('items.material'));
        if (!req.body.vendor) throw new ApiError(400, 'Select a vendor');
        if (mr.status === 'Ordered') throw new ApiError(400, 'Purchase order already raised for this request');
        if (mr.status === 'Rejected') throw new ApiError(400, 'Request was rejected');
        const po = await PurchaseOrder.create({
          vendor: req.body.vendor,
          project: mr.project,
          materialRequest: mr._id,
          expectedDate: mr.requiredDate,
          items: mr.items.map((it) => ({ material: it.material._id, quantity: it.quantity, rate: it.material.rate })),
        });
        mr.status = 'Ordered';
        await mr.save();
        res.status(201).json(po);
      });
    },
  }),
);

/* ---------------- Vendors ---------------- */
router.use(
  '/vendors',
  guard('vendors'),
  crud(Vendor, {
    search: ['name', 'code', 'phone', 'category', 'contactPerson', 'gstin'],
    filters: ['category'],
    sort: 'name',
    beforeDelete: async (doc) => {
      if (await PurchaseOrder.exists({ vendor: doc._id })) throw new ApiError(400, 'Vendor has purchase orders and cannot be deleted');
    },
  }),
);

/* ---------------- RFQ ---------------- */
router.use(
  '/rfqs',
  guard('rfqs'),
  crud(Rfq, {
    populate: [P('project'), P('materialRequest', 'code'), MAT, P('vendors'), P('responses.vendor'), P('selectedVendor')],
    search: ['title', 'code'],
    filters: ['project', 'status'],
    extend: (r, { findScoped }) => {
      // Award RFQ to a vendor -> Purchase order
      r.post('/:id/award', async (req, res) => {
        const rfq = await findScoped(req).then((d) => d.populate('items.material'));
        const { vendor } = req.body;
        if (!vendor) throw new ApiError(400, 'Select the winning vendor');
        if (rfq.status === 'Closed') throw new ApiError(400, 'RFQ already awarded');
        const response = rfq.responses.find((x) => String(x.vendor) === String(vendor));
        const baseTotal = rfq.items.reduce((s, it) => s + (it.quantity || 0) * (it.material?.rate || 0), 0);
        // Scale material rates to the vendor's quoted total (if provided)
        const factor = response?.amount && baseTotal ? response.amount / baseTotal : 1;
        const po = await PurchaseOrder.create({
          vendor,
          project: rfq.project || null,
          materialRequest: rfq.materialRequest,
          rfq: rfq._id,
          items: rfq.items
            .filter((it) => it.material)
            .map((it) => ({ material: it.material._id, quantity: it.quantity, rate: round2((it.material.rate || 0) * factor) })),
        });
        rfq.selectedVendor = vendor;
        rfq.status = 'Closed';
        await rfq.save();
        res.status(201).json(po);
      });
    },
  }),
);

/* ---------------- Purchase Orders ---------------- */
router.use(
  '/purchase-orders',
  guard('purchaseOrders'),
  crud(PurchaseOrder, {
    populate: [P('vendor', 'name code phone gstin address'), P('project'), P('materialRequest', 'code'), MAT],
    search: ['code', 'notes'],
    filters: ['vendor', 'project', 'status'],
    dateField: 'orderDate',
    beforeSave: async (doc, _req, isNew) => {
      if (!isNew && doc.isModified('items') && ['Partially Received', 'Received'].includes(doc.status)) {
        throw new ApiError(400, 'Items of a received purchase order cannot be changed');
      }
    },
    beforeDelete: async (doc) => {
      if (doc.items.some((i) => i.receivedQty > 0)) throw new ApiError(400, 'Goods already received. Cancel the PO instead.');
    },
    extend: (r, { findScoped, fetchPopulated }) => {
      r.post('/:id/approve', async (req, res) => {
        const po = await findScoped(req);
        if (po.status !== 'Draft') throw new ApiError(400, `PO is ${po.status}`);
        po.status = 'Approved';
        await po.save();
        res.json(await fetchPopulated(po._id));
      });

      // Goods receipt (GRN): body.items = [{ itemId, quantity }]; omit to receive everything pending
      r.post('/:id/receive', async (req, res) => {
        const po = await findScoped(req);
        if (!['Approved', 'Partially Received'].includes(po.status)) throw new ApiError(400, 'Approve the PO before receiving goods');
        const lines = req.body.items?.length
          ? req.body.items
          : po.items.map((it) => ({ itemId: it._id, quantity: it.quantity - it.receivedQty }));
        let received = 0;
        for (const line of lines) {
          const item = po.items.id(line.itemId);
          const qty = Number(line.quantity);
          if (!item || !(qty > 0)) continue;
          const pending = item.quantity - item.receivedQty;
          if (qty > pending + 1e-6) throw new ApiError(400, `Cannot receive more than pending quantity (${pending})`);
          await recordStock(
            { type: 'Receipt', material: item.material, quantity: qty, rate: item.rate, toProject: po.project, purchaseOrder: po._id, remarks: `GRN against ${po.code}`, date: req.body.date },
            req.user,
          );
          item.receivedQty = round2(item.receivedQty + qty);
          received++;
        }
        if (!received) throw new ApiError(400, 'Nothing to receive');
        po.status = po.items.every((i) => i.receivedQty >= i.quantity) ? 'Received' : 'Partially Received';
        await po.save();
        res.json(await fetchPopulated(po._id));
      });

      // Purchase invoice from PO
      r.post('/:id/bill', async (req, res) => {
        const po = await findScoped(req).then((d) => d.populate('items.material'));
        if (['Draft', 'Cancelled'].includes(po.status)) throw new ApiError(400, 'Approve the PO first');
        if (await Bill.exists({ purchaseOrder: po._id })) throw new ApiError(409, 'A purchase invoice already exists for this PO');
        const bill = await Bill.create({
          billType: 'Vendor',
          vendor: po.vendor,
          project: po.project,
          purchaseOrder: po._id,
          partyInvoiceNo: req.body.partyInvoiceNo,
          dueDate: req.body.dueDate || new Date(Date.now() + 30 * 864e5),
          gstPercent: po.gstPercent,
          items: po.items.map((it) => ({ description: it.material.name, unit: it.material.unit, quantity: it.quantity, rate: it.rate })),
        });
        res.status(201).json(bill);
      });
    },
  }),
);

export default router;
