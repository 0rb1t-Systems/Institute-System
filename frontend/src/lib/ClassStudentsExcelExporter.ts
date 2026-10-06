import * as XLSX from 'xlsx';

type ClassStudentsExportRow = {
  name?: string | null;
};

type ClassStudentsExportMeta = {
  name?: string | null;
};

function safeFileName(name: string) {
  const cleaned = name.replace(/[\\/*?:\[\]]/g, '_').trim().replace(/\s+/g, '_');
  return (cleaned || 'class').slice(0, 60);
}

/**
 * Downloads an Excel workbook with enrolled student names only.
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
    Name: s.name || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 32 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Students');

  const fileName = `${safeFileName(String(classData.name || 'class'))}_students.xlsx`;
  XLSX.writeFile(wb, fileName);
}
