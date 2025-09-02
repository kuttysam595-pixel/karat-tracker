-- Fix activity log triggers to properly capture user information
-- Drop existing triggers first
DROP TRIGGER IF EXISTS trigger_log_daily_rates_activity ON public.daily_rates;
DROP TRIGGER IF EXISTS trigger_log_expense_log_activity ON public.expense_log;
DROP TRIGGER IF EXISTS trigger_log_sales_log_activity ON public.sales_log;
DROP TRIGGER IF EXISTS trigger_log_users_activity ON public.users;

-- Drop the existing function
DROP FUNCTION IF EXISTS log_activity();

-- Create an improved function that handles user context better
CREATE OR REPLACE FUNCTION log_activity()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id TEXT;
BEGIN
    -- Skip logging for activity_log table itself to prevent infinite loops
    IF TG_TABLE_NAME = 'activity_log' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Try to get the current user from the setting, fallback to 'system'
    BEGIN
        current_user_id := current_setting('app.current_user', true);
        IF current_user_id IS NULL OR current_user_id = '' THEN
            current_user_id := 'system';
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            current_user_id := 'system';
    END;

    -- Log the activity
    INSERT INTO public.activity_log (
        user_id,
        table_name,
        action,
        record_id,
        old_data,
        new_data
    ) VALUES (
        current_user_id,
        TG_TABLE_NAME,
        TG_OP,
        CASE 
            WHEN TG_OP = 'DELETE' THEN OLD.id::TEXT
            ELSE NEW.id::TEXT
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

-- Create a function to set the current user context
CREATE OR REPLACE FUNCTION set_current_user(username TEXT)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_user', username, true);
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers for all main tables
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
