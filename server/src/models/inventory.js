import mongoose from 'mongoose';
import { autoCode, opts, ref } from './plugins.js';
import { round2 } from '../utils/helpers.js';
import {
  MATERIAL_CATEGORIES, UNITS, STOCK_TXN_TYPES, MR_STATUS, RFQ_STATUS, PO_STATUS,
} from '../config/constants.js';

/* ---------------- Material Master ---------------- */
const materialSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: MATERIAL_CATEGORIES, default: 'Other' },
    unit: { type: String, enum: UNITS, default: 'Nos' },
    rate: { type: Number, default: 0 },
    minStock: { type: Number, default: 0 },
    brand: String,
    hsn: String,
    description: String,
  },
  opts,
);
autoCode(materialSchema, 'MAT');
export const Material = mongoose.model('Material', materialSchema);

/* ---------------- Stock Transaction ----------------
 * Location semantics: a `null` project means the central warehouse.
 *  Receipt      -> stock IN at `toProject`
 *  Return       -> stock IN at `toProject` (returned from site / client)
 *  Consumption  -> stock OUT at `fromProject`
 *  Wastage      -> stock OUT at `fromProject`
 *  Transfer     -> OUT at `fromProject`, IN at `toProject`
 */
const stockTxnSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    type: { type: String, enum: STOCK_TXN_TYPES, required: true },
    material: ref('Material', { required: true }),
    quantity: { type: Number, required: true, min: 0.0001 },
    rate: { type: Number, default: 0 },
    fromProject: ref('Project', { default: null }),
    toProject: ref('Project', { default: null }),
    purchaseOrder: ref('PurchaseOrder'),
    remarks: String,
    createdBy: ref('User'),
  },
  opts,
);
stockTxnSchema.virtual('value').get(function () {
  return round2(this.quantity * (this.rate || 0));
});
autoCode(stockTxnSchema, 'STK');
export const StockTxn = mongoose.model('StockTxn', stockTxnSchema);

/* ---------------- Material Request ---------------- */
const materialRequestSchema = new mongoose.Schema(
  {
    project: ref('Project', { required: true }),
    items: [{ material: ref('Material', { required: true }), quantity: { type: Number, required: true }, remarks: String }],
    requiredDate: Date,
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
    requestedBy: ref('User'),
    status: { type: String, enum: MR_STATUS, default: 'Pending' },
    notes: String,
  },
  opts,
);
autoCode(materialRequestSchema, 'MR');
export const MaterialRequest = mongoose.model('MaterialRequest', materialRequestSchema);

/* ---------------- Vendor ---------------- */
const vendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    contactPerson: String,
    phone: { type: String, required: true },
    email: String,
    gstin: String,
    address: String,
    category: String,
    paymentTerms: { type: String, default: '30 days' },
    rating: { type: Number, min: 0, max: 5, default: 4 },
  },
  opts,
);
autoCode(vendorSchema, 'VEN');
export const Vendor = mongoose.model('Vendor', vendorSchema);

/* ---------------- RFQ ---------------- */
const rfqSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    project: ref('Project'),
    materialRequest: ref('MaterialRequest'),
    items: [{ material: ref('Material'), quantity: Number, remarks: String }],
    vendors: [ref('Vendor')],
    responses: [{ vendor: ref('Vendor'), amount: Number, deliveryDays: Number, remarks: String }],
    dueDate: Date,
    selectedVendor: ref('Vendor'),
    status: { type: String, enum: RFQ_STATUS, default: 'Draft' },
  },
  opts,
);
autoCode(rfqSchema, 'RFQ');
export const Rfq = mongoose.model('Rfq', rfqSchema);

/* ---------------- Purchase Order ---------------- */
const poItemSchema = new mongoose.Schema({
  material: ref('Material', { required: true }),
  quantity: { type: Number, required: true },
  rate: { type: Number, default: 0 },
  amount: Number,
  receivedQty: { type: Number, default: 0 },
});

const purchaseOrderSchema = new mongoose.Schema(
  {
    vendor: ref('Vendor', { required: true }),
    project: ref('Project', { default: null }),
    materialRequest: ref('MaterialRequest'),
    rfq: ref('Rfq'),
    orderDate: { type: Date, default: Date.now },
    expectedDate: Date,
    items: [poItemSchema],
    subtotal: Number,
    gstPercent: { type: Number, default: 18 },
    gstAmount: Number,
    total: Number,
    status: { type: String, enum: PO_STATUS, default: 'Draft' },
    notes: String,
  },
  opts,
);
purchaseOrderSchema.pre('save', function () {
  let sub = 0;
  for (const it of this.items) {
    it.amount = round2(it.quantity * it.rate);
    sub += it.amount;
  }
  this.subtotal = round2(sub);
  this.gstAmount = round2((this.subtotal * Number(this.gstPercent || 0)) / 100);
  this.total = round2(this.subtotal + this.gstAmount);
});
autoCode(purchaseOrderSchema, 'PO');
export const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);
