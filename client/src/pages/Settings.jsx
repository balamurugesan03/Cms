import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Building2, KeyRound, UserCircle, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../lib/hooks';
import { put, errMsg } from '../lib/api';
import { Button, Card, CardHeader, Field, Input, PageHeader, Textarea, Avatar, Badge } from '../components/ui';
import { NAV } from '../config/nav';

function useForm(initial) {
  const [v, setV] = useState(initial);
  const bind = (k) => ({ value: v[k] ?? '', onChange: (e) => setV((s) => ({ ...s, [k]: e.target.value })) });
  return [v, setV, bind];
}

export default function Settings() {
  const { user, isAdmin, setUser, can } = useAuth();
  const { data: company, refetch } = useApi('/settings');
  const [profile, , bindP] = useForm({ name: user.name, phone: user.phone, designation: user.designation });
  const [pw, setPw, bindPw] = useForm({ currentPassword: '', newPassword: '', confirm: '' });
  const [co, setCo, bindC] = useForm({});
  const [busy, setBusy] = useState('');
  useEffect(() => company && setCo(company), [company, setCo]);

  const run = async (k, fn, msg) => {
    setBusy(k);
    try {
      await fn();
      toast.success(msg);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy('');
    }
  };

  const modules = NAV.flatMap((g) => g.items).filter((i) => i.module && can(i.module));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Settings" description="Your profile, password and company details used on quotations & invoices." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profile" icon={UserCircle} />
          <form className="space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); run('p', async () => setUser((await put('/auth/me', profile)).user), 'Profile updated'); }}>
            <div className="flex items-center gap-3">
              <Avatar name={user.name} className="size-12 text-base" />
              <div><p className="font-semibold">{user.email}</p><Badge tone="brand">{user.role}</Badge></div>
            </div>
            <Field label="Full name"><Input {...bindP('name')} required /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone"><Input {...bindP('phone')} /></Field>
              <Field label="Designation"><Input {...bindP('designation')} /></Field>
            </div>
            <div className="flex justify-end"><Button type="submit" loading={busy === 'p'}>Save profile</Button></div>
          </form>
        </Card>

        <Card>
          <CardHeader title="Change password" icon={KeyRound} />
          <form className="space-y-4 p-5" onSubmit={(e) => {
            e.preventDefault();
            if (pw.newPassword !== pw.confirm) return toast.error('Passwords do not match');
            run('pw', async () => { await put('/auth/password', pw); setPw({ currentPassword: '', newPassword: '', confirm: '' }); }, 'Password changed');
          }}>
            <Field label="Current password"><Input type="password" {...bindPw('currentPassword')} required /></Field>
            <Field label="New password" hint="Minimum 6 characters"><Input type="password" {...bindPw('newPassword')} required minLength={6} /></Field>
            <Field label="Confirm new password"><Input type="password" {...bindPw('confirm')} required /></Field>
            <div className="flex justify-end"><Button type="submit" loading={busy === 'pw'}>Update password</Button></div>
          </form>
        </Card>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader title="Company details" subtitle="Printed on quotations, purchase orders and invoices" icon={Building2} />
          <form className="grid gap-4 p-5 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run('c', async () => { await put('/settings', co); refetch(); }, 'Company details saved'); }}>
            <Field label="Company name"><Input {...bindC('companyName')} /></Field>
            <Field label="Tagline"><Input {...bindC('tagline')} /></Field>
            <Field label="Phone"><Input {...bindC('phone')} /></Field>
            <Field label="Email"><Input {...bindC('email')} /></Field>
            <Field label="GSTIN"><Input {...bindC('gstin')} /></Field>
            <Field label="Bank details"><Input {...bindC('bankDetails')} /></Field>
            <Field label="Address" className="sm:col-span-2"><Textarea {...bindC('address')} rows={2} /></Field>
            <div className="flex justify-end sm:col-span-2"><Button type="submit" loading={busy === 'c'}>Save company</Button></div>
          </form>
        </Card>
      )}

      <Card>
        <CardHeader title="Your access" subtitle={`Modules available to the ${user.role} role`} icon={Shield} />
        <div className="flex flex-wrap gap-2 p-5">
          {modules.map((m) => (
            <Badge key={m.to} tone={can(m.module, 'edit') ? 'green' : 'slate'}><m.icon className="size-3" />{m.label}{can(m.module, 'edit') ? ' · edit' : ' · view'}</Badge>
          ))}
        </div>
      </Card>
    </div>
  );
}
