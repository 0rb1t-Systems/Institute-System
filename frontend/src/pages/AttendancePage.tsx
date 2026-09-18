import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { notify, MESSAGES } from '@/lib/notify';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Calendar, CheckCircle2, AlertCircle, Users, ClipboardCheck } from 'lucide-react';
import { upsertAttendanceRecord, bulkUpsertAttendanceWithDuplicatePrevention, getAttendanceByClassAndDate } from '@/lib/api';

const AttendancePage = () => {
  const { user } = useAuth();
  const { classes, enrollments, students, refreshData } = useData();
  const { toast } = useToast();
  
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceState, setAttendanceState] = useState({});
  const [notesState, setNotesState] = useState({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [bulkSaving, setBulkSaving] = useState(false);

  const availableClasses = useMemo(() => {
    if (!user) return [];
    const active = (classes || []).filter((c) => c.is_active);
    if (user.role === 'instructor') {
      return active.filter(
        (c) =>
          c.instructor_id === user.id &&
          (!user.institution_id || c.institution_id === user.institution_id)
      );
    }
    if (user.institution_id) {
      return active.filter((c) => c.institution_id === user.institution_id);
    }
    return active;
  }, [classes, user]);

  const enrolledStudents = useMemo(() => {
    if (!selectedClassId) return [];
    const classEnrollments = enrollments.filter(e => e.class_id === selectedClassId && e.status === 'active');
    return classEnrollments
      .map(e => students.find(s => s.id === e.student_id))
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedClassId, enrollments, students]);

  // Load existing attendance for this specific day
  useEffect(() => {
    if (!selectedClassId || !selectedDate) return;

    const loadExisting = async () => {
      setLoading(true);
      try {
        const daysRecords = await getAttendanceByClassAndDate(selectedClassId, selectedDate);
        
        const newStatus: any = {};
        const newNotes: any = {};
        
        daysRecords?.forEach(r => {
            newStatus[r.student_id] = r.status;
            if (r.notes) newNotes[r.student_id] = r.notes;
        });
        
        setAttendanceState(newStatus);
        setNotesState(newNotes);
      } catch (error) {
        notify.error(error, { context: 'AttendancePage - load', fallback: MESSAGES.LOAD_FAILED });
      } finally {
        setLoading(false);
      }
    };

    loadExisting();
  }, [selectedClassId, selectedDate, toast]);

  const markedCount = Object.keys(attendanceState).length;
  const pendingCount = enrolledStudents.length - markedCount;

  // Immediate Save Handler
  const handleStatusChange = async (studentId, status) => {
      if (!selectedClassId || !selectedDate) {
         notify.validation(`${MESSAGES.VALIDATION.SELECT_CLASS} ${MESSAGES.VALIDATION.SELECT_DATE}`);
         return;
      }

      // Optimistic UI Update
      setAttendanceState(prev => ({ ...prev, [studentId]: status }));
      setSavingId(studentId);

      try {
          const record = {
              student_id: studentId,
              class_id: selectedClassId,
              date: selectedDate,
              status: status,
              notes: notesState[studentId] || null,
              marked_by: user.id
          };

          await upsertAttendanceRecord(record);
          
          toast({ title: "Success", description: MESSAGES.SUCCESS.ATTENDANCE_SAVED, duration: 2000 });
      } catch (error) {
          notify.error(error, { context: 'AttendancePage - save', fallback: { title: 'Save Error', description: MESSAGES.DOMAIN.ATTENDANCE_SAVE } });
          // Revert on failure could be added here
      } finally {
          setSavingId(null);
      }
  };

  const handleNoteBlur = async (studentId, note) => {
      if (!attendanceState[studentId]) return; // Only save note if status exists
      
      try {
         const record = {
              student_id: studentId,
              class_id: selectedClassId,
              date: selectedDate,
              status: attendanceState[studentId],
              notes: note || null,
              marked_by: user.id
          };
          await upsertAttendanceRecord(record);
      } catch (error) {
          notify.error(error, { context: 'AttendancePage - note', fallback: MESSAGES.DOMAIN.ATTENDANCE_SAVE });
      }
  };

  const handleMarkAllPresent = async () => {
      if (!selectedClassId || !selectedDate || enrolledStudents.length === 0) return;
      
      setBulkSaving(true);
      try {
          const records = enrolledStudents.map(s => ({
              student_id: s.id,
              class_id: selectedClassId,
              date: selectedDate,
              status: 'present',
              notes: notesState[s.id] || null,
              marked_by: user.id
          }));

          await bulkUpsertAttendanceWithDuplicatePrevention(records);

          const newStatus: any = {};
          enrolledStudents.forEach(s => { newStatus[s.id] = 'present'; });
          setAttendanceState(newStatus);
          
          toast({ title: "Success", description: MESSAGES.SUCCESS.ATTENDANCE_SAVED });
      } catch (error) {
          notify.error(error, { context: 'AttendancePage - bulkSave', fallback: { title: 'Error', description: MESSAGES.DOMAIN.ATTENDANCE_SAVE } });
      } finally {
          setBulkSaving(false);
      }
  };

  return (
    <AnimatedPage>
      <Helmet><title>Mark Attendance - Portal</title></Helmet>
      <PageHeader 
        title="Mark Attendance" 
        subtitle="Record daily student participation. Changes save automatically."
      />

      <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card className="md:col-span-2">
              <CardContent className="pt-6 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                      <Label>Select Class</Label>
                      <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                          <SelectTrigger><SelectValue placeholder="Choose Class" /></SelectTrigger>
                          <SelectContent className="max-h-60">
                              {availableClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                      </Select>
                  </div>
                  <div className="space-y-2">
                      <Label>Date</Label>
                      <div className="relative">
                          <Input 
                            type="date" 
                            max={new Date().toISOString().split('T')[0]}
                            value={selectedDate} 
                            onChange={e => setSelectedDate(e.target.value)} 
                            className="pl-10"
                          />
                          <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-[var(--ds-text-tertiary,#8A978E)]" />
                      </div>
                  </div>
              </CardContent>
          </Card>

          <StatCard
            title="Total Active"
            value={enrolledStudents.length}
            icon={<Users className="h-5 w-5" />}
            tone="info"
          />

          <StatCard
            title="Marked / Pending"
            value={`${markedCount} / ${pendingCount}`}
            icon={<ClipboardCheck className="h-5 w-5" />}
            tone={pendingCount === 0 && enrolledStudents.length > 0 ? 'primary' : 'warning'}
            description={enrolledStudents.length ? `${Math.round((markedCount / enrolledStudents.length) * 100)}% complete` : 'Select a class'}
            descriptionTone={pendingCount === 0 && enrolledStudents.length > 0 ? 'accent' : 'warning'}
          />
      </div>

      {selectedClassId && (
          <Card className="relative overflow-hidden">
              <div 
                 className="absolute top-0 left-0 h-1 bg-[var(--ds-accent,#1F8A5B)] transition-all duration-500" 
                 style={{ width: `${enrolledStudents.length ? (markedCount / enrolledStudents.length) * 100 : 0}%` }}
              ></div>
              
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                      <CardTitle>Student Roster</CardTitle>
                      <CardDescription>Click a status to save immediately.</CardDescription>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                      <Button 
                        onClick={handleMarkAllPresent} 
                        disabled={bulkSaving || enrolledStudents.length === 0} 
                        className="w-full sm:w-auto"
                      >
                          {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                          Mark All Present
                      </Button>
                  </div>
              </CardHeader>
              <CardContent>
                  {loading ? (
                      <div className="text-center py-16"><Loader2 className="h-8 w-8 animate-spin mx-auto text-[var(--ds-accent,#1F8A5B)]" /></div>
                  ) : (
                      <div className="rounded-[var(--ds-radius-md,8px)] border border-[var(--ds-border,#DDE5DF)] overflow-hidden">
                          <Table>
                              <TableHeader>
                                  <TableRow>
                                      <TableHead className="min-w-[140px] sm:w-[300px]">Student Name</TableHead>
                                      <TableHead className="text-center min-w-[200px] sm:min-w-[320px]">Status</TableHead>
                                      <TableHead>Notes (Optional)</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {enrolledStudents.map(student => (
                                      <TableRow key={student.id}>
                                          <TableCell>
                                              <div className="flex items-center gap-3">
                                                  <div className="relative">
                                                      {!attendanceState[student.id] && <AlertCircle className="h-4 w-4 text-[var(--ds-warning,#C2410C)] absolute -left-5 top-1" />}
                                                  </div>
                                                  <div>
                                                      <div className="font-medium flex items-center gap-2">
                                                          {student.name}
                                                      </div>
                                                      <div className="text-xs text-[var(--ds-text-tertiary,#8A978E)] font-mono mt-0.5">{student.student_code}</div>
                                                  </div>
                                              </div>
                                          </TableCell>
                                          <TableCell className="text-center">
                                              <div className="flex justify-center gap-1.5 relative">
                                                  {savingId === student.id && (
                                                      <div className="absolute -right-6 top-2">
                                                          <Loader2 className="h-4 w-4 animate-spin text-[var(--ds-accent,#1F8A5B)]" />
                                                      </div>
                                                  )}
                                                  {['present', 'late', 'absent', 'excused'].map(status => (
                                                      <button
                                                          key={status}
                                                          onClick={() => handleStatusChange(student.id, status)}
                                                          disabled={savingId === student.id}
                                                          className={`
                                                              px-3 py-1.5 rounded-[var(--ds-radius-md,8px)] text-xs font-bold uppercase tracking-wider transition-all border
                                                              ${attendanceState[student.id] === status 
                                                                  ? status === 'present' ? 'bg-[var(--ds-success-bg,#ECFDF5)] border-[var(--ds-accent,#1F8A5B)] text-[var(--ds-accent,#1F8A5B)]'
                                                                  : status === 'late' ? 'bg-[var(--ds-warning-bg,#FFF7ED)] border-[var(--ds-warning,#C2410C)] text-[var(--ds-warning,#C2410C)]'
                                                                  : status === 'absent' ? 'bg-[var(--ds-danger-bg,#FEF2F2)] border-[var(--ds-danger,#DC2626)] text-[var(--ds-danger,#DC2626)]'
                                                                  : 'bg-[var(--ds-info-bg,#EFF6FF)] border-[var(--ds-info,#2563EB)] text-[var(--ds-info,#2563EB)]'
                                                                  : 'bg-[var(--ds-surface,#fff)] border-[var(--ds-border,#DDE5DF)] text-[var(--ds-text-secondary,#5B6B61)] hover:bg-[var(--ds-surface-muted,#F7FAF8)] hover:border-[var(--ds-border-strong,#C5D0C8)] disabled:opacity-50'
                                                              }
                                                          `}
                                                      >
                                                          {status}
                                                      </button>
                                                  ))}
                                              </div>
                                          </TableCell>
                                          <TableCell>
                                              <Input 
                                                  placeholder="Add note..." 
                                                  value={notesState[student.id] || ''}
                                                  onChange={e => setNotesState(p => ({...p, [student.id]: e.target.value}))}
                                                  onBlur={(e) => handleNoteBlur(student.id, e.target.value)}
                                                  className="h-9 text-sm"
                                              />
                                          </TableCell>
                                      </TableRow>
                                  ))}
                                  {enrolledStudents.length === 0 && (
                                      <TableRow><TableCell colSpan={3} className="text-center py-12 text-[var(--ds-text-tertiary,#8A978E)]">No active students found in this class.</TableCell></TableRow>
                                  )}
                              </TableBody>
                          </Table>
                      </div>
                  )}
              </CardContent>
          </Card>
      )}
    </AnimatedPage>
  );
};

export default AttendancePage;