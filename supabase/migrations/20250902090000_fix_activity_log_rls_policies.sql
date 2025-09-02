-- Fix Row Level Security policies for activity_log table
-- The issue: Only SELECT policy exists, but INSERT operations are blocked

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admin and owner can view activity logs" ON public.activity_log;
DROP POLICY IF EXISTS "Allow authenticated users to insert activity logs" ON public.activity_log;
DROP POLICY IF EXISTS "Prevent activity log modifications" ON public.activity_log;

-- Create comprehensive RLS policies for activity_log table

-- 1. Allow all authenticated users to INSERT activity logs
-- This is essential for logging user activities
CREATE POLICY "Allow authenticated users to insert activity logs" ON public.activity_log
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- 2. Allow only admin and owner users to SELECT (view) activity logs
-- This maintains security by restricting who can view the audit trail
CREATE POLICY "Admin and owner can view activity logs" ON public.activity_log 
FOR SELECT 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE username = auth.jwt() ->> 'username' 
        AND role IN ('admin', 'owner')
    )
);

-- 3. Prevent any UPDATE operations on activity logs
-- Activity logs should be immutable for audit trail integrity
CREATE POLICY "Prevent activity log updates" ON public.activity_log
FOR UPDATE
TO authenticated
USING (false);

-- 4. Prevent any DELETE operations on activity logs
-- Activity logs should never be deleted to maintain complete audit trail
CREATE POLICY "Prevent activity log deletions" ON public.activity_log
FOR DELETE
TO authenticated
USING (false);

-- Add a comment explaining the security model
COMMENT ON TABLE public.activity_log IS 'Activity log table with RLS policies: INSERT allowed for all authenticated users, SELECT restricted to admin/owner, UPDATE/DELETE prohibited to maintain audit trail integrity';
