import mongoose from 'mongoose';
import { autoCode, opts, ref } from './plugins.js';
import {
  PROJECT_TYPES, PROJECT_STATUS, TASK_STATUS, PRIORITIES, ROOM_TYPES, DESIGN_STATUS, DOCUMENT_CATEGORIES, UNITS,
} from '../config/constants.js';

/* ---------------- Project ---------------- */
const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    client: ref('Client', { required: true }),
    projectType: { type: String, enum: PROJECT_TYPES, default: 'Interior' },
    siteAddress: String,
    city: String,
    startDate: Date,
    endDate: Date,
    budget: { type: Number, default: 0 },
    contractValue: { type: Number, default: 0 },
    manager: ref('User'),
    team: [ref('User')],
    status: { type: String, enum: PROJECT_STATUS, default: 'Planning' },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    quotation: ref('Quotation'),
    description: String,
    completedAt: Date,
  },
  opts,
);
projectSchema.pre('save', function () {
  if (this.isModified('status') && this.status === 'Completed') {
    this.completedAt = this.completedAt || new Date();
    this.progress = 100;
  }
});
autoCode(projectSchema, 'PRJ');
export const Project = mongoose.model('Project', projectSchema);

/* ---------------- Task ---------------- */
const taskSchema = new mongoose.Schema(
  {
    project: ref('Project', { required: true }),
    title: { type: String, required: true },
    description: String,
    area: String,
    assignedTo: ref('User'),
    team: String,
    startDate: Date,
    dueDate: Date,
    priority: { type: String, enum: PRIORITIES, default: 'Medium' },
    status: { type: String, enum: TASK_STATUS, default: 'To Do' },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    dependsOn: [ref('Task')],
    completedAt: Date,
  },
  opts,
);
taskSchema.pre('save', function () {
  if (this.isModified('status') && this.status === 'Done') this.progress = 100;
  if (this.progress === 100) this.status = 'Done';
  else if (this.status === 'Done') this.status = 'In Progress';
  else if (this.progress > 0 && this.status === 'To Do') this.status = 'In Progress';
  this.completedAt = this.status === 'Done' ? this.completedAt || new Date() : undefined;
});

async function syncProjectProgress(projectId) {
  if (!projectId) return;
  const [agg] = await mongoose.model('Task').aggregate([
    { $match: { project: new mongoose.Types.ObjectId(String(projectId)) } },
    { $group: { _id: null, avg: { $avg: '$progress' } } },
  ]);
  const project = await Project.findById(projectId);
  if (project && project.status !== 'Completed') {
    project.progress = Math.round(agg?.avg || 0);
    await project.save();
  }
}
taskSchema.post('save', (doc) => syncProjectProgress(doc.project));
taskSchema.post('deleteOne', { document: true, query: false }, (doc) => syncProjectProgress(doc.project));
autoCode(taskSchema, 'TSK');
export const Task = mongoose.model('Task', taskSchema);

/* ---------------- Daily Site Report ---------------- */
const dailyReportSchema = new mongoose.Schema(
  {
    project: ref('Project', { required: true }),
    date: { type: Date, required: true, default: Date.now },
    weather: { type: String, default: 'Clear' },
    workDone: { type: String, required: true },
    workPending: String,
    labourCount: { type: Number, default: 0 },
    materialsUsed: String,
    instructions: String,
    issues: String,
    progress: { type: Number, min: 0, max: 100 },
    photos: [String],
    submittedBy: ref('User'),
    status: { type: String, enum: ['Submitted', 'Reviewed'], default: 'Submitted' },
  },
  opts,
);
autoCode(dailyReportSchema, 'DPR');
export const DailyReport = mongoose.model('DailyReport', dailyReportSchema);

/* ---------------- Interior Room / Area ---------------- */
const roomSchema = new mongoose.Schema(
  {
    project: ref('Project', { required: true }),
    name: { type: String, required: true },
    roomType: { type: String, enum: ROOM_TYPES, default: 'Living Room' },
    areaSqft: Number,
    designer: ref('User'),
    designImages: [String],
    materials: [
      { item: String, specification: String, brand: String, quantity: Number, unit: { type: String, enum: UNITS, default: 'Nos' } },
    ],
    furniture: [{ name: String, specification: String, quantity: { type: Number, default: 1 }, cost: { type: Number, default: 0 } }],
    customWork: String,
    designStatus: { type: String, enum: DESIGN_STATUS, default: 'Concept' },
    revisions: [
      {
        version: Number,
        notes: String,
        requestedBy: { type: String, enum: ['Client', 'Internal'], default: 'Client' },
        date: { type: Date, default: Date.now },
      },
    ],
    approvedAt: Date,
    clientComments: String,
  },
  opts,
);
roomSchema.virtual('furnitureCost').get(function () {
  return (this.furniture || []).reduce((s, f) => s + (f.quantity || 0) * (f.cost || 0), 0);
});
export const Room = mongoose.model('Room', roomSchema);

/* ---------------- Document / Photo ---------------- */
const documentSchema = new mongoose.Schema(
  {
    project: ref('Project'),
    room: ref('Room'),
    title: { type: String, required: true },
    category: { type: String, enum: DOCUMENT_CATEGORIES, default: 'Site Photo' },
    fileUrl: { type: String, required: true },
    fileName: String,
    mimeType: String,
    size: Number,
    uploadedBy: ref('User'),
    notes: String,
  },
  opts,
);
export const Document = mongoose.model('Document', documentSchema);
