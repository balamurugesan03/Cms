import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES } from '../config/permissions.js';
import { opts, ref } from './plugins.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ROLES, default: 'Site Engineer' },
    phone: String,
    designation: String,
    active: { type: Boolean, default: true },
    // Links for external portal users
    client: ref('Client'),
    subcontractor: ref('Subcontractor'),
    worker: ref('Worker'),
    lastLogin: Date,
  },
  opts,
);

userSchema.pre('save', async function () {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.matchPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.password;
    return ret;
  },
});

export default mongoose.model('User', userSchema);
