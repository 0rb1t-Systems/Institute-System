import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  PlusCircle,
  BookOpen,
  Trash2,
  GraduationCap,
  MonitorPlay,
  Building2,
  Edit,
  GripVertical,
  Save,
  X,
  Loader2,
} from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { notify, MESSAGES } from '@/lib/notify';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { coursesForDiploma, diplomasForCourse, groupCoursesBySemester, semestersForDiploma } from '@/lib/diplomaCourses';

const DiplomaForm = ({ diploma, closeDialog }: any) => {
    const [name, setName] = useState(diploma?.name || '');
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [selectedSemesterId, setSelectedSemesterId] = useState('none');
    const [newSemesterName, setNewSemesterName] = useState('');
    const {
        addDiploma,
        updateDiplomaData,
        diplomas,
        courses,
        diplomaCourses = [],
        diplomaSemesters = [],
        assignCourseToDiploma,
        removeCourseFromDiploma,
        addDiplomaSemester,
        deleteDiplomaSemesterData,
    } = useData();

    const includedCourses = diploma ? coursesForDiploma(courses, diplomaCourses, diploma.id) : [];
    const includedIds = new Set(includedCourses.map((c) => c.id));
    const availableCourses = courses.filter((c) => !includedIds.has(c.id));
    const semesters = diploma ? semestersForDiploma(diplomaSemesters, diploma.id) : [];

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const duplicate = diplomas.find(d => 
            d.name.trim().toLowerCase() === name.trim().toLowerCase() && 
            d.id !== diploma?.id
        );

        if (duplicate) {
            notify.validation(MESSAGES.DUPLICATE.GENERIC.description);
            return;
        }

        try {
            const data = { name: name.trim() };
            if (diploma) {
                await updateDiplomaData(diploma.id, data);
                notify.success(MESSAGES.SUCCESS.COURSE_UPDATED);
            } else {
                await addDiploma(data);
                notify.success(MESSAGES.SUCCESS.COURSE_CREATED);
            }
            closeDialog();
        } catch (error) {
             notify.error(error, { context: 'CoursesPage - saveDiploma', fallback: MESSAGES.SAVE_FAILED });
        }
    };

    const handleAddCourse = async () => {
        if (!diploma?.id || !selectedCourseId) return;
        try {
            await assignCourseToDiploma(
                diploma.id,
                selectedCourseId,
                selectedSemesterId === 'none' ? null : selectedSemesterId,
            );
            setSelectedCourseId('');
            notify.success({ title: 'Course added', description: 'Existing course was added to this diploma.' });
        } catch (error) {
            notify.error(error, { context: 'CoursesPage - assignCourseToDiploma', fallback: MESSAGES.SAVE_FAILED });
        }
    };

    const handleAddSemester = async () => {
        if (!diploma?.id || !newSemesterName.trim()) return;
        try {
            await addDiplomaSemester(diploma.id, newSemesterName.trim());
            setNewSemesterName('');
            notify.success({ title: 'Semester added', description: 'This semester appears on transcripts for this diploma.' });
        } catch (error) {
            notify.error(error, { context: 'CoursesPage - addDiplomaSemester', fallback: MESSAGES.SAVE_FAILED });
        }
    };

    const handleRemoveCourse = async (courseId) => {
        if (!diploma?.id) return;
        try {
            await removeCourseFromDiploma(diploma.id, courseId);
            notify.success({ title: 'Removed', description: 'Course was removed from this diploma only.' });
        } catch (error) {
            notify.error(error, { context: 'CoursesPage - removeCourseFromDiploma', fallback: MESSAGES.SAVE_FAILED });
        }
    };

    const groupedCourses = groupCoursesBySemester(includedCourses, semesters);

    return (
        <form onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-5">
            <DialogHeader>
                <DialogTitle>{diploma ? 'Edit Diploma' : 'Create New Diploma'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-1.5 min-w-0">
                    <Label htmlFor="diploma-name">Name</Label>
                    <Input
                        id="diploma-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full min-w-0"
                        required
                    />
                </div>

            {diploma ? (
                <div className="grid min-w-0 gap-4 md:grid-cols-2">
                    <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
                        <div>
                            <Label className="text-base">Semesters</Label>
                            <p className="text-xs text-slate-400 mt-1">Shown as headings on the transcript.</p>
                        </div>
                        <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                            <Input
                                value={newSemesterName}
                                onChange={(e) => setNewSemesterName(e.target.value)}
                                placeholder="e.g. Semester 1"
                                className="min-w-0 flex-1"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                className="shrink-0 border-slate-700"
                                onClick={handleAddSemester}
                                disabled={!newSemesterName.trim()}
                            >
                                Add semester
                            </Button>
                        </div>
                        {semesters.length > 0 ? (
                            <ul className="space-y-2">
                                {semesters.map((s) => (
                                    <li
                                        key={s.id}
                                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2.5"
                                    >
                                        <span className="truncate text-sm text-slate-100">{s.name}</span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 shrink-0 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                                            onClick={() => deleteDiplomaSemesterData(s.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-xs text-slate-500 rounded-lg border border-dashed border-slate-800 px-3 py-4">
                                No semesters yet — the transcript lists courses in one block.
                            </p>
                        )}
                    </section>

                    <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
                        <div>
                            <Label className="text-base">Included courses</Label>
                            <p className="text-xs text-slate-400 mt-1">Add a course and pick its semester.</p>
                        </div>
                        <div className="flex min-w-0 flex-col gap-2.5">
                            <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                                <SelectTrigger className="w-full min-w-0">
                                    <SelectValue placeholder="Add existing course..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableCourses.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {semesters.length > 0 ? (
                                <Select value={selectedSemesterId} onValueChange={setSelectedSemesterId}>
                                    <SelectTrigger className="w-full min-w-0">
                                        <SelectValue placeholder="Semester" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No semester</SelectItem>
                                        {semesters.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : null}
                            <Button type="button" onClick={handleAddCourse} disabled={!selectedCourseId} className="w-full">
                                <PlusCircle className="h-4 w-4 mr-1" /> Add
                            </Button>
                        </div>
                        <div className="max-h-52 space-y-3 overflow-y-auto pr-1">
                            {includedCourses.length > 0 ? groupedCourses.map((g) => (
                                <div key={g.id || 'none'} className="space-y-1.5">
                                    {g.name ? (
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g.name}</p>
                                    ) : null}
                                    <ul className="space-y-1.5">
                                        {g.courses.map((c) => (
                                            <li
                                                key={c.id}
                                                className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2.5"
                                            >
                                                <span className="truncate text-sm text-slate-100">{c.name}</span>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 shrink-0 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                                                    onClick={() => handleRemoveCourse(c.id)}
                                                    title="Remove from this diploma"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )) : (
                                <p className="text-xs text-slate-500 rounded-lg border border-dashed border-slate-800 px-3 py-4">
                                    No courses added yet
                                </p>
                            )}
                        </div>
                    </section>
                </div>
            ) : null}

            <p className="text-xs text-slate-500">Duration and fees are managed at the class level.</p>
            <DialogFooter className="sm:justify-end">
                <Button type="submit" className="w-full sm:w-auto">Save Diploma</Button>
            </DialogFooter>
        </form>
    );
};

const CourseForm = ({ course, closeDialog }: any) => {
    const [name, setName] = useState(course?.name || '');
    const [code, setCode] = useState(course?.code || '');
    const [description, setDescription] = useState(course?.description || '');
    const [type, setType] = useState(course?.type || 'regular');
    const [diplomaId, setDiplomaId] = useState(() => {
        if (course?.diploma_id) return course.diploma_id;
        if (!course?.id) return 'none';
        return 'none';
    });
    const [semesterId, setSemesterId] = useState('none');

    const {
        addCourse,
        updateCourseData,
        diplomas,
        courses,
        diplomaCourses = [],
        diplomaSemesters = [],
        assignCourseToDiploma,
        setDiplomaCourseSemester,
    } = useData();

    const diplomaSemestersForPick = useMemo(
        () => (diplomaId === 'none' ? [] : semestersForDiploma(diplomaSemesters, diplomaId)),
        [diplomaSemesters, diplomaId],
    );

    useEffect(() => {
        if (!course?.id || course.diploma_id) return;
        const first = diplomasForCourse(diplomas, diplomaCourses, course.id)[0];
        if (first) setDiplomaId(first.id);
    }, [course?.id, course?.diploma_id, diplomas, diplomaCourses]);

    useEffect(() => {
        if (!course?.id || diplomaId === 'none') {
            if (diplomaId === 'none') setSemesterId('none');
            return;
        }
        const link = (diplomaCourses || []).find(
            (dc) => dc.course_id === course.id && dc.diploma_id === diplomaId,
        );
        setSemesterId(link?.semester_id || 'none');
    }, [course?.id, diplomaId, diplomaCourses]);

    const handleDiplomaChange = (value) => {
        setDiplomaId(value);
        setSemesterId('none');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const duplicate = courses.find(c =>
            c.name.trim().toLowerCase() === name.trim().toLowerCase() &&
            c.id !== course?.id
        );

        if (duplicate) {
            notify.validation(MESSAGES.DUPLICATE.GENERIC.description);
            return;
        }

        try {
            const semester = semesterId === 'none' ? null : semesterId;
            const payload = {
                name: name.trim(),
                code,
                description,
                type,
                diploma_id: diplomaId === 'none' ? null : diplomaId,
                diploma_ids: diplomaId === 'none' ? [] : [diplomaId],
                semester_id: semester,
            };

            if (course) {
                await updateCourseData(course.id, {
                    name: payload.name,
                    code: payload.code,
                    description: payload.description,
                    type: payload.type,
                });
                if (diplomaId !== 'none') {
                    const linked = (diplomaCourses || []).some(
                        (dc) => dc.course_id === course.id && dc.diploma_id === diplomaId,
                    );
                    if (linked) {
                        await setDiplomaCourseSemester(diplomaId, course.id, semester);
                    } else {
                        await assignCourseToDiploma(diplomaId, course.id, semester);
                    }
                }
                notify.success(MESSAGES.SUCCESS.COURSE_UPDATED);
            } else {
                await addCourse(payload);
                notify.success(MESSAGES.SUCCESS.COURSE_CREATED);
            }
            closeDialog();
        } catch(error) {
            notify.error(error, { context: 'CoursesPage - saveCourse', fallback: MESSAGES.SAVE_FAILED });
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-4">
            <DialogHeader><DialogTitle>{course ? 'Edit Course' : 'Create New Course'}</DialogTitle></DialogHeader>
            <div className="flex min-w-0 flex-col gap-4">
                <div className="space-y-1.5 min-w-0">
                    <Label htmlFor="course-name">Course name</Label>
                    <Input id="course-name" value={name} onChange={e => setName(e.target.value)} className="w-full min-w-0" required />
                </div>
                <div className="space-y-1.5 min-w-0">
                    <Label htmlFor="course-code">Course code</Label>
                    <Input id="course-code" value={code} onChange={e => setCode(e.target.value)} className="w-full min-w-0" placeholder="e.g. CS101" />
                </div>
                <div className="space-y-1.5 min-w-0">
                    <Label>Type</Label>
                    <Select value={type} onValueChange={setType}>
                        <SelectTrigger className="w-full min-w-0"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="regular">Regular (In-Person/Online Class)</SelectItem>
                            <SelectItem value="outsource">Outsource (E-Learning/Self-Paced)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5 min-w-0">
                    <Label>Diploma</Label>
                    <Select value={diplomaId} onValueChange={handleDiplomaChange}>
                        <SelectTrigger className="w-full min-w-0"><SelectValue placeholder="Standalone (None)" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Standalone Course</SelectItem>
                            {diplomas.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                {diplomaSemestersForPick.length > 0 ? (
                    <div className="space-y-1.5 min-w-0">
                        <Label>Semester</Label>
                        <Select value={semesterId} onValueChange={setSemesterId}>
                            <SelectTrigger className="w-full min-w-0"><SelectValue placeholder="Choose semester" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No semester</SelectItem>
                                {diplomaSemestersForPick.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                ) : null}
                <div className="space-y-1.5 min-w-0">
                    <Label htmlFor="course-description">Description</Label>
                    <Textarea id="course-description" value={description} onChange={e => setDescription(e.target.value)} className="w-full min-w-0 min-h-[80px]" rows={3} />
                </div>
            </div>
            <DialogFooter><Button type="submit">Save Course</Button></DialogFooter>
        </form>
    );
};

/** Drag-and-drop reorder panel for diploma courses (no course codes). */
const ManageSequencePanel = ({ diploma, diplomas, courses, diplomaCourses, diplomaSemesters = [], onClose, onSaved }) => {
    const { reorderDiplomaCourses, setDiplomaCourseSemester } = useData();
    const [selectedDiplomaId, setSelectedDiplomaId] = useState(diploma?.id || '');
    const [ordered, setOrdered] = useState([]);
    const [dragIndex, setDragIndex] = useState(null);
    const [saving, setSaving] = useState(false);

    const selectedDiploma = useMemo(
        () => diplomas.find((d) => d.id === selectedDiplomaId) || null,
        [diplomas, selectedDiplomaId],
    );
    const semesterOptions = useMemo(
        () => semestersForDiploma(diplomaSemesters, selectedDiplomaId),
        [diplomaSemesters, selectedDiplomaId],
    );

    useEffect(() => {
        if (!selectedDiplomaId) {
            setOrdered([]);
            return;
        }
        setOrdered(coursesForDiploma(courses, diplomaCourses, selectedDiplomaId));
    }, [selectedDiplomaId, courses, diplomaCourses]);

    const moveItem = (from, to) => {
        if (from === to || from == null || to == null) return;
        setOrdered((prev) => {
            const next = [...prev];
            const [item] = next.splice(from, 1);
            next.splice(to, 0, item);
            return next;
        });
    };

    const handleDragStart = (index) => (e) => {
        setDragIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
    };

    const handleDragOver = (index) => (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragIndex === null || dragIndex === index) return;
        moveItem(dragIndex, index);
        setDragIndex(index);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragIndex(null);
    };

    const handleSave = async () => {
        if (!selectedDiplomaId || ordered.length === 0) return;
        setSaving(true);
        try {
            await reorderDiplomaCourses(selectedDiplomaId, ordered.map((c) => c.id));
            notify.success({ title: 'Sequence saved', description: 'Course order updated for this diploma.' });
            onSaved?.();
            onClose?.();
        } catch (error) {
            notify.error(error, { context: 'CoursesPage - reorderDiplomaCourses', fallback: MESSAGES.SAVE_FAILED });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <Select value={selectedDiplomaId} onValueChange={setSelectedDiplomaId}>
                    <SelectTrigger className="w-full sm:max-w-md bg-slate-950 border-slate-700 text-white">
                        <SelectValue placeholder="Select diploma..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-950 border-slate-800 text-slate-100">
                        {diplomas.map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <button
                    type="button"
                    className="text-sm text-blue-400 hover:text-blue-300 self-start sm:self-auto"
                    onClick={onClose}
                >
                    Clear Filter
                </button>
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-blue-950/30 p-4 flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
                <div className="min-w-0">
                    <h3 className="text-base font-semibold text-white">Drag and Drop to Reorder</h3>
                    <p className="text-sm text-slate-400 mt-1">
                        Reorder courses here to change how they appear in transcripts. Assign a semester so the transcript groups them.
                    </p>
                    <p className="text-xs text-blue-300/80 mt-2">
                        {ordered.length} course{ordered.length === 1 ? '' : 's'} assigned
                        {selectedDiploma?.name ? ` · ${selectedDiploma.name}` : ''}
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onClose}
                        className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                    >
                        <X className="h-4 w-4 mr-1.5" />
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        onClick={handleSave}
                        disabled={saving || ordered.length === 0}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                        Save Order
                    </Button>
                </div>
            </div>

            <div className="space-y-2" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
                {ordered.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 text-sm border border-dashed border-slate-800 rounded-xl">
                        No courses linked to this diploma yet.
                    </div>
                ) : (
                    ordered.map((course, index) => (
                        <div
                            key={course.id}
                            draggable
                            onDragStart={handleDragStart(index)}
                            onDragOver={handleDragOver(index)}
                            onDragEnd={() => setDragIndex(null)}
                            className={cn(
                                'flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-3 cursor-grab active:cursor-grabbing',
                                dragIndex === index && 'opacity-70 border-blue-500/50',
                            )}
                        >
                            <GripVertical className="h-5 w-5 text-slate-500 shrink-0" />
                            <div className="h-10 w-10 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-lg font-bold text-white shrink-0">
                                {index + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold text-white truncate">{course.name}</p>
                                <p className="text-xs text-slate-500 mt-0.5 capitalize">
                                    {course.type === 'outsource' ? 'E-Learning' : 'Regular'}
                                </p>
                            </div>
                            {semesterOptions.length > 0 ? (
                                <Select
                                    value={course.semester_id || 'none'}
                                    onValueChange={(v) => setDiplomaCourseSemester(selectedDiplomaId, course.id, v === 'none' ? null : v)}
                                >
                                    <SelectTrigger className="w-36 h-8 text-xs bg-slate-950 border-slate-700" onClick={(e) => e.stopPropagation()}>
                                        <SelectValue placeholder="Semester" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-950 border-slate-800 text-slate-100">
                                        <SelectItem value="none">No semester</SelectItem>
                                        {semesterOptions.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : null}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const CoursesPage = () => {
    const [isCourseOpen, setIsCourseOpen] = useState(false);
    const [isDiplomaOpen, setIsDiplomaOpen] = useState(false);
    const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [editingCourse, setEditingCourse] = useState(null);
    const [editingDiploma, setEditingDiploma] = useState(null);
    const [sequenceDiploma, setSequenceDiploma] = useState(null);
    const [isSequenceOpen, setIsSequenceOpen] = useState(false);

    const {
        courses,
        diplomas,
        diplomaCourses = [],
        diplomaSemesters = [],
        deleteDiplomaData,
        deleteCourse,
    } = useData();
    const { user } = useAuth();
    const canManagePrograms = user?.role === 'admin' || user?.role === 'staff';

    const handleDeleteClick = (type, id) => {
        if (!canManagePrograms) {
            notify.permission(MESSAGES.ACCESS.ADMIN_ONLY);
            return;
        }
        setItemToDelete({ type, id });
        setDeleteAlertOpen(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            if (itemToDelete.type === 'diploma') {
                await deleteDiplomaData(itemToDelete.id);
                notify.success(MESSAGES.SUCCESS.COURSE_DELETED);
            } else {
                await deleteCourse(itemToDelete.id);
                notify.success(MESSAGES.SUCCESS.COURSE_DELETED);
            }
        } catch (error) {
            notify.error(error, { context: 'CoursesPage - delete', fallback: MESSAGES.DELETE_FAILED });
        } finally {
            setDeleteAlertOpen(false);
            setItemToDelete(null);
        }
    };

    const handleEditCourse = (course) => {
        setEditingCourse(course);
        setIsCourseOpen(true);
    };

    const handleEditDiploma = (diploma) => {
        setEditingDiploma(diploma);
        setIsDiplomaOpen(true);
    };

    const openSequence = (diploma) => {
        setSequenceDiploma(diploma);
        setIsSequenceOpen(true);
    };

    return (
        <AnimatedPage>
            <Helmet><title>Courses & Diplomas - Portal</title></Helmet>
            
            <PageHeader title="Academic Programs" subtitle="Manage diplomas and individual courses.">
                {canManagePrograms && (
                    <div className="flex gap-2">
                         <Dialog open={isDiplomaOpen} onOpenChange={(open) => { setIsDiplomaOpen(open); if(!open) setEditingDiploma(null); }}>
                            <DialogTrigger asChild><Button variant="outline"><GraduationCap className="mr-2 h-4 w-4" /> Create Diploma</Button></DialogTrigger>
                            <DialogContent className="flex min-w-0 flex-col sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                                <DiplomaForm key={editingDiploma?.id || 'new'} diploma={editingDiploma} closeDialog={() => setIsDiplomaOpen(false)} />
                            </DialogContent>
                        </Dialog>
                        <Dialog open={isCourseOpen} onOpenChange={(open) => { setIsCourseOpen(open); if(!open) setEditingCourse(null); }}>
                            <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" /> Create Course</Button></DialogTrigger>
                            <DialogContent className="flex min-w-0 flex-col sm:max-w-lg max-h-[90vh] overflow-y-auto"><CourseForm course={editingCourse} closeDialog={() => setIsCourseOpen(false)} /></DialogContent>
                        </Dialog>
                    </div>
                )}
            </PageHeader>
            
            <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the {itemToDelete?.type} 
                            {itemToDelete?.type === 'diploma' ? ' and decouple all linked courses' : ''}.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog
                open={isSequenceOpen}
                onOpenChange={(open) => {
                    setIsSequenceOpen(open);
                    if (!open) setSequenceDiploma(null);
                }}
            >
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-950 border-slate-800 text-slate-100">
                    <DialogHeader>
                        <DialogTitle>Manage Sequence</DialogTitle>
                    </DialogHeader>
                    {isSequenceOpen ? (
                        <ManageSequencePanel
                            diploma={sequenceDiploma}
                            diplomas={diplomas}
                            courses={courses}
                            diplomaCourses={diplomaCourses}
                            diplomaSemesters={diplomaSemesters}
                            onClose={() => setIsSequenceOpen(false)}
                            onSaved={() => {}}
                        />
                    ) : null}
                </DialogContent>
            </Dialog>

            <Tabs defaultValue="courses" className="mt-6">
                <TabsList className="bg-slate-900/80 border border-slate-800 p-1 h-auto">
                    <TabsTrigger
                        value="diplomas"
                        className="data-[state=active]:bg-slate-950 data-[state=active]:text-white text-slate-400"
                    >
                        Diplomas
                    </TabsTrigger>
                    <TabsTrigger
                        value="courses"
                        className="data-[state=active]:bg-slate-950 data-[state=active]:text-white text-slate-400"
                    >
                        All Courses
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="diplomas" className="mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {diplomas.map((diploma, index) => {
                            const diplomaCourseList = coursesForDiploma(courses, diplomaCourses, diploma.id);
                            const diplomaSems = semestersForDiploma(diplomaSemesters, diploma.id);
                            const grouped = groupCoursesBySemester(diplomaCourseList, diplomaSems);
                            return (
                                <motion.div key={diploma.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                                    <Card className="flex flex-col h-full bg-slate-900/50 border-slate-800 hover:border-primary/50 transition-colors">
                                        <CardHeader>
                                            <CardTitle className="flex justify-between items-start gap-2">
                                                <span className="leading-snug">{diploma.name}</span>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600/90 text-[11px] font-bold text-white px-1.5">
                                                        {diplomaCourseList.length}
                                                    </span>
                                                    {canManagePrograms && (
                                                        <>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-400 hover:text-blue-300" onClick={() => handleEditDiploma(diploma)}><Edit className="h-3 w-3" /></Button>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:bg-red-400/10" onClick={() => handleDeleteClick('diploma', diploma.id)}><Trash2 className="h-3 w-3" /></Button>
                                                        </>
                                                    )}
                                                </div>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="flex-grow space-y-4">
                                            <div className="bg-slate-950/50 p-3 rounded-lg text-sm border border-slate-800/80">
                                                <div className="font-medium text-slate-300 mb-2 flex items-center justify-between gap-2">
                                                    <span className="flex items-center">
                                                        <BookOpen className="mr-2 h-3.5 w-3.5"/> Included Courses
                                                    </span>
                                                    {canManagePrograms && diplomaCourseList.length > 0 ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => openSequence(diploma)}
                                                            className="text-xs font-medium text-blue-400 hover:text-blue-300"
                                                        >
                                                            Manage Sequence
                                                        </button>
                                                    ) : null}
                                                </div>
                                                <div className="space-y-3 max-h-[180px] overflow-y-auto text-xs">
                                                    {diplomaCourseList.length > 0 ? grouped.map((g) => (
                                                        <div key={g.id || 'none'}>
                                                            {g.name ? (
                                                                <p className="font-semibold text-slate-200 mb-1">{g.name}</p>
                                                            ) : null}
                                                            <ul className="list-disc list-inside text-slate-400 space-y-1">
                                                                {g.courses.map((c) => (
                                                                    <li key={c.id} className="truncate">{c.name}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )) : (
                                                        <p className="text-slate-500">No courses added yet</p>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            );
                        })}
                        {diplomas.length === 0 && <div className="col-span-full text-center py-10 text-slate-500">No diplomas found.</div>}
                    </div>
                </TabsContent>

                <TabsContent value="courses" className="mt-4">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {courses.map((course, index) => {
                            const linkedDiplomas = diplomasForCourse(diplomas, diplomaCourses, course);
                            const diplomaCount = linkedDiplomas.length;
                            const isElearning = course.type === 'outsource';
                            return (
                            <motion.div key={course.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
                                <Card className="flex flex-col h-full bg-slate-950 border-slate-800/90 rounded-2xl shadow-sm overflow-hidden">
                                    <CardHeader className="pb-3 space-y-3">
                                        <div className="flex justify-between items-start gap-3">
                                            <CardTitle className="text-lg font-bold text-white leading-snug pr-1">
                                                {course.name}
                                            </CardTitle>
                                            {canManagePrograms && (
                                                <div className="flex gap-1.5 shrink-0">
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-lg border-blue-500/40 bg-transparent text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                                                        onClick={() => handleEditCourse(course)}
                                                    >
                                                        <Edit className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-lg border-red-500/40 bg-transparent text-red-400 hover:bg-red-500/10 hover:text-red-300"
                                                        onClick={() => handleDeleteClick('course', course.id)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className="w-fit rounded-full border-slate-700 bg-slate-900/80 text-slate-200 font-normal px-2.5 py-0.5"
                                        >
                                            {isElearning ? (
                                                <><MonitorPlay className="w-3 h-3 mr-1.5" /> E-Learning</>
                                            ) : (
                                                <><Building2 className="w-3 h-3 mr-1.5" /> Regular</>
                                            )}
                                        </Badge>
                                    </CardHeader>
                                    <CardContent className="pt-0 flex-grow flex flex-col">
                                        <div className="border-t border-slate-800/90 pt-3 mt-auto space-y-2.5">
                                            <p className="text-xs text-slate-500">
                                                Assigned to {diplomaCount} diploma{diplomaCount === 1 ? '' : 's'}
                                            </p>
                                            {linkedDiplomas.length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {linkedDiplomas.map((d) => (
                                                        <span
                                                            key={d.id}
                                                            className="inline-flex max-w-full items-center rounded-full border border-blue-500/50 bg-blue-950/40 px-3 py-1 text-sm font-medium text-blue-400 truncate"
                                                        >
                                                            {d.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-sm text-slate-500">
                                                    Standalone
                                                </span>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                            );
                        })}
                        {courses.length === 0 && <div className="col-span-full text-center py-10 text-slate-500">No courses found.</div>}
                     </div>
                </TabsContent>
            </Tabs>
        </AnimatedPage>
    );
};

export default CoursesPage;
