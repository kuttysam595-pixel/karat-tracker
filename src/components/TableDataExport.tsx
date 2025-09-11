import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Download, Database, Calendar, Filter, AlertCircle, ArrowLeft, Search, X } from 'lucide-react';
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

// Custom column display names mapping
// You can customize these display names as needed
const COLUMN_DISPLAY_NAMES: Record<string, Record<string, string>> = {
  users: {
    id: 'ID',
    username: 'Email Address',
    password: 'Password',
    role: 'Role',
    sessionid: 'sessionid',
    created_at: 'Registration Date',
    updated_at: 'Last Updated',
    // Add more custom names for users table
  },
  daily_rates: {
    id: 'ID',
    asof_date: 'Date',
    inserted_by: 'Inserted By',
    date_time: 'Inserted Date',
    material: 'Material',
    karat: 'Karat',
    n_price: 'New Price',
    o_price: 'Old Price',
    created_at: 'Created',
    updated_at: 'Updated',
    // Add more custom names for daily_rates table
  },
  expense_log: {
    id: 'ID',
    asof_date: 'Date',
    expense_type: 'Expense Type',
    item_name: 'Item name',
    cost: 'Cost',
    udhaar: 'Udhaar',
    created_at: 'Created Date',
    // Add more custom names for expense_log table
  },
  sales_log: {
    id: 'ID',
    asof_date: 'Date',
    inserted_by: 'Inserted By',
    date_time: 'Inserted Date',
    material: 'Material',
    type: 'Sales type',
    item_name: 'Item name',
    tag_no: 'Tag#',
    customer_name: 'Customer Name',
    customer_phone: 'Customer Phone',
    o1_gram: 'Old1 Grams',
    o1_purity: 'Old1 Purity %',
    o2_gram: 'Old2 Grams',
    o2_purity: 'Old2 Purity %',
    o_cost: 'Old Cost',
    p_grams: 'Purchase Grams',
    p_purity: 'Purchase purity %',
    p_cost: 'Purchase Cost',
    s_purity: 'Sales purity %',
    wastage: 'Wastage %',
    s_cost: 'Sales Cost',
    profit: 'Profit',
    created_at: 'Created Date',
     // Add more custom names for sales_log table
  },
  activity_log: {
    id: 'ID',
    user_id: 'User ID',
    action: 'Action',
    details: 'Details',
    timestamp: 'Date & Time',
    ip_address: 'IP Address',
    user_agent: 'Device Info',
    // Add more custom names for activity_log table
  },
};

