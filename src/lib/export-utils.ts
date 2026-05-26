import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, MONTHS } from './budget-structure';
import { format } from 'date-fns';

export interface ReportRow {
  section: string;
  item: string;
  months: number[];
  total: number;
}

export interface ReportData {
  budgetRows: ReportRow[];
  actualRows: ReportRow[];
  varianceRows: ReportRow[];
  year: number;
  facilityName: string;
  generatedAt: string;
}

export interface OperationsSummaryData {
  facilityName: string;
  unitName?: string;
  dateRange: string;
  generatedAt: string;
  kpis: {
    totalCensus: number;
    avgDailyCensus: number;
    totalRevenue: number;
    avgDailyRevenue: number;
    avgPPD: number;
    alos: number;
    admits: number;
    discharges: number;
    inquiries: number;
    referrals: number;
    falls: number;
    incidents: number;
    complaints: number;
    restraints: number;
    totalPayroll: number;
    employeesHired: number;
    employeesTermed: number;
    projectedProfitLoss: number;
    daysEntered: number;
  };
  censusByPayer: {
    mcrDays: number;
    hmoDays: number;
    medicaidDays: number;
    commercialDays: number;
    privatePayDays: number;
    charityDays: number;
  };
  revenueByPayer: {
    mcrRevenue: number;
    hmoRevenue: number;
    medicaidRevenue: number;
    commercialRevenue: number;
    privatePayRevenue: number;
    charityRevenue: number;
  };
  territories?: {
    name: string;
    inquiries: number;
    referrals: number;
    admits: number;
    discharges: number;
    faceToFace: number;
    qualityTouches: number;
    fiveStarSurveys: number;
  }[];
}

// Daily Operations Detail Export Types
export interface DailyOperationsDetailEntry {
  date: string;
  // Census breakdown by payer
  mcrFullDays: number;
  mcrCoDays: number;
  mcrLifetimeDays: number;
  hmoPtDays: number;
  medicaidPtDays: number;
  commercialPtDays: number;
  privatePayPtDays: number;
  charityPtDays: number;
  elmhsPtDays: number;
  totalCensus: number;
  totalRevenue: number;
  // IOP-specific fields
  iopEnrolledTotal: number;
  iopAttendanceTotal: number;
  iopGroupsBilled: number;
  // Staffing
  rnHours: number;
  lpnHours: number;
  mhtHours: number;
  totalPayroll: number;
  // Quality events
  fallsWithInjury: number;
  fallsWithoutInjury: number;
  incidentsWithInjury: number;
  incidentsWithoutInjury: number;
  complaints: number;
  grievances: number;
  // Comments
  censusComments: string;
  qualityComments: string;
}

export interface DailyOperationsDetailData {
  facilityName: string;
  unitName?: string;
  unitType?: string; // To identify IOP units
  dateRange: string;
  generatedAt: string;
  entries: DailyOperationsDetailEntry[];
  rates: {
    mcrFullDays: number;
    mcrCoDays: number;
    mcrLifetimeDays: number;
    hmo: number;
    medicaid: number;
    commercial: number;
    privatePay: number;
    charityIndigent: number;
    elmhs: number;
  };
}

