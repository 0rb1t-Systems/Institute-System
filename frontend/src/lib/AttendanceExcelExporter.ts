import * as XLSX from 'xlsx';

/**
 * Generates and downloads an Excel workbook containing attendance records
 * grouped by class, along with a summary sheet.
 */
export const exportAttendanceToExcel = (records, dateFrom, dateTo) => {
    if (!records || records.length === 0) {
        throw new Error("No data available to export for the selected filters.");
    }

    const wb = XLSX.utils.book_new();

    // 1. Group records by Class Name
    const groupedByClass = records.reduce((acc: any, curr: any) => {
        const cName = curr.className || 'Unknown Class';
        if (!acc[cName]) acc[cName] = [];
        acc[cName].push(curr);
        return acc;
    }, {});

    const summaryData: any[] = [];

    // 2. Process each class and create individual sheets
    Object.entries(groupedByClass).forEach(([className, classRecords]: [string, any]) => {
        // Extract unique dates for this class and sort them
        const uniqueDates = [...new Set(classRecords.map((r: any) => r.date))].sort();

        // Group records by student within the class
        const studentsMap: any = {};
        classRecords.forEach((r: any) => {
            if (!studentsMap[r.studentCode]) {
                studentsMap[r.studentCode] = {
                    name: r.studentName,
                    code: r.studentCode,
                    attendance: {},
                    present: 0,
                    absent: 0,
                    leave: 0
                };
            }

            // Standardize status codes for the report
            let statusCode = 'P';
            if (r.status === 'absent') statusCode = 'A';
            if (r.status === 'late' || r.status === 'excused') statusCode = 'L';

            studentsMap[r.studentCode].attendance[r.date] = statusCode;

            // Increment counters
            if (statusCode === 'P') studentsMap[r.studentCode].present++;
            if (statusCode === 'A') studentsMap[r.studentCode].absent++;
            if (statusCode === 'L') studentsMap[r.studentCode].leave++;
        });

        const sheetData = [];
        
        // Build Header Row
        const headerRow: any[] = ["Student Name", "Student ID", ...uniqueDates, "Total Present", "Total Absent", "Total Leave", "Percentage"];
        sheetData.push(headerRow);

        let classTotalP = 0;
        let classTotalA = 0;
        let classTotalL = 0;

        // Build Student Rows
        Object.values(studentsMap).forEach((student: any) => {
            const totalDays = student.present + student.absent + student.leave;
            const percentage = totalDays > 0 ? ((student.present / totalDays) * 100).toFixed(2) + '%' : '0%';

            classTotalP += student.present;
            classTotalA += student.absent;
            classTotalL += student.leave;

            const row = [student.name, student.code];
            
            // Add attendance status for each unique date
            uniqueDates.forEach((date: any) => {
                row.push(student.attendance[date] || '-');
            });
            
            row.push(student.present, student.absent, student.leave, percentage);
            sheetData.push(row);
        });

        // Summary calculations for this class (for the Summary Sheet)
        const numStudents = Object.keys(studentsMap).length;
        const classTotalDays = classTotalP + classTotalA + classTotalL;
        const classAvgPercent = classTotalDays > 0 ? ((classTotalP / classTotalDays) * 100).toFixed(2) + '%' : '0%';

        summaryData.push({
            "Class Name": className,
            "Total Students": numStudents,
            "Avg Attendance %": classAvgPercent,
            "Total Present Days": classTotalP,
            "Total Absent Days": classTotalA,
            "Total Leave Days": classTotalL
        });

        // Convert array of arrays to sheet
        const ws = XLSX.utils.aoa_to_sheet(sheetData);

        // Auto-fit column widths based on header length and content (approximate)
        const colWidths = headerRow.map(h => ({ wch: Math.max(h.length, 12) }));
        ws['!cols'] = colWidths;
        
        // Freeze the header row and first two columns (Name, ID)
        ws['!freeze'] = { xSplit: 2, ySplit: 1, topLeftCell: "C2", activePane: "bottomRight" };

        // Clean sheet name (Excel restricts sheet names to 31 chars and no special characters)
        const safeSheetName = className.replace(/[\\/?*\[\]:]/g, "").substring(0, 31) || "Class";
        XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
    });

    // 3. Create the Summary Sheet
    if (summaryData.length > 0) {
        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        
        // Auto-fit summary columns
        const summaryCols = Object.keys(summaryData[0] || {}).map(k => ({ wch: Math.max(k.length, 15) }));
        wsSummary['!cols'] = summaryCols;
        
        // Insert summary sheet at the beginning
        XLSX.utils.book_append_sheet(wb, wsSummary, "Overall Summary");
        
        // Move summary to the first position
        const sheetNames = wb.SheetNames;
        const summaryIndex = sheetNames.indexOf("Overall Summary");
        if (summaryIndex > 0) {
            sheetNames.splice(summaryIndex, 1);
            sheetNames.unshift("Overall Summary");
        }
    }

    // 4. Trigger Download
    const fileName = `attendance_report_${dateFrom}_to_${dateTo}.xlsx`;
    XLSX.writeFile(wb, fileName);
};