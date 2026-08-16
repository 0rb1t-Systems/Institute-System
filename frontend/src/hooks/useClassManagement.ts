import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useToast } from '@/components/ui/use-toast';
import { notify, MESSAGES } from '@/lib/notify';
import * as api from '@/lib/api';

const useClassManagement = () => {
  const { 
    updateClassData, 
    enrollStudent, 
    payments, 
    results, 
    refreshData 
  } = useData();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Toggle Class Active Status (Suspend/Reactivate)
  const toggleClassStatus = async (classId, currentStatus) => {
    setLoading(true);
    try {
      // Logic per Task 5: updateClass with is_active flag
      const newStatus = !currentStatus;
      await updateClassData(classId, { is_active: newStatus });
      
      toast({
        title: "Success",
        description: MESSAGES.SUCCESS.CLASS_UPDATED,
        variant: "default"
      });
      return true;
    } catch (error) {
      notify.error(error, { context: 'useClassManagement - toggleStatus', fallback: MESSAGES.UPDATE_FAILED });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Independent Student Enrollment
  const enrollInClass = async (studentId, classId) => {
    setLoading(true);
    try {
      await enrollStudent({
        student_id: studentId,
        class_id: classId
      });
      
      toast({
        title: "Success",
        description: MESSAGES.SUCCESS.ENROLLMENT_SAVED,
        variant: "default"
      });
      return true;
    } catch (error) {
      notify.error(error, {
        context: 'useClassManagement - enroll',
        fallback: { title: 'Enrollment Failed', description: MESSAGES.DOMAIN.ENROLLMENT_FAILED },
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Get Payments for a specific class and student
  const getClassPayments = (classId, studentId) => {
    return payments.filter(p => p.class_id === classId && p.student_id === studentId);
  };

  // Get Results for a specific class and student
  const getClassResults = (classId, studentId) => {
    // Results are linked to exams, exams are linked to classes
    // We need to filter results where the exam belongs to the class
    return results.filter(r => r.exam?.class_id === classId && r.student_id === studentId);
  };

  return {
    loading,
    toggleClassStatus,
    enrollInClass,
    getClassPayments,
    getClassResults
  };
};

export default useClassManagement;