export function generateOperationsSummaryCSV(data: OperationsSummaryData): string {
  const lines: string[] = [];
  const { kpis, censusByPayer, revenueByPayer, territories } = data;
  
  // Header
  lines.push(`Operations Summary Report`);
  lines.push(`Facility: ${data.facilityName}`);
  if (data.unitName) {
    lines.push(`Unit: ${data.unitName}`);
  }
  lines.push(`Date Range: ${data.dateRange}`);
  lines.push(`Generated: ${data.generatedAt}`);
  lines.push('');
  
  // KPIs
  lines.push('KEY PERFORMANCE INDICATORS');
  lines.push('Metric,Value');
  lines.push(`Total Census,${kpis.totalCensus}`);
  lines.push(`Average Daily Census,${kpis.avgDailyCensus.toFixed(1)}`);
  lines.push(`ALOS (Average Length of Stay),${kpis.alos.toFixed(1)} days`);
  lines.push(`Total Revenue,$${kpis.totalRevenue.toFixed(2)}`);
  lines.push(`Average Daily Revenue,$${kpis.avgDailyRevenue.toFixed(2)}`);
  lines.push(`Average PPD,$${kpis.avgPPD.toFixed(2)}`);
  lines.push(`Admits,${kpis.admits}`);
  lines.push(`Discharges,${kpis.discharges}`);
  lines.push(`Net Change,${kpis.admits - kpis.discharges}`);
  lines.push(`Inquiries,${kpis.inquiries}`);
  lines.push(`Referrals,${kpis.referrals}`);
  lines.push(`Falls,${kpis.falls}`);
  lines.push(`Incidents,${kpis.incidents}`);
  lines.push(`Complaints/Grievances,${kpis.complaints}`);
  lines.push(`Restraints/Seclusions,${kpis.restraints}`);
  lines.push(`Total Payroll,$${kpis.totalPayroll.toFixed(2)}`);
  lines.push(`Employees Hired,${kpis.employeesHired}`);
  lines.push(`Employees Termed,${kpis.employeesTermed}`);
  lines.push(`Projected P/L,$${kpis.projectedProfitLoss.toFixed(2)}`);
  lines.push(`Days of Data,${kpis.daysEntered}`);
  lines.push('');
  
  // Census Summary
  lines.push('CENSUS SUMMARY');
  lines.push('Payer,Patient Days,% of Total');
  const totalCensus = kpis.totalCensus || 1;
  lines.push(`MCR,${censusByPayer.mcrDays},${((censusByPayer.mcrDays / totalCensus) * 100).toFixed(1)}%`);
  lines.push(`HMO,${censusByPayer.hmoDays},${((censusByPayer.hmoDays / totalCensus) * 100).toFixed(1)}%`);
  lines.push(`Medicaid,${censusByPayer.medicaidDays},${((censusByPayer.medicaidDays / totalCensus) * 100).toFixed(1)}%`);
  lines.push(`Commercial,${censusByPayer.commercialDays},${((censusByPayer.commercialDays / totalCensus) * 100).toFixed(1)}%`);
  lines.push(`Private Pay,${censusByPayer.privatePayDays},${((censusByPayer.privatePayDays / totalCensus) * 100).toFixed(1)}%`);
  lines.push(`Charity/Indigent,${censusByPayer.charityDays},${((censusByPayer.charityDays / totalCensus) * 100).toFixed(1)}%`);
  lines.push(`TOTAL,${kpis.totalCensus},100%`);
  lines.push('');
  
  // Revenue by Payer
  lines.push('REVENUE BY PAYER');
  lines.push('Payer,Revenue,% of Total');
  const totalRevenue = kpis.totalRevenue || 1;
  lines.push(`MCR,$${revenueByPayer.mcrRevenue.toFixed(2)},${((revenueByPayer.mcrRevenue / totalRevenue) * 100).toFixed(1)}%`);
  lines.push(`HMO,$${revenueByPayer.hmoRevenue.toFixed(2)},${((revenueByPayer.hmoRevenue / totalRevenue) * 100).toFixed(1)}%`);
  lines.push(`Medicaid,$${revenueByPayer.medicaidRevenue.toFixed(2)},${((revenueByPayer.medicaidRevenue / totalRevenue) * 100).toFixed(1)}%`);
  lines.push(`Commercial,$${revenueByPayer.commercialRevenue.toFixed(2)},${((revenueByPayer.commercialRevenue / totalRevenue) * 100).toFixed(1)}%`);
  lines.push(`Private Pay,$${revenueByPayer.privatePayRevenue.toFixed(2)},${((revenueByPayer.privatePayRevenue / totalRevenue) * 100).toFixed(1)}%`);
  lines.push(`Charity/Indigent,$${revenueByPayer.charityRevenue.toFixed(2)},${((revenueByPayer.charityRevenue / totalRevenue) * 100).toFixed(1)}%`);
  lines.push(`TOTAL,$${kpis.totalRevenue.toFixed(2)},100%`);
  lines.push('');
  
  // Territory Breakdown
  if (territories && territories.length > 0) {
    lines.push('TERRITORY BREAKDOWN');
    lines.push('Territory,Inquiries,Referrals,Admits,Discharges,Net Change,Face-to-Face,Quality Touches,5 Star Surveys');
    territories.forEach(t => {
      lines.push(`${t.name},${t.inquiries},${t.referrals},${t.admits},${t.discharges},${t.admits - t.discharges},${t.faceToFace},${t.qualityTouches},${t.fiveStarSurveys}`);
    });
  }
  
  return lines.join('\n');
}

