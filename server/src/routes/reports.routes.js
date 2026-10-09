import express from 'express';
import { guard } from '../middleware/auth.js';
import { projectFinancials, finFor } from '../services/finance.js';
import {
  Project, Task, StockTxn, Attendance, PurchaseOrder, Bill, Payment, Vendor, Client, Subcontractor, WorkOrder,
  DailyReport, Boq,
} from '../models/index.js';
import { ApiError, oid, round2, startOfDay } from '../utils/helpers.js';

const router = express.Router();

const col = (key, label, type = 'text') => ({ key, label, type });
const pct = (a, b) => (b ? round2((a / b) * 100) : 0);

function dateRange(q, field) {
  if (!q.from && !q.to) return {};
  const r = {};
  if (q.from) r.$gte = new Date(q.from);
  if (q.to) {
    const e = new Date(q.to);
    e.setUTCHours(23, 59, 59, 999);
    r.$lte = e;
  }
  return { [field]: r };
}

const projectsFor = (q) => Project.find(q.project ? { _id: q.project } : q.status ? { status: q.status } : {})
  .populate('client', 'name').populate('manager', 'name').sort('code').lean();

const REPORTS = {
  'project-progress': {
    title: 'Project Progress Report',
    async run(q) {
      const projects = await projectsFor(q);
      const today = startOfDay();
      const tasks = await Task.aggregate([
        { $match: { project: { $in: projects.map((p) => p._id) } } },
        {
          $group: {
            _id: '$project',
            total: { $sum: 1 },
            done: { $sum: { $cond: [{ $eq: ['$status', 'Done'] }, 1, 0] } },
            overdue: { $sum: { $cond: [{ $and: [{ $ne: ['$status', 'Done'] }, { $lt: ['$dueDate', today] }] }, 1, 0] } },
          },
        },
      ]);
      const t = new Map(tasks.map((x) => [String(x._id), x]));
      return {
        columns: [col('code', 'Code'), col('name', 'Project'), col('client', 'Client'), col('status', 'Status', 'status'), col('startDate', 'Start', 'date'), col('endDate', 'End', 'date'), col('tasks', 'Tasks', 'number'), col('done', 'Done', 'number'), col('overdue', 'Overdue', 'number'), col('progress', 'Progress', 'progress')],
        rows: projects.map((p) => {
          const x = t.get(String(p._id)) || {};
          return { code: p.code, name: p.name, client: p.client?.name, status: p.status, startDate: p.startDate, endDate: p.endDate, tasks: x.total || 0, done: x.done || 0, overdue: x.overdue || 0, progress: p.progress };
        }),
      };
    },
  },

  'project-cost': {
    title: 'Project Cost Report',
    async run(q) {
      const projects = await projectsFor(q);
      const fin = await projectFinancials(projects.map((p) => p._id));
      return {
        columns: [col('code', 'Code'), col('name', 'Project'), col('material', 'Material', 'currency'), col('labour', 'Labour', 'currency'), col('subcontract', 'Subcontract', 'currency'), col('expenses', 'Other Expenses', 'currency'), col('totalCost', 'Total Cost', 'currency')],
        rows: projects.map((p) => ({ code: p.code, name: p.name, ...finFor(fin, p._id) })),
        totalKeys: ['material', 'labour', 'subcontract', 'expenses', 'totalCost'],
      };
    },
  },

  'budget-vs-actual': {
    title: 'Budget vs Actual (incl. BOQ estimate)',
    async run(q) {
      const projects = await projectsFor(q);
      const [fin, boqs] = await Promise.all([
        projectFinancials(projects.map((p) => p._id)),
        Boq.find({ project: { $in: projects.map((p) => p._id) } }).select('project costTotal').lean(),
      ]);
      const boqMap = new Map(boqs.map((b) => [String(b.project), b.costTotal]));
      return {
        columns: [col('code', 'Code'), col('name', 'Project'), col('boq', 'BOQ Estimate', 'currency'), col('budget', 'Budget', 'currency'), col('actual', 'Actual Cost', 'currency'), col('variance', 'Variance', 'currency'), col('utilization', 'Utilization %', 'percent'), col('progress', 'Progress', 'progress')],
        rows: projects.map((p) => {
          const actual = finFor(fin, p._id).totalCost;
          return { code: p.code, name: p.name, boq: boqMap.get(String(p._id)) || 0, budget: p.budget, actual, variance: round2(p.budget - actual), utilization: pct(actual, p.budget), progress: p.progress };
        }),
        totalKeys: ['boq', 'budget', 'actual', 'variance'],
      };
    },
  },

  'material-consumption': {
    title: 'Material Consumption Report',
    run: (q) => stockMovementReport(q, 'Consumption'),
  },

  'material-wastage': {
    title: 'Material Wastage Report',
    run: (q) => stockMovementReport(q, 'Wastage'),
  },

  'labour-cost': {
    title: 'Labour Cost & Productivity',
    async run(q) {
      const match = { ...dateRange(q, 'date'), ...(q.project ? { project: oid(q.project) } : {}) };
      const rows = await Attendance.aggregate([
        { $match: match },
        {
          $group: {
            _id: { worker: '$worker', project: '$project' },
            present: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
            half: { $sum: { $cond: [{ $eq: ['$status', 'Half Day'] }, 1, 0] } },
            absent: { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } },
            ot: { $sum: '$otHours' },
            wage: { $sum: '$wage' },
          },
        },
        { $lookup: { from: 'workers', localField: '_id.worker', foreignField: '_id', as: 'w' } },
        { $lookup: { from: 'projects', localField: '_id.project', foreignField: '_id', as: 'p' } },
        { $sort: { wage: -1 } },
      ]);
      return {
        columns: [col('worker', 'Worker'), col('trade', 'Trade'), col('skill', 'Skill'), col('project', 'Project'), col('present', 'Present', 'number'), col('half', 'Half Days', 'number'), col('absent', 'Absent', 'number'), col('ot', 'OT Hrs', 'number'), col('attendance', 'Attendance %', 'percent'), col('wage', 'Wages', 'currency')],
        rows: rows.map((r) => {
          const days = r.present + r.half + r.absent;
          return { worker: r.w[0]?.name, trade: r.w[0]?.trade, skill: r.w[0]?.skillType, project: r.p[0] ? `${r.p[0].code} · ${r.p[0].name}` : '', present: r.present, half: r.half, absent: r.absent, ot: r.ot, attendance: pct(r.present + r.half * 0.5, days), wage: round2(r.wage) };
        }),
        totalKeys: ['present', 'half', 'absent', 'ot', 'wage'],
      };
    },
  },

  purchase: {
    title: 'Purchase Report',
    async run(q) {
      const pos = await PurchaseOrder.find({ ...dateRange(q, 'orderDate'), ...(q.project ? { project: q.project } : {}), ...(q.vendor ? { vendor: q.vendor } : {}) })
        .populate('vendor', 'name').populate('project', 'name code').sort('-orderDate').lean();
      return {
        columns: [col('code', 'PO No'), col('orderDate', 'Date', 'date'), col('vendor', 'Vendor'), col('project', 'Deliver To'), col('subtotal', 'Subtotal', 'currency'), col('gstAmount', 'GST', 'currency'), col('total', 'Total', 'currency'), col('received', 'Received %', 'percent'), col('status', 'Status', 'status')],
        rows: pos.map((p) => {
          const qty = p.items.reduce((s, i) => s + i.quantity, 0);
          const rec = p.items.reduce((s, i) => s + i.receivedQty, 0);
          return { code: p.code, orderDate: p.orderDate, vendor: p.vendor?.name, project: p.project ? `${p.project.code} · ${p.project.name}` : 'Main Warehouse', subtotal: p.subtotal, gstAmount: p.gstAmount, total: p.total, received: pct(rec, qty), status: p.status };
        }),
        totalKeys: ['subtotal', 'gstAmount', 'total'],
      };
    },
  },

  'vendor-outstanding': {
    title: 'Vendor Outstanding',
    async run() {
      const [vendors, pos, bills] = await Promise.all([
        Vendor.find().sort('name').lean(),
        PurchaseOrder.aggregate([{ $match: { status: { $nin: ['Draft', 'Cancelled'] } } }, { $group: { _id: '$vendor', sum: { $sum: '$total' } } }]),
        Bill.aggregate([{ $match: { billType: 'Vendor', status: { $nin: ['Draft', 'Cancelled'] } } }, { $group: { _id: '$vendor', billed: { $sum: '$total' }, paid: { $sum: '$paidAmount' }, overdue: { $sum: { $cond: [{ $and: [{ $gt: ['$balance', 0] }, { $lt: ['$dueDate', new Date()] }] }, '$balance', 0] } } } }]),
      ]);
      const poM = new Map(pos.map((x) => [String(x._id), x.sum]));
      const bM = new Map(bills.map((x) => [String(x._id), x]));
      return {
        columns: [col('code', 'Code'), col('name', 'Vendor'), col('phone', 'Phone'), col('ordered', 'PO Value', 'currency'), col('billed', 'Invoiced', 'currency'), col('paid', 'Paid', 'currency'), col('balance', 'Outstanding', 'currency'), col('overdue', 'Overdue', 'currency')],
        rows: vendors.map((v) => {
          const b = bM.get(String(v._id)) || {};
          return { code: v.code, name: v.name, phone: v.phone, ordered: round2(poM.get(String(v._id)) || 0), billed: round2(b.billed || 0), paid: round2(b.paid || 0), balance: round2((b.billed || 0) - (b.paid || 0)), overdue: round2(b.overdue || 0) };
        }),
        totalKeys: ['ordered', 'billed', 'paid', 'balance', 'overdue'],
      };
    },
  },

  'client-outstanding': {
    title: 'Client Outstanding',
    async run() {
      const [clients, projects, bills, receipts] = await Promise.all([
        Client.find().sort('name').lean(),
        Project.aggregate([{ $match: { status: { $ne: 'Cancelled' } } }, { $group: { _id: '$client', value: { $sum: '$contractValue' }, count: { $sum: 1 } } }]),
        Bill.aggregate([{ $match: { billType: 'Client', status: { $nin: ['Draft', 'Cancelled'] } } }, { $group: { _id: '$client', billed: { $sum: '$total' }, overdue: { $sum: { $cond: [{ $and: [{ $gt: ['$balance', 0] }, { $lt: ['$dueDate', new Date()] }] }, '$balance', 0] } } } }]),
        Payment.aggregate([{ $match: { direction: 'In' } }, { $group: { _id: '$client', sum: { $sum: '$amount' } } }]),
      ]);
      const pM = new Map(projects.map((x) => [String(x._id), x]));
      const bM = new Map(bills.map((x) => [String(x._id), x]));
      const rM = new Map(receipts.map((x) => [String(x._id), x.sum]));
      return {
        columns: [col('code', 'Code'), col('name', 'Client'), col('projects', 'Projects', 'number'), col('contract', 'Contract Value', 'currency'), col('billed', 'Billed', 'currency'), col('received', 'Received', 'currency'), col('outstanding', 'Billed Outstanding', 'currency'), col('overdue', 'Overdue', 'currency'), col('unbilled', 'Yet to Bill', 'currency')],
        rows: clients
          .map((c) => {
            const id = String(c._id);
            const p = pM.get(id) || {};
            const b = bM.get(id) || {};
            const rec = rM.get(id) || 0;
            return { code: c.code, name: c.name, projects: p.count || 0, contract: round2(p.value || 0), billed: round2(b.billed || 0), received: round2(rec), outstanding: round2((b.billed || 0) - rec), overdue: round2(b.overdue || 0), unbilled: round2((p.value || 0) - (b.billed || 0)) };
          })
          .filter((r) => r.projects || r.billed || r.received),
        totalKeys: ['contract', 'billed', 'received', 'outstanding', 'overdue', 'unbilled'],
      };
    },
  },

  'profit-loss': {
    title: 'Project Profit / Loss',
    async run(q) {
      const projects = await projectsFor(q);
      const fin = await projectFinancials(projects.map((p) => p._id));
      return {
        columns: [col('code', 'Code'), col('name', 'Project'), col('status', 'Status', 'status'), col('contractValue', 'Contract Value', 'currency'), col('billed', 'Billed', 'currency'), col('received', 'Received', 'currency'), col('totalCost', 'Total Cost', 'currency'), col('profit', 'Profit / Loss', 'currency'), col('margin', 'Margin %', 'percent'), col('projected', 'Projected Profit', 'currency')],
        rows: projects.map((p) => {
          const f = finFor(fin, p._id);
          const profit = round2(f.billed - f.totalCost);
          return { code: p.code, name: p.name, status: p.status, contractValue: p.contractValue, billed: f.billed, received: f.received, totalCost: f.totalCost, profit, margin: pct(profit, f.billed), projected: round2(p.contractValue - Math.max(p.budget, f.totalCost)) };
        }),
        totalKeys: ['contractValue', 'billed', 'received', 'totalCost', 'profit', 'projected'],
      };
    },
  },

  contractor: {
    title: 'Contractor Report',
    async run() {
      const [subs, wos, bills] = await Promise.all([
        Subcontractor.find().sort('name').lean(),
        WorkOrder.aggregate([{ $match: { status: { $ne: 'Terminated' } } }, { $group: { _id: '$subcontractor', count: { $sum: 1 }, value: { $sum: '$contractAmount' }, progress: { $avg: '$progress' } } }]),
        Bill.aggregate([{ $match: { billType: 'Contractor', status: { $nin: ['Draft', 'Cancelled'] } } }, { $group: { _id: '$subcontractor', billed: { $sum: '$total' }, paid: { $sum: '$paidAmount' } } }]),
      ]);
      const wM = new Map(wos.map((x) => [String(x._id), x]));
      const bM = new Map(bills.map((x) => [String(x._id), x]));
      return {
        columns: [col('code', 'Code'), col('name', 'Contractor'), col('trade', 'Trade'), col('workOrders', 'Work Orders', 'number'), col('contract', 'Contract Value', 'currency'), col('progress', 'Avg Progress', 'progress'), col('billed', 'Billed', 'currency'), col('paid', 'Paid', 'currency'), col('outstanding', 'Outstanding', 'currency')],
        rows: subs.map((s) => {
          const w = wM.get(String(s._id)) || {};
          const b = bM.get(String(s._id)) || {};
          return { code: s.code, name: s.name, trade: s.trade, workOrders: w.count || 0, contract: round2(w.value || 0), progress: Math.round(w.progress || 0), billed: round2(b.billed || 0), paid: round2(b.paid || 0), outstanding: round2((b.billed || 0) - (b.paid || 0)) };
        }),
        totalKeys: ['contract', 'billed', 'paid', 'outstanding'],
      };
    },
  },

  'site-performance': {
    title: 'Site Performance',
    async run(q) {
      const projects = (await projectsFor(q)).filter((p) => p.status !== 'Cancelled');
      const ids = projects.map((p) => p._id);
      const [reports, labour, fin] = await Promise.all([
        DailyReport.aggregate([{ $match: { project: { $in: ids } } }, { $group: { _id: '$project', count: { $sum: 1 }, issues: { $sum: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$issues', ''] } }, 0] }, 1, 0] } } } }]),
        Attendance.aggregate([{ $match: { project: { $in: ids }, status: { $ne: 'Absent' } } }, { $group: { _id: '$project', days: { $sum: { $cond: [{ $eq: ['$status', 'Half Day'] }, 0.5, 1] } } } }]),
        projectFinancials(ids),
      ]);
      const rM = new Map(reports.map((x) => [String(x._id), x]));
      const lM = new Map(labour.map((x) => [String(x._id), x.days]));
      const now = Date.now();
      return {
        columns: [col('code', 'Code'), col('name', 'Site'), col('manager', 'Manager'), col('planned', 'Planned %', 'progress'), col('progress', 'Actual %', 'progress'), col('variance', 'Schedule Var.', 'percent'), col('reports', 'Daily Reports', 'number'), col('issues', 'Issues', 'number'), col('labourDays', 'Labour Days', 'number'), col('costPerProgress', 'Cost / 1% Progress', 'currency')],
        rows: projects.map((p) => {
          const s = p.startDate ? new Date(p.startDate).getTime() : now;
          const e = p.endDate ? new Date(p.endDate).getTime() : now;
          const planned = e > s ? Math.min(100, Math.max(0, Math.round(((now - s) / (e - s)) * 100))) : 100;
          const r = rM.get(String(p._id)) || {};
          const cost = finFor(fin, p._id).totalCost;
          return { code: p.code, name: p.name, manager: p.manager?.name, planned, progress: p.progress, variance: p.progress - planned, reports: r.count || 0, issues: r.issues || 0, labourDays: lM.get(String(p._id)) || 0, costPerProgress: p.progress ? round2(cost / p.progress) : 0 };
        }),
      };
    },
  },

  payments: {
    title: 'Payment Report',
    async run(q) {
      const filter = { ...dateRange(q, 'date'), ...(q.project ? { project: q.project } : {}), ...(q.direction ? { direction: q.direction } : {}) };
      const pays = await Payment.find(filter)
        .populate('project', 'name code').populate('client', 'name').populate('vendor', 'name').populate('subcontractor', 'name').populate('worker', 'name').populate('bill', 'code')
        .sort('-date').lean();
      return {
        columns: [col('code', 'Voucher'), col('date', 'Date', 'date'), col('category', 'Category'), col('party', 'Party'), col('project', 'Project'), col('bill', 'Against Bill'), col('mode', 'Mode'), col('inflow', 'Received', 'currency'), col('outflow', 'Paid', 'currency')],
        rows: pays.map((p) => ({
          code: p.code, date: p.date, category: p.category,
          party: p.client?.name || p.vendor?.name || p.subcontractor?.name || p.worker?.name || '—',
          project: p.project ? `${p.project.code} · ${p.project.name}` : '—', bill: p.bill?.code || '—', mode: p.mode,
          inflow: p.direction === 'In' ? p.amount : 0, outflow: p.direction === 'Out' ? p.amount : 0,
        })),
        totalKeys: ['inflow', 'outflow'],
      };
    },
  },
};

async function stockMovementReport(q, type) {
  const match = { type, ...dateRange(q, 'date'), ...(q.project ? { fromProject: q.project === 'warehouse' ? null : oid(q.project) } : {}) };
  const rows = await StockTxn.aggregate([
    { $match: match },
    { $group: { _id: { m: '$material', p: '$fromProject' }, qty: { $sum: '$quantity' }, value: { $sum: { $multiply: ['$quantity', '$rate'] } }, count: { $sum: 1 } } },
    { $lookup: { from: 'materials', localField: '_id.m', foreignField: '_id', as: 'm' } },
    { $lookup: { from: 'projects', localField: '_id.p', foreignField: '_id', as: 'p' } },
    { $sort: { value: -1 } },
  ]);
  return {
    columns: [col('material', 'Material'), col('category', 'Category'), col('location', 'Site'), col('entries', 'Entries', 'number'), col('quantity', 'Quantity', 'number'), col('unit', 'Unit'), col('value', 'Value', 'currency')],
    rows: rows.map((r) => ({
      material: r.m[0]?.name, category: r.m[0]?.category, unit: r.m[0]?.unit,
      location: r.p[0] ? `${r.p[0].code} · ${r.p[0].name}` : 'Main Warehouse',
      entries: r.count, quantity: round2(r.qty), value: round2(r.value),
    })),
    totalKeys: ['value'],
  };
}

router.get('/reports', guard('reports'), (_req, res) => {
  res.json(Object.entries(REPORTS).map(([key, r]) => ({ key, title: r.title })));
});

router.get('/reports/:key', guard('reports'), async (req, res) => {
  const report = REPORTS[req.params.key];
  if (!report) throw new ApiError(404, 'Unknown report');
  const data = await report.run(req.query);
  const totals = {};
  for (const k of data.totalKeys || []) totals[k] = round2(data.rows.reduce((s, r) => s + (Number(r[k]) || 0), 0));
  res.json({ key: req.params.key, title: report.title, columns: data.columns, rows: data.rows, totals, generatedAt: new Date() });
});

export default router;
