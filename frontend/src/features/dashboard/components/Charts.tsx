import React from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

const defaultDynamicsData = [
  { name: 'Sen', amount: 9800000 },
  { name: 'Okt', amount: 14200000 },
  { name: 'Noy', amount: 12500000 },
  { name: 'Dek', amount: 18900000 },
  { name: 'Yan', amount: 15400000 },
  { name: 'Fev', amount: 13800000 },
  { name: 'Mar', amount: 19200000 },
  { name: 'Apr', amount: 21500000 },
  { name: 'May', amount: 24800000 },
  { name: 'Iyn', amount: 22100000 },
  { name: 'Iyl', amount: 26400000 },
  { name: 'Avg', amount: 14850000 },
];

const defaultCategoryData = [
  { name: 'Marketing & Reklama', value: 42500000, color: '#3b82f6' },
  { name: 'Ofis & Ma\'muriy', value: 26800000, color: '#10b981' },
  { name: 'Transport & Yoqilg\'i', value: 19400000, color: '#f59e0b' },
  { name: 'IT & Uskunalar', value: 15600000, color: '#8b5cf6' },
  { name: 'Xizmat safari', value: 12300000, color: '#ec4899' },
  { name: 'Boshqa xarajatlar', value: 8900000, color: '#6b7280' }
];

const branchCompareData = [
  { name: 'Mirobod', sarf: 28.9, limit: 28.0 },
  { name: 'Chilonzor', sarf: 24.5, limit: 30.0 },
  { name: 'Yunusobod', sarf: 18.2, limit: 25.0 },
  { name: 'Samarqand', sarf: 14.2, limit: 20.0 },
  { name: 'Namangan', sarf: 12.4, limit: 18.0 },
  { name: 'Farg\'ona', sarf: 11.5, limit: 16.0 },
  { name: 'Buxoro', sarf: 9.8, limit: 15.0 },
];

export const DynamicsChart = ({ data }: { data?: any[] }) => {
  const chartData = data && data.length > 0 ? data : defaultDynamicsData;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: 'rgb(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`}
          tick={{ fontSize: 11, fill: 'rgb(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: any) => [`${new Intl.NumberFormat('uz-UZ').format(Number(value))} so'm`, 'Xarajat']}
          contentStyle={{
            backgroundColor: 'rgb(var(--card))',
            borderRadius: '8px',
            border: '1px solid rgb(var(--border))',
            boxShadow: 'var(--shadow-md)',
            color: 'rgb(var(--foreground))'
          }}
        />
        <Area
          type="monotone"
          dataKey="amount"
          stroke="#3b82f6"
          strokeWidth={2.5}
          fillOpacity={1}
          fill="url(#colorSpend)"
          activeDot={{ r: 6 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export const CategoryPieChart = ({ data }: { data?: any[] }) => {
  const chartData = data && data.length > 0 ? data : defaultCategoryData;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          innerRadius={55}
          outerRadius={80}
          paddingAngle={4}
          dataKey="value"
        >
          {chartData.map((entry: any, index: number) => (
            <Cell key={`cell-${index}`} fill={entry.color || ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'][index % 5]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: any) => [`${new Intl.NumberFormat('uz-UZ').format(Number(value))} so'm`, 'Summa']}
          contentStyle={{
            backgroundColor: 'rgb(var(--card))',
            borderRadius: '8px',
            border: '1px solid rgb(var(--border))',
            boxShadow: 'var(--shadow-md)'
          }}
        />
        <Legend
          layout="horizontal"
          verticalAlign="bottom"
          align="center"
          wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

export const BranchBarChart = () => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={branchCompareData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: 'rgb(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${v}M`}
          tick={{ fontSize: 11, fill: 'rgb(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(val: any, name: any) => [`${val} mln so'm`, name === 'sarf' ? 'Haqiqiy sarf' : 'Byudjet limiti']}
          contentStyle={{
            backgroundColor: 'rgb(var(--card))',
            borderRadius: '8px',
            border: '1px solid rgb(var(--border))',
            boxShadow: 'var(--shadow-md)'
          }}
        />
        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
        <Bar dataKey="sarf" name="Haqiqiy sarf" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="limit" name="Limit" fill="rgba(148, 163, 184, 0.4)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};