export function downloadOperationsSummaryCSV(data: OperationsSummaryData, filename: string): void {
  const csv = generateOperationsSummaryCSV(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadOperationsSummaryPDF(data: OperationsSummaryData, filename: string): void {
  const doc = new jsPDF({ orientation: 'portrait' });
  const { kpis, censusByPayer, revenueByPayer, territories } = data;
  
  // Title
  doc.setFontSize(18);
  doc.text('Operations Summary Report', 14, 20);
  
  doc.setFontSize(11);
  let yPos = 28;
  doc.text(`Facility: ${data.facilityName}`, 14, yPos);
  yPos += 6;
  if (data.unitName) {
    doc.text(`Unit: ${data.unitName}`, 14, yPos);
    yPos += 6;
  }
  doc.text(`Date Range: ${data.dateRange}`, 14, yPos);
  yPos += 6;
  doc.text(`Generated: ${data.generatedAt}`, 14, yPos);
  
  let startY = yPos + 10;
  
  // KPIs Table
  doc.setFontSize(14);
  doc.text('Key Performance Indicators', 14, startY);
  
  autoTable(doc, {
    startY: startY + 5,
    head: [['Metric', 'Value']],
    body: [
      ['Total Census', kpis.totalCensus.toLocaleString()],
      ['Avg Daily Census', kpis.avgDailyCensus.toFixed(1)],
      ['ALOS (Avg Length of Stay)', `${kpis.alos.toFixed(1)} days`],
      ['Total Revenue', `$${kpis.totalRevenue.toLocaleString()}`],
      ['Avg Daily Revenue', `$${kpis.avgDailyRevenue.toFixed(0)}`],
      ['Avg PPD', `$${kpis.avgPPD.toFixed(2)}`],
      ['Admits / Discharges', `${kpis.admits} / ${kpis.discharges}`],
      ['Net Change', `${kpis.admits - kpis.discharges >= 0 ? '+' : ''}${kpis.admits - kpis.discharges}`],
      ['Inquiries / Referrals', `${kpis.inquiries} / ${kpis.referrals}`],
      ['Quality Events', `${kpis.falls + kpis.incidents} (${kpis.falls} falls, ${kpis.incidents} incidents)`],
      ['Projected P/L', `$${kpis.projectedProfitLoss.toLocaleString()}`],
      ['Days of Data', kpis.daysEntered.toString()],
    ],
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246] },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 60 },
    },
  });
  
  startY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  
  // Census Summary
  const totalCensus = kpis.totalCensus || 1;
  doc.setFontSize(14);
  doc.text('Census Summary', 14, startY);
  
  autoTable(doc, {
    startY: startY + 5,
    head: [['Payer', 'Days', '% of Total']],
    body: [
      ['MCR', censusByPayer.mcrDays.toLocaleString(), `${((censusByPayer.mcrDays / totalCensus) * 100).toFixed(1)}%`],
      ['HMO', censusByPayer.hmoDays.toLocaleString(), `${((censusByPayer.hmoDays / totalCensus) * 100).toFixed(1)}%`],
      ['Medicaid', censusByPayer.medicaidDays.toLocaleString(), `${((censusByPayer.medicaidDays / totalCensus) * 100).toFixed(1)}%`],
      ['Commercial', censusByPayer.commercialDays.toLocaleString(), `${((censusByPayer.commercialDays / totalCensus) * 100).toFixed(1)}%`],
      ['Private Pay', censusByPayer.privatePayDays.toLocaleString(), `${((censusByPayer.privatePayDays / totalCensus) * 100).toFixed(1)}%`],
      ['Charity/Indigent', censusByPayer.charityDays.toLocaleString(), `${((censusByPayer.charityDays / totalCensus) * 100).toFixed(1)}%`],
      ['TOTAL', kpis.totalCensus.toLocaleString(), '100%'],
    ],
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246] },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 30 },
      2: { cellWidth: 25 },
    },
  });
  
  startY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  
  // Revenue by Payer
  const totalRevenue = kpis.totalRevenue || 1;
  doc.setFontSize(14);
  doc.text('Revenue by Payer', 14, startY);
  
  autoTable(doc, {
    startY: startY + 5,
    head: [['Payer', 'Revenue', '% of Total']],
    body: [
      ['MCR', `$${revenueByPayer.mcrRevenue.toLocaleString()}`, `${((revenueByPayer.mcrRevenue / totalRevenue) * 100).toFixed(1)}%`],
      ['HMO', `$${revenueByPayer.hmoRevenue.toLocaleString()}`, `${((revenueByPayer.hmoRevenue / totalRevenue) * 100).toFixed(1)}%`],
      ['Medicaid', `$${revenueByPayer.medicaidRevenue.toLocaleString()}`, `${((revenueByPayer.medicaidRevenue / totalRevenue) * 100).toFixed(1)}%`],
      ['Commercial', `$${revenueByPayer.commercialRevenue.toLocaleString()}`, `${((revenueByPayer.commercialRevenue / totalRevenue) * 100).toFixed(1)}%`],
      ['Private Pay', `$${revenueByPayer.privatePayRevenue.toLocaleString()}`, `${((revenueByPayer.privatePayRevenue / totalRevenue) * 100).toFixed(1)}%`],
      ['Charity/Indigent', `$${revenueByPayer.charityRevenue.toLocaleString()}`, `${((revenueByPayer.charityRevenue / totalRevenue) * 100).toFixed(1)}%`],
      ['TOTAL', `$${kpis.totalRevenue.toLocaleString()}`, '100%'],
    ],
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [34, 197, 94] },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 40 },
      2: { cellWidth: 25 },
    },
  });
  
  startY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  
  // Territory Breakdown
  if (territories && territories.length > 0) {
    if (startY > 230) {
      doc.addPage();
      startY = 20;
    }
    
    doc.setFontSize(14);
    doc.text('Territory Breakdown', 14, startY);
    
    autoTable(doc, {
      startY: startY + 5,
      head: [['Territory', 'Inquiries', 'Referrals', 'Admits', 'D/C', 'Net', 'F2F', 'Quality', '5 Star']],
      body: territories.map(t => [
        t.name,
        t.inquiries.toString(),
        t.referrals.toString(),
        t.admits.toString(),
        t.discharges.toString(),
        (t.admits - t.discharges >= 0 ? '+' : '') + (t.admits - t.discharges),
        t.faceToFace.toString(),
        t.qualityTouches.toString(),
        t.fiveStarSurveys.toString(),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [239, 68, 68] },
    });
  }
  
  doc.save(filename);
}

