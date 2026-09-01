import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Search, BookOpen, ChevronRight, ChevronDown, Save, AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { notify, MESSAGES } from '@/lib/notify';
import { ScrollArea } from '@/components/ui/scroll-area';
import ResultsErrorBoundary from '@/components/ui/ResultsErrorBoundary';
import { coursesForDiploma } from '@/lib/diplomaCourses';
import {
  canManageCourseProjects,
  COURSE_PROJECT_MAX_LEN,
  sanitizeCourseProject,
} from '@/lib/institution';

const ExaminationsPageContent = () => {
  const { user, institution } = useAuth();
  const showCourseProject = canManageCourseProjects(institution, user?.role);
  const { 
    classes, 
    courses, 
    classCourses, 
    diplomaCourses = [],
    students, 
    enrollments, 
    exams, 
    results, 
    saveExam, 
    saveManualGrades,
    refreshData,
    users = [],
  } = useData();
  const { toast } = useToast();

  const [expandedClass, setExpandedClass] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [markingContext, setMarkingContext] = useState(null);
  const [marksBuffer, setMarksBuffer] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setIsRefreshing(false);
  };

  const activeClasses = useMemo(() => {
    if (!classes) return [];
    
    let relevantClasses = classes.filter(c => c.is_active);
    if (user?.role === 'instructor') {
        relevantClasses = relevantClasses.filter(c => c.instructor_id === user.id);
    }

    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        relevantClasses = relevantClasses.filter(c => c.name.toLowerCase().includes(lower));
    }

    return relevantClasses.map(cls => {
        let clsCourses = [];

        if (cls.diploma_id) {
            clsCourses = coursesForDiploma(courses, diplomaCourses, cls.diploma_id);
        } else if (cls.course_id) {
            const c = courses.find(course => course.id === cls.course_id);
            if (c) clsCourses = [c];
        }

        const linked = classCourses
            .filter(cc => cc.class_id === cls.id)
            .map(cc => courses.find(c => c.id === cc.course_id))
            .filter(Boolean);
            
        const allCourses = [...clsCourses, ...linked].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

        const instructor =
          users.find((u) => u.id === cls.instructor_id) ||
          (cls.instructor_id === user?.id ? user : null);
        const instructorName =
          instructor?.name || instructor?.full_name || null;

        return { ...cls, derivedCourses: allCourses, instructorName };
    });
  }, [classes, courses, classCourses, diplomaCourses, user, searchTerm, users]);
  
  const handleOpenGrading = async (cls, course) => {
      let exam = exams.find(e => 
          e.class_id === cls.id && 
          e.course_id === course.id && 
          e.marking_type === 'manual'
      );

      if (!exam) {
          try {
            exam = await saveExam({
                title: `${course.name} - Final Grade`,
                class_id: cls.id,
                course_id: course.id,
                marking_type: 'manual',
                total_marks: 100,
                is_active: true,
                open_time: new Date().toISOString(),
                description: 'Manual course grading container'
            });
            
            await refreshData(); 
          } catch (e) {
            toast({ variant: "destructive", title: "Unable to start grading", description: MESSAGES.UNEXPECTED.description });
            return;
          }
      }

      const currentResults = results.filter(r => r.exam_id === exam.id);
      const initialBuffer: any = {};
      
      const classEnrollments = enrollments.filter(e => e.class_id === cls.id && e.status === 'active');
      const enrolledStudentIds = classEnrollments.map(e => e.student_id);

      enrolledStudentIds.forEach(sid => {
          const res = currentResults.find(r => r.student_id === sid);
          if (res) {
              let comments = '';
              if (res.answers && Array.isArray(res.answers) && res.answers[0]?.answer) {
                 comments = res.answers[0].answer;
              }

              initialBuffer[sid] = {
                  score: res.score !== null ? res.score : '',
                  comments: comments,
                  course_project: res.course_project || course.course_project || '',
              };
          } else {
              initialBuffer[sid] = {
                  score: '',
                  comments: '',
                  course_project: course.course_project || '',
              };
          }
      });

      setMarksBuffer(initialBuffer);
      setMarkingContext({
          classId: cls.id,
          courseId: course.id,
          examId: exam.id,
          className: cls.name,
          courseName: course.name,
          totalMarks: exam.total_marks
      });
  };

  const handleMarkChange = (studentId, field, value) => {
      setMarksBuffer(prev => ({
          ...prev,
          [studentId]: {
              ...prev[studentId],
              [field]: value
          }
      }));
  };

  const handleSaveMarks = async () => {
      setIsSaving(true);
      try {
          const updates = Object.entries(marksBuffer).map(([studentId, data]: [string, any]) => {
              if (data.score === '' || data.score === null || data.score === undefined) return null;

              const scoreNum = parseFloat(data.score);
              
              if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > markingContext.totalMarks) {
                  throw new Error(`Invalid score for student ID ${studentId}. Must be 0-${markingContext.totalMarks}`);
              }

              const row: Record<string, unknown> = {
                  exam_id: markingContext.examId,
                  student_id: studentId,
                  score: scoreNum,
                  total_marks: markingContext.totalMarks,
                  submission_date: new Date().toISOString(),
                  answers: [{ question_id: 'manual_comment', answer: data.comments || '' }] 
              };
              if (showCourseProject) {
                  row.course_project = sanitizeCourseProject(data.course_project);
              }
              return row;
          }).filter(Boolean);

          if (updates.length === 0) {
              toast({ title: "No Changes", description: "No valid grades were found to save." });
              setIsSaving(false);
              return;
          }

          await saveManualGrades(updates);

          toast({ title: "Success", description: MESSAGES.SUCCESS.GRADE_SAVED, className: "bg-green-600 border-green-700 text-white" });
          setMarkingContext(null);
          setTimeout(() => refreshData(), 500);
      } catch (e) {
          notify.error(e, { context: 'ExaminationsPage - saveGrades', fallback: MESSAGES.SAVE_FAILED });
      } finally {
          setIsSaving(false);
      }
  };

  const contextStudents = useMemo(() => {
      if (!markingContext) return [];
      return enrollments
        .filter(e => e.class_id === markingContext.classId && e.status === 'active')
        .map(e => students.find(s => s.id === e.student_id))
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));
  }, [markingContext, enrollments, students]);

  return (
    <>
      <div className="mb-6 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <Input 
                placeholder="Search active classes..." 
                className="pl-10 bg-slate-900/50 border-slate-800"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={handleManualRefresh} disabled={isRefreshing} className="border-slate-800 bg-slate-900">
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
          </Button>
      </div>

      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Manual Course Grading</h3>

      <div className="space-y-4">
        {activeClasses.length > 0 ? (
            activeClasses.map(cls => (
                <Card key={cls.id} className={`bg-slate-900/50 border-slate-800 transition-all ${expandedClass === cls.id ? 'ring-1 ring-indigo-500/50' : ''}`}>
                    <div 
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 rounded-t-lg"
                        onClick={() => setExpandedClass(expandedClass === cls.id ? null : cls.id)}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg ${expandedClass === cls.id ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}>
                                <BookOpen className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-200">{cls.name}</h3>
                                <p className="text-sm text-slate-500">
                                    {cls.derivedCourses.length} Courses • {cls.instructorName || 'No Instructor'}
                                </p>
                            </div>
                        </div>
                        {expandedClass === cls.id ? <ChevronDown className="h-5 w-5 text-slate-500" /> : <ChevronRight className="h-5 w-5 text-slate-500" />}
                    </div>

                    {expandedClass === cls.id && (
                        <CardContent className="pt-0 pb-4 px-4 bg-slate-950/30 border-t border-slate-800">
                            <div className="mt-4 space-y-2">
                                {cls.derivedCourses.length > 0 ? (
                                    cls.derivedCourses.map(course => {
                                        const exam = exams.find(e => e.class_id === cls.id && e.course_id === course.id && e.marking_type === 'manual');
                                        const gradedCount = exam ? results.filter(r => r.exam_id === exam.id).length : 0;

                                        return (
                                            <div key={course.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
                                                <div className="min-w-0">
                                                    <div className="font-medium text-slate-300 break-words">{course.name}</div>
                                                    <div className="text-xs text-slate-500">Code: {course.code || '—'}</div>
                                                </div>
                                                <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                                                    <div className="text-right text-xs hidden sm:block">
                                                        <div className="text-slate-400">Status</div>
                                                        <div className={gradedCount > 0 ? "text-green-400" : "text-yellow-500"}>
                                                            {gradedCount > 0 ? `${gradedCount} Graded` : 'Not Started'}
                                                        </div>
                                                    </div>
                                                    <Button 
                                                        size="sm" 
                                                        className="bg-indigo-600 hover:bg-indigo-700"
                                                        onClick={() => handleOpenGrading(cls, course)}
                                                    >
                                                        Grade Course
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-center py-4 text-slate-500 text-sm">No courses linked to this class.</div>
                                )}
                            </div>
                        </CardContent>
                    )}
                </Card>
            ))
        ) : (
            <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl">
                <AlertCircle className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-slate-300">No Active Classes Found</h3>
                <p className="text-slate-500">Make sure you have active classes assigned to you.</p>
            </div>
        )}
      </div>

      <Dialog open={!!markingContext} onOpenChange={(open) => !open && setMarkingContext(null)}>
          <DialogContent className={`${showCourseProject ? 'max-w-5xl' : 'max-w-4xl'} h-[85vh] flex flex-col bg-slate-950 border-slate-800 p-0 gap-0`}>
              <DialogHeader className="p-6 border-b border-slate-800 bg-slate-900/50">
                  <div className="flex items-center justify-between">
                      <div>
                        <DialogTitle className="text-xl">{markingContext?.courseName}</DialogTitle>
                        <DialogDescription className="mt-1 text-slate-400">
                            Grading for <span className="text-white font-medium">{markingContext?.className}</span>
                        </DialogDescription>
                      </div>
                      <Badge variant="outline" className="border-indigo-500/50 text-indigo-400 bg-indigo-500/10">
                          Max Score: {markingContext?.totalMarks}
                      </Badge>
                  </div>
              </DialogHeader>
              
              <ScrollArea className="flex-1 p-6">
                  <Table>
                      <TableHeader>
                          <TableRow className="border-slate-800 hover:bg-transparent">
                              <TableHead className="w-[220px]">Student</TableHead>
                              <TableHead className="w-[130px]">Score (0-{markingContext?.totalMarks})</TableHead>
                              {showCourseProject ? (
                                <TableHead className="min-w-[180px]">Course project</TableHead>
                              ) : null}
                              <TableHead>Comments (Optional)</TableHead>
                              <TableHead className="w-[100px] text-right">Status</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {contextStudents.length > 0 ? (
                              contextStudents.map(student => {
                                  const buffer = marksBuffer[student.id] || { score: '', comments: '', course_project: '' };
                                  const scoreVal = buffer.score === '' ? NaN : parseFloat(buffer.score);
                                  const isValid = buffer.score === '' || (!isNaN(scoreVal) && scoreVal >= 0 && scoreVal <= (markingContext?.totalMarks || 100));
                                  
                                  return (
                                      <TableRow key={student.id} className="border-slate-800 hover:bg-slate-900/50">
                                          <TableCell>
                                              <div className="font-medium text-slate-200">{student.name}</div>
                                              <div className="text-xs text-slate-500">{student.student_code}</div>
                                          </TableCell>
                                          <TableCell>
                                              <Input 
                                                type="number" 
                                                value={buffer.score}
                                                onChange={(e) => handleMarkChange(student.id, 'score', e.target.value)}
                                                className={`bg-slate-900 border-slate-700 ${!isValid ? 'border-red-500 focus-visible:ring-red-500' : 'focus-visible:ring-indigo-500'}`}
                                                placeholder="-"
                                                min={0}
                                                max={markingContext?.totalMarks}
                                              />
                                          </TableCell>
                                          {showCourseProject ? (
                                            <TableCell>
                                              <Input
                                                value={buffer.course_project || ''}
                                                maxLength={COURSE_PROJECT_MAX_LEN}
                                                onChange={(e) => handleMarkChange(student.id, 'course_project', e.target.value)}
                                                className="bg-slate-900 border-slate-700"
                                                placeholder="e.g. Research Proposal Development"
                                              />
                                            </TableCell>
                                          ) : null}
                                          <TableCell>
                                              <Input 
                                                value={buffer.comments}
                                                onChange={(e) => handleMarkChange(student.id, 'comments', e.target.value)}
                                                className="bg-slate-900 border-slate-700"
                                                placeholder="Add feedback..."
                                              />
                                          </TableCell>
                                          <TableCell className="text-right">
                                              {buffer.score !== '' && isValid ? (
                                                  <CheckCircle2 className="h-5 w-5 text-green-500 ml-auto" />
                                              ) : (
                                                  <span className="text-slate-600 text-xs">Pending</span>
                                              )}
                                          </TableCell>
                                      </TableRow>
                                  );
                              })
                          ) : (
                              <TableRow>
                                  <TableCell colSpan={showCourseProject ? 5 : 4} className="text-center py-8 text-slate-500">
                                      No students enrolled in this class.
                                  </TableCell>
                              </TableRow>
                          )}
                      </TableBody>
                  </Table>
              </ScrollArea>

              <DialogFooter className="p-6 border-t border-slate-800 bg-slate-900/50">
                  <Button variant="ghost" onClick={() => setMarkingContext(null)} disabled={isSaving}>Cancel</Button>
                  <Button onClick={handleSaveMarks} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 min-w-[140px]">
                      {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Grades</>}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </>
  );
};

const ExaminationsPage = () => {
  return (
    <AnimatedPage>
      <Helmet><title>Examinations - Portal</title></Helmet>
      <PageHeader 
        title="Examinations" 
        subtitle="Enter manual course grades for your active classes." 
      />
      <ResultsErrorBoundary>
        <ExaminationsPageContent />
      </ResultsErrorBoundary>
    </AnimatedPage>
  );
};

export default ExaminationsPage;