// Columns that should show totals for each table
// Only these columns will display totals at the bottom
const COLUMNS_TO_TOTAL: Record<string, string[]> = {
  users: [
    // Add column names that should show totals for users table
    // Example: 'login_count', 'total_orders', etc.
  ],
  daily_rates: [
   // Add column names that should show totals for users table
    // Example: 'login_count', 'total_orders', etc.
  ],
  expense_log: [
    'cost',
  ],
  sales_log: [
    'o1_gram',
    'o2_gram',
    'o_cost',
    'p_grams',
    'p_cost',
    'wastage',
    's_cost',
    'profit',
  ],
  activity_log: [
    // Add column names that should show totals for activity_log table
  ],
};

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
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  // Check if user has access (admin or owner only)
  const hasAccess = user?.role === 'admin' || user?.role === 'owner';

  // Function to get display name for a column
  const getColumnDisplayName = (column: string): string => {
      if (!selectedTable) {
        return column.replace(/_/g, ' ').toUpperCase();
      }
  
      const tableMappings = COLUMN_DISPLAY_NAMES[selectedTable];
      if (tableMappings && tableMappings[column]) {
        return tableMappings[column];
      }
  
      // Fallback to default formatting
      return column.replace(/_/g, ' ').toUpperCase();
  };

  useEffect(() => {
    if (!hasAccess) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this feature.",
        variant: "destructive",
      });
    }
  }, [hasAccess, toast]);


  const handleFilterChange = (column: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: value
    }));
  };

   // Filtered data based on column filters
   const filteredData = useMemo(() => {
    if (Object.keys(columnFilters).length === 0) return tableData;
    
    return tableData.filter(row => {
      return Object.entries(columnFilters).every(([column, filterValue]) => {
        if (!filterValue.trim()) return true;
        
        const cellValue = row[column];
        const filter = filterValue.toLowerCase().trim();
        
        // Handle different data types
        if (typeof cellValue === 'boolean') {
          // For boolean columns like "Udhaar"
          const boolFilter = filter.toLowerCase();
          if (boolFilter === 'true' || boolFilter === 'yes' || boolFilter === '1') {
            return cellValue === true;
          }
          if (boolFilter === 'false' || boolFilter === 'no' || boolFilter === '0') {
            return cellValue === false;
          }
          // Also check for partial matches
          const boolString = cellValue ? 'yes' : 'no';
          return boolString.includes(filter) || filter.includes(boolString);
        }
        
        // For string/number values, use existing logic
        const stringValue = String(cellValue || '').toLowerCase().trim();
        
        // Improved matching logic with word boundaries
        // 1. Exact match
        if (stringValue === filter) return true;
        
        // 2. Word boundary match (filter matches start of a word)
        const words = stringValue.split(/\s+/);
        const wordStartsWithFilter = words.some(word => 
          word.startsWith(filter) || word === filter
        );
        if (wordStartsWithFilter) return true;
        
        // 3. Allow substring match only if filter is longer than 3 characters
        if (filter.length > 3) {
          return stringValue.includes(filter);
        }
        
        return false;
      });
    });
  }, [tableData, columnFilters]);

    // Calculate totals for specified columns only
    const totals = useMemo(() => {
      if (filteredData.length === 0 || !selectedTable) return {};
      
      const columnsToTotal = COLUMNS_TO_TOTAL[selectedTable] || [];
      if (columnsToTotal.length === 0) return {};
      
      const calculatedTotals: Record<string, number> = {};
      
      columnsToTotal.forEach(column => {
        // Only calculate totals for columns that exist in the current data
        if (!columns.includes(column)) return;
        
        let sum = 0;
        let hasNumericData = false;
        
        filteredData.forEach(row => {
          const value = row[column];
          if (typeof value === 'number') {
            sum += value;
            hasNumericData = true;
          } else if (typeof value === 'string' && !isNaN(Number(value))) {
            sum += Number(value);
            hasNumericData = true;
          }
        });
        
        // Only include totals for columns that have numeric data
        if (hasNumericData) {
          calculatedTotals[column] = sum;
        }
      });
      
      return calculatedTotals;
    }, [filteredData, selectedTable, columns]);

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

      // Reset filters when new data is loaded
      setColumnFilters({});

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
    if (filteredData.length === 0) {
      toast({
        title: "No Data",
        description: "No data available to download.",
        variant: "destructive",
      });
      return;
    }

    // Create CSV content with filtered data
    const headers = columns.map(col => getColumnDisplayName(col)).join(',');
    const rows = filteredData.map(row => 
      columns.map(col => {
        const value = row[col];
        // Handle JSON data and escape commas/quotes
        if (typeof value === 'object' && value !== null) {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        return `"${String(value || '').replace(/"/g, '""')}"`;
      }).join(',')
    );

    // Add totals row if there are numeric columns
    const totalsRow = columns.map(col => {
      if (totals[col] !== undefined) {
        return `"TOTAL: ${totals[col].toFixed(2)}"`;
      }
      return '""';
    });

    const csvContent = [headers, ...rows, totalsRow.join(',')].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedTable}_${fromDate}_to_${toDate}_filtered.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Download Complete",
      description: `${selectedTable} filtered data exported successfully.`,
    });
  };

  const clearAllFilters = () => {
    setColumnFilters({});
  };

  const formatCellValue = (value: any, columnName?: string, tableName?: string) => {
    // Mask password columns for security
    if (tableName === 'users' && columnName && 
        (columnName.toLowerCase().includes('password') || 
         columnName.toLowerCase() === 'pwd' || 
         columnName.toLowerCase() === 'pass')) {
      return '••••••••';
    }

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
                  Showing {filteredData.length} of {tableData.length} records from {selectedTable}
                </p>
                <div className="flex gap-2">
                  {Object.keys(columnFilters).some(key => columnFilters[key].trim()) && (
                    <Button onClick={clearAllFilters} variant="outline" size="sm">
                      Clear Filters
                    </Button>
                  )}
                  <Button onClick={downloadCSV} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download CSV
                  </Button>
                </div>
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
                  <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                    {/* Column Headers */}
                    <TableRow>
                      {columns.map((column) => (
                        <TableHead key={column} className="whitespace-nowrap font-semibold">
                          {getColumnDisplayName(column)}
                        </TableHead>
                      ))}
                    </TableRow>
                    {/* Filter Row */}
                    <TableRow className="bg-gray-50">
                      {columns.map((column) => (
                        <TableHead key={`filter-${column}`} className="p-2">
                          <div className="flex items-center gap-1">
                            <Search className="h-3 w-3 text-gray-400" />
                            <Input
                              placeholder={`Filter ${getColumnDisplayName(column)}`}
                              value={columnFilters[column] || ''}
                              onChange={(e) => handleFilterChange(column, e.target.value)}
                              className="h-7 text-xs border-gray-300 focus:border-blue-500"
                            />
                            {(columnFilters[column] || '').trim() && (
                              <Button
                                onClick={() => handleFilterChange(column, '')}
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 hover:bg-gray-200"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Data Rows */}
                    {filteredData.slice(0, 50).map((row, index) => (
                      <TableRow key={index}>
                        {columns.map((column) => (
                          <TableCell key={column} className="max-w-xs truncate">
                            {formatCellValue(row[column], column, selectedTable)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {/* Totals Row */}
                    {Object.keys(totals).length > 0 && (
                      <TableRow className="bg-blue-50 font-semibold border-t-2 border-blue-200">
                        {columns.map((column) => (
                          <TableCell key={`total-${column}`} className="font-bold text-blue-800">
                            {totals[column] !== undefined ? (
                              <div className="flex items-center gap-1">
                                <span className="text-blue-600">{getColumnDisplayName(column)}:</span>
                                <span>{totals[column].toFixed(2)}</span>
                            </div>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                {filteredData.length > 50 && (
                  <p className="text-sm text-gray-500 mt-2 text-center">
                    Showing first 50 of {filteredData.length} filtered records. Download CSV for complete data.
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