export function generateCSV(data: ReportData): string {
  const lines: string[] = [];
  
  // Header
  lines.push(`Budget vs Actual Report - ${data.year}`);
  lines.push(`Facility: ${data.facilityName}`);
  lines.push(`Generated: ${data.generatedAt}`);
  lines.push('');
  
  // Budget section
  lines.push('BUDGET');
  lines.push(['Section', 'Item', ...MONTHS, 'Total'].join(','));
  data.budgetRows.forEach(row => {
    lines.push([
      `"${row.section}"`,
      `"${row.item}"`,
      ...row.months.map(v => v.toFixed(2)),
      row.total.toFixed(2),
    ].join(','));
  });
  lines.push('');
  
  // Actual section
  lines.push('ACTUAL');
  lines.push(['Section', 'Item', ...MONTHS, 'Total'].join(','));
  data.actualRows.forEach(row => {
    lines.push([
      `"${row.section}"`,
      `"${row.item}"`,
      ...row.months.map(v => v.toFixed(2)),
      row.total.toFixed(2),
    ].join(','));
  });
  lines.push('');
  
  // Variance section
  lines.push('VARIANCE (Actual - Budget)');
  lines.push(['Section', 'Item', ...MONTHS, 'Total'].join(','));
  data.varianceRows.forEach(row => {
    lines.push([
      `"${row.section}"`,
      `"${row.item}"`,
      ...row.months.map(v => v.toFixed(2)),
      row.total.toFixed(2),
    ].join(','));
  });
  
  return lines.join('\n');
}

