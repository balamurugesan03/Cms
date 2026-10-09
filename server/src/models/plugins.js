import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });
export const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

export async function nextCode(prefix) {
  const c = await Counter.findByIdAndUpdate(prefix, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return `${prefix}-${String(c.seq).padStart(4, '0')}`;
}

/** Adds an auto-generated human friendly `code` (e.g. PRJ-0001) to a schema. */
export function autoCode(schema, prefix) {
  schema.add({ code: { type: String, index: true } });
  schema.pre('validate', async function () {
    if (!this.code) {
      const p = typeof prefix === 'function' ? prefix(this) : prefix;
      this.code = await nextCode(p);
    }
  });
}

export const opts = { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } };
export const { ObjectId } = mongoose.Schema.Types;
export const ref = (model, extra = {}) => ({ type: ObjectId, ref: model, ...extra });
