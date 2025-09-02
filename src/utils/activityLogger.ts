
import { supabase } from '@/integrations/supabase/client';

export interface ActivityLogEntry {
  username: string;
  role: string;
  action: string;
  table_name?: string;
  row_id?: string;
  description: string;
  metadata?: Record<string, any>;
}

export const logActivity = async (entry: ActivityLogEntry) => {
  try {
    const { error } = await supabase
      .from('activity_log')
      .insert({
        username: entry.username,
        role: entry.role,
        action: entry.action,
        table_name: entry.table_name,
        row_id: entry.row_id,
        description: entry.description,
        metadata: entry.metadata || {}
      });

    if (error) {
      console.error('Failed to log activity:', error);
    }
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};
