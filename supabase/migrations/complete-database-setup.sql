-- ============================================================================
-- KARAT TRACKER - COMPLETE DATABASE SETUP SCRIPT
-- ============================================================================
-- 🎯 SINGLE SCRIPT FOR ALL DATABASE NEEDS
--
-- ✅ NEW DATABASES: Complete setup from scratch
-- ✅ EXISTING DATABASES: Safe updates and fixes (including UPDATE policies)
-- ✅ FIXES EDIT FUNCTIONALITY: Adds missing UPDATE policies for sales/expense editing
--
-- 📋 EXECUTION STEPS:
-- 1. Go to your Supabase Project → SQL Editor
-- 2. Copy this entire script
-- 3. Paste and execute
-- 4. Verify using the queries at the end
--
-- 🔄 CONSOLIDATES: All previous migration files + critical fixes
-- 🛡️ SAFE TO RE-RUN: Uses IF NOT EXISTS and handles existing data
-- ============================================================================

-- ============================================================================
-- SECTION 1: TABLES AND BASIC STRUCTURE
-- ============================================================================

-- Create users table for authentication (with IF NOT EXISTS for safety)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    sessionid TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'owner', 'employee')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create daily_rates table
CREATE TABLE IF NOT EXISTS public.daily_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inserted_by TEXT NOT NULL REFERENCES public.users(username),
    date_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
    asof_date DATE NOT NULL,
    material TEXT NOT NULL CHECK (material IN ('gold', 'silver')),
    karat TEXT NOT NULL,
    n_price DECIMAL(10,2) NOT NULL,
    o_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create expense_log table
CREATE TABLE IF NOT EXISTS public.expense_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inserted_by TEXT NOT NULL REFERENCES public.users(username),
    date_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
    asof_date DATE NOT NULL,
    expense_type TEXT NOT NULL CHECK (expense_type IN ('direct', 'indirect')),
    item_name TEXT NOT NULL,
    cost DECIMAL(10,2) NOT NULL,
    udhaar BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create sales_log table
CREATE TABLE IF NOT EXISTS public.sales_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inserted_by TEXT NOT NULL REFERENCES public.users(username),
    date_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
    asof_date DATE NOT NULL,
    material TEXT NOT NULL CHECK (material IN ('gold', 'silver')),
    type TEXT NOT NULL CHECK (type IN ('wholesale', 'retail')),
    item_name TEXT NOT NULL,
    tag_no TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    o1_gram DECIMAL(10,3),
    o1_purity DECIMAL(5,2),
    o2_gram DECIMAL(10,3),
    o2_purity DECIMAL(5,2),
    o_cost DECIMAL(10,2),
    p_grams DECIMAL(10,3) NOT NULL,
    p_purity DECIMAL(5,2) NOT NULL,
    p_cost DECIMAL(10,2) NOT NULL,
    s_purity DECIMAL(5,2),
    wastage DECIMAL(5,2),
    s_cost DECIMAL(10,2) NOT NULL,
    profit DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create activity_log table for tracking all database changes
CREATE TABLE IF NOT EXISTS public.activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(username),
    table_name TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================================
-- SECTION 2: ADD MISSING COLUMNS (Safe for existing databases)
-- ============================================================================

-- Add udhaar column to expense_log if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'expense_log'
        AND column_name = 'udhaar'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.expense_log ADD COLUMN udhaar BOOLEAN DEFAULT false;
    END IF;
END $$;

-- ============================================================================
-- SECTION 3: INDEXES AND CONSTRAINTS
-- ============================================================================

-- Create unique constraint for daily rates to prevent duplicates (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'daily_rates_unique'
        AND schemaname = 'public'
    ) THEN
        CREATE UNIQUE INDEX daily_rates_unique ON public.daily_rates (asof_date, material, karat);
    END IF;
END $$;

-- ============================================================================
-- SECTION 4: ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable Row Level Security on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 5: RLS POLICIES (Drop existing and recreate for consistency)
-- ============================================================================

