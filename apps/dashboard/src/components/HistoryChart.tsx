'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export function HistoryChart({ points }: { points: { at: string; usedPct: number }[] }) {
  return <div className="chart" role="img" aria-label="Quota usage over the last seven days"><ResponsiveContainer width="100%" height="100%"><LineChart data={points} margin={{ top: 12, right: 16, bottom: 0, left: -18 }}><CartesianGrid vertical={false} stroke="#edf0f3" /><XAxis dataKey="at" tickFormatter={value => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} tick={{ fill: '#8b95a4', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} /><YAxis domain={[0, 100]} tickFormatter={value => `${value}%`} tick={{ fill: '#8b95a4', fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip labelFormatter={value => new Date(String(value)).toLocaleString()} formatter={value => [`${Number(value).toFixed(1)}%`, 'Used']} contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: 'none', fontSize: 12 }} /><Line type="monotone" dataKey="usedPct" stroke="#4f46e5" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>;
}
