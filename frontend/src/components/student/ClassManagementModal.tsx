import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from 'lucide-react';

const ClassManagementModal = ({ 
  isOpen, 
  onClose, 
  selectedClass, 
  onConfirm, 
  loading 
}) => {
  if (!selectedClass) return null;

  const isSuspending = selectedClass.is_active;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-950 border-slate-800 text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className={`h-5 w-5 ${isSuspending ? 'text-amber-500' : 'text-green-500'}`} />
            {isSuspending ? 'Suspend Class' : 'Reactivate Class'}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Are you sure you want to {isSuspending ? 'suspend' : 'reactivate'} <strong>{selectedClass.name}</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className={`p-4 rounded-lg border ${isSuspending ? 'bg-amber-500/10 border-amber-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
            <p className="text-sm">
              {isSuspending 
                ? "Suspending this class will mark it as inactive. This may affect visibility for other users."
                : "Reactivating this class will make it visible and active for all enrolled students."
              }
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading} className="text-slate-400 hover:text-white">
            Cancel
          </Button>
          <Button 
            variant={isSuspending ? "destructive" : "default"}
            onClick={() => onConfirm(selectedClass.id, selectedClass.is_active)}
            disabled={loading}
            className={!isSuspending ? "bg-green-600 hover:bg-green-700 text-white" : ""}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSuspending ? 'Confirm Suspend' : 'Confirm Reactivate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClassManagementModal;