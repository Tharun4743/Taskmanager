import type { User } from '../types';

export interface RoleFlags {
  isAdmin: boolean;
  isHOD: boolean;
  isAdvisor: boolean;
  isStudent: boolean;
  isCoordinator: boolean;
  isFaculty: boolean;
  isIndustry: boolean;
}

/**
 * Derive normalized RBAC role flags from a user object.
 */
export function getRoleFlags(user: User | null | undefined): RoleFlags {
  const role = user?.role;
  const isAdmin = role === 'SUPREME_ADMIN';
  const isHOD = role === 'HOD';
  const isAdvisor = role === 'CLASS_ADVISOR';
  const isStudent = role === 'STUDENT';
  const isCoordinator = Boolean(role === 'STUDENT' && user?.is_coordinator);
  const isFaculty = role === 'FACULTY' || role === 'STAFF';
  const isIndustry = role === 'INDUSTRY' || role === 'INDUSTRY_GUEST';
  return { isAdmin, isHOD, isAdvisor, isStudent, isCoordinator, isFaculty, isIndustry };
}

/**
 * Default landing view for a logged-in user based on role.
 */
export function getDefaultViewForUser(user: User | null | undefined): string {
  const { isIndustry } = getRoleFlags(user);
  return isIndustry ? 'industry-dashboard' : 'dashboard';
}

const VIEW_PERMISSION_RULES: Record<string, (flags: RoleFlags) => boolean> = {
  'public-portfolio': () => true,
  'feature-comparison': () => true,
  settings: () => true,

  dashboard: f => !f.isIndustry,
  tasks: f => !f.isIndustry,
  'notice-board': f => !f.isIndustry,
  'leetcode-targets': f => !f.isIndustry,
  'live-teaching-hub': f => !f.isIndustry,
  'placement-readiness': () => true,

  // Student-only academic views (Coordinators are still STUDENTs)
  submissions: f => f.isStudent || f.isCoordinator,
  profile: f => f.isStudent,
  opportunities: f => f.isStudent,
  'student-coding-assessments': f => f.isStudent,
  'skill-gap-analyzer': f => f.isStudent || f.isAdvisor || f.isHOD || f.isAdmin || f.isFaculty,
  'skill-assessment': f => f.isStudent || f.isFaculty || f.isAdvisor || f.isHOD || f.isAdmin,

  // Verification / Management
  verifications: f => f.isAdmin || f.isHOD || f.isAdvisor || f.isCoordinator || f.isFaculty,
  users: f => f.isAdmin || f.isHOD || f.isAdvisor || f.isCoordinator || f.isFaculty,
  'my-class': f => f.isAdvisor || f.isCoordinator,
  classes: f => f.isAdmin || f.isHOD,
  departments: f => f.isAdmin,
  'industry-approvals': f => f.isAdmin || f.isHOD,
  'institutional-skill-heatmap': f => f.isAdmin || f.isHOD || f.isAdvisor || f.isFaculty,

  // Industry portal routes
  'industry-dashboard': f => f.isIndustry || f.isAdmin || f.isHOD,
  'industry-postings': f => f.isIndustry || f.isAdmin || f.isHOD,
  'industry-applications': f => f.isIndustry || f.isAdmin || f.isHOD,
  'industry-coding-assessments': f => f.isIndustry || f.isAdmin || f.isHOD,
  'industry-reports': f => f.isIndustry || f.isAdmin || f.isHOD,
  'industry-profile': f => f.isIndustry || f.isAdmin || f.isHOD,
};

/**
 * Determine whether the given user is authorized to render a frontend view.
 */
export function canAccessView(user: User | null | undefined, view: string): boolean {
  if (view === 'public-portfolio') return true;
  if (!user) return false;
  const flags = getRoleFlags(user);
  const check = VIEW_PERMISSION_RULES[view];
  if (!check) return !flags.isIndustry;
  return check(flags);
}
