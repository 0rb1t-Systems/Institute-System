import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const StatCard = ({ title, value, icon, description }) => (
  <Card className="bg-slate-900/50 border-slate-800 hover:border-slate-700">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-slate-300">{title}</CardTitle>
      <div className="text-primary">{icon}</div>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-white">{value}</div>
      {description ? <p className="text-xs text-slate-400 mt-1">{description}</p> : null}
    </CardContent>
  </Card>
);

export default StatCard;
