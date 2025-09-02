-- Create activity_log table for tracking all database changes
CREATE TABLE public.activity_log (
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

-- Enable Row Level Security
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Create policies for activity_log table (only admin and owner can view)
CREATE POLICY "Admin and owner can view activity logs" ON public.activity_log 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE username = auth.jwt() ->> 'username' 
        AND role IN ('admin', 'owner')
    )
);

-- Create indexes for better performance
CREATE INDEX idx_activity_log_user_id ON public.activity_log(user_id);
CREATE INDEX idx_activity_log_table_name ON public.activity_log(table_name);
CREATE INDEX idx_activity_log_timestamp ON public.activity_log(timestamp);
CREATE INDEX idx_activity_log_action ON public.activity_log(action);

-- Create function to log activity
CREATE OR REPLACE FUNCTION log_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- Skip logging for activity_log table itself to prevent infinite loops
    IF TG_TABLE_NAME = 'activity_log' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Log the activity
    INSERT INTO public.activity_log (
        user_id,
        table_name,
        action,
        record_id,
        old_data,
        new_data
    ) VALUES (
        COALESCE(
            current_setting('app.current_user', true),
            'system'
        ),
        TG_TABLE_NAME,
        TG_OP,
        CASE 
            WHEN TG_OP = 'DELETE' THEN OLD.id
            ELSE NEW.id
        END,
        CASE 
            WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
            WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD)
            ELSE NULL
        END,
        CASE 
            WHEN TG_OP = 'DELETE' THEN NULL
            ELSE to_jsonb(NEW)
        END
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all main tables
CREATE TRIGGER trigger_log_daily_rates_activity
    AFTER INSERT OR UPDATE OR DELETE ON public.daily_rates
    FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER trigger_log_expense_log_activity
    AFTER INSERT OR UPDATE OR DELETE ON public.expense_log
    FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER trigger_log_sales_log_activity
    AFTER INSERT OR UPDATE OR DELETE ON public.sales_log
    FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER trigger_log_users_activity
    AFTER INSERT OR UPDATE OR DELETE ON public.users
    FOR EACH ROW EXECUTE FUNCTION log_activity();
