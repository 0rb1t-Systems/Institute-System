import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, ScanLine, CheckCircle2, XCircle, Printer, FileDown, User, RefreshCw } from 'lucide-react';
import Logo from '@/components/Logo';
import QRCode from 'react-qr-code';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { verifyTranscriptCredential } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import {
  getInstitutionDisplayName,
  getInstitutionContactLine,
  getVerificationUrl,
  getTranscriptFooterText,
  getTranscriptNarrativeText,
  resolveDocumentBranding,
  getInstitutionPrimary,
  getSignatoryLeftName,
  getSignatoryLeftTitle,
  getSignatoryRightName,
  getSignatoryRightTitle,
  sanitizeCourseProject,
} from '@/lib/institution';
import { getDocumentTemplate } from '@/lib/api';
import {
  normalizeTranscriptLayoutKey,
  libraryTranscriptLayoutKey,
  isCustomTranscriptLayout,
  getTranscriptLayoutChrome,
  getTranscriptLayoutStyles,
  type TranscriptLayoutKey,
} from '@/lib/transcriptTemplates';
import {
  hydrateDocumentDesignFromTemplate,
  type HydratedDocumentDesign,
} from '@/lib/documentDesign';
import {
  downloadDesignPDF,
  printDesignPDF,
  downloadDomPagesPdf,
  printDomPagesPdf,
} from '@/lib/documentPdf';
import CertificateDesignRenderer from '@/components/certificates/CertificateDesignRenderer';
import type { CertificateRenderData } from '@/lib/certificateTemplates';
import {
  formatClassificationRange,
  getGradePointsFromScale,
  getInstitutionGradeScale,
  getLetterGradeFromScale,
  isCoursePassedFromScale,
} from '@/lib/gradingScale';
import { coursesForClass, coursesForDiploma, groupTranscriptRowsBySemester, semestersForDiploma } from '@/lib/diplomaCourses';
import { formatMonthYear } from '@/lib/utils';

function sameId(a, b) {
  if (a == null || b == null || a === '' || b === '') return false;
  return String(a) === String(b);
}

function transcriptForClass(transcripts, studentId, classId, enrollmentId) {
  const rows = (transcripts || []).filter((t) => {
    if (!t || t.status === 'revoked') return false;
    if (!sameId(t.student_id, studentId)) return false;
    if (t.class_id && !sameId(t.class_id, classId)) return false;
    if (sameId(t.class_id, classId)) return true;
    if (!t.class_id && enrollmentId && sameId(t.enrollment_id, enrollmentId)) return true;
    return false;
  });
  return rows.sort(
    (a, b) => Number(new Date(b.issued_at || 0)) - Number(new Date(a.issued_at || 0)),
  )[0] || null;
}

type TranscriptGroupPage = {
  key: string;
  name: string | null;
  rows: any[];
};

type TranscriptFlatItem =
  | { kind: 'header'; key: string; name: string }
  | { kind: 'row'; key: string; name: string | null; row: any };

/** Estimated vertical weight so long grade tables can spill onto extra A4 pages. */
function transcriptItemUnits(item: TranscriptFlatItem): number {
  if (item.kind === 'header') return 0.7;
  return item.row?.courseProject ? 1.35 : 1;
}

function flattenTranscriptGroups(groups: TranscriptGroupPage[]): TranscriptFlatItem[] {
  const items: TranscriptFlatItem[] = [];
  for (const group of groups || []) {
    if (group.name) items.push({ kind: 'header', key: group.key, name: group.name });
    for (const row of group.rows || []) {
      items.push({ kind: 'row', key: group.key, name: group.name, row });
    }
  }
  return items;
}

function flatItemsToGroups(items: TranscriptFlatItem[]): TranscriptGroupPage[] {
  const groups: TranscriptGroupPage[] = [];
  const map = new Map<string, TranscriptGroupPage>();
  for (const item of items) {
    let group = map.get(item.key);
    if (!group) {
      group = { key: item.key, name: item.kind === 'header' ? item.name : item.name, rows: [] };
      map.set(item.key, group);
      groups.push(group);
    } else if (item.kind === 'header' && item.name) {
      group.name = item.name;
    }
    if (item.kind === 'row') group.rows.push(item.row);
  }
  return groups;
}

function takeTranscriptItems(items: TranscriptFlatItem[], maxUnits: number) {
  const page: TranscriptFlatItem[] = [];
  let units = 0;
  let index = 0;
  while (index < items.length) {
    const next = items[index];
    const weight = transcriptItemUnits(next);
    if (page.length > 0 && units + weight > maxUnits) break;
    page.push(next);
    units += weight;
    index += 1;
  }
  return { page, rest: items.slice(index) };
}

/**
 * Split semester groups across A4 pages so signatures + QR stay visible on the last page.
 * Capacities are conservative row-units that leave room for header / footer chrome.
 */
function paginateTranscriptGroups(
  groups: TranscriptGroupPage[],
  opts: {
    firstWithFooter: number;
    firstContinue: number;
    continuePage: number;
    lastWithFooter: number;
  },
): TranscriptGroupPage[][] {
  const items = flattenTranscriptGroups(groups);
  if (!items.length) return [[]];

  const totalUnits = items.reduce((sum, item) => sum + transcriptItemUnits(item), 0);
  if (totalUnits <= opts.firstWithFooter) {
    return [flatItemsToGroups(items)];
  }

  const pages: TranscriptFlatItem[][] = [];
  let remaining = items;

  const first = takeTranscriptItems(remaining, opts.firstContinue);
  pages.push(first.page);
  remaining = first.rest;

  while (remaining.length) {
    const restUnits = remaining.reduce((sum, item) => sum + transcriptItemUnits(item), 0);
    if (restUnits <= opts.lastWithFooter) {
      pages.push(remaining);
      break;
    }
    const chunk = takeTranscriptItems(remaining, opts.continuePage);
    if (!chunk.page.length) {
      pages.push(remaining);
      break;
    }
    // Ensure the final leftover still fits with footer room.
    const afterUnits = chunk.rest.reduce((sum, item) => sum + transcriptItemUnits(item), 0);
    if (chunk.rest.length && afterUnits <= opts.lastWithFooter) {
      pages.push(chunk.page);
      pages.push(chunk.rest);
      break;
    }
    pages.push(chunk.page);
    remaining = chunk.rest;
  }

  return pages.map(flatItemsToGroups);
}

