import { useState, useEffect, useCallback } from 'react';
import { getAttendanceEnriched } from '@/lib/api';
import { getUserMessage } from '@/lib/mapError';
import { MESSAGES } from '@/lib/messages';

/**
 * Loads attendance for reports.
 * Instructors are strictly scoped to `availableClasses` (their assigned classes).
 */
export const useAttendanceFiltering = (dateFrom, dateTo, classId, user, availableClasses) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchRecords = useCallback(async (showSilent = false) => {
    if (!user) return;

    if (!showSilent) setLoading(true);
    setError(null);

    try {
      const instructorClassIds = (availableClasses || []).map((c) => c.id);
      const allowedSet = new Set(instructorClassIds);
      const isInstructor = user?.role === 'instructor';

      // Instructors with no assigned classes see nothing
      if (isInstructor && instructorClassIds.length === 0) {
        setRecords([]);
        setLastUpdated(new Date());
        if (!showSilent) setLoading(false);
        return;
      }

      // Instructors may only query their own classes (block forged classId)
      if (isInstructor && classId && classId !== 'all' && !allowedSet.has(classId)) {
        setRecords([]);
        setLastUpdated(new Date());
        if (!showSilent) setLoading(false);
        return;
      }

      const filters = {
        dateFrom,
        dateTo,
        classId: undefined,
        classIds: undefined,
      };

      if (classId && classId !== 'all') {
        filters.classId = classId;
      } else if (isInstructor) {
        filters.classIds = instructorClassIds;
      }

      const data = await getAttendanceEnriched(filters);

      let formattedData = (data || []).map((item) => ({
        ...item,
        studentName: item.student?.name || 'Unknown',
        studentCode: item.student?.student_code || 'N/A',
        className: item.class?.name || 'Unknown Class',
      }));

      // Defense in depth: drop any row outside the instructor's assigned classes
      if (isInstructor) {
        formattedData = formattedData.filter((r) => allowedSet.has(r.class_id));
      }

      setRecords(formattedData);
      setLastUpdated(new Date());
    } catch (err) {
      setError(getUserMessage(err, { context: 'useAttendanceFiltering', fallback: MESSAGES.LOAD_FAILED }));
    } finally {
      if (!showSilent) setLoading(false);
    }
  }, [dateFrom, dateTo, classId, user, availableClasses]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  return {
    records,
    loading,
    error,
    lastUpdated,
    refetch: () => fetchRecords(false),
  };
};
