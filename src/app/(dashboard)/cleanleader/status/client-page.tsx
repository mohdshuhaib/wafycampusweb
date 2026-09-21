'use client';

import { useState, useEffect } from 'react';
import { BarChart3, CheckCircle2, XCircle, MapPin, Printer, Users, GraduationCap } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Select } from '@/components/ui/select';
import { useLoading } from '@/components/ui/loading-provider';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getPdfReportData } from './actions';

type DateRow = { id: string; date: string };
type PlaceData = { id: string; name: string; block: string; assignedCount: number; cleaned: boolean; classAssigned: string | null };
type UnassignedStudent = {
  cicno: string;
  name: string;
  class: string;
  status: string;
  is_exceptional: boolean;
};

export default function StatusClient({
  dates,
  currentDate,
  placesData,
  unassignedStudents = [],
  allClasses
}: {
  dates: DateRow[];
  currentDate: DateRow | null;
  placesData: PlaceData[];
  unassignedStudents?: UnassignedStudent[];
  allClasses: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { startLoading, stopLoading } = useLoading();
  const [filterClass, setFilterClass] = useState('All');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    stopLoading();
  }, [searchParams, stopLoading]);
  
  const cleanedCount = placesData.filter(p => p.cleaned).length;
  const totalCount = placesData.filter(p => p.assignedCount > 0).length;
  const progress = totalCount > 0 ? Math.round((cleanedCount / totalCount) * 100) : 0;

  const assignedPlaces = placesData
    .filter(p => p.assignedCount > 0)
    .filter(p => filterClass === 'All' || p.classAssigned === filterClass)
    .sort((a, b) => {
      const classA = a.classAssigned || 'ZZZ_Unassigned';
      const classB = b.classAssigned || 'ZZZ_Unassigned';
      if (classA !== classB) {
        return classA.localeCompare(classB);
      }
      return a.name.localeCompare(b.name);
    });

  const unassignedPlaces = placesData.filter(p => p.assignedCount === 0);

  // Group unassigned places by block
  const unassignedByBlock: Record<string, PlaceData[]> = {};
  unassignedPlaces.forEach(p => {
    if (!unassignedByBlock[p.block]) unassignedByBlock[p.block] = [];
    unassignedByBlock[p.block].push(p);
  });

  // Filter and group unassigned students by class
  const filteredUnassignedStudents = unassignedStudents.filter(
    s => filterClass === 'All' || s.class === filterClass
  );

  const unassignedByClass: Record<string, UnassignedStudent[]> = {};
  filteredUnassignedStudents.forEach(s => {
    const cls = s.class || 'Unassigned';
    if (!unassignedByClass[cls]) unassignedByClass[cls] = [];
    unassignedByClass[cls].push(s);
  });

  const handleExportPdf = async () => {
    if (!currentDate) return;
    setIsExporting(true);
    try {
      const { data, error } = await getPdfReportData(currentDate.id);
      if (error || !data) throw new Error(error || 'Failed to fetch PDF data');

      const doc = new jsPDF();
      const primaryColor = [24, 24, 27];

      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('Daily Cleaning Report', 14, 20);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Date: ${data.dateStr}${filterClass !== 'All' ? `  |  Filtered: Class ${filterClass}` : ''}`, 14, 27);

      // Summary Box
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 33, 182, 30, 2, 2, 'F');
      
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text(`Assigned Places: ${data.stats.assignedPlacesCount} / ${data.stats.totalPlaces}`, 20, 43);
      doc.text(`Absences: ${data.stats.leaveCount + data.stats.medicalCount} (Leave: ${data.stats.leaveCount}, Medical: ${data.stats.medicalCount})`, 20, 53);
      
      doc.text(`Students Cleaned: ${data.stats.studentsCleaned}`, 110, 43);
      doc.text(`Students Pending: ${data.stats.studentsPending}`, 110, 53);

      let startY = 70;

      // Filter data if a specific class is selected in UI
      const assignedPlacesToExport = filterClass === 'All' 
        ? data.assignedPlaces 
        : data.assignedPlaces.filter(p => p.className === filterClass);

      const unassignedToExport = filterClass === 'All'
        ? (data.unassignedStudentsByClass || [])
        : (data.unassignedStudentsByClass || []).filter(g => g.className === filterClass);

      // Unassigned Places (only when viewing All classes)
      if (filterClass === 'All' && data.stats.unassignedPlaces.length > 0) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 38, 38);
        doc.text(`Unassigned Places (${data.stats.unassignedPlaces.length})`, 14, startY);
        
        const unassignedText = data.stats.unassignedPlaces.join(', ');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        
        const textLines = doc.splitTextToSize(unassignedText, 182);
        doc.text(textLines, 14, startY + 5);
        
        startY = startY + 5 + (textLines.length * 4.5) + 8;
      }

      // Detailed Table: Assigned Places
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(`Assigned Places Details (${assignedPlacesToExport.length})`, 14, startY);

      const tableData = assignedPlacesToExport.map(place => {
        const studentsList = place.students.map(s => `${s.name} ${s.is_cleaned ? '(Done)' : ''}`).join('\n');
        return [
          place.className,
          `${place.placeName}\n(${place.placeBlock})`,
          studentsList || 'No students',
          place.isCleaned ? 'Cleaned' : 'Pending'
        ];
      });

      autoTable(doc, {
        startY: startY + 4,
        head: [['Class', 'Place', 'Assigned Students', 'Status']],
        body: tableData.length > 0 ? tableData : [['None', 'No places assigned', '-', '-']],
        headStyles: { fillColor: [30, 41, 59] as any, textColor: 255, fontStyle: 'bold' },
        styles: { cellPadding: 3.5, fontSize: 9, valign: 'middle' },
        columnStyles: {
          0: { cellWidth: 28, fontStyle: 'bold' },
          1: { cellWidth: 52 },
          2: { cellWidth: 78 },
          3: { cellWidth: 24, fontStyle: 'bold' }
        },
        didParseCell: function (cell) {
          if (cell.section === 'body' && cell.column.index === 3) {
            if (cell.cell.raw === 'Cleaned') {
              cell.cell.styles.textColor = [22, 163, 74];
            } else if (cell.cell.raw === 'Pending') {
              cell.cell.styles.textColor = [217, 119, 6];
            }
          }
        }
      });

      // Unassigned Students Table
      const totalUnassignedToExport = unassignedToExport.reduce((sum, g) => sum + g.students.length, 0);
      if (totalUnassignedToExport > 0) {
        let nextY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 12 : startY + 60;
        
        if (nextY > 240) {
          doc.addPage();
          nextY = 20;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(`Unassigned Students (${totalUnassignedToExport})`, 14, nextY);

        const unassignedRows: any[] = [];
        unassignedToExport.forEach(group => {
          group.students.forEach(st => {
            let statusLabel = 'Present / Unassigned';
            if (st.is_exceptional) statusLabel = 'Exceptional';
            else if (st.status === 'leave') statusLabel = 'Leave';
            else if (st.status === 'medical') statusLabel = 'Medical';

            unassignedRows.push([
              group.className,
              st.name,
              st.cicno,
              statusLabel
            ]);
          });
        });

        autoTable(doc, {
          startY: nextY + 4,
          head: [['Class', 'Student Name', 'CIC No.', 'Status / Note']],
          body: unassignedRows,
          headStyles: { fillColor: [51, 65, 85] as any, textColor: 255, fontStyle: 'bold' },
          styles: { cellPadding: 3.5, fontSize: 9, valign: 'middle' },
          columnStyles: {
            0: { cellWidth: 28, fontStyle: 'bold' },
            1: { cellWidth: 68 },
            2: { cellWidth: 42 },
            3: { cellWidth: 44 }
          },
          didParseCell: function (cell) {
            if (cell.section === 'body' && cell.column.index === 3) {
              const raw = String(cell.cell.raw || '');
              if (raw === 'Leave') {
                cell.cell.styles.textColor = [180, 83, 9];
                cell.cell.styles.fontStyle = 'bold';
              } else if (raw === 'Medical') {
                cell.cell.styles.textColor = [220, 38, 38];
                cell.cell.styles.fontStyle = 'bold';
              } else if (raw === 'Exceptional') {
                cell.cell.styles.textColor = [126, 34, 206];
                cell.cell.styles.fontStyle = 'bold';
              } else {
                cell.cell.styles.textColor = [100, 116, 139];
              }
            }
          }
        });
      }

      const filenameSuffix = filterClass !== 'All' ? `_${filterClass}` : '';
      doc.save(`Cleaning_Report_${data.dateStr.replace(/[^a-zA-Z0-9]/g, '_')}${filenameSuffix}.pdf`);
      
    } catch (err: any) {
      alert(err.message);
    }
    setIsExporting(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Live Status</h1>
          <p className="text-sm text-muted-foreground">
            Monitoring cleaning progress and status
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
          {dates.length > 0 && (
            <div className="w-full sm:w-44">
              <Select 
                value={currentDate?.id || ''}
                onChange={(val) => { startLoading(); router.push(`?dateId=${val}`); }}
                placeholder="Select a date..."
                options={dates.map(d => ({
                  value: d.id,
                  label: new Date(d.date).toLocaleDateString('en-GB')
                }))}
              />
            </div>
          )}
          <div className="w-full sm:w-44">
            <Select 
              value={filterClass}
              onChange={(val) => setFilterClass(val)}
              options={['All', ...allClasses].map(c => ({
                value: c,
                label: c === 'All' ? 'All Classes' : c
              }))}
            />
          </div>
          {currentDate && (
            <button
              onClick={handleExportPdf}
              disabled={isExporting}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 bg-primary hover:brightness-95 text-primary-foreground rounded-md font-medium text-xs transition-colors shadow-xs disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" /> {isExporting ? 'Generating...' : 'Export PDF'}
            </button>
          )}
        </div>
      </div>

      {!currentDate ? (
        <div className="p-8 text-center text-sm text-muted-foreground bg-card border border-border rounded-lg shadow-xs">Please create a date in Assign Places first.</div>
      ) : (
        <>
          <div className="bg-card text-card-foreground border border-border rounded-lg p-5 sm:p-6 mb-6 shadow-xs">
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2 text-foreground">
              <BarChart3 className="w-4 h-4 text-primary" /> Overall Progress for {new Date(currentDate.date).toLocaleDateString('en-GB')}
            </h2>
            <div className="w-full bg-secondary rounded-full h-3 mb-2 overflow-hidden">
              <div 
                className="bg-primary h-3 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-xs font-medium text-muted-foreground">
              {cleanedCount} of {totalCount} assigned places cleaned ({progress}%)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assignedPlaces.map(place => (
              <div key={place.id} className="bg-card text-card-foreground border border-border rounded-lg p-5 shadow-xs relative overflow-hidden">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-base text-foreground">{place.name}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" /> {place.block}
                    </p>
                    <p className="text-xs font-medium text-primary mt-1">Class: {place.classAssigned || 'Unassigned'}</p>
                  </div>
                  {place.cleaned ? (
                    <CheckCircle2 className="w-5 h-5 text-accent-foreground" />
                  ) : (
                    <XCircle className="w-5 h-5 text-muted-foreground/40" />
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-border flex justify-between items-center text-xs font-medium">
                  <span className="text-muted-foreground">Status</span>
                  {place.cleaned ? (
                    <span className="text-accent-foreground bg-accent px-2 py-0.5 rounded-sm font-semibold">Cleaned</span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-sm font-semibold">In Progress</span>
                  )}
                </div>
              </div>
            ))}
          </div>
            
          {unassignedPlaces.length > 0 && (
            <div className="mt-8">
              <h3 className="text-base font-semibold mb-4 text-foreground border-b border-border pb-2">Unassigned Places</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(unassignedByBlock).map(([block, places]) => (
                  <div key={block} className="bg-card text-card-foreground border border-border rounded-lg p-5 shadow-xs">
                    <h4 className="font-semibold text-xs text-primary flex items-center gap-1.5 mb-3 uppercase tracking-wider">
                      <MapPin className="w-3.5 h-3.5" /> {block}
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {places.map(p => (
                        <span key={p.id} className="text-xs bg-muted/50 border border-border text-foreground px-2.5 py-1 rounded-md">
                          {p.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unassigned Students Section */}
          <div className="mt-8">
            <div className="flex items-center justify-between border-b border-border pb-2 mb-4">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span>Unassigned Students</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                  {filteredUnassignedStudents.length} unassigned
                </span>
              </h3>
              {filterClass !== 'All' && (
                <span className="text-xs text-muted-foreground">
                  Filtered by <strong className="text-foreground">{filterClass}</strong>
                </span>
              )}
            </div>

            {filteredUnassignedStudents.length === 0 ? (
              <div className="p-6 text-center bg-card border border-border rounded-lg text-xs text-muted-foreground">
                All students {filterClass !== 'All' ? `in ${filterClass}` : ''} are assigned for this date.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(unassignedByClass).sort(([a], [b]) => a.localeCompare(b)).map(([cls, list]) => (
                  <div key={cls} className="bg-card text-card-foreground border border-border rounded-lg p-5 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3 border-b border-border pb-2">
                        <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                          <GraduationCap className="w-4 h-4 text-primary" /> {cls}
                        </h4>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-sm bg-accent text-accent-foreground">
                          {list.length} unassigned
                        </span>
                      </div>
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {list.map(st => (
                          <div 
                            key={st.cicno} 
                            className="flex items-center justify-between p-2 rounded-md bg-muted/40 border border-border text-xs"
                          >
                            <div className="min-w-0 pr-2">
                              <p className="font-medium text-foreground truncate">{st.name}</p>
                              <p className="text-[10px] text-muted-foreground">CIC: {st.cicno}</p>
                            </div>
                            <div className="shrink-0">
                              {st.is_exceptional ? (
                                <span className="text-[10px] font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 px-1.5 py-0.5 rounded-sm">
                                  Exceptional
                                </span>
                              ) : st.status === 'leave' ? (
                                <span className="text-[10px] font-semibold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 px-1.5 py-0.5 rounded-sm">
                                  Leave
                                </span>
                              ) : st.status === 'medical' ? (
                                <span className="text-[10px] font-semibold bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-sm">
                                  Medical
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-sm">
                                  Unassigned
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
