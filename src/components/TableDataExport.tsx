import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Download, Database, Calendar, Filter, AlertCircle, ArrowLeft, Search, X, Mic, MessageSquare, Loader2, Sparkles, Square, Eye, EyeOff, Settings, CalendarIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { openaiService } from '@/lib/openaiService';
import { useAudioRecorder, isAudioRecordingSupported } from '@/hooks/useAudioRecorder';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';

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
const COLUMN_DISPLAY_NAMES: Record<string, Record<string, string>> = {
  users: {
    id: 'ID',
    username: 'Email Address',
    password: 'Password',
    role: 'Role',
    sessionid: 'sessionid',
    created_at: 'Registration Date',
    updated_at: 'Last Updated',
  },
  daily_rates: {
    id: 'ID',
    asof_date: 'Date',
    inserted_by: 'Inserted By',
    date_time: 'Inserted Date',
    material: 'Material',
    karat: 'Karat',
    n_price: 'New Price (₹)',
    o_price: 'Old Price (₹)',
    created_at: 'Created At',
  },
  expense_log: {
    id: 'ID',
    asof_date: 'Date',
    expense_type: 'Expense Type',
    item_name: 'Item Name',
    cost: 'Cost (₹)',
    udhaar: 'Udhaar',
    created_at: 'Created At',
  },
  sales_log: {
    id: 'ID',
    asof_date: 'Date',
    inserted_by: 'Inserted By',
    date_time: 'Transaction Time',
    material: 'Material',
    type: 'Type',
    item_name: 'Item Name',
    tag_no: 'Tag Number',
    customer_name: 'Customer Name',
    customer_phone: 'Customer Phone',
    o1_gram: 'Old Gold 1 (g)',
    o1_purity: 'Old Gold 1 Purity (%)',
    o2_gram: 'Old Gold 2 (g)',
    o2_purity: 'Old Gold 2 Purity (%)',
    o_cost: 'Old Gold Cost (₹)',
    p_grams: 'Purchase Weight (g)',
    p_purity: 'Purchase Purity (%)',
    p_cost: 'Purchase Cost (₹)',
    s_purity: 'Sale Purity (%)',
    wastage: 'Wastage (%)',
    s_cost: 'Sale Cost (₹)',
    profit: 'Profit (₹)',
    created_at: 'Created At',
  },
  activity_log: {
    id: 'ID',
    user_id: 'User ID',
    action: 'Action',
    details: 'Details',
    timestamp: 'Timestamp',
    ip_address: 'IP Address',
    user_agent: 'User Agent',
  },
};

// Default visible columns for each table
const DEFAULT_VISIBLE_COLUMNS: Record<string, string[]> = {
  users: ['id', 'username', 'role', 'created_at'],
  daily_rates: ['id', 'asof_date', 'material', 'karat', 'n_price', 'o_price'],
  expense_log: ['id', 'asof_date', 'expense_type', 'item_name', 'cost', 'udhaar'],
  sales_log: ['id', 'asof_date', 'material', 'customer_name', 'p_grams', 's_cost', 'profit'],
  activity_log: ['id', 'action', 'details', 'timestamp'],
};