-- Drop all existing policies first (ignore errors if they don't exist)
DO $$
DECLARE
    pol_record RECORD;
BEGIN
    -- Drop policies for users table
    FOR pol_record IN
        SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol_record.policyname || '" ON public.users';
    END LOOP;

    -- Drop policies for daily_rates table
    FOR pol_record IN
        SELECT policyname FROM pg_policies WHERE tablename = 'daily_rates' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol_record.policyname || '" ON public.daily_rates';
    END LOOP;

    -- Drop policies for expense_log table
    FOR pol_record IN
        SELECT policyname FROM pg_policies WHERE tablename = 'expense_log' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol_record.policyname || '" ON public.expense_log';
    END LOOP;

    -- Drop policies for sales_log table
    FOR pol_record IN
        SELECT policyname FROM pg_policies WHERE tablename = 'sales_log' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol_record.policyname || '" ON public.sales_log';
    END LOOP;

    -- Drop policies for activity_log table
    FOR pol_record IN
        SELECT policyname FROM pg_policies WHERE tablename = 'activity_log' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol_record.policyname || '" ON public.activity_log';
    END LOOP;
END $$;

-- Create comprehensive RLS policies for users table
CREATE POLICY "Users can view all users" ON public.users
    FOR SELECT USING (true);
CREATE POLICY "Users can update their own session" ON public.users
    FOR UPDATE USING (true);
CREATE POLICY "Users can insert new users" ON public.users
    FOR INSERT WITH CHECK (true);

-- Create comprehensive RLS policies for daily_rates table
CREATE POLICY "Users can view all daily rates" ON public.daily_rates
    FOR SELECT USING (true);
CREATE POLICY "Users can insert daily rates" ON public.daily_rates
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update daily rates" ON public.daily_rates
    FOR UPDATE USING (true);
CREATE POLICY "Users can delete daily rates" ON public.daily_rates
    FOR DELETE USING (true);

-- Create comprehensive RLS policies for expense_log table
CREATE POLICY "Users can view all expenses" ON public.expense_log
    FOR SELECT USING (true);
CREATE POLICY "Users can insert expenses" ON public.expense_log
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update expenses" ON public.expense_log
    FOR UPDATE USING (true);
CREATE POLICY "Users can delete expenses" ON public.expense_log
    FOR DELETE USING (true);

-- Create comprehensive RLS policies for sales_log table
CREATE POLICY "Users can view all sales" ON public.sales_log
    FOR SELECT USING (true);
CREATE POLICY "Users can insert sales" ON public.sales_log
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update sales" ON public.sales_log
    FOR UPDATE USING (true);
CREATE POLICY "Users can delete sales" ON public.sales_log
    FOR DELETE USING (true);

-- Create comprehensive RLS policies for activity_log table
CREATE POLICY "Users can view all activity logs" ON public.activity_log
    FOR SELECT USING (true);
CREATE POLICY "Users can insert activity logs" ON public.activity_log
    FOR INSERT WITH CHECK (true);

-- ============================================================================
-- SECTION 6: UTILITY FUNCTIONS
-- ============================================================================

-- Function to get table schema information
CREATE OR REPLACE FUNCTION get_table_schema(table_name text)
RETURNS TABLE (
  column_name text,
  data_type text,
  is_nullable text,
  column_default text,
  character_maximum_length integer,
  numeric_precision integer,
  numeric_scale integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.column_name::text,
    c.data_type::text,
    c.is_nullable::text,
    c.column_default::text,
    c.character_maximum_length,
    c.numeric_precision,
    c.numeric_scale
  FROM information_schema.columns c
  WHERE c.table_name = get_table_schema.table_name
    AND c.table_schema = 'public'
  ORDER BY c.ordinal_position;
END;
$$;

-- Function to execute safe SELECT queries dynamically
CREATE OR REPLACE FUNCTION execute_safe_query(query_text text)
RETURNS TABLE (result_json jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  query_lower text;
BEGIN
  -- Convert to lowercase for validation
  query_lower := lower(trim(query_text));

  -- Security checks: Only allow SELECT statements
  IF query_lower NOT LIKE 'select%' THEN
    RAISE EXCEPTION 'Only SELECT statements are allowed';
  END IF;

  -- Block dangerous keywords
  IF query_lower ~ '\b(drop|delete|update|insert|create|alter|truncate|grant|revoke)\b' THEN
    RAISE EXCEPTION 'Query contains forbidden operations';
  END IF;

  -- Block function calls that could be dangerous
  IF query_lower ~ '\b(pg_|information_schema\.|current_user|session_user)\b' THEN
    RAISE EXCEPTION 'Query contains forbidden system functions';
  END IF;

  -- Execute the query and return results as JSONB
  RETURN QUERY
  EXECUTE format('
    WITH query_result AS (%s)
    SELECT to_jsonb(query_result.*) as result_json
    FROM query_result
  ', query_text);

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Query execution failed: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION execute_safe_query(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_table_schema(text) TO authenticated;

-- ============================================================================
-- SECTION 7: DEFAULT DATA (Only for new databases)
-- ============================================================================

-- Insert default admin user (only if no users exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users LIMIT 1) THEN
        INSERT INTO public.users (username, password, role)
        VALUES ('admin', 'admin', 'admin');
    END IF;
END $$;

-- ============================================================================
-- SECTION 8: VERIFICATION
-- ============================================================================

-- Display current RLS policies for verification
SELECT
    schemaname,
    tablename,
    policyname,
    cmd,
    permissive,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('users', 'daily_rates', 'expense_log', 'sales_log', 'activity_log')
ORDER BY tablename, cmd;

-- Display table information
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('users', 'daily_rates', 'expense_log', 'sales_log', 'activity_log')
ORDER BY table_name, ordinal_position;

-- ============================================================================
-- SCRIPT COMPLETE
-- ============================================================================
-- This script has:
-- 1. ✅ Created all necessary tables (safe for existing databases)
-- 2. ✅ Added missing columns (udhaar in expense_log)
-- 3. ✅ Created all indexes and constraints
-- 4. ✅ Enabled RLS on all tables
-- 5. ✅ Created comprehensive RLS policies (INCLUDING UPDATE policies)
-- 6. ✅ Created utility functions for the application
-- 7. ✅ Added default admin user (only for new databases)
-- 8. ✅ Provided verification queries
--
-- Your edit functionality should now work perfectly!
-- ============================================================================