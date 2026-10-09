import { StockTxn, Material } from '../models/index.js';
import { ApiError, oid, round2 } from '../utils/helpers.js';

const IN_TYPES = ['Receipt', 'Return', 'Transfer'];
const OUT_TYPES = ['Consumption', 'Wastage', 'Transfer'];

/**
 * Current stock per material per location.
 * location key: project id string, or 'warehouse' for the central store.
 */
export async function stockLevels({ material, location } = {}) {
  const mMatch = material ? { material: oid(material) } : {};
  const [ins, outs] = await Promise.all([
    StockTxn.aggregate([
      { $match: { ...mMatch, type: { $in: IN_TYPES } } },
      { $group: { _id: { m: '$material', l: '$toProject' }, qty: { $sum: '$quantity' } } },
    ]),
    StockTxn.aggregate([
      { $match: { ...mMatch, type: { $in: OUT_TYPES } } },
      { $group: { _id: { m: '$material', l: '$fromProject' }, qty: { $sum: '$quantity' } } },
    ]),
  ]);
  const map = new Map();
  const key = (r) => `${r._id.m}|${r._id.l ? String(r._id.l) : 'warehouse'}`;
  for (const r of ins) map.set(key(r), (map.get(key(r)) || 0) + r.qty);
  for (const r of outs) map.set(key(r), (map.get(key(r)) || 0) - r.qty);

  const rows = [];
  for (const [k, qty] of map) {
    const [m, l] = k.split('|');
    if (location && location !== l) continue;
    rows.push({ material: m, location: l, quantity: round2(qty) });
  }
  return rows;
}

export async function availableAt(material, projectId) {
  const loc = projectId ? String(projectId) : 'warehouse';
  const rows = await stockLevels({ material, location: loc });
  return rows[0]?.quantity || 0;
}

/** Validates and records a stock movement. */
export async function recordStock(body, user) {
  const { type, material, quantity } = body;
  const qty = Number(quantity);
  if (!material || !(qty > 0)) throw new ApiError(400, 'Material and a positive quantity are required');
  const mat = await Material.findById(material);
  if (!mat) throw new ApiError(404, 'Material not found');

  const from = body.fromProject || null;
  const to = body.toProject || null;
  if (type === 'Transfer' && String(from) === String(to)) throw new ApiError(400, 'Source and destination must differ');

  if (OUT_TYPES.includes(type)) {
    const avail = await availableAt(material, from);
    if (qty > avail + 1e-6) {
      throw new ApiError(400, `Insufficient stock of ${mat.name}: available ${avail} ${mat.unit}`);
    }
  }

  return StockTxn.create({
    ...body,
    quantity: qty,
    fromProject: OUT_TYPES.includes(type) ? from : null,
    toProject: IN_TYPES.includes(type) ? to : null,
    rate: body.rate || mat.rate,
    createdBy: user?._id,
  });
}
