import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';




const COLORS = ['#2B55B4', '#218757', '#D68B07', '#CA2B2B'];

export const DynamicsChart = ({ data }: { data: any[] }) => (
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border))" />
      <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'rgb(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
      <YAxis tick={{ fontSize: 12, fill: 'rgb(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
      <Tooltip 
        contentStyle={{ backgroundColor: 'rgb(var(--card))', borderRadius: '8px', border: '1px solid rgb(var(--border))' }} 
      />
      <Line type="monotone" dataKey="expense" stroke="rgb(var(--primary))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
    </LineChart>
  </ResponsiveContainer>
);

export const CategoryPieChart = ({ data }: { data: any[] }) => (
  <ResponsiveContainer width="100%" height="100%">
    <PieChart>
      <Pie
        data={data}
        innerRadius={60}
        outerRadius={80}
        paddingAngle={5}
        dataKey="value"
      >
        {data.map((_, index) => (
          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
        ))}
      </Pie>
      <Tooltip contentStyle={{ backgroundColor: 'rgb(var(--card))', borderRadius: '8px', border: '1px solid rgb(var(--border))' }} />
      <Legend wrapperStyle={{ fontSize: '12px' }} />
    </PieChart>
  </ResponsiveContainer>
);
