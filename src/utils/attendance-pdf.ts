import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDisplayDate } from './kerala-time';

export type StudentPdfRow = {
  cicno: string;
  name: string;
  class: string;
  status: string;
};

export type ClassPdfSummary = {
  className: string;
  totalStudents: number;
  present: number;
  medical: number;
  leave: number;
  late?: number;
  notAttend?: number;
  students: StudentPdfRow[];
};

export function exportDayAttendancePdf({
  date,
  classesSummary,
  totalStrength,
  totalCollegeStudents
}: {
  date: string;
  classesSummary: ClassPdfSummary[];
  totalStrength: number;
  totalCollegeStudents: number;
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor: [number, number, number] = [15, 23, 42]; // Slate 900
  const emeraldColor: [number, number, number] = [16, 185, 129];
  const dateFormatted = formatDisplayDate(date, true);

  // 1. Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...primaryColor);
  doc.text('Wafy Campus, Kalikkav', 14, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(71, 85, 105);
  doc.text(`Day Attendance Report of ${dateFormatted}`, 14, 28);

  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-GB')}`, 14, 34);

  // 2. Global Strength Summary Banner
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 38, 182, 18, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(`Total College Strength: ${totalStrength} / ${totalCollegeStudents}`, 20, 47);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`(Strength includes Present, Late, and Medical • Leave is absent)`, 20, 52);

  let currentY = 62;

  // 3. Render Each Class
  classesSummary.forEach((cls) => {
    // Check if we need a new page
    if (currentY > 240) {
      doc.addPage();
      currentY = 20;
    }

    // Class Section Header
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, currentY, 182, 11, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...primaryColor);
    doc.text(`Class: ${cls.className}`, 18, currentY + 7);

    // Class Stats Pills
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    const statsText = `Total: ${cls.totalStudents}  |  Present: ${cls.present}  |  Late: ${cls.late || 0}  |  Medical: ${cls.medical}  |  Leave: ${cls.leave}`;
    doc.text(statsText, 85, currentY + 7);

    currentY += 14;

    // Student Table (CIC ascending order)
    const sortedStudents = [...cls.students].sort((a, b) => 
      a.cicno.localeCompare(b.cicno, undefined, { numeric: true })
    );

    const bodyData = sortedStudents.map((s, idx) => [
      String(idx + 1),
      s.cicno,
      (s.name || '').toUpperCase(),
      (s.status || 'present').toUpperCase()
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'CIC No', 'Student Name', 'Status']],
      body: bodyData,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left'
      },
      styles: {
        fontSize: 8,
        cellPadding: 2,
        valign: 'middle'
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 26, fontStyle: 'bold' },
        2: { cellWidth: 106, fontStyle: 'bold' },
        3: { cellWidth: 40, fontStyle: 'bold', halign: 'center' }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const val = String(data.cell.raw).toLowerCase();
          if (val === 'present') {
            data.cell.styles.textColor = [16, 185, 129]; // Emerald
          } else if (val === 'late') {
            data.cell.styles.textColor = [234, 88, 12]; // Amber / Orange
          } else if (val === 'medical') {
            data.cell.styles.textColor = [37, 99, 235]; // Blue
          } else if (val === 'leave') {
            data.cell.styles.textColor = [225, 29, 72]; // Rose / Red
          }
        }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  });

  doc.save(`Day_Attendance_${date}.pdf`);
}

export function exportSpecialAttendancePdf({
  attendanceName,
  subtitle,
  date,
  classesSummary,
  totalStrength,
  totalEligibleStudents
}: {
  attendanceName: string;
  subtitle?: string | null;
  date: string;
  classesSummary: ClassPdfSummary[];
  totalStrength: number;
  totalEligibleStudents: number;
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor: [number, number, number] = [15, 23, 42];
  const dateFormatted = formatDisplayDate(date, true);

  // 1. Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...primaryColor);
  doc.text('Wafy Campus, Kalikkav', 14, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(71, 85, 105);
  doc.text(`${attendanceName} Report of ${dateFormatted}`, 14, 28);

  if (subtitle) {
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text(subtitle, 14, 34);
  }

  const summaryTop = subtitle ? 39 : 34;

  // 2. Global Strength Summary Banner
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, summaryTop, 182, 17, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(`Total Strength: ${totalStrength} / ${totalEligibleStudents}`, 20, summaryTop + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`(Strength represents all students marked Present)`, 20, summaryTop + 13);

  let currentY = summaryTop + 24;

  // 3. Render Each Class
  classesSummary.forEach((cls) => {
    if (currentY > 240) {
      doc.addPage();
      currentY = 20;
    }

    // Class Section Header
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, currentY, 182, 11, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...primaryColor);
    doc.text(`Class: ${cls.className}`, 18, currentY + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    const statsText = `Total: ${cls.totalStudents}  |  Present: ${cls.present}  |  Leave: ${cls.leave}  |  Medical: ${cls.medical}  |  Not Attend: ${cls.notAttend || 0}`;
    doc.text(statsText, 80, currentY + 7);

    currentY += 14;

    const sortedStudents = [...cls.students].sort((a, b) => 
      a.cicno.localeCompare(b.cicno, undefined, { numeric: true })
    );

    const bodyData = sortedStudents.map((s, idx) => [
      String(idx + 1),
      s.cicno,
      (s.name || '').toUpperCase(),
      (s.status || 'present').toUpperCase()
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'CIC No', 'Student Name', 'Status']],
      body: bodyData,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left'
      },
      styles: {
        fontSize: 8,
        cellPadding: 2,
        valign: 'middle'
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 26, fontStyle: 'bold' },
        2: { cellWidth: 106, fontStyle: 'bold' },
        3: { cellWidth: 40, fontStyle: 'bold', halign: 'center' }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const val = String(data.cell.raw).toLowerCase();
          if (val === 'present') {
            data.cell.styles.textColor = [16, 185, 129];
          } else if (val === 'not attend') {
            data.cell.styles.textColor = [225, 29, 72];
          } else if (val === 'leave') {
            data.cell.styles.textColor = [234, 88, 12];
          } else if (val === 'medical') {
            data.cell.styles.textColor = [37, 99, 235];
          }
        }
      },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  });

  const safeFileName = attendanceName.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Special_Attendance_${safeFileName}_${date}.pdf`);
}
