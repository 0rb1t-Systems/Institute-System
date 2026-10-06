import * as XLSX from 'xlsx';

type ClassStudentsExportRow = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  university?: string | null;
  university_name?: string | null;
  faculty?: string | null;
  year?: string | null;
  year_of_study?: string | null;
};

type ClassStudentsExportMeta = {
  name?: string | null;
};

function safeFileName(name: string) {
  const cleaned = name.replace(/[\\/*?:\[\]]/g, '_').trim().replace(/\s+/g, '_');
  return (cleaned || 'class').slice(0, 60);
}

/**
 * Downloads an Excel workbook with the same student fields as registration.
 */
export function exportClassStudentsToExcel(
  classData: ClassStudentsExportMeta,
  students: ClassStudentsExportRow[],
) {
  if (!students.length) {
    throw new Error('No enrolled students to export for this class.');
  }

  const wb = XLSX.utils.book_new();
  const rows = students.map((s) => ({
    'Full Name': String(s.name || '').trim(),
    'Email Address': String(s.email || '').trim(),
    'Phone Number': String(s.phone || '').trim(),
    University: String(s.university || s.university_name || '').trim(),
    Faculty: String(s.faculty || '').trim(),
    'Year of Study': String(s.year || s.year_of_study || '').trim(),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 28 },
    { wch: 32 },
    { wch: 18 },
    { wch: 28 },
    { wch: 22 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Students');

  const fileName = `${safeFileName(String(classData.name || 'class'))}_students.xlsx`;
  XLSX.writeFile(wb, fileName);
}
