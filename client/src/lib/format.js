import { format, formatDistanceToNowStrict, isValid } from 'date-fns';
import clsx from 'clsx';

export const cn = (...a) => clsx(...a);

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

export const money = (v, exact = false) => (v == null || v === '' ? '—' : (exact ? inr2 : inr).format(Number(v) || 0));

/** ₹12.5L / ₹1.2Cr style for KPI cards */
export function moneyShort(v) {
  const n = Number(v) || 0;
  const a = Math.abs(n);
  const s = n < 0 ? '-' : '';
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(2)}Cr`;
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(2)}L`;
  if (a >= 1e3) return `${s}₹${(a / 1e3).toFixed(1)}K`;
  return `${s}₹${Math.round(a)}`;
}

export const number = (v) => (v == null || v === '' ? '—' : num.format(Number(v) || 0));

const toDate = (v) => (v ? new Date(v) : null);
export const fmtDate = (v, f = 'dd MMM yyyy') => {
  const d = toDate(v);
  return d && isValid(d) ? format(d, f) : '—';
};
export const fmtDateTime = (v) => fmtDate(v, 'dd MMM yyyy, hh:mm a');
export const ago = (v) => {
  const d = toDate(v);
  return d && isValid(d) ? `${formatDistanceToNowStrict(d)} ago` : '';
};
/** yyyy-mm-dd for <input type="date"> (calendar day in UTC, matching how the API stores dates) */
export const dateInput = (v) => {
  const d = toDate(v);
  return d && isValid(d) ? d.toISOString().slice(0, 10) : '';
};
export const today = () => new Date().toISOString().slice(0, 10);

export const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('');

export const fileUrl = (u) => u || '';
export const isImage = (u = '') => /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(u);

export function downloadCSV(filename, columns, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [columns.map((c) => esc(c.label)).join(','), ...rows.map((r) => columns.map((c) => esc(r[c.key])).join(','))];
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
