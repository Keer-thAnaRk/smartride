'use client';

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  Users,
  CheckCircle2,
  FileDown,
  Printer,
  Calendar,
  Layers,
  X,
  Sparkles,
  BarChart3,
  ArrowUpRight,
} from 'lucide-react';

interface DataPoint {
  month: string;
  revenue: number;
  completedRides: number;
  commuters: number;
}

const SIX_MONTHS_DATA: DataPoint[] = [
  { month: 'Mar', revenue: 4200, completedRides: 840, commuters: 28 },
  { month: 'Apr', revenue: 5600, completedRides: 1120, commuters: 37 },
  { month: 'May', revenue: 6900, completedRides: 1380, commuters: 45 },
  { month: 'Jun', revenue: 7800, completedRides: 1560, commuters: 51 },
  { month: 'Jul', revenue: 9100, completedRides: 1820, commuters: 59 },
  { month: 'Aug', revenue: 10400, completedRides: 2080, commuters: 68 },
];

const LAST_30_DAYS_DATA: DataPoint[] = [
  { month: 'Week 1', revenue: 2350, completedRides: 470, commuters: 62 },
  { month: 'Week 2', revenue: 2500, completedRides: 500, commuters: 65 },
  { month: 'Week 3', revenue: 2700, completedRides: 540, commuters: 67 },
  { month: 'Week 4', revenue: 2850, completedRides: 570, commuters: 68 },
];

const YTD_DATA: DataPoint[] = [
  { month: 'Jan', revenue: 2100, completedRides: 420, commuters: 15 },
  { month: 'Feb', revenue: 3150, completedRides: 630, commuters: 21 },
  { month: 'Mar', revenue: 4200, completedRides: 840, commuters: 28 },
  { month: 'Apr', revenue: 5600, completedRides: 1120, commuters: 37 },
  { month: 'May', revenue: 6900, completedRides: 1380, commuters: 45 },
  { month: 'Jun', revenue: 7800, completedRides: 1560, commuters: 51 },
  { month: 'Jul', revenue: 9100, completedRides: 1820, commuters: 59 },
  { month: 'Aug', revenue: 10400, completedRides: 2080, commuters: 68 },
];

