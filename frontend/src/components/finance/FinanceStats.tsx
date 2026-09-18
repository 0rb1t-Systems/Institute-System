import React from 'react';
import StatCard from '@/components/StatCard';
import { DollarSign, CreditCard, AlertCircle, CalendarClock } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const FinanceStats = ({ stats }) => {
  if (!stats) return null;

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      <StatCard
        title="Total Collected"
        value={formatCurrency(stats.totalCollected)}
        tone="primary"
        descriptionTone="secondary"
        icon={<DollarSign className="h-5 w-5" strokeWidth={1.75} />}
        description="Lifetime revenue"
      />
      <StatCard
        title="Registration Fees"
        value={formatCurrency(stats.totalRegFees)}
        tone="primary"
        descriptionTone="secondary"
        icon={<CreditCard className="h-5 w-5" strokeWidth={1.75} />}
        description={`${stats.regCount} Paid Registrations`}
      />
      <StatCard
        title="Outstanding Balance"
        value={formatCurrency(stats.totalOutstanding)}
        tone="warning"
        descriptionTone="warning"
        icon={<AlertCircle className="h-5 w-5" strokeWidth={1.75} />}
        description="Total pending from students"
      />
      <StatCard
        title="Overdue Accounts"
        value={stats.overdueCount}
        tone="danger"
        descriptionTone="danger"
        icon={<CalendarClock className="h-5 w-5" strokeWidth={1.75} />}
        description="Students with > $0 overdue"
      />
    </div>
  );
};

export default FinanceStats;