export function downloadCSV(data: ReportData, filename: string): void {
  const csv = generateCSV(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadPDF(data: ReportData, filename: string): void {
  const doc = new jsPDF({ orientation: 'landscape' });
  
  // Title
  doc.setFontSize(18);
  doc.text(`Budget vs Actual Report - ${data.year}`, 14, 20);
  
  doc.setFontSize(11);
  doc.text(`Facility: ${data.facilityName}`, 14, 28);
  doc.text(`Generated: ${data.generatedAt}`, 14, 34);
  
  let startY = 45;
  
  // Budget Table
  doc.setFontSize(14);
  doc.text('Budget', 14, startY);
  
  autoTable(doc, {
    startY: startY + 5,
    head: [['Section', 'Item', ...MONTHS.map(m => m.substring(0, 3)), 'Total']],
    body: data.budgetRows.map(row => [
      row.section,
      row.item,
      ...row.months.map(v => formatCurrency(v)),
      formatCurrency(row.total),
    ]),
    styles: { fontSize: 7, cellPadding: 1 },
    headStyles: { fillColor: [59, 130, 246] },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 35 },
    },
  });
  
  // Actual Table
  startY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  
  if (startY > 170) {
    doc.addPage();
    startY = 20;
  }
  
  doc.setFontSize(14);
  doc.text('Actual', 14, startY);
  
  autoTable(doc, {
    startY: startY + 5,
    head: [['Section', 'Item', ...MONTHS.map(m => m.substring(0, 3)), 'Total']],
    body: data.actualRows.map(row => [
      row.section,
      row.item,
      ...row.months.map(v => formatCurrency(v)),
      formatCurrency(row.total),
    ]),
    styles: { fontSize: 7, cellPadding: 1 },
    headStyles: { fillColor: [34, 197, 94] },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 35 },
    },
  });
  
  // Variance Table
  startY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  
  if (startY > 170) {
    doc.addPage();
    startY = 20;
  }
  
  doc.setFontSize(14);
  doc.text('Variance (Actual - Budget)', 14, startY);
  
  autoTable(doc, {
    startY: startY + 5,
    head: [['Section', 'Item', ...MONTHS.map(m => m.substring(0, 3)), 'Total']],
    body: data.varianceRows.map(row => [
      row.section,
      row.item,
      ...row.months.map(v => formatCurrency(v)),
      formatCurrency(row.total),
    ]),
    styles: { fontSize: 7, cellPadding: 1 },
    headStyles: { fillColor: [239, 68, 68] },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 35 },
    },
  });
  
  doc.save(filename);
}

// ==================== Daily Operations Detail Export ====================

