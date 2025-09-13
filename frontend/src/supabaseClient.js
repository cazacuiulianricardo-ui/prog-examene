import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vbopkjfdndwrwwysjfyy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZib3BramZkbmR3cnd3eXNqZnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2MTU2MTAsImV4cCI6MjA2NTE5MTYxMH0.LVIaEPQCChFiPpgJHaUZOv1DKcTrbju-Sr476T1Z5Hs';

export const supabase = createClient(supabaseUrl, supabaseKey);
