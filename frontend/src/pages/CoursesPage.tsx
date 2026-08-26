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

const sortDiplomaCourses = (list = []) =>
  [...list].sort((a, b) => {
    const ao = Number(a?.sort_order ?? 0);
    const bo = Number(b?.sort_order ?? 0);
    if (ao !== bo) return ao - bo;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });

const DiplomaForm = ({ diploma, onSave, closeDialog }: any) => {
    const [name, setName] = useState(diploma?.name || '');
    const [description, setDescription] = useState(diploma?.description || '');
    const { addDiploma, updateDiplomaData, diplomas } = useData();

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
            const data = { name: name.trim(), description };
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

    return (
        <form onSubmit={handleSubmit}>
            <DialogHeader><DialogTitle>{diploma ? 'Edit Diploma' : 'Create New Diploma'}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-left sm:text-right">Name</Label>
                    <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" required />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-left sm:text-right">Description</Label>
                    <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} className="col-span-3" />
                </div>
                <div className="col-span-4 text-xs text-muted-foreground text-center">* Duration and fees are now managed at the Class level.</div>
            </div>
            <DialogFooter><Button type="submit">Save Diploma</Button></DialogFooter>
        </form>
    );
};

const CourseForm = ({ course, closeDialog }: any) => {
    const [name, setName] = useState(course?.name || '');
    const [code, setCode] = useState(course?.code || '');
    const [description, setDescription] = useState(course?.description || '');
    const [type, setType] = useState(course?.type || 'regular');
    const [diplomaId, setDiplomaId] = useState(course?.diploma_id || 'none');
    
    const { addCourse, updateCourseData, diplomas, courses } = useData(); 

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
            const data = { 
                name: name.trim(), 
                code, 
                description, 
                type, 
                diploma_id: diplomaId === 'none' ? null : diplomaId 
            };
            
            if (course) {
                await updateCourseData(course.id, data);
                notify.success(MESSAGES.SUCCESS.COURSE_UPDATED);
            } else {
                await addCourse(data);
                notify.success(MESSAGES.SUCCESS.COURSE_CREATED);
            }
            closeDialog();
        } catch(error) {
            notify.error(error, { context: 'CoursesPage - saveCourse', fallback: MESSAGES.SAVE_FAILED });
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <DialogHeader><DialogTitle>{course ? 'Edit Course' : 'Create New Course'}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-left sm:text-right">Course Name</Label>
                    <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" required />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                    <Label htmlFor="code" className="text-left sm:text-right">Course Code</Label>
                    <Input id="code" value={code} onChange={e => setCode(e.target.value)} className="col-span-3" placeholder="e.g. CS101" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                    <Label htmlFor="type" className="text-left sm:text-right">Type</Label>
                    <Select value={type} onValueChange={setType}>
                        <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="regular">Regular (In-Person/Online Class)</SelectItem>
                            <SelectItem value="outsource">Outsource (E-Learning/Self-Paced)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                    <Label htmlFor="diploma" className="text-left sm:text-right">Diploma</Label>
                    <Select value={diplomaId} onValueChange={setDiplomaId}>
                        <SelectTrigger className="col-span-3"><SelectValue placeholder="Standalone (None)" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Standalone Course</SelectItem>
                            {diplomas.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-left sm:text-right">Description</Label>
                    <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} className="col-span-3" />
                </div>
            </div>
            <DialogFooter><Button type="submit">Save Course</Button></DialogFooter>
        </form>
    );
};

/** Drag-and-drop reorder panel for diploma courses (no course codes). */
const ManageSequencePanel = ({ diploma, diplomas, courses, onClose, onSaved }) => {
    const { reorderDiplomaCourses } = useData();
    const [selectedDiplomaId, setSelectedDiplomaId] = useState(diploma?.id || '');
    const [ordered, setOrdered] = useState([]);
    const [dragIndex, setDragIndex] = useState(null);
    const [saving, setSaving] = useState(false);

    const selectedDiploma = useMemo(
        () => diplomas.find((d) => d.id === selectedDiplomaId) || null,
        [diplomas, selectedDiplomaId],
    );

    useEffect(() => {
        if (!selectedDiplomaId) {
            setOrdered([]);
            return;
        }
        const list = sortDiplomaCourses(courses.filter((c) => c.diploma_id === selectedDiplomaId));
        setOrdered(list);
    }, [selectedDiplomaId, courses]);

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
                        Reorder courses here to change how they appear in transcripts and reports for this diploma.
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

    const { courses, diplomas, deleteDiplomaData, deleteCourse } = useData();
    const { user } = useAuth();
    const canManagePrograms = user?.role === 'admin' || user?.role === 'staff';

    const diplomaNameById = useMemo(() => {
        const map = new Map();
        diplomas.forEach((d) => map.set(d.id, d.name));
        return map;
    }, [diplomas]);

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
                            <DialogContent className="sm:max-w-[500px]"><DiplomaForm diploma={editingDiploma} closeDialog={() => setIsDiplomaOpen(false)} /></DialogContent>
                        </Dialog>
                        <Dialog open={isCourseOpen} onOpenChange={(open) => { setIsCourseOpen(open); if(!open) setEditingCourse(null); }}>
                            <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4" /> Create Course</Button></DialogTrigger>
                            <DialogContent className="sm:max-w-[500px]"><CourseForm course={editingCourse} closeDialog={() => setIsCourseOpen(false)} /></DialogContent>
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
                            const diplomaCourses = sortDiplomaCourses(
                                courses.filter((c) => c.diploma_id === diploma.id),
                            );
                            return (
                                <motion.div key={diploma.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                                    <Card className="flex flex-col h-full bg-slate-900/50 border-slate-800 hover:border-primary/50 transition-colors">
                                        <CardHeader>
                                            <CardTitle className="flex justify-between items-start gap-2">
                                                <span className="leading-snug">{diploma.name}</span>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600/90 text-[11px] font-bold text-white px-1.5">
                                                        {diplomaCourses.length}
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
                                            {diploma.description && <p className="text-xs text-slate-400">{diploma.description}</p>}
                                            <div className="bg-slate-950/50 p-3 rounded-lg text-sm border border-slate-800/80">
                                                <div className="font-medium text-slate-300 mb-2 flex items-center justify-between gap-2">
                                                    <span className="flex items-center">
                                                        <BookOpen className="mr-2 h-3.5 w-3.5"/> Included Courses
                                                    </span>
                                                    {canManagePrograms && diplomaCourses.length > 0 ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => openSequence(diploma)}
                                                            className="text-xs font-medium text-blue-400 hover:text-blue-300"
                                                        >
                                                            Manage Sequence
                                                        </button>
                                                    ) : null}
                                                </div>
                                                <ul className="list-disc list-inside text-slate-400 space-y-1 max-h-[150px] overflow-y-auto text-xs">
                                                    {diplomaCourses.length > 0
                                                        ? diplomaCourses.map((c) => (
                                                            <li key={c.id} className="truncate">{c.name}</li>
                                                          ))
                                                        : <li>No courses added yet</li>}
                                                </ul>
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
                            const diplomaName = course.diploma?.name || diplomaNameById.get(course.diploma_id);
                            const diplomaCount = diplomaName ? 1 : 0;
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
                                            {diplomaName ? (
                                                <span className="inline-flex max-w-full items-center rounded-full border border-blue-500/50 bg-blue-950/40 px-3 py-1 text-sm font-medium text-blue-400 truncate">
                                                    {diplomaName}
                                                </span>
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