export function generateDailyOperationsDetailCSV(data: DailyOperationsDetailData): string {
  const lines: string[] = [];
  const { entries, rates, unitType } = data;
  const isIOP = unitType === 'IOP';
  
  // Header
  lines.push(`Daily Operations Detail Report`);
  lines.push(`Facility: ${data.facilityName}`);
  if (data.unitName) {
    lines.push(`Unit: ${data.unitName}`);
  }
  lines.push(`Date Range: ${data.dateRange}`);
  lines.push(`Generated: ${data.generatedAt}`);
  lines.push('');
  
  // Budget rates used
  lines.push('BUDGET RATES APPLIED');
  lines.push(`MCR Full Days: $${rates.mcrFullDays.toFixed(2)}`);
  lines.push(`MCR Co Days: $${rates.mcrCoDays.toFixed(2)}`);
  lines.push(`MCR Lifetime Days: $${rates.mcrLifetimeDays.toFixed(2)}`);
  lines.push(`HMO: $${rates.hmo.toFixed(2)}`);
  lines.push(`Medicaid: $${rates.medicaid.toFixed(2)}`);
  lines.push(`Commercial: $${rates.commercial.toFixed(2)}`);
  lines.push(`Private Pay: $${rates.privatePay.toFixed(2)}`);
  lines.push(`Charity/Indigent: $${rates.charityIndigent.toFixed(2)}`);
  lines.push(`ELMHS: $${rates.elmhs.toFixed(2)}`);
  lines.push('');
  
  // IOP Patient Count Section (only for IOP units)
  if (isIOP) {
    lines.push('IOP PATIENT COUNTS');
    lines.push('Date,Enrolled Patients,Attendance,Groups Billed');
    
    let totalEnrolled = 0, totalAttendance = 0, totalGroups = 0;
    entries.forEach(entry => {
      totalEnrolled += entry.iopEnrolledTotal;
      totalAttendance += entry.iopAttendanceTotal;
      totalGroups += entry.iopGroupsBilled;
      
      lines.push([
        entry.date,
        entry.iopEnrolledTotal,
        entry.iopAttendanceTotal,
        entry.iopGroupsBilled,
      ].join(','));
    });
    
    lines.push(['TOTALS', totalEnrolled, totalAttendance, totalGroups].join(','));
    lines.push('');
  }
  
  // Census Breakdown
  lines.push('CENSUS BREAKDOWN (PATIENT DAYS)');
  lines.push('Date,MCR Full,MCR Co,MCR Life,HMO,Medicaid,Commercial,Private Pay,Charity,ELMHS,Total Census,Total Revenue');
  
  let totalMcrFull = 0, totalMcrCo = 0, totalMcrLife = 0, totalHmo = 0, totalMedicaid = 0;
  let totalCommercial = 0, totalPrivate = 0, totalCharity = 0, totalElmhs = 0;
  let grandTotalCensus = 0, grandTotalRevenue = 0;
  
  entries.forEach(entry => {
    totalMcrFull += entry.mcrFullDays;
    totalMcrCo += entry.mcrCoDays;
    totalMcrLife += entry.mcrLifetimeDays;
    totalHmo += entry.hmoPtDays;
    totalMedicaid += entry.medicaidPtDays;
    totalCommercial += entry.commercialPtDays;
    totalPrivate += entry.privatePayPtDays;
    totalCharity += entry.charityPtDays;
    totalElmhs += entry.elmhsPtDays;
    grandTotalCensus += entry.totalCensus;
    grandTotalRevenue += entry.totalRevenue;
    
    lines.push([
      entry.date,
      entry.mcrFullDays,
      entry.mcrCoDays,
      entry.mcrLifetimeDays,
      entry.hmoPtDays,
      entry.medicaidPtDays,
      entry.commercialPtDays,
      entry.privatePayPtDays,
      entry.charityPtDays,
      entry.elmhsPtDays,
      entry.totalCensus,
      `$${entry.totalRevenue.toFixed(2)}`,
    ].join(','));
  });
  
  lines.push([
    'TOTALS',
    totalMcrFull, totalMcrCo, totalMcrLife, totalHmo, totalMedicaid,
    totalCommercial, totalPrivate, totalCharity, totalElmhs,
    grandTotalCensus, `$${grandTotalRevenue.toFixed(2)}`,
  ].join(','));
  lines.push('');
  
  // Staffing
  lines.push('STAFFING');
  lines.push('Date,RN Hours,LPN Hours,MHT Hours,Total Payroll');
  
  let totalRn = 0, totalLpn = 0, totalMht = 0, totalPayroll = 0;
  entries.forEach(entry => {
    totalRn += entry.rnHours;
    totalLpn += entry.lpnHours;
    totalMht += entry.mhtHours;
    totalPayroll += entry.totalPayroll;
    
    lines.push([
      entry.date,
      entry.rnHours.toFixed(1),
      entry.lpnHours.toFixed(1),
      entry.mhtHours.toFixed(1),
      `$${entry.totalPayroll.toFixed(2)}`,
    ].join(','));
  });
  
  lines.push([
    'TOTALS',
    totalRn.toFixed(1), totalLpn.toFixed(1), totalMht.toFixed(1),
    `$${totalPayroll.toFixed(2)}`,
  ].join(','));
  lines.push('');
  
  // Quality Events
  lines.push('QUALITY EVENTS');
  lines.push('Date,Falls w/Injury,Falls w/o Injury,Incidents w/Injury,Incidents w/o Injury,Complaints,Grievances');
  
  let totalFallsInj = 0, totalFallsNoInj = 0, totalIncInj = 0, totalIncNoInj = 0;
  let totalComplaints = 0, totalGrievances = 0;
  entries.forEach(entry => {
    totalFallsInj += entry.fallsWithInjury;
    totalFallsNoInj += entry.fallsWithoutInjury;
    totalIncInj += entry.incidentsWithInjury;
    totalIncNoInj += entry.incidentsWithoutInjury;
    totalComplaints += entry.complaints;
    totalGrievances += entry.grievances;
    
    lines.push([
      entry.date,
      entry.fallsWithInjury,
      entry.fallsWithoutInjury,
      entry.incidentsWithInjury,
      entry.incidentsWithoutInjury,
      entry.complaints,
      entry.grievances,
    ].join(','));
  });
  
  lines.push([
    'TOTALS',
    totalFallsInj, totalFallsNoInj, totalIncInj, totalIncNoInj,
    totalComplaints, totalGrievances,
  ].join(','));
  lines.push('');
  
  // Comments (only include entries that have comments)
  const entriesWithComments = entries.filter(e => e.censusComments || e.qualityComments);
  if (entriesWithComments.length > 0) {
    lines.push('COMMENTS');
    lines.push('Date,Census Notes,Quality Notes');
    entriesWithComments.forEach(entry => {
      lines.push([
        entry.date,
        `"${(entry.censusComments || '').replace(/"/g, '""')}"`,
        `"${(entry.qualityComments || '').replace(/"/g, '""')}"`,
      ].join(','));
    });
  }
  
  return lines.join('\n');
}