export default function AdminRevenueChart() {
  const [timeframe, setTimeframe] = useState<'30d' | '6m' | 'ytd'>('6m');
  const [showExportModal, setShowExportModal] = useState(false);

  const activeData = useMemo(() => {
    switch (timeframe) {
      case '30d':
        return LAST_30_DAYS_DATA;
      case 'ytd':
        return YTD_DATA;
      case '6m':
      default:
        return SIX_MONTHS_DATA;
    }
  }, [timeframe]);

  // Executive Metric Calculations based on active dataset
  const lastIndex = activeData.length - 1;
  const currentMonthData = activeData[lastIndex];
  const previousMonthData = activeData[lastIndex - 1] || currentMonthData;

  const momGrowthRate = useMemo(() => {
    if (!previousMonthData.revenue) return 0;
    const rate = ((currentMonthData.revenue - previousMonthData.revenue) / previousMonthData.revenue) * 100;
    return parseFloat(rate.toFixed(1));
  }, [currentMonthData, previousMonthData]);

  const arpu = useMemo(() => {
    if (!currentMonthData.commuters) return 152;
    return Math.round(currentMonthData.revenue / currentMonthData.commuters);
  }, [currentMonthData]);

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataIndex = activeData.findIndex((d) => d.month === label);
      const currentRev = payload[0]?.value || 0;
      const prevRev = dataIndex > 0 ? activeData[dataIndex - 1].revenue : null;
      const momPercent = prevRev ? (((currentRev - prevRev) / prevRev) * 100).toFixed(1) : null;
      const completedRides = payload[1]?.value || 0;
      const activeCommuters = activeData[dataIndex]?.commuters || 0;

      return (
        <div className="bg-slate-950/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-slate-700 min-w-[220px] space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-extrabold text-sm text-slate-100 flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>{label} 2026</span>
            </span>
            {momPercent && (
              <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center">
                <ArrowUpRight className="w-3 h-3 mr-0.5" />
                +{momPercent}% MoM
              </span>
            )}
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Gross Revenue:</span>
              </span>
              <span className="font-black text-emerald-400 text-sm">
                ${currentRev.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400 flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span>Completed Trips:</span>
              </span>
              <span className="font-bold text-blue-300">
                {completedRides.toLocaleString()} rides
              </span>
            </div>

            <div className="flex justify-between items-center pt-1 border-t border-slate-800/80">
              <span className="text-slate-400 flex items-center space-x-1.5">
                <Users className="w-3 h-3 text-slate-500" />
                <span>Subscribed Commuters:</span>
              </span>
              <span className="font-semibold text-slate-200">
                {activeCommuters} users
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // CSV Export Generation
  const handleDownloadCSV = () => {
    const headers = ['Month', 'Gross Revenue (USD)', 'Completed Rides', 'Active Commuters', 'ARPU (USD)', 'MoM Growth (%)'];
    const rows = activeData.map((d, index) => {
      const prevRev = index > 0 ? activeData[index - 1].revenue : null;
      const mom = prevRev ? (((d.revenue - prevRev) / prevRev) * 100).toFixed(1) + '%' : 'N/A';
      const monthlyArpu = Math.round(d.revenue / d.commuters);
      return [d.month, d.revenue, d.completedRides, d.commuters, monthlyArpu, mom].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `smart_ride_executive_report_${timeframe}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print/PDF Export Trigger
  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
      {/* Header with Title, Timeframe Pills & Export Button */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-bold text-slate-900">
              Monthly Revenue & Commute Volume Growth
            </h3>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              Dual-Axis Dynamic
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tracking monthly gross recurring revenue alongside total completed commuter pick-up and drop dispatches
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe Filter Pills */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setTimeframe('30d')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                timeframe === '30d'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last 30 Days
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('6m')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                timeframe === '6m'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last 6 Months
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('ytd')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                timeframe === 'ytd'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Year-to-Date (YTD)
            </button>
          </div>

          {/* Export Executive Report Button */}
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-sm"
          >
            <FileDown className="w-3.5 h-3.5 text-emerald-400" />
            <span>📊 Download Executive PDF / CSV Report</span>
          </button>
        </div>
      </div>

      {/* Recharts Dual-Axis Interactive Chart Container */}
      <div className="w-full h-80 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={activeData}
            margin={{ top: 15, right: 10, bottom: 5, left: 10 }}
          >
            <defs>
              <linearGradient id="revenueBarGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#0d9488" stopOpacity={0.7} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
            />
            {/* Left Y-Axis: Revenue ($ USD) */}
            <YAxis
              yAxisId="left"
              orientation="left"
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#0f766e', fontSize: 11, fontWeight: 700 }}
              tickFormatter={(val) => `$${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`}
            />
            {/* Right Y-Axis: Completed Rides (Volume) */}
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#2563eb', fontSize: 11, fontWeight: 700 }}
              tickFormatter={(val) => `${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ paddingBottom: 12, fontSize: 12, fontWeight: 600 }}
            />
            <Bar
              yAxisId="left"
              dataKey="revenue"
              name="Monthly Gross Revenue ($)"
              fill="url(#revenueBarGradient)"
              radius={[8, 8, 0, 0]}
              barSize={32}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="completedRides"
              name="Completed Pickups & Drops (Trips)"
              stroke="#2563eb"
              strokeWidth={3}
              dot={{ r: 4, fill: '#1d4ed8', strokeWidth: 2, stroke: '#ffffff' }}
              activeDot={{ r: 7, fill: '#1e40af', stroke: '#ffffff', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 2. Executive Summary Metrics Box (Directly Under Chart) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
        {/* Metric 1: MoM Growth */}
        <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-800 uppercase tracking-wider">
            <span>MoM Revenue Growth Rate</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-950 flex items-center">
            <span>+{momGrowthRate}%</span>
            <span className="text-xs font-semibold text-emerald-700 ml-2">vs Last Month</span>
          </div>
          <p className="text-[11px] text-emerald-800">
            Consistently accelerating platform run-rate across peak tech corridors
          </p>
        </div>

        {/* Metric 2: ARPU */}
        <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80 space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-blue-800 uppercase tracking-wider">
            <span>Average Revenue / Commuter</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-950 flex items-center">
            <span>${arpu}</span>
            <span className="text-xs font-semibold text-blue-700 ml-2">/ month</span>
          </div>
          <p className="text-[11px] text-blue-800">
            Calculated dynamically across active subscribers ($152 benchmark)
          </p>
        </div>

        {/* Metric 3: SLA Fulfillment */}
        <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200/80 space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-purple-800 uppercase tracking-wider">
            <span>Route Fulfillment SLA Rate</span>
            <CheckCircle2 className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-950 flex items-center">
            <span>99.2%</span>
            <span className="text-xs font-semibold text-purple-700 ml-2">on-time</span>
          </div>
          <p className="text-[11px] text-purple-800">
            Real-time GPS monitored pick-up & drop-off corridor SLA delivery
          </p>
        </div>
      </div>

      {/* 3. "Export Executive Report" Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white max-w-3xl w-full rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 print:max-w-none print:shadow-none print:p-0">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center font-bold">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Smart Ride Executive Performance Report
                  </h3>
                  <p className="text-xs text-slate-500">
                    Financial cohort growth, trip volume dispatches & operational metrics
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 print:hidden">
                <button
                  type="button"
                  onClick={handlePrintPDF}
                  className="flex items-center space-x-1 px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                  title="Print or Save as PDF"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCSV}
                  className="flex items-center space-x-1 px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors"
                  title="Download CSV"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Platform Performance KPI Snapshot */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold uppercase text-slate-400">Monthly Run Rate</div>
                <div className="text-xl font-black text-slate-900">${currentMonthData.revenue.toLocaleString()}</div>
                <div className="text-[10px] font-semibold text-emerald-600">+{momGrowthRate}% vs prior</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold uppercase text-slate-400">Seat Utilization</div>
                <div className="text-xl font-black text-slate-900">88.4%</div>
                <div className="text-[10px] font-semibold text-slate-500">68 seats active</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold uppercase text-slate-400">Corridor Fleet</div>
                <div className="text-xl font-black text-slate-900">6 Shuttles</div>
                <div className="text-[10px] font-semibold text-slate-500">100% verified</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold uppercase text-slate-400">Dispatch SLA</div>
                <div className="text-xl font-black text-purple-700">99.2%</div>
                <div className="text-[10px] font-semibold text-purple-600">0.8% variance</div>
              </div>
            </div>

            {/* Month-by-Month Financial & Ride Volume Breakdown Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Month-by-Month Financial & Volume Breakdown
              </h4>
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 font-bold text-slate-600">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Month</th>
                      <th className="px-4 py-2.5 text-right">Gross Revenue</th>
                      <th className="px-4 py-2.5 text-right">MoM Growth</th>
                      <th className="px-4 py-2.5 text-right">Completed Trips</th>
                      <th className="px-4 py-2.5 text-right">Commuters</th>
                      <th className="px-4 py-2.5 text-right">ARPU</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {activeData.map((row, idx) => {
                      const prevRev = idx > 0 ? activeData[idx - 1].revenue : null;
                      const mom = prevRev ? (((row.revenue - prevRev) / prevRev) * 100).toFixed(1) + '%' : '—';
                      const rowArpu = Math.round(row.revenue / row.commuters);

                      return (
                        <tr key={idx} className="hover:bg-slate-50/80">
                          <td className="px-4 py-2.5 font-bold text-slate-800">{row.month} 2026</td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-700">
                            ${row.revenue.toLocaleString()}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">
                            {mom}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                            {row.completedRides.toLocaleString()} rides
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-700">
                            {row.commuters}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900">
                            ${rowArpu}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Route Efficiency & Subscriber Retention Summary */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Route Efficiency & Retention Insights
              </h4>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                <li>
                  <strong className="text-slate-800">Retention & Churn:</strong> Subscriber monthly churn is held at <strong>2.4%</strong>, well below the industry standard of 6.5%.
                </li>
                <li>
                  <strong className="text-slate-800">Capacity Utilization:</strong> Key corridors (Outer Ring Road & ITPL) operate at peak <strong>88.4% capacity</strong> during 08:30 AM & 06:15 PM slots.
                </li>
                <li>
                  <strong className="text-slate-800">Standby Route Coverage:</strong> Automated standby replacement system maintains zero route dropouts during route captain leaves.
                </li>
              </ul>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-3 pt-2 print:hidden">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={handlePrintPDF}
                className="px-4 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl flex items-center space-x-1.5 shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Executive Briefing</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
