import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { hasPermission } from '../config/permissions.js';

export const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '7d' });

export async function protect(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Not authenticated' });
  try {
    const { id } = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(id);
    if (!user || !user.active) return res.status(401).json({ message: 'Account disabled or not found' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Session expired, please login again' });
  }
}

/** Checks module permission: GET requests need `view`, everything else needs `edit`. */
export const guard = (module, forceAction) => (req, res, next) => {
  const action = forceAction || (req.method === 'GET' ? 'view' : 'edit');
  if (hasPermission(req.user.role, module, action)) return next();
  return res.status(403).json({ message: `Your role (${req.user.role}) cannot ${action} ${module}` });
};

/** Allow only listed roles (admins always allowed). */
export const allowRoles = (...roles) => (req, res, next) => {
  const r = req.user.role;
  if (r === 'Super Admin' || r === 'Admin' || roles.includes(r)) return next();
  return res.status(403).json({ message: 'Access denied' });
};
