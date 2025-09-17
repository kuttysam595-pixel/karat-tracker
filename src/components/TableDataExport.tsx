import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Download, Database, Calendar, Filter, AlertCircle, ArrowLeft, Search, X, Mic, MessageSquare, Loader2, Sparkles, Square, Eye, EyeOff, Settings, CalendarIcon, ChevronDown, ChevronUp, Code, Edit } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { openaiService } from '@/lib/openaiService';
import { useAudioRecorder, isAudioRecordingSupported } from '@/hooks/useAudioRecorder';
import { DataMaskingService } from '@/lib/dataMasking';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';

interface TableData {
  [key: string]: any;
}

type TableName = 'users' | 'daily_rates' | 'expense_log' | 'sales_log' | 'activity_log';

const AVAILABLE_TABLES: { value: TableName; label: string }[] = [
 /* { value: 'users', label: 'Users' }, */
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
    new_price_per_gram: 'New Price (₹)',
    old_price_per_gram: 'Old Price (₹)',
    created_at: 'Created At',
  },
  expense_log: {
    actions: 'Actions',
    id: 'ID',
    asof_date: 'Date',
    expense_type: 'Expense Type',
    item_name: 'Item Name',
    cost: 'Cost (₹)',
    is_credit: 'Credit',
    created_at: 'Created At',
  },
  sales_log: {
    actions: 'Actions',
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
    old_weight_grams: 'Old Material Weight (g)',
    old_purchase_purity: 'Old Purchase Purity (%)',
    o2_gram: 'Old Gold 2 (g)',
    old_sales_purity: 'Old Sales Purity (%)',
    old_material_profit: 'Old Material Profit (₹)',
    purchase_weight_grams: 'Purchase Weight (g)',
    purchase_purity: 'Purchase Purity (%)',
    purchase_cost: 'Purchase Cost (₹)',
    selling_purity: 'Selling Purity (%)',
    wastage: 'Wastage (%)',
    selling_cost: 'Selling Cost (₹)',
    profit: 'Profit (₹)',
    created_at: 'Created At',
  },
  activity_log: {
    id: 'ID',
    user_id: 'User',
    table_name: 'Table',
    action: 'Action',
    record_id: 'Record ID',
    old_data: 'Previous Data',
    new_data: 'New Data',
    timestamp: 'Date & Time',
    ip_address: 'IP Address',
    user_agent: 'User Agent',
  },
};

// Default visible columns for each table
const DEFAULT_VISIBLE_COLUMNS: Record<string, string[]> = {
  users: ['id', 'username', 'role', 'created_at'],
  daily_rates: ['id', 'asof_date', 'material', 'karat', 'new_price_per_gram', 'old_price_per_gram'],
  expense_log: ['actions', 'id', 'asof_date', 'expense_type', 'item_name', 'cost', 'is_credit'],
  sales_log: ['actions', 'id', 'asof_date', 'material', 'customer_name', 'purchase_weight_grams', 'selling_cost', 'profit'],
  activity_log: ['id', 'user_id', 'table_name', 'action', 'old_data', 'new_data', 'timestamp'],
};

// Columns that should show totals (for each table)
const COLUMNS_TO_TOTAL: Record<string, string[]> = {
  sales_log: ['wastage','old_weight_grams','o2_gram','old_material_profit','purchase_weight_grams','purchase_cost','selling_cost', 'profit'],
  expense_log: ['cost'],
  daily_rates: [],
  users: [],
  activity_log: [],
};

