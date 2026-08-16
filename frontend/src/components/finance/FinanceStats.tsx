import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, CreditCard, AlertCircle, CalendarClock } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const FinanceStats = ({ stats }) => {
  if (!stats) return null;

  return (
    <div className="grid gap-6 md:grid-cols-4 mb-6">
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Collected</CardTitle>
          <DollarSign className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-400">{formatCurrency(stats.totalCollected)}</div>
          <p className="text-xs text-muted-foreground mt-1">Lifetime revenue</p>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Registration Fees</CardTitle>
          <CreditCard className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-400">{formatCurrency(stats.totalRegFees)}</div>
          <p className="text-xs text-muted-foreground mt-1">{stats.regCount} Paid Registrations</p>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding Balance</CardTitle>
          <AlertCircle className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-400">{formatCurrency(stats.totalOutstanding)}</div>
          <p className="text-xs text-muted-foreground mt-1">Total pending from students</p>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Overdue Accounts</CardTitle>
          <CalendarClock className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-400">{stats.overdueCount}</div>
          <p className="text-xs text-muted-foreground mt-1">Students with {`>`} $0 overdue</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceStats;