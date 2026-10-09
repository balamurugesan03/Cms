import { PurchaseOrder, Attendance, Bill, Expense, Payment, StockTxn } from '../models/index.js';
import { oid, round2 } from '../utils/helpers.js';

const ACTIVE_BILL = { $nin: ['Draft', 'Cancelled'] };

const groupSum = (Model, match, valueExpr, key = '$project') =>
  Model.aggregate([{ $match: match }, { $group: { _id: key, sum: { $sum: valueExpr } } }]);

export const emptyFin = () => ({
  material: 0, labour: 0, subcontract: 0, expenses: 0, totalCost: 0, billed: 0, received: 0, outstanding: 0,
});

/**
 * Cost & revenue roll-up per project.
 *  material    = purchase orders delivered to the site + warehouse transfers to the site
 *  labour      = attendance wages
 *  subcontract = contractor bills
 *  expenses    = direct site expenses
 *  billed      = client invoices, received = client receipts
 */
export async function projectFinancials(projectIds = null) {
  const pm = projectIds ? { project: { $in: projectIds.map(oid) } } : { project: { $ne: null } };
  const tm = projectIds ? { toProject: { $in: projectIds.map(oid) } } : { toProject: { $ne: null } };

  const [po, transfers, labour, sub, exp, billed, received] = await Promise.all([
    groupSum(PurchaseOrder, { ...pm, status: { $nin: ['Draft', 'Cancelled'] } }, '$total'),
    groupSum(StockTxn, { ...tm, type: 'Transfer', fromProject: null }, { $multiply: ['$quantity', '$rate'] }, '$toProject'),
    groupSum(Attendance, pm, '$wage'),
    groupSum(Bill, { ...pm, billType: 'Contractor', status: ACTIVE_BILL }, '$total'),
    groupSum(Expense, pm, '$amount'),
    groupSum(Bill, { ...pm, billType: 'Client', status: ACTIVE_BILL }, '$total'),
    groupSum(Payment, { ...pm, direction: 'In' }, '$amount'),
  ]);

  const map = new Map();
  const add = (rows, field) => {
    for (const r of rows) {
      if (!r._id) continue;
      const k = String(r._id);
      if (!map.has(k)) map.set(k, emptyFin());
      map.get(k)[field] += r.sum;
    }
  };
  add(po, 'material');
  add(transfers, 'material');
  add(labour, 'labour');
  add(sub, 'subcontract');
  add(exp, 'expenses');
  add(billed, 'billed');
  add(received, 'received');

  for (const f of map.values()) {
    for (const k of Object.keys(f)) f[k] = round2(f[k]);
    f.totalCost = round2(f.material + f.labour + f.subcontract + f.expenses);
    f.outstanding = round2(f.billed - f.received);
  }
  return map;
}

export const finFor = (map, id) => map.get(String(id)) || emptyFin();

export function totalsOf(map) {
  const t = emptyFin();
  for (const f of map.values()) for (const k of Object.keys(t)) t[k] += f[k];
  for (const k of Object.keys(t)) t[k] = round2(t[k]);
  return t;
}
