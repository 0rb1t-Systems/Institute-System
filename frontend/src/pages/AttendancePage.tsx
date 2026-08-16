import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
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
import { Save, Loader2, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
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

      <div className="grid gap-6 md:grid-cols-4 mb-6">
          <Card className="bg-slate-900/50 border-slate-800 md:col-span-2 shadow-lg">
              <CardContent className="pt-6 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                      <Label className="text-slate-300">Select Class</Label>
                      <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                          <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue placeholder="Choose Class" /></SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                              {availableClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                      </Select>
                  </div>
                  <div className="space-y-2">
                      <Label className="text-slate-300">Date</Label>
                      <div className="relative">
                          <Input 
                            type="date" 
                            max={new Date().toISOString().split('T')[0]}
                            value={selectedDate} 
                            onChange={e => setSelectedDate(e.target.value)} 
                            className="bg-slate-950 border-slate-800 text-white pl-10"
                          />
                          <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                      </div>
                  </div>
              </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800 flex items-center justify-center shadow-lg border-b-4 border-b-blue-500">
              <CardContent className="pt-6 text-center">
                  <h3 className="font-bold text-4xl text-blue-400">{enrolledStudents.length}</h3>
                  <p className="text-sm text-slate-400 mt-1 uppercase tracking-wider font-semibold">Total Active</p>
              </CardContent>
          </Card>

          <Card className={`bg-slate-900/50 border-slate-800 flex items-center justify-center shadow-lg border-b-4 ${pendingCount === 0 && enrolledStudents.length > 0 ? 'border-b-green-500' : 'border-b-yellow-500'}`}>
              <CardContent className="pt-6 text-center">
                  <div className="flex justify-center items-center gap-4">
                      <div>
                          <h3 className="font-bold text-2xl text-green-400">{markedCount}</h3>
                          <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">Marked</p>
                      </div>
                      <div className="w-px h-8 bg-slate-800"></div>
                      <div>
                          <h3 className="font-bold text-2xl text-yellow-400">{pendingCount}</h3>
                          <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">Pending</p>
                      </div>
                  </div>
              </CardContent>
          </Card>
      </div>

      {selectedClassId && (
          <Card className="bg-slate-900/50 border-slate-800 shadow-xl relative overflow-hidden">
              {/* Progress Bar Indicator */}
              <div 
                 className="absolute top-0 left-0 h-1 bg-green-500 transition-all duration-500" 
                 style={{ width: `${enrolledStudents.length ? (markedCount / enrolledStudents.length) * 100 : 0}%` }}
              ></div>
              
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                      <CardTitle>Student Roster</CardTitle>
                      <CardDescription className="text-slate-400">Click a status to save immediately.</CardDescription>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                      <Button 
                        onClick={handleMarkAllPresent} 
                        disabled={bulkSaving || enrolledStudents.length === 0} 
                        className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto shadow-md shadow-green-900/20"
                      >
                          {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                          Mark All Present
                      </Button>
                  </div>
              </CardHeader>
              <CardContent>
                  {loading ? (
                      <div className="text-center py-16"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" /></div>
                  ) : (
                      <div className="rounded-md border border-slate-800 overflow-hidden">
                          <Table>
                              <TableHeader className="bg-slate-950">
                                  <TableRow className="border-slate-800">
                                      <TableHead className="min-w-[140px] sm:w-[300px] text-slate-400">Student Name</TableHead>
                                      <TableHead className="text-center text-slate-400 min-w-[200px] sm:min-w-[320px]">Status</TableHead>
                                      <TableHead className="text-slate-400">Notes (Optional)</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {enrolledStudents.map(student => (
                                      <TableRow key={student.id} className="hover:bg-slate-800/50 border-slate-800 transition-colors">
                                          <TableCell>
                                              <div className="flex items-center gap-3">
                                                  <div className="relative">
                                                      {!attendanceState[student.id] && <AlertCircle className="h-4 w-4 text-yellow-500 absolute -left-5 top-1" />}
                                                  </div>
                                                  <div>
                                                      <div className="font-medium text-slate-200 flex items-center gap-2">
                                                          {student.name}
                                                      </div>
                                                      <div className="text-xs text-slate-500 font-mono mt-0.5">{student.student_code}</div>
                                                  </div>
                                              </div>
                                          </TableCell>
                                          <TableCell className="text-center">
                                              <div className="flex justify-center gap-1.5 relative">
                                                  {savingId === student.id && (
                                                      <div className="absolute -right-6 top-2">
                                                          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                                      </div>
                                                  )}
                                                  {['present', 'late', 'absent', 'excused'].map(status => (
                                                      <button
                                                          key={status}
                                                          onClick={() => handleStatusChange(student.id, status)}
                                                          disabled={savingId === student.id}
                                                          className={`
                                                              px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all border
                                                              ${attendanceState[student.id] === status 
                                                                  ? status === 'present' ? 'bg-green-600/20 border-green-500 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.2)]'
                                                                  : status === 'late' ? 'bg-yellow-600/20 border-yellow-500 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.2)]'
                                                                  : status === 'absent' ? 'bg-red-600/20 border-red-500 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                                                                  : 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                                                                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800 hover:border-slate-600 disabled:opacity-50'
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
                                                  className="h-9 text-sm bg-slate-950/50 border-slate-800 text-slate-300 focus-visible:ring-blue-500"
                                              />
                                          </TableCell>
                                      </TableRow>
                                  ))}
                                  {enrolledStudents.length === 0 && (
                                      <TableRow><TableCell colSpan={3} className="text-center py-12 text-slate-500">No active students found in this class.</TableCell></TableRow>
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