function collectTranscriptPdfPages(): HTMLElement[] {
  const academic = Array.from(
    document.querySelectorAll<HTMLElement>('[data-transcript-academic-page]'),
  );
  const gradingKey = document.getElementById('transcript-grading-key');
  return [...academic, gradingKey].filter(Boolean) as HTMLElement[];
}

const TranscriptView = ({ studentId, onClose, initialClassId }: any) => {
    const { user, institution } = useAuth();
    const gradeScale = useMemo(() => getInstitutionGradeScale(institution), [institution]);
    const {
      students,
      results,
      courses,
      enrollments,
      classes,
      classCourses,
      diplomaCourses = [],
      diplomaSemesters = [],
      exams,
      diplomas,
      gradebookEntries = [],
      transcripts = [],
    } = useData();
    const [selectedClassId, setSelectedClassId] = useState(initialClassId || null);
    const [showScanner, setShowScanner] = useState(false);
    const [liveLayoutKey, setLiveLayoutKey] = useState<TranscriptLayoutKey>('classic');
    const [customDesign, setCustomDesign] = useState<HydratedDocumentDesign | null>(null);
    const navigate = useNavigate();
    
    // Scanner States
    const [verificationStatus, setVerificationStatus] = useState('idle'); // idle, scanning, verifying, valid, invalid, error
    const [verifiedData, setVerifiedData] = useState(null);
    const [isDownloading, setIsDownloading] = useState(false);
    
    const scannerRef = useRef(null);

    // Admin/staff, or the student viewing their own transcript
    const canDownload =
      ['admin', 'staff'].includes(user?.role) ||
      (user?.role === 'student' &&
        !!studentId &&
        (user.studentId === studentId || user.id === studentId));

    const studentData = useMemo(() => students.find(s => s.id === studentId), [students, studentId]);

    // Calculate Credential Number from student code digits (no hardcoded brand prefix)
    const credentialNumber = useMemo(() => {
        if (!studentData?.student_code) return '0000001';
        const match = String(studentData.student_code).match(/\d+/);
        const sequence = match ? parseInt(match[0], 10) : 1;
        return Math.max(sequence, 1).toString().padStart(7, '0');
    }, [studentData]);

    // Get all classes the student is enrolled in
    const studentClasses = useMemo(() => {
        if (!studentData) return [];
        return enrollments
            .filter((e) => sameId(e.student_id, studentData.id))
            .map((e) => classes.find((c) => sameId(c.id, e.class_id)))
            .filter(Boolean)
            .filter((c, i, arr) => arr.findIndex((x) => sameId(x.id, c.id)) === i)
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    }, [studentData, enrollments, classes]);

    useEffect(() => {
        setSelectedClassId(initialClassId || null);
    }, [studentId, initialClassId]);

    useEffect(() => {
        if (!studentData?.id) {
            setSelectedClassId(null);
            return;
        }
        const ids = new Set(studentClasses.map((c) => String(c.id)));
        if (selectedClassId && ids.has(String(selectedClassId))) return;
        if (initialClassId && ids.has(String(initialClassId))) {
            setSelectedClassId(initialClassId);
            return;
        }
        setSelectedClassId(studentClasses[0]?.id || null);
    }, [studentData?.id, studentClasses, selectedClassId, initialClassId]);

    // Fetch Diploma/Program Info
    const currentClass = useMemo(() => classes.find(c => c.id === selectedClassId), [classes, selectedClassId]);
    const currentDiploma = useMemo(() => currentClass?.diploma_id ? diplomas.find(d => d.id === currentClass.diploma_id) : null, [currentClass, diplomas]);
    const programName = useMemo(() => {
      if (currentDiploma?.name) return currentDiploma.name;
      const linked = coursesForClass(currentClass, courses, classCourses, diplomaCourses);
      if (linked.length === 1 && linked[0]?.name) return linked[0].name;
      const primaryCourse = currentClass?.course_id
        ? courses.find((c) => c.id === currentClass.course_id)
        : null;
      if (primaryCourse?.name) return primaryCourse.name;
      return 'Academic Record';
    }, [currentDiploma, currentClass, courses, classCourses, diplomaCourses]);

    const programMonths = useMemo(() => {
      const enrollment = enrollments.find(
        (e) => e.student_id === studentData?.id && e.class_id === selectedClassId,
      );
      const startRaw =
        currentClass?.start_date || enrollment?.enrollment_date || enrollment?.created_at || null;
      const endRaw = currentClass?.end_date || null;
      return {
        startMonth: formatMonthYear(startRaw) || '—',
        completionMonth: formatMonthYear(endRaw) || '—',
      };
    }, [currentClass, enrollments, studentData?.id, selectedClassId]);

    // Scanner Logic
    useEffect(() => {
        if (showScanner && verificationStatus === 'idle') {
            // Small delay to ensure DOM is ready
            const timeoutId = setTimeout(() => {
                // Prevent duplicate initialization
                if (scannerRef.current) return;

                const scanner = new Html5QrcodeScanner(
                    "reader",
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    false
                );
                
                scanner.render(onScanSuccess, onScanFailure);
                scannerRef.current = scanner;
            }, 100);

            return () => {
                clearTimeout(timeoutId);
                cleanupScanner();
            };
        }
    }, [showScanner, verificationStatus]);

    const cleanupScanner = () => {
        if (scannerRef.current) {
            try {
                scannerRef.current.clear().catch(err => console.error("Failed to clear scanner", err));
            } catch (e) {
                console.error("Scanner cleanup error", e);
            }
            scannerRef.current = null;
        }
    };

    const onScanSuccess = async (decodedText) => {
        cleanupScanner();
        setVerificationStatus('verifying');

        try {
            // Extract ID from URL if necessary
            let idToVerify = decodedText;
            if (decodedText.includes('/verify/')) {
                const parts = decodedText.split('/verify/');
                if (parts.length > 1) {
                    idToVerify = parts[1];
                }
            }

            // Perform system lookup using NEW dedicated function
            const result = await verifyTranscriptCredential(idToVerify);
            
            if (result && (result.valid || (result.data && result.data.valid))) {
                setVerifiedData(result.data || result);
                setVerificationStatus('valid');
            } else {
                setVerificationStatus('invalid');
            }
        } catch (error) {
            console.error("Verification failed:", error);
            setVerificationStatus('error');
        }
    };

    const onScanFailure = (error) => {
        // console.warn(`Code scan error = ${error}`);
    };

    const resetScanner = () => {
        setVerificationStatus('idle');
        setVerifiedData(null);
    };

    const transcriptData = useMemo(() => {
        if (!studentData || !selectedClassId) return [];

        if (!currentClass) return [];

        let relevantCourses = [];

        // 1. Identify all courses related to this class/program
        if (currentClass.diploma_id) {
            relevantCourses = coursesForDiploma(courses, diplomaCourses, currentClass.diploma_id);
        } else if (currentClass.course_id) {
            const c = courses.find(course => course.id === currentClass.course_id);
            if (c) relevantCourses = [c];
        }

        // 2. Check Many-to-Many relationships
        const linkedCourses = classCourses
            .filter(cc => cc.class_id === currentClass.id)
            .map(cc => courses.find(c => c.id === cc.course_id))
            .filter(Boolean);
            
        relevantCourses = [...relevantCourses, ...linkedCourses]
            .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

        // 3. Map Courses to Grades — prefer finalized gradebook / transcript entries
        const gradebook = Array.isArray(gradebookEntries) ? gradebookEntries : [];
        const classEnrollment = enrollments.find(
          (e) => sameId(e.student_id, studentData.id) && sameId(e.class_id, selectedClassId),
        );
        const studentTranscript = transcriptForClass(
          transcripts,
          studentData.id,
          selectedClassId,
          classEnrollment?.id,
        );
        const transcriptRows = studentTranscript?.entries || studentTranscript?.transcript_entries || [];

        return relevantCourses.map(course => {
            const gb = gradebook.find(
              (g) =>
                sameId(g.student_id, studentData.id) &&
                sameId(g.course_id, course.id) &&
                sameId(g.class_id, selectedClassId)
            );
            const te = transcriptRows.find((t) => sameId(t.course_id, course.id));

            const relevantExams = exams.filter(
              (e) => sameId(e.class_id, selectedClassId) && sameId(e.course_id, course.id),
            );
            
            const studentResults = results.filter(r => 
                sameId(r.student_id, studentData.id) && 
                relevantExams.some(e => sameId(e.id, r.exam_id))
            );
            const bestResult = studentResults.sort((a, b) => (b.score || 0) - (a.score || 0))[0];
            const examDetails = bestResult ? exams.find(e => e.id === bestResult.exam_id) : (relevantExams[0] || null);
            
            let marks = null;
            let percentageValue = 0;
            let status = 'Pending'; 
            let grade = '-';
            let displayPercentage = '-';

            // Prefer gradebook final (exam + assignment bonus), then live exam, then transcript entry
            if (gb && gb.final_mark != null) {
                marks = Number(gb.final_mark);
                percentageValue = marks;
                displayPercentage = `${Math.round(percentageValue)}%`;
                grade = gb.letter_grade || getLetterGradeFromScale(percentageValue, gradeScale);
                status = isCoursePassedFromScale(percentageValue, gradeScale) ? 'Pass' : 'Fail';
            } else if (bestResult && bestResult.score !== null) {
                marks = bestResult.score;
                const total = examDetails?.total_marks || examDetails?.final_marks || bestResult.total_marks || 100;
                percentageValue = (Number(marks) / Number(total)) * 100;
                displayPercentage = `${Math.round(percentageValue)}%`;
                grade = getLetterGradeFromScale(percentageValue, gradeScale);
                status = isCoursePassedFromScale(percentageValue, gradeScale) ? 'Pass' : 'Fail';
            } else if (te && te.mark != null) {
                marks = Number(te.mark);
                percentageValue = marks;
                displayPercentage = `${Math.round(percentageValue)}%`;
                grade = te.grade || getLetterGradeFromScale(percentageValue, gradeScale);
                status = isCoursePassedFromScale(percentageValue, gradeScale) ? 'Pass' : 'Fail';
            }

            const liveSemesters = currentClass?.diploma_id
              ? semestersForDiploma(diplomaSemesters, currentClass.diploma_id)
              : [];
            const liveSem = liveSemesters.find((s) => s.id === course.semester_id);
            const semesterName = (te?.semester_name && String(te.semester_name).trim()) || liveSem?.name || null;
            const semesterSort =
              te?.semester_sort != null && te.semester_sort !== ''
                ? Number(te.semester_sort)
                : liveSem
                  ? Number(liveSem.sort_order ?? 0)
                  : 9999;

            const courseProject = sanitizeCourseProject(
              te?.course_project || bestResult?.course_project || '',
            );

            return {
                id: course.id,
                code: course.code || `CRS-${course.id.substring(0,4).toUpperCase()}`,
                name: course.name,
                courseProject,
                examName: examDetails?.title || 'Course Exam',
                marks: marks,
                totalMarks: examDetails?.total_marks || 100,
                percentage: displayPercentage,
                percentageValue: percentageValue,
                grade: grade,
                status: status,
                credits: course.credits || 3,
                date: bestResult ? new Date(bestResult.submission_date || bestResult.graded_at || Date.now()).toLocaleDateString() : '-',
                semester_name: semesterName,
                semester_sort: semesterSort,
            };
        });
    }, [studentData, selectedClassId, classes, courses, results, classCourses, diplomaCourses, diplomaSemesters, exams, currentClass, gradebookEntries, transcripts, gradeScale, enrollments]);

    const stats = useMemo(() => {
        const graded = transcriptData.filter(t => t.marks !== null);
        const passed = transcriptData.filter(t => t.status === 'Pass').length;
        const failed = transcriptData.filter(t => t.status === 'Fail').length;
        
        let totalPoints = 0;
        graded.forEach(t => {
            totalPoints += getGradePointsFromScale(t.percentageValue, gradeScale);
        });
        
        const gpa = graded.length > 0 ? (totalPoints / graded.length).toFixed(2) : "0.00";
        return { total: transcriptData.length, passed, failed, gpa };
    }, [transcriptData, gradeScale]);

    const transcriptGroups = useMemo(
      () => groupTranscriptRowsBySemester(transcriptData),
      [transcriptData],
    );

    const issuedTranscript = useMemo(() => {
      if (!studentData?.id || !selectedClassId) return null;
      const enrollment = enrollments.find(
        (e) => sameId(e.student_id, studentData.id) && sameId(e.class_id, selectedClassId),
      );
      return transcriptForClass(transcripts, studentData.id, selectedClassId, enrollment?.id);
    }, [studentData, selectedClassId, enrollments, transcripts]);

    const brand = resolveDocumentBranding(institution, issuedTranscript?.template_snapshot);
    const verifyCode = String(issuedTranscript?.verification_code || '').trim();
    const verifyUrl = verifyCode
      ? getVerificationUrl(verifyCode, brand, 'verify')
      : '';
    const institutionName = getInstitutionDisplayName(brand);
    const contactLine = getInstitutionContactLine(brand);
    const transcriptFooter = getTranscriptFooterText(brand);
    const transcriptNarrative = getTranscriptNarrativeText(brand, currentDiploma, currentClass);
    const primary = getInstitutionPrimary(brand);

    // Live institution template (Page Builder / Upload Own activate immediately, like certificates)
    useEffect(() => {
      let cancelled = false;
      ;(async () => {
        try {
          const tpl = await getDocumentTemplate('transcript');
          if (cancelled) return;
          const key = normalizeTranscriptLayoutKey(tpl?.layout_key);
          setLiveLayoutKey(key);
          if (isCustomTranscriptLayout(key)) {
            const hydrated = await hydrateDocumentDesignFromTemplate(tpl, 'transcript');
            if (!cancelled) setCustomDesign(hydrated);
          } else {
            setCustomDesign(null);
          }
        } catch {
          if (!cancelled) {
            setLiveLayoutKey('classic');
            setCustomDesign(null);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [institution?.id, issuedTranscript?.id]);

    const useCustomLayout = isCustomTranscriptLayout(liveLayoutKey);
    const layoutKey = libraryTranscriptLayoutKey(liveLayoutKey);
    const chrome = getTranscriptLayoutChrome(layoutKey, primary);
    const layoutStyles = getTranscriptLayoutStyles(layoutKey, primary);
    const showNarrative = !!transcriptNarrative;

    const transcriptPages = useMemo(() => {
      const capacities =
        layoutKey === 'compact'
          ? { firstWithFooter: 12, firstContinue: 18, continuePage: 28, lastWithFooter: 18 }
          : showNarrative
            ? { firstWithFooter: 8, firstContinue: 13, continuePage: 24, lastWithFooter: 14 }
            : { firstWithFooter: 10, firstContinue: 15, continuePage: 26, lastWithFooter: 16 };
      return paginateTranscriptGroups(transcriptGroups, capacities);
    }, [transcriptGroups, layoutKey, showNarrative]);

    const gradesSummary = useMemo(
      () =>
        transcriptGroups
          .map((g) => {
            const head = g.name ? `${g.name}\n` : '';
            const lines = g.rows
              .map((t) => {
                const project = t.courseProject ? `  Course Project: ${t.courseProject}` : '';
                return `${t.code}  ${t.name}${project}  ${t.percentage ?? '-'}  ${t.grade}`;
              })
              .join('\n');
            return `${head}${lines}`;
          })
          .join('\n\n'),
      [transcriptGroups],
    );

    const customRenderData: CertificateRenderData | null = useMemo(() => {
      if (!useCustomLayout || !studentData) return null;
      return {
        layoutKey: liveLayoutKey === 'custom_upload' ? 'custom_upload' : 'logo_builder',
        institutionName,
        primary,
        logoUrl: brand?.logo_url,
        sealUrl: brand?.seal_url,
        signatureUrl: brand?.signature_url,
        leftTitle: getSignatoryLeftTitle(brand),
        rightTitle: getSignatoryRightTitle(brand),
        leftName: getSignatoryLeftName(brand) || undefined,
        rightName: getSignatoryRightName(brand) || undefined,
        footerText: transcriptFooter || undefined,
        studentName: studentData.name || studentData.full_name || 'Student',
        studentId: studentData.student_code,
        startMonth: programMonths.startMonth,
        completionMonth: programMonths.completionMonth,
        programName,
        className: currentClass?.name,
        certificateNumber: credentialNumber,
        verifyCode: verifyCode || undefined,
        verificationUrl: verifyUrl || undefined,
        dateIssued: issuedTranscript?.issued_at || new Date().toISOString(),
        gpa: stats.gpa,
        gradesSummary,
        logoBuilderDesign: customDesign?.logoBuilderDesign || null,
        customBackgroundUrl: customDesign?.customBackgroundUrl || null,
        customAspectRatio: customDesign?.customAspectRatio ?? null,
        customFieldLayout: customDesign?.customFieldLayout || null,
        customPaperLayers: customDesign?.customPaperLayers || null,
      };
    }, [
      useCustomLayout,
      liveLayoutKey,
      studentData,
      institutionName,
      primary,
      brand,
      transcriptFooter,
      programName,
      currentClass?.name,
      programMonths.startMonth,
      programMonths.completionMonth,
      credentialNumber,
      verifyCode,
      verifyUrl,
      issuedTranscript?.issued_at,
      stats.gpa,
      gradesSummary,
      customDesign,
    ]);

    const handleDownloadPDF = async () => {
      setIsDownloading(true);
      try {
        const safeName = String(studentData?.name || 'Student').replace(/\s+/g, '_');
        if (useCustomLayout && customRenderData) {
          await downloadDesignPDF(customRenderData, `Transcript_${safeName}.pdf`, brand);
          return;
        }
        const pages = collectTranscriptPdfPages();
        if (!pages.length) return;
        await downloadDomPagesPdf(pages, `Transcript_${safeName}.pdf`);
      } catch (error) {
        console.error('PDF Generation failed', error);
      } finally {
        setIsDownloading(false);
      }
    };

    const handlePrint = async () => {
      setIsDownloading(true);
      try {
        if (useCustomLayout && customRenderData) {
          await printDesignPDF(customRenderData, brand);
          return;
        }
        const pages = collectTranscriptPdfPages();
        if (!pages.length) {
          window.print();
          return;
        }
        await printDomPagesPdf(pages);
      } catch (error) {
        console.error('Print failed', error);
        window.print();
      } finally {
        setIsDownloading(false);
      }
    };

    if (!studentData) return <div className="p-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;

    return (
        <div className="flex flex-col items-center gap-8 my-8 font-sans select-none w-full min-w-0 px-2 sm:px-0" id="printable-transcript">
            
            {/* Controls (Hidden when printing) */}
            <div className="bg-slate-50 p-3 sm:p-4 border-b rounded-lg shadow w-full max-w-[210mm] flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center print:hidden">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full md:w-auto min-w-0">
                    <span className="text-sm font-bold text-black shrink-0">Program / Class:</span>
                    <Select value={selectedClassId || undefined} onValueChange={setSelectedClassId}>
                        <SelectTrigger className="w-full md:w-[300px] bg-white border-black text-black font-bold">
                            <SelectValue placeholder="Select Class" />
                        </SelectTrigger>
                        <SelectContent>
                            {studentClasses.map(cls => (
                                <SelectItem key={cls.id} value={cls.id}>
                                  {cls.name}
                                  {cls.diploma_id ? ' (Diploma)' : cls.course_id ? ' (Course)' : ''}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                    {canDownload && (
                        <>
                            <Button 
                                variant="outline" 
                                onClick={handlePrint}
                                disabled={isDownloading}
                                className="gap-2 border-slate-300 bg-white text-slate-900 hover:bg-slate-100 hover:text-slate-900 font-bold"
                            >
                                {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} Print
                            </Button>
                            <Button 
                                variant="default" 
                                onClick={handleDownloadPDF} 
                                disabled={isDownloading}
                                className="gap-2 bg-black hover:bg-slate-800 text-white font-bold"
                            >
                                {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                                Download PDF
                            </Button>
                        </>
                    )}
                    <Dialog open={showScanner} onOpenChange={(open) => {
                        setShowScanner(open);
                        if(!open) resetScanner();
                    }}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="gap-2 border-slate-300 bg-white text-slate-900 hover:bg-slate-100 hover:text-slate-900 font-bold"><ScanLine className="h-4 w-4" /> Scan QR</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md bg-slate-950 border-slate-800 text-white">
                            <DialogHeader>
                                <DialogTitle className="text-center text-xl font-bold text-white">Credential Verification</DialogTitle>
                                <p className="text-center text-slate-400 text-sm">{institutionName}</p>
                            </DialogHeader>
                            <div className="p-4 flex flex-col items-center justify-center min-h-[300px]">
                                {verificationStatus === 'idle' && (
                                    <>
                                        <div id="reader" className="w-full bg-black rounded-lg overflow-hidden border border-slate-700"></div>
                                        <p className="text-xs text-slate-500 mt-4 text-center">
                                            Align the QR code within the frame to verify credential authenticity.
                                        </p>
                                    </>
                                )}

                                {verificationStatus === 'verifying' && (
                                    <div className="flex flex-col items-center gap-4">
                                        <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
                                        <p className="text-lg font-medium text-slate-300">Verifying Document...</p>
                                    </div>
                                )}

                                {verificationStatus === 'valid' && verifiedData && (
                                    <div className="flex flex-col items-center gap-4 text-center animate-in fade-in zoom-in duration-300 w-full">
                                        <div className="bg-green-500/10 p-4 rounded-full border border-green-500/30">
                                            <CheckCircle2 className="h-16 w-16 text-green-500" />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-bold text-green-500">Verified Document</h3>
                                            <p className="text-slate-400 text-sm">This transcript is valid and exists in the system.</p>
                                        </div>
                                        
                                        <div className="bg-slate-900 p-4 rounded-lg w-full mt-2 border border-slate-800">
                                            <div className="grid grid-cols-[100px_1fr] gap-2 text-left text-sm">
                                                <span className="text-slate-500 font-medium">Student:</span>
                                                <span className="font-bold text-white">{verifiedData.studentName}</span>
                                                
                                                <span className="text-slate-500 font-medium">ID Code:</span>
                                                <span className="font-mono text-slate-300">{verifiedData.studentCode}</span>

                                                <span className="text-slate-500 font-medium">Status:</span>
                                                <span className="font-bold text-green-400 uppercase">{verifiedData.status || 'Active'}</span>
                                            </div>
                                        </div>
                                        
                                        <Button onClick={resetScanner} className="mt-4 gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                                            <RefreshCw className="h-4 w-4" /> Scan Another
                                        </Button>
                                    </div>
                                )}

                                {(verificationStatus === 'invalid' || verificationStatus === 'error') && (
                                    <div className="flex flex-col items-center gap-6 text-center animate-in fade-in zoom-in duration-300 w-full pt-4">
                                        <div className="bg-red-500/10 p-5 rounded-full border-[3px] border-red-500">
                                            <XCircle className="h-12 w-12 text-red-500" strokeWidth={3} />
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-2xl font-bold text-red-500">Invalid Document</h3>
                                            <p className="text-slate-400 max-w-[250px] mx-auto text-sm leading-relaxed">
                                                Document not found or not yet valid.
                                            </p>
                                        </div>
                                        
                                        <Button 
                                            onClick={() => {
                                                navigate('/login'); 
                                                resetScanner();
                                            }} 
                                            className="mt-6 w-full bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
                                            variant="outline"
                                        >
                                            Login to Portal
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Academic pages: custom Page Builder / Upload Own, or library chrome (multi-page when many courses) */}
            <div className="w-full overflow-x-auto print:overflow-visible space-y-8">
            {useCustomLayout && customRenderData ? (
              <div
                id="transcript-page-1"
                data-transcript-academic-page
                className="bg-white text-black shadow-2xl w-[210mm] min-w-[210mm] mx-auto overflow-hidden relative print:shadow-none print:m-0 print:w-full print:min-w-0 print:break-after-page"
              >
                <CertificateDesignRenderer
                  data={customRenderData}
                  design={customRenderData.logoBuilderDesign}
                  backgroundUrl={customRenderData.customBackgroundUrl}
                  composeUpload={liveLayoutKey === 'custom_upload'}
                  hideInstitutionNameWhenLogo={false}
                />
              </div>
            ) : (
              transcriptPages.map((pageGroups, pageIndex) => {
                const isFirstPage = pageIndex === 0;
                const isLastPage = pageIndex === transcriptPages.length - 1;
                const dense = showNarrative || !isFirstPage || layoutKey === 'compact';
                return (
            <div
              id={`transcript-page-${pageIndex + 1}`}
              data-transcript-academic-page
              key={`${selectedClassId || 'transcript'}-p${pageIndex}`}
              className={`bg-white text-black shadow-2xl w-[210mm] min-w-[210mm] mx-auto h-[297mm] max-h-[297mm] overflow-hidden relative flex flex-col print:shadow-none print:m-0 print:w-full print:min-w-0 print:h-[297mm] print:max-h-[297mm] print:break-after-page ${chrome.outerFrame} ${chrome.pageExtra}`}
            >
                
                {/* Header */}
                <div
                  className={`shrink-0 px-6 ${isFirstPage ? 'pt-5' : 'pt-4'} pb-2 print:px-6 print:pt-4 print:pb-2 ${showNarrative && isFirstPage ? 'pt-4' : ''} ${chrome.headerBorder}`}
                  style={layoutStyles.headerBorderColor ? { borderBottomColor: layoutStyles.headerBorderColor } : undefined}
                >
                    <div className="flex justify-between items-start gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="shrink-0">
                                <Logo className={`${dense ? 'h-14 print:h-14' : 'h-20 print:h-20'} w-auto text-black`} />
                            </div>
                            <div className="space-y-0 min-w-0">
                                <h1 className={`${dense ? 'text-base' : 'text-xl'} font-black tracking-tight uppercase text-black leading-tight`}>{institutionName}</h1>
                                {contactLine && isFirstPage ? (
                                  <p className="text-[10px] font-bold text-black mt-0.5 leading-snug">{contactLine}</p>
                                ) : null}
                                {!isFirstPage ? (
                                  <p className="text-[10px] font-bold text-black mt-0.5 uppercase tracking-wide">
                                    {studentData.name} · {studentData.student_code} · Continued
                                  </p>
                                ) : null}
                            </div>
                        </div>
                        <div className="text-right shrink-0">
                            <div
                              className={`inline-block p-1 ${chrome.badgeBorder}`}
                              style={layoutStyles.badgeBorderColor ? { borderColor: layoutStyles.badgeBorderColor } : undefined}
                            >
                                <div className="bg-white px-2.5 py-1 print:bg-white">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-black whitespace-nowrap">
                                      {isFirstPage ? 'Official Transcript' : `Transcript · Page ${pageIndex + 1}`}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Program Title Bar */}
                    <div
                      className={`mt-3 py-1.5 px-3 text-center print:mt-2 ${chrome.titleBar} ${chrome.titleBarText}`}
                      style={{
                        backgroundColor: layoutStyles.titleBarBg,
                        color: layoutStyles.titleBarColor,
                        WebkitPrintColorAdjust: 'exact',
                        printColorAdjust: 'exact',
                      }}
                    >
                        <h3 className={`${dense ? 'text-sm' : 'text-base'} font-bold uppercase tracking-wider leading-tight`}>{programName}</h3>
                    </div>
                </div>

                <div className={`px-6 ${dense ? 'py-2' : 'py-4'} min-h-0 flex-1 flex flex-col print:px-6 print:py-2`}>
                    {/* Student Info & Photo Grid — first page only */}
                    {isFirstPage ? (
                    <div className={`flex justify-between items-start gap-3 relative z-10 shrink-0 ${showNarrative || layoutKey === 'compact' ? 'mb-2' : 'mb-4'}`}>
                        
                        <div className="flex-1 min-w-0 grid grid-cols-2 gap-6">
                            <div>
                                <h3 className={`text-[10px] font-bold text-black uppercase tracking-wider pb-1 mb-1 print:text-black ${chrome.sectionRule}`}>Student Details</h3>
                                <div className="grid grid-cols-[120px_1fr] gap-y-0.5 text-[11px] print:text-[11px]">
                                    <span className="text-black font-bold uppercase">Full Name:</span>
                                    <span className="font-bold text-black text-xs uppercase leading-tight">{studentData.name}</span>
                                    
                                    <span className="text-black font-bold uppercase">Student ID:</span>
                                    <span className="font-bold text-black font-mono">{studentData.student_code}</span>

                                    <span className="text-black font-bold uppercase">Start Month:</span>
                                    <span className="font-bold text-black uppercase">{programMonths.startMonth}</span>
                                </div>
                            </div>
                            <div>
                                <h3 className={`text-[10px] font-bold text-black uppercase tracking-wider pb-1 mb-1 print:text-black ${chrome.sectionRule}`}>Credential Details</h3>
                                <div className="grid grid-cols-[108px_1fr] gap-y-0.5 text-[11px] print:text-[11px]">
                                    <span className="text-black font-bold uppercase">Institution:</span>
                                    <span className="text-black font-bold uppercase leading-tight">{institutionName}</span>

                                    <span className="text-black font-bold uppercase">Credential No:</span>
                                    <span className="text-black font-bold font-mono">{credentialNumber}</span>

                                    <span className="text-black font-bold uppercase">Class:</span>
                                    <span className="text-black font-bold uppercase leading-tight">{currentClass?.name || '—'}</span>

                                    <span className="text-black font-bold uppercase">Completion Month:</span>
                                    <span className="font-bold text-black uppercase">{programMonths.completionMonth}</span>
                                </div>
                            </div>
                        </div>

                        {/* Student Photo */}
                        <div className={`${showNarrative ? 'w-[96px] h-[112px]' : 'w-[120px] h-[140px]'} border border-black bg-slate-50 flex items-center justify-center overflow-hidden shrink-0`}>
                             {studentData.avatar_url ? (
                                <img 
                                    src={studentData.avatar_url} 
                                    alt="Student" 
                                    className="w-full h-full object-cover"
                                    onError={(e: any) => {
                                        e.target.onerror = null;
                                        e.target.style.display = 'none'; 
                                        e.target.parentElement.classList.add('flex', 'items-center', 'justify-center');
                                    }}
                                />
                             ) : (
                                <User className="h-14 w-14 text-slate-300" />
                             )}
                        </div>
                    </div>
                    ) : null}

                    {/* Performance Summary — first page only */}
                    {isFirstPage ? (
                    <div className={`flex gap-3 shrink-0 ${showNarrative ? 'mb-2' : 'mb-4 print:mb-3'}`}>
                        <div className={`bg-white px-3 rounded border-2 border-black flex-1 ${showNarrative ? 'py-1' : 'p-2'}`}>
                            <div className="text-[9px] text-black font-bold uppercase">Cumulative GPA</div>
                            <div className={`${showNarrative ? 'text-lg' : 'text-2xl'} font-black text-black leading-tight`}>{stats.gpa}</div>
                        </div>
                        <div className={`bg-white px-3 rounded border-2 border-black flex-1 ${showNarrative ? 'py-1' : 'p-2'}`}>
                            <div className="text-[9px] text-black font-bold uppercase">Academic Standing</div>
                            <div className={`${showNarrative ? 'text-xs' : 'text-sm'} font-bold mt-0.5`}>
                                {stats.failed === 0 && stats.passed > 0 ? (
                                    <span className="text-black flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5"/> Good Standing</span>
                                ) : (
                                    <span className="text-black">Active</span>
                                )}
                            </div>
                        </div>
                    </div>
                    ) : null}

                    {isFirstPage && showNarrative ? (
                      <p className="shrink-0 mb-2 text-[9px] leading-snug text-black text-justify print:text-[9px]">
                        {transcriptNarrative}
                      </p>
                    ) : null}

                    {/* Grades Table (paginated) */}
                    <div className={`min-h-0 flex-1 ${dense ? 'mb-1' : 'mb-4 print:mb-2'}`}>
                        <Table
                          className={`w-full border-collapse ${chrome.tableBorder}`}
                          style={layoutStyles.tableBorderColor ? { borderColor: layoutStyles.tableBorderColor } : undefined}
                        >
                            <TableHeader>
                                <TableRow className="border-b-2 border-black bg-white hover:bg-white h-7">
                                    <TableHead className="font-bold text-black uppercase text-[10px] w-[100px] border-r border-black h-7 py-1 pl-2">Code</TableHead>
                                    <TableHead className="font-bold text-black uppercase text-[10px] border-r border-black h-7 py-1 px-2 text-left">Course Title</TableHead>
                                    <TableHead className="font-bold text-black uppercase text-[10px] text-center w-[80px] border-r border-black h-7 py-1">Score</TableHead>
                                    <TableHead className="font-bold text-black uppercase text-[10px] text-center w-[80px] h-7 py-1 pr-2">Grade</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pageGroups.length > 0 ? pageGroups.map((group) => (
                                    <React.Fragment key={`${pageIndex}-${group.key}`}>
                                        {group.name ? (
                                            <TableRow className="bg-slate-100 hover:bg-slate-100 border-b border-black">
                                                <TableCell colSpan={4} className={`${dense ? 'py-1' : 'py-1.5'} px-2 font-black uppercase text-[10px] tracking-wide text-black`}>
                                                    {group.name}
                                                </TableCell>
                                            </TableRow>
                                        ) : null}
                                        {group.rows.map((row) => (
                                            <TableRow key={row.id} className="bg-white hover:bg-slate-50 h-auto border-b border-black">
                                                <TableCell className={`font-mono font-bold text-black text-xs ${dense ? 'py-1' : 'py-2'} pl-2 border-r border-black`}>{row.code}</TableCell>
                                                <TableCell className={`${dense ? 'py-1' : 'py-2'} px-2 border-r border-black`}>
                                                    <div className="font-bold text-black text-xs uppercase leading-tight">{row.name}</div>
                                                    {row.courseProject ? (
                                                        <div className="text-[9px] italic text-black/80 leading-tight mt-0.5">
                                                            Course Project: {row.courseProject}
                                                        </div>
                                                    ) : null}
                                                </TableCell>
                                                <TableCell className={`text-center font-bold text-black text-xs ${dense ? 'py-1' : 'py-2'} border-r border-black`}>{row.marks !== null ? row.marks : '-'}</TableCell>
                                                <TableCell className={`text-center font-bold text-black text-xs ${dense ? 'py-1' : 'py-2'} pr-2`}>{row.grade}</TableCell>
                                            </TableRow>
                                        ))}
                                    </React.Fragment>
                                )) : (
                                    isFirstPage ? (
                                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-black italic text-xs">No grades found in transcript.</TableCell></TableRow>
                                    ) : null
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Totals + signatures + QR only on the last academic page so they are never clipped */}
                    {isLastPage ? (
                    <>
                    <div className={`flex justify-end shrink-0 ${showNarrative ? 'mb-2' : 'mb-6 print:mb-4'}`}>
                        <div className={`w-56 border-2 border-black bg-white ${showNarrative ? 'px-2 py-1.5' : 'p-3'}`}>
                            <div className="flex justify-between text-[11px] font-bold mb-0.5 text-black">
                                <span className="uppercase">Total Credits:</span>
                                <span>{transcriptData.reduce((sum: any, t: any) => sum + (t.credits || 3), 0)}</span>
                            </div>
                            <div className="flex justify-between text-[11px] font-bold text-black">
                                <span className="uppercase">CGPA:</span>
                                <span>{stats.gpa}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto shrink-0">
                        <div className={`grid grid-cols-2 gap-12 border-t border-black ${showNarrative ? 'pt-2 mt-1' : 'pt-4 mt-4 print:mt-2 print:pt-2'}`}>
                            <div className="text-center">
                                <div className={`${showNarrative ? 'h-8' : 'h-12'} border-b border-black mb-1`}></div>
                                <p className="text-[10px] uppercase font-bold text-black">Registrar Signature</p>
                            </div>
                            <div className="text-center">
                                <div className={`${showNarrative ? 'h-8' : 'h-12'} border-b border-black mb-1`}></div>
                                <p className="text-[10px] uppercase font-bold text-black">Date Issued</p>
                            </div>
                        </div>

                        <div className={`${showNarrative ? 'mt-2' : 'mt-4'} text-center px-2`}>
                            <p className="text-[8px] text-black font-bold uppercase tracking-wider leading-snug">
                                {transcriptFooter || (
                                  <>
                                    This document is an official transcript of the student&apos;s academic record.
                                    <br/>Valid only if bearing the official seal and signature.
                                  </>
                                )}
                            </p>
                        </div>
                        
                        <div className={`flex justify-center ${showNarrative ? 'mt-1.5 pb-2' : 'mt-3 pb-4 print:mt-2 print:pb-2'}`}>
                            {verifyUrl ? (
                              <div className="flex flex-col items-center gap-0.5">
                                  <QRCode value={verifyUrl} size={showNarrative ? 40 : 48} fgColor="#000000" />
                                  <span className="text-[6px] font-mono font-bold text-black">{verifyCode}</span>
                              </div>
                            ) : (
                              <p className="text-[8px] text-slate-500">Issue transcript to enable QR verification</p>
                            )}
                        </div>
                    </div>
                    </>
                    ) : (
                      <p className="mt-auto shrink-0 text-center text-[9px] font-bold uppercase tracking-wide text-black/70 pb-3">
                        Continued on next page
                      </p>
                    )}
                </div>
            </div>
                );
              })
            )}
            </div>

             {/* Grading Key (library layouts only — custom designs are self-contained) */}
             {!useCustomLayout ? (
             <div className="w-full overflow-x-auto print:overflow-visible">
             <div id="transcript-grading-key" className="bg-white text-black shadow-2xl w-[210mm] min-w-[210mm] mx-auto h-[297mm] relative flex flex-col justify-center items-center p-8 sm:p-16 print:shadow-none print:m-0 print:w-full print:min-w-0 print:h-[297mm] print:break-before-page">
                <div className="w-full border-2 border-black p-10 h-[240mm] flex flex-col justify-between">
                    
                    <div className="space-y-12">
                         {/* Key to Grades Section */}
                        <div className="space-y-6">
                            <h2 className="text-xl font-black text-center uppercase underline decoration-2 underline-offset-8 tracking-widest">Key to Grades</h2>
                            <p className="text-center font-bold text-sm tracking-wide">The Grading System is as follows:</p>
                            
                            <div className="w-full max-w-2xl mx-auto border-2 border-black">
                                <div className="grid grid-cols-3 bg-slate-100 border-b-2 border-black">
                                    <div className="font-black text-center text-sm uppercase py-3 border-r-2 border-black">Mark %</div>
                                    <div className="font-black text-center text-sm uppercase py-3 border-r-2 border-black">Letter Grade</div>
                                    <div className="font-black text-center text-sm uppercase py-3">Grade Point</div>
                                </div>
                                
                                {[...gradeScale.bands]
                                  .sort((a, b) => b.min - a.min)
                                  .map((item, idx, arr) => (
                                    <div key={`${item.letter}-${idx}`} className={`grid grid-cols-3 ${idx !== arr.length - 1 ? 'border-b border-black' : ''}`}>
                                        <div className="text-center font-bold text-sm py-2 border-r border-black">{item.label}</div>
                                        <div className="text-center font-bold text-sm py-2 border-r border-black">{item.letter}</div>
                                        <div className="text-center font-bold text-sm py-2">{Number(item.points).toFixed(1)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Key to Classification Section */}
                        {gradeScale.classifications?.length ? (
                        <div className="space-y-6 pt-8">
                            <h2 className="text-xl font-black text-center uppercase underline decoration-2 underline-offset-8 tracking-widest">Key to Classification of Awards</h2>
                            
                            <div className="w-full max-w-2xl mx-auto border-2 border-black">
                                <div className="grid grid-cols-[2fr_1fr] bg-slate-100 border-b-2 border-black">
                                    <div className="font-black text-center text-sm uppercase py-3 border-r-2 border-black">Class / Classification</div>
                                    <div className="font-black text-center text-sm uppercase py-3">CGPA Range</div>
                                </div>

                                {gradeScale.classifications.map((item, idx) => (
                                    <div key={`${item.name}-${idx}`} className={`grid grid-cols-[2fr_1fr] ${idx !== gradeScale.classifications.length - 1 ? 'border-b border-black' : ''}`}>
                                        <div className="pl-6 font-bold text-sm py-2 border-r border-black text-left">{item.name}</div>
                                        <div className="text-center font-bold text-sm py-2">{formatClassificationRange(item)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        ) : null}
                    </div>

                    <div className="space-y-2 mt-8 border-t-2 border-black pt-6">
                         <div className="flex gap-2 text-xs font-bold items-center">
                            <span className="bg-black text-white px-2 py-0.5 rounded-sm uppercase text-[10px]">Note:</span>
                            <span>The Cumulative Grade Point Average (CGPA) is calculated on a {Number(gradeScale.scale_max).toFixed(2)} scale.</span>
                         </div>
                         <div className="space-y-1 text-xs font-bold text-slate-800 ml-10">
                            <p>• <span className="font-black">Nrt</span> – Retake: The Student obtained the score on second sitting.</p>
                            <p>• <span className="font-black">EX</span> – Exempt: The student is exempted from sitting for that course.</p>
                        </div>
                    </div>

                </div>
            </div>
             </div>
             ) : null}

        </div>
    );
};

export default TranscriptView;