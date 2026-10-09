import express from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { crud } from '../utils/crud.js';
import { protect, signToken, guard, allowRoles } from '../middleware/auth.js';
import { User, Setting } from '../models/index.js';
import { ApiError } from '../utils/helpers.js';
import { PERMISSIONS, ROLES } from '../config/permissions.js';

const router = express.Router();

/* ---------------- Auth ---------------- */
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw new ApiError(400, 'Email and password are required');
  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+password');
  if (!user || !(await user.matchPassword(password))) throw new ApiError(401, 'Invalid email or password');
  if (!user.active) throw new ApiError(403, 'Your account is disabled. Contact the administrator.');
  user.lastLogin = new Date();
  await user.save();
  res.json({ token: signToken(user), user: user.toJSON() });
});

router.use(protect);

router.get('/auth/me', (req, res) => res.json({ user: req.user, permissions: PERMISSIONS, roles: ROLES }));

router.put('/auth/me', async (req, res) => {
  const { name, phone, designation } = req.body;
  req.user.set({ name, phone, designation });
  await req.user.save();
  res.json({ user: req.user });
});

router.put('/auth/password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.matchPassword(currentPassword || ''))) throw new ApiError(400, 'Current password is incorrect');
  if (!newPassword || newPassword.length < 6) throw new ApiError(400, 'New password must be at least 6 characters');
  user.password = newPassword;
  await user.save();
  res.json({ message: 'Password updated' });
});

/* ---------------- Users ---------------- */
// Lightweight staff lookup for assignment dropdowns (any logged-in user)
router.get('/users/lookup', async (req, res) => {
  const filter = { active: true, role: { $nin: ['Client', 'Contractor', 'Worker'] } };
  if (req.query.role) filter.role = { $in: String(req.query.role).split(',') };
  res.json({ items: await User.find(filter).select('name role email').sort('name').lean() });
});

router.use(
  '/users',
  guard('users'),
  crud(User, {
    populate: [{ path: 'client', select: 'name code' }, { path: 'subcontractor', select: 'name code' }, { path: 'worker', select: 'name code' }],
    search: ['name', 'email', 'phone', 'role'],
    filters: ['role', 'active'],
    sort: 'name',
    sanitize: (body, req) => {
      if (!body.password) delete body.password;
      if (body.role === 'Super Admin' && req.user.role !== 'Super Admin') throw new ApiError(403, 'Only a Super Admin can assign that role');
      for (const k of ['client', 'subcontractor', 'worker']) if (body[k] === '') body[k] = null;
      return body;
    },
    beforeDelete: async (doc, req) => {
      if (String(doc._id) === String(req.user._id)) throw new ApiError(400, 'You cannot delete your own account');
      if (doc.role === 'Super Admin' && req.user.role !== 'Super Admin') throw new ApiError(403, 'Cannot delete a Super Admin');
    },
  }),
);

/* ---------------- Company settings ---------------- */
router.get('/settings', async (_req, res) => {
  res.json((await Setting.findOne({ key: 'company' })) || (await Setting.create({ key: 'company' })));
});
router.put('/settings', allowRoles(), async (req, res) => {
  const { _id, key, ...rest } = req.body;
  res.json(await Setting.findOneAndUpdate({ key: 'company' }, rest, { new: true, upsert: true }));
});

/* ---------------- File uploads ---------------- */
const storage = multer.diskStorage({
  destination: 'uploads',
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
});
const ALLOWED = /^(image\/|video\/|application\/pdf|application\/(msword|vnd\.)|text\/plain|application\/zip|application\/octet-stream)/;
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(ALLOWED.test(file.mimetype) ? null : new ApiError(400, `File type not allowed: ${file.mimetype}`), ALLOWED.test(file.mimetype)),
});

router.post('/uploads', upload.array('files', 10), (req, res) => {
  res.status(201).json({
    files: (req.files || []).map((f) => ({ url: `${process.env.BASE_PATH || ''}/uploads/${f.filename}`, name: f.originalname, mimeType: f.mimetype, size: f.size })),
  });
});

export default router;
