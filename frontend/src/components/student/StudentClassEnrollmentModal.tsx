import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, BookOpen } from 'lucide-react';
import { useData } from '@/contexts/DataContext';

const StudentClassEnrollmentModal = ({ 
  isOpen, 
  onClose, 
  onEnroll, 
  loading,
  currentEnrollments 
}) => {
  const { classes } = useData();
  const [selectedClassId, setSelectedClassId] = useState("");

  // Filter out classes specifically:
  // 1. Classes user is already enrolled in
  // 2. We show BOTH active and suspended classes as per requirements "filtered by active and suspended classes"
  const availableClasses = classes.filter(cls => {
    const isEnrolled = currentEnrollments.some(e => e.class_id === cls.id);
    return !isEnrolled;
  });

  const handleSubmit = () => {
    if (selectedClassId) {
      onEnroll(selectedClassId);
      setSelectedClassId("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-950 border-slate-800 text-white sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-400" />
            Enroll in New Class
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Select a class from the list below to add it to your schedule.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="class-select" className="text-slate-200">Select Class</Label>
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger id="class-select" className="bg-slate-900 border-slate-700 text-white">
                <SelectValue placeholder="Choose a class..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-white">
                {availableClasses.length > 0 ? (
                  availableClasses.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      <div className="flex items-center justify-between w-full gap-2">
                        <span>{cls.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${cls.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {cls.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>No new classes available</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!selectedClassId || loading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enroll Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StudentClassEnrollmentModal;