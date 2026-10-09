import { useState } from 'react';
import { ArrowRight, Building2, CheckCircle2, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, Field } from '../components/ui';
import { errMsg } from '../lib/api';
import { cn } from '../lib/format';

const DEMO = [
  ['Super Admin', 'superadmin@buildpro.in'], ['Project Manager', 'pm@buildpro.in'], ['Site Engineer', 'engineer@buildpro.in'],
  ['Estimator', 'estimator@buildpro.in'], ['Purchase Manager', 'purchase@buildpro.in'], ['Accountant', 'accounts@buildpro.in'],
  ['Designer', 'designer@buildpro.in'], ['Store Manager', 'store@buildpro.in'], ['Site Supervisor', 'supervisor@buildpro.in'],
  ['Contractor', 'contractor@buildpro.in'], ['Worker', 'worker@buildpro.in'], ['Client', 'client@buildpro.in'],
];

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('superadmin@buildpro.in');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-slate-900 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(234,88,12,.35),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(59,130,246,.18),transparent_45%)]" />
        <div className="absolute inset-0 opacity-[.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:40px_40px]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand-600"><Building2 className="size-5" /></div>
            <span className="text-xl font-bold">BuildPro</span>
          </div>
          <div>
            <h1 className="max-w-lg text-4xl leading-tight font-bold tracking-tight">Run every site, every rupee and every room — from one place.</h1>
            <p className="mt-4 max-w-md text-slate-300">Construction & interior project management: leads to handover, BOQ to billing, stock to profit.</p>
            <ul className="mt-8 space-y-3 text-sm text-slate-300">
              {['Lead → Quotation → Project in a few clicks', 'Daily site reports, attendance & material tracking', 'Measurement-based client & contractor billing', 'Live profit / loss for every project'].map((t) => (
                <li key={t} className="flex items-center gap-2.5"><CheckCircle2 className="size-4 text-brand-400" />{t}</li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} BuildPro ERP</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><div className="flex size-11 items-center justify-center rounded-xl bg-brand-600 text-white"><Building2 className="size-5" /></div></div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-500">Sign in to your workspace</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="Email">
              <div className="relative">
                <Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                <input className="input h-11 pl-10" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
              </div>
            </Field>
            <Field label="Password">
              <div className="relative">
                <Lock className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                <input className="input h-11 pl-10" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
              </div>
            </Field>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
            <Button type="submit" size="lg" loading={loading} className="w-full">Sign in <ArrowRight className="size-4" /></Button>
          </form>

          <div className="mt-8">
            <p className="mb-2 text-xs font-medium text-slate-500">Demo accounts · password <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">password123</code></p>
            <div className="flex flex-wrap gap-1.5">
              {DEMO.map(([role, mail]) => (
                <button key={mail} type="button" onClick={() => { setEmail(mail); setPassword('password123'); }}
                  className={cn('rounded-md border px-2 py-1 text-xs transition', email === mail ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400')}>
                  {role}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
