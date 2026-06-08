export interface PetroTask {
  task_id: string;
  title: string;
  description?: string | null;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'active' | 'completed' | 'cancelled' | 'paused' | 'failed';
  recurrence_type: string;
  assigned_to_team?: string | null;
  due_date?: string | null;
  next_run_at?: string | null;
  compliance_critical: boolean;
  safety_critical: boolean;
  related_module?: string | null;
}

export interface TaskListResponse {
  tasks: PetroTask[];
  count: number;
}

export interface TaskCreateInput {
  title: string;
  description?: string | undefined;
  category: string;
  priority: PetroTask['priority'];
  recurrence_type: string;
  assigned_to_team?: string | undefined;
  due_date?: string | undefined;
  timezone: string;
  status: 'active';
  compliance_critical: boolean;
  safety_critical: boolean;
  reminder_channels: string[];
}

export interface TaskUpdateInput {
  title?: string | undefined;
  description?: string | undefined;
  category?: string | undefined;
  priority?: PetroTask['priority'] | undefined;
  recurrence_type?: string | undefined;
  assigned_to_team?: string | undefined;
  due_date?: string | undefined;
}