export function downloadDailyOperationsDetailCSV(data: DailyOperationsDetailData, filename: string): void {
  const csv = generateDailyOperationsDetailCSV(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadDailyOperationsDetailPDF(data: DailyOperationsDetailData, filename: string): void {
  const doc = new jsPDF({ orientation: 'landscape' });
  const { entries, rates, unitType } = data;
  const isIOP = unitType === 'IOP';
  
  // Title
  doc.setFontSize(18);
  doc.text('Daily Operations Detail Report', 14, 20);
  
  doc.setFontSize(11);
  let yPos = 28;
  doc.text(`Facility: ${data.facilityName}`, 14, yPos);
  yPos += 6;
  if (data.unitName) {
    doc.text(`Unit: ${data.unitName}`, 14, yPos);
    yPos += 6;
  }
  doc.text(`Date Range: ${data.dateRange}`, 14, yPos);
  yPos += 6;
  doc.text(`Generated: ${data.generatedAt}`, 14, yPos);
  
  let startY = yPos + 10;
  
  // Calculate totals
  const totals = entries.reduce((acc, entry) => ({
    mcrFullDays: acc.mcrFullDays + entry.mcrFullDays,
    mcrCoDays: acc.mcrCoDays + entry.mcrCoDays,
    mcrLifetimeDays: acc.mcrLifetimeDays + entry.mcrLifetimeDays,
    hmoPtDays: acc.hmoPtDays + entry.hmoPtDays,
    medicaidPtDays: acc.medicaidPtDays + entry.medicaidPtDays,
    commercialPtDays: acc.commercialPtDays + entry.commercialPtDays,
    privatePayPtDays: acc.privatePayPtDays + entry.privatePayPtDays,
    charityPtDays: acc.charityPtDays + entry.charityPtDays,
    elmhsPtDays: acc.elmhsPtDays + entry.elmhsPtDays,
    totalCensus: acc.totalCensus + entry.totalCensus,
    totalRevenue: acc.totalRevenue + entry.totalRevenue,
    iopEnrolledTotal: acc.iopEnrolledTotal + entry.iopEnrolledTotal,
    iopAttendanceTotal: acc.iopAttendanceTotal + entry.iopAttendanceTotal,
    iopGroupsBilled: acc.iopGroupsBilled + entry.iopGroupsBilled,
    rnHours: acc.rnHours + entry.rnHours,
    lpnHours: acc.lpnHours + entry.lpnHours,
    mhtHours: acc.mhtHours + entry.mhtHours,
    totalPayroll: acc.totalPayroll + entry.totalPayroll,
    fallsWithInjury: acc.fallsWithInjury + entry.fallsWithInjury,
    fallsWithoutInjury: acc.fallsWithoutInjury + entry.fallsWithoutInjury,
    incidentsWithInjury: acc.incidentsWithInjury + entry.incidentsWithInjury,
    incidentsWithoutInjury: acc.incidentsWithoutInjury + entry.incidentsWithoutInjury,
    complaints: acc.complaints + entry.complaints,
    grievances: acc.grievances + entry.grievances,
  }), {
    mcrFullDays: 0, mcrCoDays: 0, mcrLifetimeDays: 0, hmoPtDays: 0, medicaidPtDays: 0,
    commercialPtDays: 0, privatePayPtDays: 0, charityPtDays: 0, elmhsPtDays: 0,
    totalCensus: 0, totalRevenue: 0, iopEnrolledTotal: 0, iopAttendanceTotal: 0, iopGroupsBilled: 0,
    rnHours: 0, lpnHours: 0, mhtHours: 0, totalPayroll: 0,
    fallsWithInjury: 0, fallsWithoutInjury: 0, incidentsWithInjury: 0, incidentsWithoutInjury: 0,
    complaints: 0, grievances: 0,
  });
  
  // IOP Patient Counts Table (only for IOP units)
  if (isIOP) {
    doc.setFontSize(14);
    doc.text('IOP Patient Counts', 14, startY);
    
    autoTable(doc, {
      startY: startY + 5,
      head: [['Date', 'Enrolled Patients', 'Attendance', 'Groups Billed']],
      body: [
        ...entries.map(entry => [
          entry.date,
          entry.iopEnrolledTotal.toString(),
          entry.iopAttendanceTotal.toString(),
          entry.iopGroupsBilled.toString(),
        ]),
        ['TOTALS', totals.iopEnrolledTotal.toString(), totals.iopAttendanceTotal.toString(), totals.iopGroupsBilled.toString()],
      ],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [139, 92, 246] }, // Purple for IOP
      footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 35 },
        2: { cellWidth: 25 },
        3: { cellWidth: 30 },
      },
    });
    
    startY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    
    // Check if we need a new page
    if (startY > 160) {
      doc.addPage();
      startY = 20;
    }
  }
  
  // Census Breakdown Table
  doc.setFontSize(14);
  doc.text('Census Breakdown (Patient Days)', 14, startY);
  
  autoTable(doc, {
    startY: startY + 5,
    head: [['Date', 'MCR Full', 'MCR Co', 'MCR Life', 'HMO', 'Medicaid', 'Comm', 'Private', 'Charity', 'ELMHS', 'Total', 'Revenue']],
    body: [
      ...entries.map(entry => [
        entry.date,
        entry.mcrFullDays.toString(),
        entry.mcrCoDays.toString(),
        entry.mcrLifetimeDays.toString(),
        entry.hmoPtDays.toString(),
        entry.medicaidPtDays.toString(),
        entry.commercialPtDays.toString(),
        entry.privatePayPtDays.toString(),
        entry.charityPtDays.toString(),
        entry.elmhsPtDays.toString(),
        entry.totalCensus.toString(),
        `$${entry.totalRevenue.toLocaleString()}`,
      ]),
      ['TOTALS', totals.mcrFullDays.toString(), totals.mcrCoDays.toString(), totals.mcrLifetimeDays.toString(),
        totals.hmoPtDays.toString(), totals.medicaidPtDays.toString(), totals.commercialPtDays.toString(),
        totals.privatePayPtDays.toString(), totals.charityPtDays.toString(), totals.elmhsPtDays.toString(),
        totals.totalCensus.toString(), `$${totals.totalRevenue.toLocaleString()}`],
    ],
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [59, 130, 246] },
    footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: 'bold' },
  });
  
  startY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  
  // Check if we need a new page
  if (startY > 160) {
    doc.addPage();
    startY = 20;
  }
  
  // Staffing Table
  doc.setFontSize(14);
  doc.text('Staffing', 14, startY);
  
  autoTable(doc, {
    startY: startY + 5,
    head: [['Date', 'RN Hours', 'LPN Hours', 'MHT Hours', 'Total Payroll']],
    body: [
      ...entries.map(entry => [
        entry.date,
        entry.rnHours.toFixed(1),
        entry.lpnHours.toFixed(1),
        entry.mhtHours.toFixed(1),
        `$${entry.totalPayroll.toLocaleString()}`,
      ]),
      ['TOTALS', totals.rnHours.toFixed(1), totals.lpnHours.toFixed(1), totals.mhtHours.toFixed(1),
        `$${totals.totalPayroll.toLocaleString()}`],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [34, 197, 94] },
    footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 25 },
      2: { cellWidth: 25 },
      3: { cellWidth: 25 },
      4: { cellWidth: 35 },
    },
  });
  
  startY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  
  // Check if we need a new page
  if (startY > 160) {
    doc.addPage();
    startY = 20;
  }
  
  // Quality Events Table
  doc.setFontSize(14);
  doc.text('Quality Events', 14, startY);
  
  autoTable(doc, {
    startY: startY + 5,
    head: [['Date', 'Falls w/Injury', 'Falls w/o Injury', 'Incidents w/Injury', 'Incidents w/o Injury', 'Complaints', 'Grievances']],
    body: [
      ...entries.map(entry => [
        entry.date,
        entry.fallsWithInjury.toString(),
        entry.fallsWithoutInjury.toString(),
        entry.incidentsWithInjury.toString(),
        entry.incidentsWithoutInjury.toString(),
        entry.complaints.toString(),
        entry.grievances.toString(),
      ]),
      ['TOTALS', totals.fallsWithInjury.toString(), totals.fallsWithoutInjury.toString(),
        totals.incidentsWithInjury.toString(), totals.incidentsWithoutInjury.toString(),
        totals.complaints.toString(), totals.grievances.toString()],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [239, 68, 68] },
    footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: 'bold' },
  });
  
  doc.save(filename);
}
