export type FamilyRole = 'parent' | 'child'

export interface Family {
  id: string
  name: string
  invite_code: string
  created_by: string | null
  created_at: string
}

export interface FamilyMember {
  id: string
  family_id: string
  user_id: string
  role: FamilyRole
  joined_at: string
  display_name: string
}

export interface FamilyEvent {
  id: string
  family_id: string
  created_by: string | null
  title: string
  description?: string | null
  location?: string | null
  start_at: string
  end_at: string
  color: string
  created_at: string
}

export type FamilyTaskStatus = 'todo' | 'in_progress' | 'done'
export type FamilyTaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface FamilyTask {
  id: string
  family_id: string
  created_by: string | null
  assigned_to: string | null
  title: string
  description?: string | null
  priority: FamilyTaskPriority
  status: FamilyTaskStatus
  due_date?: string | null
  completed_at?: string | null
  created_at: string
}

export type FamilyGoalStatus = 'active' | 'completed'

export interface FamilyGoal {
  id: string
  family_id: string
  created_by: string | null
  title: string
  description?: string | null
  target_value: number
  current_value: number
  unit?: string | null
  due_date?: string | null
  status: FamilyGoalStatus
  created_at: string
}

export interface FamilyNotification {
  id: string
  family_id: string
  user_id: string
  actor_id: string | null
  type: string
  message: string
  related_id?: string | null
  read: boolean
  created_at: string
}
