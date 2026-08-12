const fs = require('fs');

function replaceFile(path, search, replace) {
    if (!fs.existsSync(path)) return;
    let content = fs.readFileSync(path, 'utf8');
    const newContent = content.replace(search, replace);
    if (content !== newContent) {
        fs.writeFileSync(path, newContent, 'utf8');
        console.log(`Updated ${path}`);
    }
}

replaceFile('./src/features/auth/components/LoginForm.tsx', /, getValues /g, ' ');
replaceFile('./src/features/categories/CategoriesPage.tsx', /, refetch } = /g, ' } = ');
replaceFile('./src/features/dashboard/components/Charts.tsx', /import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';/g, "import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';");
replaceFile('./src/features/dashboard/components/Charts.tsx', /const dynamicsData = \[[\s\S]*?\];/g, '');
replaceFile('./src/features/dashboard/components/Charts.tsx', /const categoryData = \[[\s\S]*?\];/g, '');
replaceFile('./src/features/dashboard/components/Charts.tsx', /\(entry, index\)/g, '(_, index)');
replaceFile('./src/features/dashboard/DashboardPage.tsx', /import { Button } from '@\/components\/ui\/Button';\n/g, '');
replaceFile('./src/features/employees/EmployeesPage.tsx', /const \[branchFilter, setBranchFilter\] = useState\(''\);\n/g, '');
replaceFile('./src/features/employees/EmployeesPage.tsx', /const \[statusFilter, setStatusFilter\] = useState\(''\);\n/g, '');
replaceFile('./src/features/expenses/ExpenseDetailsPage.tsx', /import { useState } from 'react';\n/g, '');
replaceFile('./src/features/profile/ProfilePage.tsx', /const { t } = useTranslation\(\['common'\]\);\n/g, '');
replaceFile('./src/features/refunds/components/RefundForm.tsx', /import { useForm, Controller } from 'react-hook-form';/g, "import { useForm } from 'react-hook-form';");
replaceFile('./src/features/exports/api.ts', /catch \(e\) {/g, 'catch (_e) {');
replaceFile('./src/features/notifications/api.ts', /catch \(e\) {/g, 'catch (_e) {');
replaceFile('./src/features/branches/components/BranchFormDialog.tsx', /const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<BranchFormData>\(\{[\s\S]*?\}\);\n\n  const code = watch\('code'\);/g, "const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<BranchFormData>({ resolver: zodResolver(branchSchema) });");

console.log("Done");
