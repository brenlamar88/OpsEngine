import { useState, useMemo, useCallback } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { downloadCSV, downloadPDF, type ReportData, type ReportRow } from '@/lib/export-utils';
import { formatCurrency, MONTHS } from '@/lib/budget-structure';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Building2, Download, FileText, FileSpreadsheet, MapPin, Mail, Send, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TERRITORIES, SERVICE_DEV_METRICS, type Territory } from '@/hooks/useServiceDevelopment';

export default function Reports() {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedFacility, setSelectedFacility] = useState<string>('all');
  const [selectedTerritory, setSelectedTerritory] = useState<string>('all');

  const facilityId = selectedFacility === 'all' ? null : selectedFacility;
  
  const {
    sections,
    rows,
    facilities,
    calculatedBudget,
    calculatedActual,
    loading,
  } = useDashboardData(parseInt(selectedYear), facilityId);

  // Fetch service development data for territory reporting
  const { data: serviceDevData } = useQuery({
    queryKey: ['service-development-yearly', selectedYear, selectedFacility, selectedTerritory],
    queryFn: async () => {
      let query = supabase
        .from('service_development_entries')
        .select('*')
        .gte('date', `${selectedYear}-01-01`)
        .lte('date', `${selectedYear}-12-31`);
      
      if (selectedFacility !== 'all') {
        query = query.eq('facility_id', selectedFacility);
      }
      
      if (selectedTerritory !== 'all') {
        query = query.eq('territory', selectedTerritory);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Aggregate service dev by territory and month
  const serviceTerritoryData = useMemo(() => {
    if (!serviceDevData) return null;

    const monthlyByTerritory: Record<Territory, Record<number, Record<string, number>>> = {
      Red: {},
      White: {},
      Blue: {},
    };

    // Initialize months
    TERRITORIES.forEach(territory => {
      for (let m = 1; m <= 12; m++) {
        monthlyByTerritory[territory][m] = {};
        SERVICE_DEV_METRICS.forEach(metric => {
          if (metric.type === 'number') {
            monthlyByTerritory[territory][m][metric.key] = 0;
          }
        });
      }
    });

    // Aggregate data
    serviceDevData.forEach((entry: any) => {
      const date = new Date(entry.date);
      const month = date.getMonth() + 1;
      const territory = entry.territory as Territory;
      const metricKey = entry.metric_name;
      
      if (monthlyByTerritory[territory]?.[month] && metricKey) {
        const metric = SERVICE_DEV_METRICS.find(m => m.key === metricKey);
        if (metric && metric.type === 'number') {
          monthlyByTerritory[territory][month][metricKey] += Number(entry.numeric_value || 0);
        }
      }
    });

    return monthlyByTerritory;
  }, [serviceDevData]);

  const facilityName = useMemo(() => {
    if (selectedFacility === 'all') return 'All Facilities';
    const facility = facilities.find(f => f.id === selectedFacility);
    return facility?.name || 'Unknown';
  }, [selectedFacility, facilities]);

  // Build report data
  const reportData = useMemo((): ReportData => {
    const budgetRows: ReportRow[] = [];
    const actualRows: ReportRow[] = [];
    const varianceRows: ReportRow[] = [];

    sections.forEach(section => {
      const sectionRows = rows.filter(r => r.section_id === section.id);
      
      sectionRows.forEach(row => {
        const budgetMonths = MONTHS.map((_, i) => calculatedBudget[row.id]?.[i + 1] || 0);
        const actualMonths = MONTHS.map((_, i) => calculatedActual[row.id]?.[i + 1] || 0);
        const varianceMonths = budgetMonths.map((b, i) => actualMonths[i] - b);

        const budgetTotal = budgetMonths.reduce((sum, v) => sum + v, 0);
        const actualTotal = actualMonths.reduce((sum, v) => sum + v, 0);
        const varianceTotal = actualTotal - budgetTotal;

        if (budgetTotal !== 0 || actualTotal !== 0) {
          budgetRows.push({
            section: section.name,
            item: row.name,
            months: budgetMonths,
            total: budgetTotal,
          });
          actualRows.push({
            section: section.name,
            item: row.name,
            months: actualMonths,
            total: actualTotal,
          });
          varianceRows.push({
            section: section.name,
            item: row.name,
            months: varianceMonths,
            total: varianceTotal,
          });
        }
      });
    });

    return {
      budgetRows,
      actualRows,
      varianceRows,
      year: parseInt(selectedYear),
      facilityName,
      generatedAt: format(new Date(), 'PPpp'),
    };
  }, [sections, rows, calculatedBudget, calculatedActual, selectedYear, facilityName]);

  const handleExportCSV = () => {
    const filename = `budget-report-${selectedYear}-${selectedFacility === 'all' ? 'all' : facilityName.replace(/\s+/g, '-')}.csv`;
    downloadCSV(reportData, filename);
  };

  const handleExportPDF = () => {
    const filename = `budget-report-${selectedYear}-${selectedFacility === 'all' ? 'all' : facilityName.replace(/\s+/g, '-')}.pdf`;
    downloadPDF(reportData, filename);
  };

  const [sendingServiceDev, setSendingServiceDev] = useState(false);
  const [downloadingServiceDev, setDownloadingServiceDev] = useState(false);

  const handleSendServiceDevReport = useCallback(async () => {
    setSendingServiceDev(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-service-dev-report', {
        body: {},
      });
      if (error) throw error;
      toast({
        title: 'Report sent',
        description: data?.message || 'Service Development report emailed successfully.',
      });
    } catch (err: any) {
      toast({
        title: 'Failed to send report',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSendingServiceDev(false);
    }
  }, [toast]);

  const handleDownloadServiceDevPDF = useCallback(async () => {
    setDownloadingServiceDev(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      // Get yesterday's date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const reportDate = format(yesterday, 'yyyy-MM-dd');
      const reportDateDisplay = format(yesterday, 'MMMM d, yyyy');

      // Fetch data
      const [facilitiesRes, unitsRes, entriesRes, opsRes] = await Promise.all([
        supabase.from('facilities').select('id, name, code').eq('is_active', true).order('name'),
        supabase.from('units').select('id, name, facility_id').eq('is_active', true),
        supabase.from('service_development_entries')
          .select('unit_id, territory, metric_name, numeric_value')
          .eq('date', reportDate)
          .in('metric_name', ['inquiries', 'referrals', 'admits', 'discharges']),
        supabase.from('daily_operations')
          .select('unit_id, mcr_full_days, mcr_co_days, mcr_lifetime_days, hmo_pt_days, medicaid_pt_days, commercial_pt_days, private_pay_pt_days, charity_indigent_pt_days, elmhs_pt_days')
          .eq('date', reportDate),
      ]);

      if (facilitiesRes.error) throw facilitiesRes.error;
      if (unitsRes.error) throw unitsRes.error;
      if (entriesRes.error) throw entriesRes.error;
      if (opsRes.error) throw opsRes.error;

      const allFacilities = facilitiesRes.data || [];
      const allUnits = unitsRes.data || [];
      const entries = entriesRes.data || [];
      const opsData = opsRes.data || [];

      // Build census lookup by unit_id
      const censusByUnit: Record<string, number> = {};
      for (const op of opsData) {
        const census = (op.mcr_full_days || 0) + (op.mcr_co_days || 0) + (op.mcr_lifetime_days || 0) +
          (op.hmo_pt_days || 0) + (op.medicaid_pt_days || 0) + (op.commercial_pt_days || 0) +
          (op.private_pay_pt_days || 0) + (op.charity_indigent_pt_days || 0) + (op.elmhs_pt_days || 0);
        censusByUnit[op.unit_id] = (censusByUnit[op.unit_id] || 0) + census;
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 20;

      doc.setFontSize(18);
      doc.text('Daily Service Development Report', pageWidth / 2, y, { align: 'center' });
      y += 10;
      doc.setFontSize(11);
      doc.text(`Report Date: ${reportDateDisplay}`, pageWidth / 2, y, { align: 'center' });
      y += 6;
      doc.text(`Generated: ${format(new Date(), 'PPpp')}`, pageWidth / 2, y, { align: 'center' });
      y += 12;

      const ratio = (refs: number, admits: number) => admits > 0 ? (refs / admits).toFixed(2) : 'N/A';
      const metrics = ['inquiries', 'referrals', 'admits', 'discharges'] as const;
      const labels: Record<string, string> = { inquiries: 'Inquiries', referrals: 'Referrals', admits: 'Admits', discharges: 'Discharges' };

      const grandTotals = { inquiries: 0, referrals: 0, admits: 0, discharges: 0 };
      let grandCensus = 0;

      for (const facility of allFacilities) {
        const facilityUnits = allUnits.filter(u => u.facility_id === facility.id);
        const facilityTotals = { inquiries: 0, referrals: 0, admits: 0, discharges: 0 };
        let facilityCensus = 0;
        let facilityHasData = false;

        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`${facility.name} (${facility.code})`, 14, y);
        y += 8;

        for (const unit of facilityUnits) {
          const unitEntries = entries.filter(e => e.unit_id === unit.id);

          const territories: Record<string, Record<string, number>> = {};
          const unitTotals = { inquiries: 0, referrals: 0, admits: 0, discharges: 0 };

          for (const entry of unitEntries) {
            const t = entry.territory;
            if (!territories[t]) territories[t] = { inquiries: 0, referrals: 0, admits: 0, discharges: 0 };
            const val = Number(entry.numeric_value) || 0;
            territories[t][entry.metric_name] += val;
            (unitTotals as any)[entry.metric_name] += val;
          }

          if (unitEntries.length > 0) facilityHasData = true;

          if (y > 250) { doc.addPage(); y = 20; }

          const unitCensus = censusByUnit[unit.id] || 0;
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.text(`${unit.name} — Census: ${unitCensus}`, 14, y);
          y += 2;

          const tableBody = metrics.map(m => {
            const red = territories['Red']?.[m] || 0;
            const white = territories['White']?.[m] || 0;
            const blue = territories['Blue']?.[m] || 0;
            const total = red + white + blue;
            return [labels[m], String(red), String(white), String(blue), String(total)];
          });
          tableBody.push([
            'Ref-Admit Ratio',
            ratio(territories['Red']?.referrals || 0, territories['Red']?.admits || 0),
            ratio(territories['White']?.referrals || 0, territories['White']?.admits || 0),
            ratio(territories['Blue']?.referrals || 0, territories['Blue']?.admits || 0),
            ratio(unitTotals.referrals, unitTotals.admits),
          ]);

          autoTable(doc, {
            startY: y,
            head: [['Metric', 'Red', 'White', 'Blue', 'Total']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [41, 65, 122], fontSize: 9 },
            styles: { fontSize: 9, cellPadding: 3 },
            margin: { left: 14, right: 14 },
          });

          y = (doc as any).lastAutoTable.finalY + 8;

          facilityTotals.inquiries += unitTotals.inquiries;
          facilityTotals.referrals += unitTotals.referrals;
          facilityTotals.admits += unitTotals.admits;
          facilityTotals.discharges += unitTotals.discharges;
          facilityCensus += censusByUnit[unit.id] || 0;
        }

        // Facility totals row
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`${facility.name} Totals`, 14, y);
        y += 2;
        autoTable(doc, {
          startY: y,
          head: [['Metric', 'Total']],
          body: [
            ['Census', String(facilityCensus)],
            ['Inquiries', String(facilityTotals.inquiries)],
            ['Referrals', String(facilityTotals.referrals)],
            ['Admits', String(facilityTotals.admits)],
            ['Discharges', String(facilityTotals.discharges)],
            ['Ref-Admit Ratio', ratio(facilityTotals.referrals, facilityTotals.admits)],
          ],
          theme: 'grid',
          headStyles: { fillColor: [70, 90, 140], fontSize: 9 },
          styles: { fontSize: 9, cellPadding: 3 },
          margin: { left: 14, right: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 14;

        grandTotals.inquiries += facilityTotals.inquiries;
        grandTotals.referrals += facilityTotals.referrals;
        grandTotals.admits += facilityTotals.admits;
        grandTotals.discharges += facilityTotals.discharges;
        grandCensus += facilityCensus;
      }

      // Grand totals
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Grand Totals — All Facilities', 14, y);
      y += 2;

      autoTable(doc, {
        startY: y,
        head: [['Metric', 'Total']],
        body: [
          ['Census', String(grandCensus)],
          ['Inquiries', String(grandTotals.inquiries)],
          ['Referrals', String(grandTotals.referrals)],
          ['Admits', String(grandTotals.admits)],
          ['Discharges', String(grandTotals.discharges)],
          ['Ref-Admit Ratio', ratio(grandTotals.referrals, grandTotals.admits)],
        ],
        theme: 'grid',
        headStyles: { fillColor: [41, 65, 122], fontSize: 10 },
        styles: { fontSize: 10, cellPadding: 4 },
        margin: { left: 14, right: 14 },
      });

      doc.save(`service-dev-report-${reportDate}.pdf`);
      toast({ title: 'PDF downloaded', description: `Report for ${reportDateDisplay} saved.` });
    } catch (err: any) {
      toast({ title: 'Failed to download PDF', description: err.message, variant: 'destructive' });
    } finally {
      setDownloadingServiceDev(false);
    }
  }, [toast]);

  // Calculate section summaries for the table
  const sectionSummaries = useMemo(() => {
    return sections.map(section => {
      const sectionRows = rows.filter(r => r.section_id === section.id);
      
      const monthlyBudget = MONTHS.map((_, i) => {
        return sectionRows.reduce((sum, row) => sum + (calculatedBudget[row.id]?.[i + 1] || 0), 0);
      });
      
      const monthlyActual = MONTHS.map((_, i) => {
        return sectionRows.reduce((sum, row) => sum + (calculatedActual[row.id]?.[i + 1] || 0), 0);
      });

      const totalBudget = monthlyBudget.reduce((sum, v) => sum + v, 0);
      const totalActual = monthlyActual.reduce((sum, v) => sum + v, 0);

      return {
        name: section.name,
        monthlyBudget,
        monthlyActual,
        totalBudget,
        totalActual,
        variance: totalActual - totalBudget,
      };
    }).filter(s => s.totalBudget !== 0 || s.totalActual !== 0);
  }, [sections, rows, calculatedBudget, calculatedActual]);

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="animate-slide-up">
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate and export budget vs actual reports
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map(year => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedFacility} onValueChange={setSelectedFacility}>
            <SelectTrigger className="w-[180px]">
              <Building2 className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Facility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Facilities</SelectItem>
              {facilities.map(facility => (
                <SelectItem key={facility.id} value={facility.id}>
                  {facility.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedTerritory} onValueChange={setSelectedTerritory}>
            <SelectTrigger className="w-[160px]">
              <MapPin className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Territory" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Territories</SelectItem>
              {TERRITORIES.map(territory => (
                <SelectItem key={territory} value={territory}>
                  {territory} Territory
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      ) : (
        <>
          {/* Export Card */}
          <Card className="mb-6 animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Report
              </CardTitle>
              <CardDescription>
                Download the complete budget vs actual report for {selectedYear}
                {selectedFacility !== 'all' && ` - ${facilityName}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleExportCSV} variant="outline" className="gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Export as CSV
                </Button>
                <Button onClick={handleExportPDF} className="gap-2">
                  <FileText className="h-4 w-4" />
                  Export as PDF
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Email Reports Card */}
          <Card className="mb-6 animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Reports
              </CardTitle>
              <CardDescription>
                Manually trigger automated email reports (yesterday's data)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleSendServiceDevReport}
                  disabled={sendingServiceDev}
                  variant="outline"
                  className="gap-2"
                >
                  {sendingServiceDev ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send Service Development Report
                </Button>
                <Button
                  onClick={handleDownloadServiceDevPDF}
                  disabled={downloadingServiceDev}
                  variant="outline"
                  className="gap-2"
                >
                  {downloadingServiceDev ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  Download PDF
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className="animate-fade-in delay-100">
            <CardHeader>
              <CardTitle>Report Preview</CardTitle>
              <CardDescription>
                Budget vs Actual by Section for {selectedYear}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="summary" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="budget">Budget</TabsTrigger>
                  <TabsTrigger value="actual">Actual</TabsTrigger>
                  <TabsTrigger value="variance">Variance</TabsTrigger>
                  <TabsTrigger value="service-dev">Service Dev</TabsTrigger>
                </TabsList>

                <TabsContent value="summary">
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Section</th>
                          <th className="text-right">Total Budget</th>
                          <th className="text-right">Total Actual</th>
                          <th className="text-right">Variance</th>
                          <th className="text-right">Variance %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sectionSummaries.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center text-muted-foreground py-8">
                              No data available for {selectedYear}
                            </td>
                          </tr>
                        ) : (
                          sectionSummaries.map(section => {
                            const variancePercent = section.totalBudget !== 0
                              ? (section.variance / section.totalBudget) * 100
                              : 0;
                            const isPositive = section.variance < 0;
                            
                            return (
                              <tr key={section.name}>
                                <td className="font-medium">{section.name}</td>
                                <td className="text-right font-mono">{formatCurrency(section.totalBudget)}</td>
                                <td className="text-right font-mono">{formatCurrency(section.totalActual)}</td>
                                <td className={`text-right font-mono ${isPositive ? 'variance-positive' : 'variance-negative'}`}>
                                  {section.variance >= 0 ? '+' : ''}{formatCurrency(section.variance)}
                                </td>
                                <td className={`text-right font-mono ${isPositive ? 'variance-positive' : 'variance-negative'}`}>
                                  {variancePercent >= 0 ? '+' : ''}{variancePercent.toFixed(1)}%
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                <TabsContent value="budget">
                  <div className="overflow-x-auto">
                    <table className="data-table text-sm">
                      <thead>
                        <tr>
                          <th>Section</th>
                          <th>Item</th>
                          {MONTHS.map(m => (
                            <th key={m} className="text-right">{m.substring(0, 3)}</th>
                          ))}
                          <th className="text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.budgetRows.length === 0 ? (
                          <tr>
                            <td colSpan={15} className="text-center text-muted-foreground py-8">
                              No budget data available
                            </td>
                          </tr>
                        ) : (
                          reportData.budgetRows.map((row, i) => (
                            <tr key={i}>
                              <td className="font-medium">{row.section}</td>
                              <td>{row.item}</td>
                              {row.months.map((v, j) => (
                                <td key={j} className="text-right font-mono text-xs">
                                  {formatCurrency(v)}
                                </td>
                              ))}
                              <td className="text-right font-mono font-semibold">
                                {formatCurrency(row.total)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                <TabsContent value="actual">
                  <div className="overflow-x-auto">
                    <table className="data-table text-sm">
                      <thead>
                        <tr>
                          <th>Section</th>
                          <th>Item</th>
                          {MONTHS.map(m => (
                            <th key={m} className="text-right">{m.substring(0, 3)}</th>
                          ))}
                          <th className="text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.actualRows.length === 0 ? (
                          <tr>
                            <td colSpan={15} className="text-center text-muted-foreground py-8">
                              No actual data available
                            </td>
                          </tr>
                        ) : (
                          reportData.actualRows.map((row, i) => (
                            <tr key={i}>
                              <td className="font-medium">{row.section}</td>
                              <td>{row.item}</td>
                              {row.months.map((v, j) => (
                                <td key={j} className="text-right font-mono text-xs">
                                  {formatCurrency(v)}
                                </td>
                              ))}
                              <td className="text-right font-mono font-semibold">
                                {formatCurrency(row.total)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                <TabsContent value="variance">
                  <div className="overflow-x-auto">
                    <table className="data-table text-sm">
                      <thead>
                        <tr>
                          <th>Section</th>
                          <th>Item</th>
                          {MONTHS.map(m => (
                            <th key={m} className="text-right">{m.substring(0, 3)}</th>
                          ))}
                          <th className="text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.varianceRows.length === 0 ? (
                          <tr>
                            <td colSpan={15} className="text-center text-muted-foreground py-8">
                              No variance data available
                            </td>
                          </tr>
                        ) : (
                          reportData.varianceRows.map((row, i) => (
                            <tr key={i}>
                              <td className="font-medium">{row.section}</td>
                              <td>{row.item}</td>
                              {row.months.map((v, j) => (
                                <td 
                                  key={j} 
                                  className={`text-right font-mono text-xs ${v < 0 ? 'variance-positive' : v > 0 ? 'variance-negative' : ''}`}
                                >
                                  {v >= 0 ? '+' : ''}{formatCurrency(v)}
                                </td>
                              ))}
                              <td className={`text-right font-mono font-semibold ${row.total < 0 ? 'variance-positive' : row.total > 0 ? 'variance-negative' : ''}`}>
                                {row.total >= 0 ? '+' : ''}{formatCurrency(row.total)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                <TabsContent value="service-dev">
                  <div className="mb-4">
                    <p className="text-sm text-muted-foreground">
                      Service Development metrics by territory
                      {selectedTerritory !== 'all' && ` - Filtered to ${selectedTerritory} Territory`}
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="data-table text-sm">
                      <thead>
                        <tr>
                          <th>Territory</th>
                          <th>Metric</th>
                          {MONTHS.map(m => (
                            <th key={m} className="text-right">{m.substring(0, 3)}</th>
                          ))}
                          <th className="text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!serviceTerritoryData ? (
                          <tr>
                            <td colSpan={15} className="text-center text-muted-foreground py-8">
                              No service development data available
                            </td>
                          </tr>
                        ) : (
                          (selectedTerritory === 'all' ? TERRITORIES : [selectedTerritory as Territory]).map(territory => {
                            const keyMetrics = ['inquiries', 'referrals', 'admits', 'discharges', 'five_star_surveys'];
                            return keyMetrics.map((metricKey, idx) => {
                              const metric = SERVICE_DEV_METRICS.find(m => m.key === metricKey);
                              if (!metric) return null;
                              
                              const monthlyValues = MONTHS.map((_, i) => 
                                serviceTerritoryData[territory]?.[i + 1]?.[metricKey] || 0
                              );
                              const total = monthlyValues.reduce((sum, v) => sum + v, 0);
                              
                              return (
                                <tr key={`${territory}-${metricKey}`} className={idx === 0 ? 'border-t-2' : ''}>
                                  {idx === 0 && (
                                    <td rowSpan={keyMetrics.length} className="font-medium align-top">
                                      <span className={
                                        territory === 'Red' ? 'text-red-600' : 
                                        territory === 'Blue' ? 'text-blue-600' : 'text-gray-600'
                                      }>
                                        {territory}
                                      </span>
                                    </td>
                                  )}
                                  <td>{metric.label}</td>
                                  {monthlyValues.map((v, j) => (
                                    <td key={j} className="text-right font-mono text-xs">
                                      {v}
                                    </td>
                                  ))}
                                  <td className="text-right font-mono font-semibold">
                                    {total}
                                  </td>
                                </tr>
                              );
                            });
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
