/* Erase all business data (leads, projects, stock, bills, …) but keep Super Admin logins.
   Run: npm run reset   (production: NODE_ENV=production node src/reset.js --force) */
import 'dotenv/config';
import mongoose from 'mongoose';
import { User, Setting } from './models/index.js';

async function run() {
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
    console.error('✖ Reset erases all data. Refusing in production (pass --force to override).');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  for (const { name } of await db.listCollections().toArray()) {
    if (name === 'users' || name.startsWith('system.')) continue;
    const { deletedCount } = await db.collection(name).deleteMany({});
    console.log(`  ${name}: ${deletedCount} removed`);
  }

  const { deletedCount } = await User.deleteMany({ role: { $ne: 'Super Admin' } });
  console.log(`  users: ${deletedCount} removed`);
  await User.updateMany({}, { $unset: { client: 1, subcontractor: 1, worker: 1 } });
  await Setting.create({ key: 'company' });

  const admins = await User.find({}, 'email');
  console.log(`✔ Data erased. Remaining login(s): ${admins.map((u) => u.email).join(', ') || 'none'}`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