// Columns that should show totals (for each table)
const COLUMNS_TO_TOTAL: Record<string, string[]> = {
  sales_log: ['wastage','o1_gram','o2_gram','o_cost','p_grams','p_cost','s_grams', 's_cost', 'profit'],
  expense_log: ['cost'],
  daily_rates: [],
  users: [],
  activity_log: [],
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
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessingQuery, setIsProcessingQuery] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [sqlQuery, setSqlQuery] = useState('');
  const [queryExplanation, setQueryExplanation] = useState('');
  const [initialSummary, setInitialSummary] = useState('');
  const [queryResults, setQueryResults] = useState<TableData[]>([]);
  const [querySummary, setQuerySummary] = useState('');
  const [showQueryResults, setShowQueryResults] = useState(false);
  const [lastRecordedAudio, setLastRecordedAudio] = useState<Blob | null>(null);
  const [fromDateOpen, setFromDateOpen] = useState(false);
  const [toDateOpen, setToDateOpen] = useState(false);
  const [columnDatePopoverOpen, setColumnDatePopoverOpen] = useState<Record<string, boolean>>({});

  // Audio recording hook
  const {
    isRecording,
    isProcessing: isProcessingAudio,
    error: audioError,
    startRecording,
    stopRecording,
    duration
  } = useAudioRecorder();

  // Check if user has access (admin or owner only)
  const hasAccess = user?.role === 'admin' || user?.role === 'owner';

  // Handle audio error notifications
  useEffect(() => {
    if (audioError) {
      toast({
        title: "Audio Recording Error",
        description: audioError,
        variant: "destructive",
      });
    }
  }, [audioError, toast]);

  // Check access on component mount
  useEffect(() => {
    if (!hasAccess) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this feature. Only admins and owners can export data.",
        variant: "destructive",
      });
    }
  }, [hasAccess, toast]);

  const getColumnDisplayName = (column: string): string => {
    if (selectedTable && COLUMN_DISPLAY_NAMES[selectedTable]) {
      return COLUMN_DISPLAY_NAMES[selectedTable][column] || column;
    }
    return column;
  };

  const handleFilterChange = (column: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: value
    }));
  };

  // Filtered data based on column filters
  const filteredData = useMemo(() => {
    let filtered = [...tableData];

    // Apply date filtering if dates are set
    if (fromDate || toDate) {
      filtered = filtered.filter(row => {
        const dateColumn = selectedTable === 'users' ? 'created_at' : 'asof_date';
        const rowDate = row[dateColumn];

        if (!rowDate) return false;

        const date = new Date(rowDate);
        const fromDateObj = fromDate ? new Date(fromDate) : null;
        const toDateObj = toDate ? new Date(toDate) : null;

        if (fromDateObj && date < fromDateObj) return false;
        if (toDateObj && date > toDateObj) return false;

        return true;
      });
    }

    // Apply column filters
    if (Object.keys(columnFilters).length === 0) return filtered;

    return filtered.filter(row => {
      return Object.entries(columnFilters).every(([column, filterValue]) => {
        if (!filterValue.trim()) return true;

        const rawValue = row[column];

        // Handle boolean columns (like udhaar)
        if (column === 'udhaar' || typeof rawValue === 'boolean') {
          const filterLower = filterValue.toLowerCase().trim();

          // Convert boolean to yes/no for comparison
          let booleanValue = '';
          if (typeof rawValue === 'boolean') {
            booleanValue = rawValue ? 'yes' : 'no';
          } else if (rawValue === true || rawValue === 'true' || rawValue === 1 || rawValue === '1') {
            booleanValue = 'yes';
          } else if (rawValue === false || rawValue === 'false' || rawValue === 0 || rawValue === '0') {
            booleanValue = 'no';
          } else {
            booleanValue = String(rawValue || '').toLowerCase();
          }

          // Check for yes/no matches
          if (filterLower === 'yes' || filterLower === 'y') {
            return booleanValue === 'yes' || booleanValue === 'true' || booleanValue === '1';
          } else if (filterLower === 'no' || filterLower === 'n') {
            return booleanValue === 'no' || booleanValue === 'false' || booleanValue === '0';
          }

          // Fallback to contains check
          return booleanValue.includes(filterLower);
        }

        // Handle date columns
        if (column.includes('date') || column.includes('time')) {
          try {
            const cellDate = new Date(rawValue);
            const filterDate = new Date(filterValue);

            if (!isNaN(cellDate.getTime()) && !isNaN(filterDate.getTime())) {
              return cellDate.toDateString() === filterDate.toDateString();
            }
          } catch (e) {
            // Fall through to text matching
          }
        }

        // Regular text matching for other columns
        const cellValue = String(rawValue || '').toLowerCase();
        const searchTerms = filterValue.toLowerCase().split(' ').filter(term => term.length > 0);

        // Check if all search terms are found in the cell value
        return searchTerms.every(term => {
          // Exact match for the term at word boundaries
          const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
          const exactMatch = regex.test(cellValue);

          // Partial match - if any word in the cell starts with the search term
          const words = cellValue.split(/\s+/);
          const wordStartsWithFilter = words.some(word =>
            word.startsWith(term)
          );

          return exactMatch || wordStartsWithFilter;
        });
      });
    });
  }, [tableData, columnFilters, fromDate, toDate, selectedTable]);

  // Calculate totals for numeric columns
  const totals = useMemo(() => {
    if (!selectedTable || !COLUMNS_TO_TOTAL[selectedTable]) return {};

    const totalsObj: Record<string, number> = {};
    COLUMNS_TO_TOTAL[selectedTable].forEach(column => {
      const total = filteredData.reduce((sum, row) => {
        const value = parseFloat(row[column]) || 0;
        return sum + value;
      }, 0);
      totalsObj[column] = total;
    });
    return totalsObj;
  }, [filteredData, selectedTable]);

  const fetchTableData = async () => {
    if (!selectedTable) return;

    setLoading(true);
    try {
      let query = supabase.from(selectedTable).select('*');

      // Add date filtering if dates are provided
      if (fromDate && toDate) {
        // Assume all tables have an 'asof_date' or 'created_at' column
        const dateColumn = selectedTable === 'users' ? 'created_at' : 'asof_date';
        query = query.gte(dateColumn, fromDate).lte(dateColumn, toDate);
      }

      const { data, error } = await query.order('id', { ascending: false }).limit(1000);

      if (error) {
        console.error('Error fetching data:', error);
        toast({
          title: "Error",
          description: "Failed to fetch table data. Please try again.",
          variant: "destructive",
        });
        return;
      }

      if (data) {
        setTableData(data);
        const allColumns = Object.keys(data[0] || {});
        setColumns(allColumns);

        // Set default visible columns for the selected table
        const defaultVisible = DEFAULT_VISIBLE_COLUMNS[selectedTable] || allColumns.slice(0, 6);
        setVisibleColumns(defaultVisible.filter(col => allColumns.includes(col)));

        toast({
          title: "Data Loaded",
          description: `Loaded ${data.length} records from ${selectedTable}.`,
        });
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleColumnVisibility = (columnName: string) => {
    setVisibleColumns(prev => {
      if (prev.includes(columnName)) {
        return prev.filter(col => col !== columnName);
      } else {
        return [...prev, columnName];
      }
    });

    // Clear filter for hidden columns
    if (visibleColumns.includes(columnName)) {
      setColumnFilters(prev => {
        const updated = { ...prev };
        delete updated[columnName];
        return updated;
      });
    }
  };

  const showAllColumns = () => {
    setVisibleColumns([...columns]);
  };

  const showDefaultColumns = () => {
    if (selectedTable) {
      const defaultVisible = DEFAULT_VISIBLE_COLUMNS[selectedTable] || columns.slice(0, 6);
      setVisibleColumns(defaultVisible.filter(col => columns.includes(col)));
    }
  };

  const showEssentialColumns = () => {
    const essential = ['id', 'asof_date', 'created_at'];
    const essentialVisible = columns.filter(col => essential.includes(col));
    setVisibleColumns(essentialVisible.length > 0 ? essentialVisible : columns.slice(0, 3));
  };

  const showFinancialColumns = () => {
    if (selectedTable === 'sales_log') {
      const financial = ['id', 'asof_date', 'customer_name', 'material', 'p_cost', 's_cost', 'profit'];
      setVisibleColumns(financial.filter(col => columns.includes(col)));
    } else if (selectedTable === 'expense_log') {
      const financial = ['id', 'asof_date', 'expense_type', 'item_name', 'cost', 'udhaar'];
      setVisibleColumns(financial.filter(col => columns.includes(col)));
    } else if (selectedTable === 'daily_rates') {
      const financial = ['id', 'asof_date', 'material', 'karat', 'n_price', 'o_price'];
      setVisibleColumns(financial.filter(col => columns.includes(col)));
    } else {
      showDefaultColumns();
    }
  };

  const showBasicInfoColumns = () => {
    if (selectedTable === 'sales_log') {
      const basic = ['id', 'asof_date', 'customer_name', 'customer_phone', 'material', 'type'];
      setVisibleColumns(basic.filter(col => columns.includes(col)));
    } else if (selectedTable === 'users') {
      const basic = ['id', 'username', 'role', 'created_at'];
      setVisibleColumns(basic.filter(col => columns.includes(col)));
    } else if (selectedTable === 'activity_log') {
      const basic = ['id', 'action', 'details', 'timestamp'];
      setVisibleColumns(basic.filter(col => columns.includes(col)));
    } else {
      showDefaultColumns();
    }
  };

  // Format cell value specifically for CSV export
  const formatCSVValue = (value: any, columnName?: string) => {
    if (value === null || value === undefined) return '';

    // Currency formatting for CSV (simple format to avoid encoding issues)
    if (columnName && (
      columnName.includes('cost') ||
      columnName.includes('price') ||
      columnName === 'profit'
    )) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        return `₹${numValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
    }

    // Date formatting for CSV
    if (columnName && (columnName.includes('date') || columnName.includes('time')) && value) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('en-IN');
        }
      } catch (e) {
        return value;
      }
    }

    // Boolean formatting
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    return String(value);
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

    const headers = visibleColumns.map(col => getColumnDisplayName(col)).join(',');
    const rows = filteredData.map(row =>
      visibleColumns.map(col => {
        const formattedValue = formatCSVValue(row[col], col);
        // Escape commas and quotes in CSV
        if (typeof formattedValue === 'string' && (formattedValue.includes(',') || formattedValue.includes('"') || formattedValue.includes('\n'))) {
          return `"${formattedValue.replace(/"/g, '""')}"`;
        }
        return formattedValue ?? '';
      }).join(',')
    );

    const csvContent = [headers, ...rows].join('\n');
    // Add UTF-8 BOM to ensure proper encoding for special characters like ₹
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedTable}_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Downloaded",
      description: `${selectedTable} data exported successfully.`,
    });
  };

  const clearAllFilters = () => {
    setColumnFilters({});
  };

  const processAIQuery = async () => {
    if (!searchQuery.trim()) return;

    setIsProcessingQuery(true);
    try {
      // Generate SQL query based on natural language input (can work across all tables)
      const response = await generateSQLFromNaturalLanguage(
        searchQuery,
        selectedTable || 'sales_log', // Default table for context, but query can use any table
        columns,
        tableData.slice(0, 3) // Sample data for context
      );

      setSqlQuery(response.sql);
      setQueryExplanation(response.explanation);
      setInitialSummary(response.summary);

      // Execute the query
      const results = await executeAIQuery(response.sql);
      setQueryResults(results);

      // Generate summary
      const summary = await generateQuerySummary(searchQuery, results);
      setQuerySummary(summary);

      setShowQueryResults(true);

      toast({
        title: "Query Processed",
        description: `Found ${results.length} results for your query.`,
      });
    } catch (error) {
      console.error('Error processing AI query:', error);
      toast({
        title: "Query Failed",
        description: "Failed to process your query. Please try a different question.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingQuery(false);
    }
  };

  const generateSQLFromNaturalLanguage = async (
    query: string,
    table: string,
    columns: string[],
    sampleData: TableData[]
  ): Promise<{ sql: string; explanation: string; summary: string }> => {
    try {
      // Detect if query mentions dates/time periods
      const queryLower = query.toLowerCase();
      const hasDatesInQuery = /\b(today|yesterday|this month|last month|this week|last week|this year|last year|between|from|to|since|until|ago|recent|latest|current)\b/.test(queryLower) ||
                             /\b\d{4}-\d{2}-\d{2}\b/.test(query) || // Date format YYYY-MM-DD
                             /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(queryLower);

      // Use OpenAI service for intelligent SQL generation across all tables
      const response = await openaiService.generateSQLQuery(query, {
        tableName: 'multi_table', // Indicate this can use multiple tables
        columns: [], // Not restricting to specific columns
        sampleData: [], // Not limiting to specific sample data
        tableSchema: undefined, // Will use comprehensive schema info from prompt
        // Only include date range if query mentions dates
        ...(hasDatesInQuery && { dateRange: { from: fromDate, to: toDate } })
      });

      return {
        sql: response.sql,
        explanation: response.explanation,
        summary: response.summary
      };
    } catch (error) {
      console.error('OpenAI SQL generation failed, falling back to pattern matching:', error);

      // Enhanced fallback patterns that can work across tables
      const normalizedQuery = query.toLowerCase();

      if (normalizedQuery.includes('total') && normalizedQuery.includes('profit')) {
        const sql = `SELECT SUM(profit) as total_profit FROM sales_log WHERE asof_date BETWEEN '${fromDate}' AND '${toDate}'`;
        return {
          sql,
          explanation: 'Calculates the total profit from all sales transactions in the specified date range',
          summary: 'This shows the overall profitability of your business for the selected period'
        };
      }

      if (normalizedQuery.includes('expense') && normalizedQuery.includes('profit')) {
        const sql = `SELECT
          SUM(s.profit) as total_profit,
          SUM(e.cost) as total_expenses,
          SUM(s.profit) - SUM(e.cost) as net_profit
        FROM sales_log s
        CROSS JOIN expense_log e
        WHERE s.asof_date BETWEEN '${fromDate}' AND '${toDate}'
        AND e.asof_date BETWEEN '${fromDate}' AND '${toDate}'`;
        return {
          sql,
          explanation: 'Compares total profit from sales against total expenses to calculate net profit',
          summary: 'This gives you the complete financial picture including income and expenses'
        };
      }

      if (normalizedQuery.includes('customer') && normalizedQuery.includes('sales')) {
        const sql = `SELECT customer_name, SUM(profit) as total_profit, COUNT(*) as transactions FROM sales_log WHERE asof_date BETWEEN '${fromDate}' AND '${toDate}' GROUP BY customer_name ORDER BY total_profit DESC LIMIT 10`;
        return {
          sql,
          explanation: 'Shows top customers by total profit generated in the date range',
          summary: 'This identifies your most valuable customers based on profit contribution'
        };
      }

      if (normalizedQuery.includes('material') && (normalizedQuery.includes('gold') || normalizedQuery.includes('silver'))) {
        const sql = `SELECT material, COUNT(*) as transactions, SUM(profit) as total_profit FROM sales_log WHERE asof_date BETWEEN '${fromDate}' AND '${toDate}' GROUP BY material ORDER BY total_profit DESC`;
        return {
          sql,
          explanation: 'Analyzes sales performance by material type (gold/silver)',
          summary: 'This shows which materials are driving the most profit for your business'
        };
      }

      // Default fallback
      const sql = `SELECT * FROM ${table} WHERE asof_date BETWEEN '${fromDate}' AND '${toDate}' ORDER BY created_at DESC LIMIT 50`;
      return {
        sql,
        explanation: 'Shows recent transactions for the specified date range',
        summary: 'This provides a general overview of recent business activity'
      };
    }
  };

  const executeAIQuery = async (sqlQuery: string): Promise<TableData[]> => {
    try {
      console.log('Executing SQL query:', sqlQuery);

      // Use the secure SQL execution function
      const { data, error } = await supabase
        .rpc('execute_safe_query' as any, { query_text: sqlQuery });

      if (error) {
        console.error('SQL execution error:', error);
        throw new Error(`Query failed: ${error.message}`);
      }

      if (!data || data.length === 0) {
        console.log('No data returned from query');
        return [];
      }

      // Convert JSONB results back to regular objects
      const results = data.map((row: any) => {
        if (row.result_json && typeof row.result_json === 'object') {
          return row.result_json;
        }
        return row;
      });

      console.log('Query results:', results);
      return results;
    } catch (error) {
      console.error('Query execution failed:', error);
      // Fallback to executeQueryFallback
      return await executeQueryFallback(sqlQuery);
    }
  };

  const executeQueryFallback = async (sqlQuery: string): Promise<TableData[]> => {
    try {
      // Try to extract meaningful data from the existing table data based on the query
      console.log('Executing fallback query logic for:', sqlQuery);

      if (sqlQuery.includes('SUM(profit)') && sqlQuery.includes('sales_log')) {
        const { data } = await supabase
          .from('sales_log')
          .select('*')
          .gte('asof_date', fromDate || '2024-01-01')
          .lte('asof_date', toDate || '2024-12-31');

        const totalProfit = data?.reduce((sum, row) => sum + (row.profit || 0), 0) || 0;
        const totalPurchase = data?.reduce((sum, row) => sum + (row.p_cost || 0), 0) || 0;
        const totalSales = data?.reduce((sum, row) => sum + (row.s_cost || 0), 0) || 0;

        return [{
          total_profit: totalProfit,
          total_purchase: totalPurchase,
          total_sales: totalSales,
          record_count: data?.length || 0
        }];
      }

      if (sqlQuery.includes('GROUP BY material') && sqlQuery.includes('sales_log')) {
        const { data } = await supabase
          .from('sales_log')
          .select('*')
          .gte('asof_date', fromDate || '2024-01-01')
          .lte('asof_date', toDate || '2024-12-31');

        const totalProfit = data?.reduce((sum, row) => sum + (row.profit || 0), 0) || 0;

        return [{
          material: 'All Materials',
          total_profit: totalProfit,
          transaction_count: data?.length || 0
        }];
      }

      if (sqlQuery.includes('GROUP BY customer_name') && sqlQuery.includes('sales_log')) {
        const { data } = await supabase
          .from('sales_log')
          .select('*')
          .gte('asof_date', fromDate || '2024-01-01')
          .lte('asof_date', toDate || '2024-12-31');

        const customerStats = data?.reduce((acc: Record<string, any>, row) => {
          const customer = row.customer_name || 'Unknown';
          if (!acc[customer]) {
            acc[customer] = { customer_name: customer, total_profit: 0, transactions: 0 };
          }
          acc[customer].total_profit += row.profit || 0;
          acc[customer].transactions += 1;
          return acc;
        }, {});

        return Object.values(customerStats || {}).slice(0, 10);
      }

      // Default fallback - return existing table data
      return tableData.slice(0, 10);
    } catch (error) {
      console.error('Fallback execution failed:', error);
      throw error;
    }
  };

  const generateQuerySummary = async (originalQuery: string, results: TableData[]): Promise<string> => {
    try {
      // Use OpenAI for intelligent summary generation
      return await openaiService.generateSummary(originalQuery, results);
    } catch (error) {
      console.error('OpenAI summary generation failed, using fallback:', error);

      // Fallback to basic summary generation
      if (results.length === 0) {
        return "No data found matching your query.";
      }

      // Analyze results to provide a basic summary
      const firstResult = results[0];
      const resultKeys = Object.keys(firstResult);

      if (resultKeys.includes('total_profit')) {
        const totalProfit = firstResult.total_profit || 0;
        return `Total profit found: ₹${totalProfit.toLocaleString('en-IN')} across ${results.length} record(s).`;
      }

      if (resultKeys.includes('customer_name')) {
        return `Found ${results.length} customer record(s) with sales data.`;
      }

      return `Query returned ${results.length} record(s) with ${resultKeys.length} data columns.`;
    }
  };

  // Format cell value for display
  const formatCellValue = (value: any, columnName?: string, tableName?: string) => {
    if (value === null || value === undefined) return '';

    // Currency formatting for cost/price columns
    if (columnName && (
      columnName.includes('cost') ||
      columnName.includes('price') ||
      columnName === 'profit'
    )) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        return new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
        }).format(numValue);
      }
    }

    // Date formatting
    if (columnName && (columnName.includes('date') || columnName.includes('time')) && value) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('en-IN');
        }
      } catch (e) {
        return value;
      }
    }

    // Boolean formatting
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    return String(value);
  };

  if (!hasAccess) {
    return (
      <div className="container mx-auto py-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access this feature. Only admins and owners can export data.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/dashboard')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Database className="w-8 h-8" />
          Data Export & AI Query
        </h1>
      </div>

      {/* Table Selection and Date Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Data Selection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="table-select">Select Table</Label>
              <Select value={selectedTable} onValueChange={(value: TableName) => setSelectedTable(value)}>
                <SelectTrigger id="table-select">
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

            <div className="space-y-2">
              <Label>From Date</Label>
              <Popover open={fromDateOpen} onOpenChange={setFromDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fromDate ? format(new Date(fromDate), "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={fromDate ? new Date(fromDate) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setFromDate(format(date, "yyyy-MM-dd"));
                      } else {
                        setFromDate('');
                      }
                      setFromDateOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>To Date</Label>
              <Popover open={toDateOpen} onOpenChange={setToDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {toDate ? format(new Date(toDate), "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={toDate ? new Date(toDate) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setToDate(format(date, "yyyy-MM-dd"));
                      } else {
                        setToDate('');
                      }
                      setToDateOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-end space-x-2">
              <Button
                onClick={fetchTableData}
                disabled={!selectedTable || loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4 mr-2" />
                    Load Data
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Query Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            AI Query Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Ask about your data in plain English (e.g., 'total profit this month', 'top customers by sales')"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1.5 h-7 w-7 p-0"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Voice Input Button */}
            <div className="relative">
              <Button
                variant={isRecording ? "destructive" : "secondary"}
                size="sm"
                className={`relative ${isRecording ? 'animate-pulse' : ''}`}
                onMouseDown={async () => {
                  if (!isRecording && !isTranscribing && !isProcessingAudio) {
                    await startRecording();
                  }
                }}
                onMouseUp={async () => {
                  if (isRecording) {
                    try {
                      setIsTranscribing(true);
                      const audioBlob = await stopRecording();

                      if (audioBlob) {
                        setLastRecordedAudio(audioBlob);
                        console.log('Recorded audio blob:', {
                          size: audioBlob.size,
                          type: audioBlob.type
                        });

                        if (audioBlob.size < 1000) {
                          toast({
                            title: "Recording Too Short",
                            description: "The recording appears to be too short or empty. Please try speaking longer.",
                            variant: "destructive",
                          });
                          return;
                        }

                        try {
                          const transcription = await openaiService.transcribeAudio(audioBlob);
                          console.log('Transcription result:', transcription);

                          if (transcription && transcription.trim()) {
                            setSearchQuery(transcription.trim());

                            toast({
                              title: "Voice Input Processed",
                              description: `Transcribed: "${transcription.trim()}". Click process to analyze.`,
                            });
                          } else {
                            toast({
                              title: "No Speech Detected",
                              description: "Could not detect speech in the recording. Please try again.",
                              variant: "destructive",
                            });
                          }
                        } catch (error) {
                          console.error('Transcription error:', error);
                          toast({
                            title: "Transcription Failed",
                            description: error instanceof Error ? error.message : "Failed to transcribe audio. Please try typing your query.",
                            variant: "destructive",
                          });
                        }
                      }
                    } catch (error) {
                      console.error('Recording error:', error);
                      toast({
                        title: "Recording Error",
                        description: "Failed to process recording. Please try again.",
                        variant: "destructive",
                      });
                    } finally {
                      setIsTranscribing(false);
                    }
                  }
                }}
                disabled={isTranscribing || isProcessingAudio}
              >
                {isRecording ? (
                  <>
                    <Square className="w-4 h-4 mr-2" />
                    Release to Stop
                  </>
                ) : isTranscribing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : isProcessingAudio ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 mr-2" />
                    Hold to Speak
                  </>
                )}
              </Button>

              {isRecording && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-1 rounded-full min-w-[24px] text-center">
                  {duration}s
                </div>
              )}
            </div>

            <Button
              onClick={processAIQuery}
              disabled={!searchQuery.trim() || isProcessingQuery}
              className="whitespace-nowrap"
            >
              {isProcessingQuery ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Process Query
                </>
              )}
            </Button>
          </div>

          {isAudioRecordingSupported() ? (
            <div className="text-sm text-muted-foreground">
              💡 Hold the microphone button to record your voice query, or type your question in the text field above.
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Voice input is not supported in your current environment. Please use HTTPS or localhost for voice features.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* AI Query Results */}
      {showQueryResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              AI Query Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Query Summary */}
            {querySummary && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Query Summary</h4>
                <p className="text-blue-800">{querySummary}</p>
              </div>
            )}

            {/* SQL Query Display */}
            {sqlQuery && (
              <div className="bg-gray-50 border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Generated SQL Query</h4>
                <code className="text-sm bg-gray-100 p-2 rounded block overflow-x-auto">
                  {sqlQuery}
                </code>
                {queryExplanation && (
                  <p className="text-gray-600 text-sm mt-2">{queryExplanation}</p>
                )}
              </div>
            )}

            {/* Results Table */}
            {queryResults.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(queryResults[0]).map((column) => (
                        <TableHead key={column} className="bg-gray-50 font-semibold">
                          {column.replace(/_/g, ' ').toUpperCase()}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queryResults.map((row, index) => (
                      <TableRow key={index}>
                        {Object.entries(row).map(([column, value]) => (
                          <TableCell key={`${index}-${column}`}>
                            {formatCellValue(value, column)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Regular Table Display */}
      {tableData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                {selectedTable ? AVAILABLE_TABLES.find(t => t.value === selectedTable)?.label : 'Table Data'}
                <span className="text-sm text-gray-500">({filteredData.length} records)</span>
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowColumnSelector(!showColumnSelector)}>
                  <Settings className="w-4 h-4 mr-1" />
                  Columns ({visibleColumns.length}/{columns.length})
                </Button>
                <Button variant="outline" size="sm" onClick={clearAllFilters}>
                  <X className="w-4 h-4 mr-1" />
                  Clear Filters
                </Button>
                <Button variant="outline" size="sm" onClick={downloadCSV}>
                  <Download className="w-4 h-4 mr-2" />
                  Download CSV
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Column Selection Panel */}
            {showColumnSelector && (
              <div className="mb-6 p-4 border rounded-lg bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900">Select Columns to Display</h4>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={showEssentialColumns}>
                      Essential
                    </Button>
                    <Button variant="outline" size="sm" onClick={showBasicInfoColumns}>
                      Basic Info
                    </Button>
                    <Button variant="outline" size="sm" onClick={showFinancialColumns}>
                      Financial
                    </Button>
                    <Button variant="outline" size="sm" onClick={showDefaultColumns}>
                      Default
                    </Button>
                    <Button variant="outline" size="sm" onClick={showAllColumns}>
                      All
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                  {columns.map((column) => (
                    <label key={column} className="flex items-center space-x-2 p-2 hover:bg-white rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visibleColumns.includes(column)}
                        onChange={() => toggleColumnVisibility(column)}
                        className="rounded border-gray-300"
                      />
                      <div className="flex items-center space-x-1">
                        {visibleColumns.includes(column) ? (
                          <Eye className="w-3 h-3 text-green-600" />
                        ) : (
                          <EyeOff className="w-3 h-3 text-gray-400" />
                        )}
                        <span className="text-sm">{getColumnDisplayName(column)}</span>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t text-sm text-gray-600">
                  <p>💡 <strong>Tip:</strong> Only visible columns will be included in filters and CSV exports.</p>
                  <p>Selected: {visibleColumns.length} of {columns.length} columns</p>
                </div>
              </div>
            )}

            {/* Column Filters */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-4">
              {visibleColumns.slice(0, 6).map((column) => {
                const isDateColumn = column.includes('date') || column.includes('time');

                return (
                  <div key={column} className="space-y-1">
                    <Label className="text-xs">{getColumnDisplayName(column)}</Label>
                    {isDateColumn ? (
                      <Popover
                        open={columnDatePopoverOpen[column] || false}
                        onOpenChange={(open) => setColumnDatePopoverOpen(prev => ({ ...prev, [column]: open }))}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal h-8 text-xs"
                          >
                            <CalendarIcon className="mr-1 h-3 w-3" />
                            {columnFilters[column] ?
                              format(new Date(columnFilters[column]), "MMM dd") :
                              `Filter Date`
                            }
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={columnFilters[column] ? new Date(columnFilters[column]) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                handleFilterChange(column, format(date, "yyyy-MM-dd"));
                              } else {
                                handleFilterChange(column, '');
                              }
                              setColumnDatePopoverOpen(prev => ({ ...prev, [column]: false }));
                            }}
                            initialFocus
                          />
                          {columnFilters[column] && (
                            <div className="p-2 border-t">
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => {
                                  handleFilterChange(column, '');
                                  setColumnDatePopoverOpen(prev => ({ ...prev, [column]: false }));
                                }}
                              >
                                Clear Filter
                              </Button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <Input
                        placeholder={`Filter ${getColumnDisplayName(column)}`}
                        value={columnFilters[column] || ''}
                        onChange={(e) => handleFilterChange(column, e.target.value)}
                        className="h-8 text-xs"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    {visibleColumns.map((column) => (
                      <TableHead key={column} className="bg-gray-50 font-semibold">
                        {getColumnDisplayName(column)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.slice(0, 50).map((row, index) => (
                    <TableRow key={index}>
                      {visibleColumns.map((column) => (
                        <TableCell key={`${index}-${column}`}>
                          {formatCellValue(row[column], column, selectedTable)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}

                  {/* Totals row */}
                  {Object.keys(totals).length > 0 && (
                    <TableRow className="font-semibold bg-gray-50">
                      {visibleColumns.map((column) => (
                        <TableCell key={`total-${column}`}>
                          {column === visibleColumns[0] ? 'TOTAL' :
                           totals[column] !== undefined ?
                           formatCellValue(totals[column], column, selectedTable) : ''}
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
  );
};