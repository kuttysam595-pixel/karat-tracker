import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Download, Database, Calendar, Filter, AlertCircle, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface TableData {
  [key: string]: any;
}

type TableName = 'users' | 'daily_rates' | 'expense_log' | 'sales_log' | 'activity_log';

const AVAILABLE_TABLES: { value: TableName; label: string }[] = [
  { value: 'users', label: 'Users' },
  { value: 'daily_rates', label: 'Daily Rates' },
  { value: 'expense_log', label: 'Expense Log' },
  { value: 'sales_log', label: 'Sales Log' },
  { value: 'activity_log', label: 'Activity Log' },
];

export const TableDataExport = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [selectedTable, setSelectedTable] = useState<TableName | ''>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [tableData, setTableData] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);

  // Check if user has access (admin or owner only)
  const hasAccess = user?.role === 'admin' || user?.role === 'owner';

  useEffect(() => {
    if (!hasAccess) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this feature.",
        variant: "destructive",
      });
    }
  }, [hasAccess, toast]);

  const fetchTableData = async () => {
    if (!selectedTable || !fromDate || !toDate) {
      toast({
        title: "Missing Information",
        description: "Please select a table and date range.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let query = supabase.from(selectedTable as TableName).select('*');

      // Add date filtering based on table structure
      if (selectedTable === 'activity_log') {
        query = query
          .gte('timestamp', `${fromDate}T00:00:00`)
          .lte('timestamp', `${toDate}T23:59:59`);
      } else if (selectedTable === 'users') {
        query = query
          .gte('created_at', `${fromDate}T00:00:00`)
          .lte('created_at', `${toDate}T23:59:59`);
      } else {
        // For daily_rates, expense_log, sales_log
        query = query
          .gte('asof_date', fromDate)
          .lte('asof_date', toDate);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setTableData(data || []);
      
      // Extract columns from the first row
      if (data && data.length > 0) {
        setColumns(Object.keys(data[0]));
      } else {
        setColumns([]);
      }

      toast({
        title: "Data Loaded",
        description: `Found ${data?.length || 0} records.`,
      });
    } catch (error) {
      console.error('Error fetching table data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch table data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (tableData.length === 0) {
      toast({
        title: "No Data",
        description: "No data available to download.",
        variant: "destructive",
      });
      return;
    }

    // Create CSV content
    const headers = columns.join(',');
    const rows = tableData.map(row => 
      columns.map(col => {
        const value = row[col];
        // Handle JSON data and escape commas/quotes
        if (typeof value === 'object' && value !== null) {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        return `"${String(value || '').replace(/"/g, '""')}"`;
      }).join(',')
    );

    const csvContent = [headers, ...rows].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedTable}_${fromDate}_to_${toDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Download Complete",
      description: `${selectedTable} data exported successfully.`,
    });
  };

  const formatCellValue = (value: any) => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  };

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              Access denied. This feature is only available for Admin and Owner roles.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p-6">
      <div className="max-w-7xl mx-auto">
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
              <Database className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Table Data Export</h1>
              <p className="text-slate-600">Export database tables to CSV format</p>
            </div>
          </div>
        </div>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Table Data Export
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div>
                <Label htmlFor="table-select">Select Table</Label>
                <Select value={selectedTable} onValueChange={(value) => setSelectedTable(value as TableName | '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a table" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_TABLES.map((table) => (
                      <SelectItem key={table.value} value={table.value}>
                        {table.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="from-date">From Date</Label>
                <Input
                  id="from-date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="to-date">To Date</Label>
                <Input
                  id="to-date"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>

              <div className="flex items-end gap-2">
                <Button
                  onClick={fetchTableData}
                  disabled={loading}
                  className="flex-1"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  {loading ? 'Loading...' : 'Fetch Data'}
                </Button>
              </div>
            </div>

            {tableData.length > 0 && (
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-600">
                  Showing {tableData.length} records from {selectedTable}
                </p>
                <Button onClick={downloadCSV} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download CSV
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {tableData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Data Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map((column) => (
                        <TableHead key={column} className="whitespace-nowrap">
                          {column.replace(/_/g, ' ').toUpperCase()}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableData.slice(0, 50).map((row, index) => (
                      <TableRow key={index}>
                        {columns.map((column) => (
                          <TableCell key={column} className="max-w-xs truncate">
                            {formatCellValue(row[column])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {tableData.length > 50 && (
                  <p className="text-sm text-gray-500 mt-2 text-center">
                    Showing first 50 records. Download CSV for complete data.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
