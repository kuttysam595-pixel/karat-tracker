
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Download, FileText, Filter, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ReportData {
  daily_rates: any[];
  expense_log: any[];
  sales_log: any[];
  activity_log: any[];
}

export const Reports = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [fromDate, setFromDate] = useState(format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedTable, setSelectedTable] = useState('daily_rates');
  const [reportData, setReportData] = useState<ReportData>({
    daily_rates: [],
    expense_log: [],
    sales_log: [],
    activity_log: []
  });
  const [isLoading, setIsLoading] = useState(false);

  // Check if user has admin/owner privileges
  useEffect(() => {
    if (user && !['admin', 'owner'].includes(user.role)) {
      toast.error('Access denied. This feature is only available for admin and owner roles.');
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const fetchReportData = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Fetch Daily Rates
      const { data: dailyRates } = await supabase
        .from('daily_rates')
        .select('*')
        .gte('asof_date', fromDate)
        .lte('asof_date', toDate)
        .order('asof_date', { ascending: false });

      // Fetch Expense Log
      const { data: expenseLog } = await supabase
        .from('expense_log')
        .select('*')
        .gte('asof_date', fromDate)
        .lte('asof_date', toDate)
        .order('asof_date', { ascending: false });

      // Fetch Sales Log
      const { data: salesLog } = await supabase
        .from('sales_log')
        .select('*')
        .gte('asof_date', fromDate)
        .lte('asof_date', toDate)
        .order('asof_date', { ascending: false });

      // Fetch Activity Log
      const { data: activityLog } = await supabase
        .from('activity_log')
        .select('*')
        .gte('created_at', `${fromDate}T00:00:00`)
        .lte('created_at', `${toDate}T23:59:59`)
        .order('created_at', { ascending: false });

      setReportData({
        daily_rates: dailyRates || [],
        expense_log: expenseLog || [],
        sales_log: salesLog || [],
        activity_log: activityLog || []
      });

      toast.success('Report data loaded successfully!');
    } catch (error) {
      console.error('Error fetching report data:', error);
      toast.error('Failed to fetch report data');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadCSV = (tableName: keyof ReportData) => {
    const data = reportData[tableName];
    if (!data.length) {
      toast.error('No data to export');
      return;
    }

    // Create CSV content
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Handle special formatting for different data types
          if (value === null || value === undefined) return '';
          if (typeof value === 'object') return JSON.stringify(value).replace(/"/g, '""');
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(',')
      )
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${tableName}_${fromDate}_to_${toDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderTableData = () => {
    const data = reportData[selectedTable as keyof ReportData];
    if (!data.length) {
      return (
        <TableRow>
          <TableCell colSpan={10} className="text-center py-8 text-slate-500">
            No data found for the selected date range
          </TableCell>
        </TableRow>
      );
    }

    return data.map((row, index) => (
      <TableRow key={index}>
        {Object.entries(row).map(([key, value], cellIndex) => {
          // Hide profit column for non-admin/owner users in sales_log
          if (selectedTable === 'sales_log' && key === 'profit' && !['admin', 'owner'].includes(user?.role || '')) {
            return null;
          }

          return (
            <TableCell key={cellIndex} className="max-w-48 truncate">
              {value === null || value === undefined ? '-' : 
               typeof value === 'object' ? JSON.stringify(value) : 
               String(value)}
            </TableCell>
          );
        })}
      </TableRow>
    ));
  };

  const getTableHeaders = () => {
    const data = reportData[selectedTable as keyof ReportData];
    if (!data.length) return [];

    const headers = Object.keys(data[0]);
    
    // Filter out profit column for non-admin/owner users in sales_log
    if (selectedTable === 'sales_log' && !['admin', 'owner'].includes(user?.role || '')) {
      return headers.filter(header => header !== 'profit');
    }
    
    return headers;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="outline"
            size="sm"
            className="border-amber-300 text-amber-700 hover:bg-amber-100"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Reports & Analytics</h1>
              <p className="text-slate-600">Generate and export business reports</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm mb-6">
          <CardHeader>
            <CardTitle className="text-xl text-slate-800 flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Report Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fromDate" className="text-slate-700 font-medium">
                  From Date
                </Label>
                <Input
                  id="fromDate"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="border-slate-300 focus:border-purple-400 focus:ring-purple-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="toDate" className="text-slate-700 font-medium">
                  To Date
                </Label>
                <Input
                  id="toDate"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="border-slate-300 focus:border-purple-400 focus:ring-purple-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="table" className="text-slate-700 font-medium">
                  Report Type
                </Label>
                <Select value={selectedTable} onValueChange={setSelectedTable}>
                  <SelectTrigger className="border-slate-300 focus:border-purple-400 focus:ring-purple-400">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily_rates">Daily Rates</SelectItem>
                    <SelectItem value="expense_log">Expense Log</SelectItem>
                    <SelectItem value="sales_log">Sales Log</SelectItem>
                    <SelectItem value="activity_log">Activity Log</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex flex-col justify-end">
                <Button
                  onClick={fetchReportData}
                  className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold"
                  disabled={isLoading}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {isLoading ? 'Loading...' : 'Generate Report'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Report Results */}
        <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl text-slate-800">
                {selectedTable.replace('_', ' ').toUpperCase()} Report
              </CardTitle>
              <Button
                onClick={() => downloadCSV(selectedTable as keyof ReportData)}
                variant="outline"
                size="sm"
                className="border-green-300 text-green-700 hover:bg-green-100"
                disabled={!reportData[selectedTable as keyof ReportData].length}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    {getTableHeaders().map((header, index) => (
                      <TableHead key={index} className="font-semibold">
                        {header.replace('_', ' ').toUpperCase()}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renderTableData()}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 text-sm text-slate-600">
              Total Records: {reportData[selectedTable as keyof ReportData].length}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
