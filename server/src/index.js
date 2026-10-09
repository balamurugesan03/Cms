import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';

import coreRoutes from './routes/core.routes.js';
import salesRoutes from './routes/sales.routes.js';
import projectRoutes from './routes/projects.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import workforceRoutes from './routes/workforce.routes.js';
import financeRoutes from './routes/finance.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import reportRoutes from './routes/reports.routes.js';
import notificationRoutes from './routes/notifications.routes.js';
import { notFound, errorHandler } from './middleware/error.js';

const app = express();
fs.mkdirSync('uploads', { recursive: true });

app.use(cors({ origin: process.env.CLIENT_URL?.split(',') || true, credentials: true }));
app.use(express.json({ limit: '5mb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
app.use('/uploads', express.static(path.resolve('uploads'), { maxAge: '7d' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 }));

// coreRoutes registers /auth/login (public) and then applies `protect` to everything after it
app.use('/api', coreRoutes, salesRoutes, projectRoutes, inventoryRoutes, workforceRoutes, financeRoutes, dashboardRoutes, reportRoutes, notificationRoutes);

// Serve the built React app in production
const clientDist = path.resolve('../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api|\/uploads).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✔ MongoDB connected');
    app.listen(PORT, () => console.log(`✔ API running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('✖ MongoDB connection failed:', err.message);
    process.exit(1);
  });
