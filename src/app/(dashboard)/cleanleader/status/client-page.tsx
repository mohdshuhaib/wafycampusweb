'use client';

import { useState, useEffect } from 'react';
import { BarChart3, CheckCircle2, XCircle, MapPin, Printer } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Select } from '@/components/ui/select';
import { useLoading } from '@/components/ui/loading-provider';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getPdfReportData } from './actions';

type DateRow = { id: string; date: string };
type PlaceData = { id: string; name: string; block: string; assignedCount: number; cleaned: boolean; classAssigned: string | null };

export default function StatusClient({
  dates,
  currentDate,
  placesData,
  allClasses
}: {
  dates: DateRow[];
  currentDate: DateRow | null;
  placesData: PlaceData[];
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

  const handleExportPdf = async () => {
    if (!currentDate) return;
    setIsExporting(true);
    try {
      const { data, error } = await getPdfReportData(currentDate.id);
      if (error || !data) throw new Error(error || 'Failed to fetch PDF data');

      const doc = new jsPDF();
      const primaryColor = [228, 61, 18]; // #E43D12 Loket Orange

      // Header
      doc.setFontSize(22);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('Daily Cleaning Report', 14, 20);
      
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(`Date: ${data.dateStr}`, 14, 28);

      // Summary Box
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(14, 35, 182, 30, 3, 3, 'F');
      
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      doc.text(`Assigned Places: ${data.stats.assignedPlacesCount} / ${data.stats.totalPlaces}`, 20, 45);
      doc.text(`Absences: ${data.stats.leaveCount + data.stats.medicalCount} (Leave: ${data.stats.leaveCount}, Med: ${data.stats.medicalCount})`, 20, 55);
      
      doc.text(`Students Cleaned: ${data.stats.studentsCleaned}`, 110, 45);
      doc.text(`Students Pending: ${data.stats.studentsPending}`, 110, 55);

      let startY = 75;

      // Unassigned Places
      if (data.stats.unassignedPlaces.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(200, 0, 0);
        doc.text(`Unassigned Places (${data.stats.unassignedPlaces.length})`, 14, startY);
        
        const unassignedText = data.stats.unassignedPlaces.join(', ');
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        
        const textLines = doc.splitTextToSize(unassignedText, 182);
        doc.text(textLines, 14, startY + 6);
        
        startY = startY + 6 + (textLines.length * 5) + 10;
      }

      // Detailed Table
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('Assigned Places Details', 14, startY);

      const tableData = data.assignedPlaces.map(place => {
        const studentsList = place.students.map(s => `${s.name} ${s.is_cleaned ? '(Done)' : ''}`).join('\n');
        return [
          place.className,
          `${place.placeName}\n(${place.placeBlock})`,
          studentsList || 'No students',
          place.isCleaned ? 'Cleaned' : 'Pending'
        ];
      });

      autoTable(doc, {
        startY: startY + 5,
        head: [['Class', 'Place', 'Assigned Students', 'Status']],
        body: tableData,
        headStyles: { fillColor: primaryColor as any, textColor: 255 },
        styles: { cellPadding: 4, fontSize: 10, valign: 'middle' },
        columnStyles: {
          0: { cellWidth: 30, fontStyle: 'bold' },
          1: { cellWidth: 50 },
          2: { cellWidth: 80 },
          3: { cellWidth: 25, fontStyle: 'bold' }
        },
        didParseCell: function (data) {
          if (data.section === 'body' && data.column.index === 3) {
            if (data.cell.raw === 'Cleaned') {
              data.cell.styles.textColor = [0, 150, 0];
            } else {
              data.cell.styles.textColor = [200, 100, 0];
            }
          }
        }
      });

      doc.save(`Cleaning_Report_${data.dateStr.replace(/ /g, '_')}.pdf`);
      
    } catch (err: any) {
      alert(err.message);
    }
    setIsExporting(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Live Status</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Monitoring cleaning progress and status
          </p>
        </div>
        
        <div className="flex flex-wrap gap-4 w-full md:w-auto">
          {dates.length > 0 && (
            <div className="w-full sm:w-48">
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
          <div className="w-full sm:w-48">
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
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 rounded-lg font-bold hover:bg-slate-700 dark:hover:bg-slate-300 transition-colors shadow-sm disabled:opacity-50"
            >
              <Printer className="w-4 h-4" /> {isExporting ? 'Generating...' : 'Export PDF'}
            </button>
          )}
        </div>
      </div>

      {!currentDate ? (
        <div className="p-8 text-center text-slate-500 glass-panel">Please create a date in Assign Places first.</div>
      ) : (
        <>
          <div className="glass-panel p-6 mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" /> Overall Progress for {new Date(currentDate.date).toLocaleDateString('en-GB')}
            </h2>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4 mb-2 overflow-hidden">
              <div 
                className="bg-primary h-4 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {cleanedCount} of {totalCount} assigned places cleaned ({progress}%)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assignedPlaces.map(place => (
              <div key={place.id} className="glass-panel p-6 relative overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">{place.name}</h3>
                    <p className="text-sm text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {place.block}
                    </p>
                    <p className="text-sm font-medium text-primary mt-1">Class: {place.classAssigned || 'Unassigned'}</p>
                  </div>
                  {place.cleaned ? (
                    <CheckCircle2 className="w-6 h-6 text-success" />
                  ) : (
                    <XCircle className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-sm font-medium">
                  <span className="text-slate-600 dark:text-slate-400">Status</span>
                  {place.cleaned ? (
                    <span className="text-success bg-success/10 px-2 py-1 rounded">Cleaned</span>
                  ) : (
                    <span className="text-amber-500 bg-amber-500/10 px-2 py-1 rounded">In Progress</span>
                  )}
                </div>
              </div>
            ))}
          </div>
            
          {unassignedPlaces.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xl font-bold mb-6 text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">Unassigned Places</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(unassignedByBlock).map(([block, places]) => (
                  <div key={block} className="glass-panel p-6">
                    <h4 className="font-bold text-primary flex items-center gap-2 mb-4">
                      <MapPin className="w-4 h-4" /> {block}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {places.map(p => (
                        <span key={p.id} className="text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg shadow-sm">
                          {p.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
