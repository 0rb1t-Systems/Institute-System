import React from 'react';
import { WifiOff } from 'lucide-react';
import { useNetworkStatus } from '@/lib/networkUtils';

const NetworkStatus = () => {
  const isOnline = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 border border-red-500">
        <WifiOff className="h-5 w-5 animate-pulse" />
        <div>
          <p className="font-bold text-sm">No Connection</p>
          <p className="text-xs text-red-100">Checking network...</p>
        </div>
      </div>
    </div>
  );
};

export default NetworkStatus;