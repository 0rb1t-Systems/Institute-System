export type UserRole = 'super_admin' | 'admin' | 'staff' | 'instructor' | 'affiliate' | 'student';

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  username?: string;
  role: UserRole;
  avatar_url?: string | null;
  studentId?: string;
  studentCode?: string;
  institution_id?: string | null;
  status?: string;
}

export interface Student {
  id: string;
  profile_id?: string | null;
  student_code: string;
  name: string;
  email: string;
  phone?: string | null;
  [key: string]: unknown;
}

export interface Course {
  id: string;
  name: string;
  description?: string;
  duration?: number;
  fee?: number;
  [key: string]: unknown;
}

export interface ClassItem {
  id: string;
  name: string;
  course_id?: string | null;
  instructor_id?: string | null;
  start_date?: string;
  end_date?: string;
  fee?: number;
  is_active?: boolean;
  [key: string]: unknown;
}