// Helper function to get the appropriate sort column for each table
const getSortColumn = (tableName: string): string => {
  switch (tableName) {
    case 'users':
      return 'created_at';
    case 'activity_log':
      return 'timestamp';
    case 'daily_rates':
    case 'expense_log':
    case 'sales_log':
      return 'asof_date';
    default:
      return 'asof_date';
  }
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
  const [showDeveloperInfo, setShowDeveloperInfo] = useState(false);

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

    // Sort by appropriate date column (newest first)
    const sortColumn = getSortColumn(selectedTable || '');
    filtered.sort((a, b) => {
      const dateA = new Date(a[sortColumn] || 0);
      const dateB = new Date(b[sortColumn] || 0);
      return dateB.getTime() - dateA.getTime();
    });

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

        // Handle boolean columns (like is_credit)
        if (column === 'is_credit' || typeof rawValue === 'boolean') {
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

      // Determine the appropriate date column for sorting
      const sortColumn = getSortColumn(selectedTable);

      const { data, error } = await query.order(sortColumn, { ascending: false }).limit(1000);

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

        // Add actions column for sales_log and expense_log
        const finalColumns = (selectedTable === 'sales_log' || selectedTable === 'expense_log')
          ? ['actions', ...allColumns]
          : allColumns;

        setColumns(finalColumns);

        // Set default visible columns for the selected table
        const defaultVisible = DEFAULT_VISIBLE_COLUMNS[selectedTable] || allColumns.slice(0, 6);
        setVisibleColumns(defaultVisible.filter(col => finalColumns.includes(col)));

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
      const financial = ['actions', 'id', 'asof_date', 'customer_name', 'material', 'purchase_cost', 'selling_cost', 'profit'];
      setVisibleColumns(financial.filter(col => columns.includes(col) || col === 'actions'));
    } else if (selectedTable === 'expense_log') {
      const financial = ['actions', 'id', 'asof_date', 'expense_type', 'item_name', 'cost', 'is_credit'];
      setVisibleColumns(financial.filter(col => columns.includes(col) || col === 'actions'));
    } else if (selectedTable === 'daily_rates') {
      const financial = ['id', 'asof_date', 'material', 'karat', 'new_price_per_gram', 'old_price_per_gram'];
      setVisibleColumns(financial.filter(col => columns.includes(col)));
    } else {
      showDefaultColumns();
    }
  };

  const showBasicInfoColumns = () => {
    if (selectedTable === 'sales_log') {
      const basic = ['actions', 'id', 'asof_date', 'customer_name', 'customer_phone', 'material', 'type'];
      setVisibleColumns(basic.filter(col => columns.includes(col) || col === 'actions'));
    } else if (selectedTable === 'expense_log') {
      const basic = ['actions', 'id', 'asof_date', 'expense_type', 'item_name'];
      setVisibleColumns(basic.filter(col => columns.includes(col) || col === 'actions'));
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

    // Handle JSON objects for CSV export
    if (typeof value === 'object' && value !== null && (columnName === 'old_data' || columnName === 'new_data' || columnName === 'details')) {
      try {
        const jsonData = typeof value === 'string' ? JSON.parse(value) : value;

        if (!jsonData || Object.keys(jsonData).length === 0) return '';

        // For CSV, create a more detailed but still readable format
        const entries = Object.entries(jsonData)
          .filter(([key, val]) => key !== 'id' && key !== 'created_at' && key !== 'updated_at');

        if (entries.length === 0) return '';

        return entries.map(([key, val]) => {
          let displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          let displayValue = val;

          // Format specific value types for CSV
          if (key.includes('cost') || key.includes('price') || key === 'profit') {
            const numVal = parseFloat(String(val));
            if (!isNaN(numVal)) {
              displayValue = `₹${numVal.toLocaleString('en-IN')}`;
            }
          } else if (typeof val === 'boolean') {
            displayValue = val ? 'Yes' : 'No';
          } else if (key.includes('date') && val) {
            try {
              const date = new Date(String(val));
              if (!isNaN(date.getTime())) {
                displayValue = date.toLocaleDateString('en-IN');
              }
            } catch (e) {
              // Keep original value
            }
          }

          return `${displayKey}: ${displayValue}`;
        }).join('; ');
      } catch (e) {
        // If JSON parsing fails, treat as string
        return String(value);
      }
    }

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

    // Sort data by appropriate date column before export
    const sortColumn = getSortColumn(selectedTable || '');

    // Sort filtered data by date column (newest first)
    const sortedData = [...filteredData].sort((a, b) => {
      const dateA = new Date(a[sortColumn] || 0);
      const dateB = new Date(b[sortColumn] || 0);
      return dateB.getTime() - dateA.getTime();
    });

    const csvColumns = visibleColumns.filter(col => col !== 'actions');
    const headers = csvColumns.map(col => getColumnDisplayName(col)).join(',');
    const rows = sortedData.map(row =>
      csvColumns.map(col => {
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
        tableName: 'multi_table', // Legacy field for backward compatibility
        relevantTables: [], // Will be detected automatically
        detectedIntent: 'user_query', // Will be detected automatically
        columns: [], // Not restricting to specific columns
        sampleData: [], // Not limiting to specific sample data
        tableSchemas: {}, // Will be fetched automatically
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
        const totalPurchase = data?.reduce((sum, row) => sum + (row.purchase_cost || 0), 0) || 0;
        const totalSales = data?.reduce((sum, row) => sum + (row.selling_cost || 0), 0) || 0;

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

  // Handle edit button click
  const handleEdit = (row: TableData) => {
    if (selectedTable === 'sales_log') {
      navigate(`/add-sales?edit=true&id=${row.id}`);
    } else if (selectedTable === 'expense_log') {
      navigate(`/add-expense?edit=true&id=${row.id}`);
    }
  };

  // Format cell value for display
  const formatCellValue = (value: any, columnName?: string, tableName?: string) => {
    if (value === null || value === undefined) return '';

    // Handle JSON objects (for activity log old_data/new_data columns)
    if (typeof value === 'object' && value !== null && (columnName === 'old_data' || columnName === 'new_data' || columnName === 'details')) {
      try {
        // If it's already a JSON object, format it nicely
        const jsonData = typeof value === 'string' ? JSON.parse(value) : value;

        // For activity log, show key changes in a readable format
        if (tableName === 'activity_log' && (columnName === 'old_data' || columnName === 'new_data')) {
          if (!jsonData || Object.keys(jsonData).length === 0) return '—';

          // Show only the changed fields in a compact format
          const entries = Object.entries(jsonData)
            .filter(([key, val]) => key !== 'id' && key !== 'created_at' && key !== 'updated_at')
            .slice(0, 3); // Show max 3 fields to keep it readable

          if (entries.length === 0) return '—';

          return entries.map(([key, val]) => {
            let displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            let displayValue = val;

            // Format specific value types
            if (key.includes('cost') || key.includes('price') || key === 'profit') {
              const numVal = parseFloat(String(val));
              if (!isNaN(numVal)) {
                displayValue = `₹${numVal.toLocaleString('en-IN')}`;
              }
            } else if (typeof val === 'boolean') {
              displayValue = val ? 'Yes' : 'No';
            } else if (key.includes('date') && val) {
              try {
                const date = new Date(String(val));
                if (!isNaN(date.getTime())) {
                  displayValue = date.toLocaleDateString('en-IN');
                }
              } catch (e) {
                // Keep original value
              }
            }

            return `${displayKey}: ${displayValue}`;
          }).join(', ');
        }

        // For other JSON fields, show a compact representation
        return JSON.stringify(jsonData, null, 0).substring(0, 100) + (JSON.stringify(jsonData).length > 100 ? '...' : '');
      } catch (e) {
        // If JSON parsing fails, treat as string
        return String(value).substring(0, 100) + (String(value).length > 100 ? '...' : '');
      }
    }

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
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 flex items-center justify-center">
        <div className="max-w-md mx-auto">
          <Alert className="border-0 bg-white/90 backdrop-blur-sm shadow-lg">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-slate-700">
              You don't have permission to access this feature. Only admins and owners can export data.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50">
      {/* Mobile-Optimized Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-amber-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="border-amber-300 text-amber-700 hover:bg-amber-100 w-full sm:w-auto"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="p-2 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full">
                <Database className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="flex-1 sm:flex-none">
                <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-amber-600 to-yellow-600 bg-clip-text text-transparent">
                  Data Export & AI Query
                </h1>
                <p className="text-xs text-slate-600 hidden sm:block">Advanced Analytics & Export Tools</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">

      {/* AI Query Section - Special Gradient for AI Features */}
      <Card className="border-0 bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10"></div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-400/20 to-blue-400/20 rounded-full blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-indigo-400/20 to-purple-400/20 rounded-full blur-xl"></div>
        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent font-bold">
              AI Query Assistant
            </span>
            <div className="ml-auto">
              <span className="px-2 py-1 text-xs font-medium bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-full">
                ✨ AI Powered
              </span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 relative">
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
              className="whitespace-nowrap bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-semibold shadow-lg"
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

          {/* Privacy Protection Notice */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-green-600">🛡️</span>
              <span className="text-sm font-medium text-green-900">Privacy Protection Enabled</span>
            </div>
            <p className="text-sm text-gray-700">
              Customer names and phone numbers are automatically masked before sending data to AI services to protect customer privacy.
              All sensitive information remains secure and private.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* AI Query Results */}
      {showQueryResults && (
        <Card className="border-0 bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 shadow-lg relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-indigo-500/5 to-blue-500/5"></div>
          <CardHeader className="relative">
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <div className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent font-bold">
                AI Query Results
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 relative">
            {/* Query Summary */}
            {querySummary && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Query Summary</h4>
                <p className="text-blue-800">{querySummary}</p>
              </div>
            )}

            {/* Results Table */}
            {queryResults.length > 0 && (
              <div className="space-y-4">
                {/* Privacy Notice for AI Results */}
                {DataMaskingService.getSafeDataSummary(queryResults).hasSensitiveData && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Privacy Protection Active</span>
                    </div>
                    <p className="text-sm text-blue-800 mt-1">
                      Customer names and phone numbers are masked in the results below to protect privacy.
                    </p>
                  </div>
                )}

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {Object.keys(queryResults[0]).map((column) => (
                          <TableHead key={column} className="bg-gray-50 font-semibold">
                            {column.replace(/_/g, ' ').toUpperCase()}
                            {DataMaskingService.isSensitiveField(column) && (
                              <span className="ml-1 text-xs text-blue-600" title="This field contains masked data for privacy">
                                🔒
                              </span>
                            )}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {DataMaskingService.maskQueryResults(queryResults).map((row, index) => (
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
              </div>
            )}

            {/* Developer Information Section - Collapsible */}
            {(sqlQuery || queryExplanation) && (
              <div className="border-t pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeveloperInfo(!showDeveloperInfo)}
                  className="w-full justify-between text-gray-600 hover:text-gray-800"
                >
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    <span className="text-sm font-medium">Developer Information</span>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">Testing Only</span>
                  </div>
                  {showDeveloperInfo ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>

                {showDeveloperInfo && (
                  <div className="mt-3 space-y-3">
                    {/* SQL Query Display */}
                    {sqlQuery && (
                      <div className="bg-gray-50 border rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                          <Code className="w-4 h-4" />
                          Generated SQL Query
                        </h4>
                        <code className="text-sm bg-gray-100 p-2 rounded block overflow-x-auto whitespace-pre-wrap">
                          {sqlQuery}
                        </code>
                        {queryExplanation && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <h5 className="font-medium text-gray-800 mb-1">Explanation:</h5>
                            <p className="text-gray-600 text-sm">{queryExplanation}</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="text-xs text-gray-500 bg-yellow-50 border border-yellow-200 rounded p-2">
                      ⚠️ <strong>Note:</strong> This section is for development and testing purposes only.
                      It shows the generated SQL query and technical details that are not needed for end users.
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      
      {/* Table Selection and Date Filters */}
      <Card className="border-0 bg-white/90 backdrop-blur-sm shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <Filter className="w-5 h-5 text-amber-600" />
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
                className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-semibold shadow-lg"
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

      {/* Regular Table Display */}
      {tableData.length > 0 && (
        <Card className="border-0 bg-white/90 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-slate-800">
              <span className="flex items-center gap-2">
                <Database className="w-5 h-5 text-amber-600" />
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadCSV}
                  className="border-amber-300 text-amber-700 hover:bg-amber-100"
                >
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
              {visibleColumns.filter(col => col !== 'actions').slice(0, 6).map((column) => {
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
                          {column === 'actions' ? (
                            (selectedTable === 'sales_log' || selectedTable === 'expense_log') ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(row)}
                                className="h-8 w-8 p-0"
                                title="Edit Record"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            ) : null
                          ) : (
                            formatCellValue(row[column], column, selectedTable)
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}

                  {/* Totals row */}
                  {Object.keys(totals).length > 0 && (
                    <TableRow className="font-semibold bg-gray-50">
                      {visibleColumns.map((column, index) => (
                        <TableCell key={`total-${column}`}>
                          {column === 'actions' ? '' :
                           index === 0 || (index === 1 && visibleColumns[0] === 'actions') ? 'TOTAL' :
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
    </div>
  );
};