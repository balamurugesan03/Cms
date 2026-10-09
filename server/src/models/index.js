import mongoose from 'mongoose';
import { opts } from './plugins.js';

export { default as User } from './User.js';
export * from './sales.js';
export * from './project.js';
export * from './inventory.js';
export * from './workforce.js';
export * from './finance.js';

/* Single-document company settings (letterhead for quotations / invoices) */
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'company', unique: true },
    companyName: { type: String, default: 'BuildPro Constructions & Interiors' },
    tagline: { type: String, default: 'Design · Build · Deliver' },
    address: { type: String, default: '12, Anna Salai, Chennai, Tamil Nadu 600002' },
    phone: { type: String, default: '+91 98765 43210' },
    email: { type: String, default: 'hello@buildpro.in' },
    gstin: { type: String, default: '33ABCDE1234F1Z5' },
    bankDetails: { type: String, default: 'HDFC Bank · A/c 50200012345678 · IFSC HDFC0001234' },
    currency: { type: String, default: 'INR' },
  },
  opts,
);
export const Setting = mongoose.model('Setting', settingSchema);
