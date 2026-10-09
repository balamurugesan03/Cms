import express from 'express';
import { escapeRegex, isValidId, ApiError } from './helpers.js';

const STRIP = ['_id', 'id', '__v', 'createdAt', 'updatedAt', 'code'];

const castFilterValue = (v) => {
  if (v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (typeof v === 'string' && v.includes(',')) return { $in: v.split(',').map(castFilterValue) };
  return v;
};

export const clean = (body = {}, extra = []) => {
  const out = { ...body };
  for (const k of [...STRIP, ...extra]) delete out[k];
  return out;
};

const applyPopulate = (q, populate) => {
  for (const p of populate) q = q.populate(p);
  return q;
};

/**
 * Generic REST resource: list (search, filters, date range, pagination), read, create, update, delete.
 * Updates go through `doc.save()` so model pre-save hooks (totals, codes) always run.
 *
 * Hooks:
 *  scope(user)                  -> extra filter limiting what a user may see/edit
 *  queryFilter(query, user)     -> extra list filter built from custom query params
 *  sanitize(body, req, isNew)   -> transform incoming body
 *  beforeSave(doc, req, isNew)  -> validate / enrich before persisting
 *  afterSave(doc, req, isNew)   -> side effects (e.g. advance workflow status)
 *  beforeDelete(doc, req)       -> block or clean up deletes
 *  extend(router, helpers)      -> custom routes registered before the generic ones
 */
export function crud(Model, options = {}) {
  const {
    populate = [],
    search = [],
    filters = [],
    dateField,
    sort = '-createdAt',
    scope,
    queryFilter,
    sanitize,
    beforeSave,
    afterSave,
    beforeDelete,
    extend,
  } = options;
  const router = express.Router();

  const scopeFilter = async (req) => (scope ? await scope(req.user) : {});

  async function findScoped(req) {
    if (!isValidId(req.params.id)) throw new ApiError(400, 'Invalid id');
    const doc = await Model.findOne({ _id: req.params.id, ...(await scopeFilter(req)) });
    if (!doc) throw new ApiError(404, `${Model.modelName} not found`);
    return doc;
  }

  const fetchPopulated = (id) => applyPopulate(Model.findById(id), populate);

  if (extend) extend(router, { findScoped, fetchPopulated });

  router.get('/', async (req, res) => {
    const { q, page = 1, limit = 25, sort: sortParam, from, to } = req.query;
    const filter = {};
    for (const f of filters) {
      const v = req.query[f];
      if (v !== undefined && v !== '') filter[f] = castFilterValue(v);
    }
    if (q && search.length) {
      const rx = { $regex: escapeRegex(q), $options: 'i' };
      filter.$or = search.map((f) => ({ [f]: rx }));
    }
    if (dateField && (from || to)) {
      filter[dateField] = {};
      if (from) filter[dateField].$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setUTCHours(23, 59, 59, 999);
        filter[dateField].$lte = end;
      }
    }
    if (queryFilter) Object.assign(filter, await queryFilter(req.query, req.user));
    Object.assign(filter, await scopeFilter(req));

    const lim = Math.min(Number(limit) || 25, 1000);
    const pg = Math.max(Number(page) || 1, 1);
    const [items, total] = await Promise.all([
      applyPopulate(Model.find(filter), populate)
        .sort(sortParam || sort)
        .skip((pg - 1) * lim)
        .limit(lim),
      Model.countDocuments(filter),
    ]);
    res.json({ items, total, page: pg, pages: Math.ceil(total / lim) || 1, limit: lim });
  });

  router.get('/:id', async (req, res) => {
    const doc = await findScoped(req);
    res.json(await fetchPopulated(doc._id));
  });

  router.post('/', async (req, res) => {
    let body = clean(req.body);
    if (sanitize) body = (await sanitize(body, req, true)) || body;
    const doc = new Model(body);
    if (beforeSave) await beforeSave(doc, req, true);
    await doc.save();
    if (afterSave) await afterSave(doc, req, true);
    res.status(201).json(await fetchPopulated(doc._id));
  });

  router.put('/:id', async (req, res) => {
    const doc = await findScoped(req);
    let body = clean(req.body);
    if (sanitize) body = (await sanitize(body, req, false)) || body;
    doc.set(body);
    if (beforeSave) await beforeSave(doc, req, false);
    await doc.save();
    if (afterSave) await afterSave(doc, req, false);
    res.json(await fetchPopulated(doc._id));
  });

  router.delete('/:id', async (req, res) => {
    const doc = await findScoped(req);
    if (beforeDelete) await beforeDelete(doc, req);
    await doc.deleteOne();
    res.json({ message: 'Deleted', id: doc._id });
  });

  return router;
}
