import type { Class, Submission, Task, User } from '../../types';

export type GenderFilter = 'ALL' | 'BOYS' | 'GIRLS';
export type StatusFilter = 'ALL' | 'COMPLETED' | 'PENDING' | 'NOT_PARTICIPATING';
export type NormalizedGender = 'MALE' | 'FEMALE';

export interface AnalyzerFilterParams {
  role: string;
  users: User[];
  tasks: Task[];
  submissions: Submission[];
  classes: Class[];
  userDepartmentId?: string;
  userClassId?: string;
  adminDeptFilter?: string;
  analyzerClassFilter?: string;
  analyzerYearFilter?: string;
  analyzerTaskFilter?: string;
  analyzerGenderFilter: GenderFilter;
  analyzerStatusFilter: StatusFilter;
}

export interface EnrichedAnalyzerStudent extends User {
  normalizedGender: NormalizedGender;
  submissionStatus: string;
  submissionLabel: string;
  clsName: string;
  missingTasks: Task[];
  isDone: boolean;
  isResponded: boolean;
  isSkipped: boolean;
}

export interface GenderCohortStats {
  total: number;
  boysTotal: number;
  girlsTotal: number;
  responded: number;
  boysResponded: number;
  girlsResponded: number;
  completed: number;
  boysCompleted: number;
  girlsCompleted: number;
  skipped: number;
  boysSkipped: number;
  girlsSkipped: number;
  pending: number;
}

export interface AnalyzerSnapshot {
  scopeStudents: EnrichedAnalyzerStudent[];
  genderCohort: EnrichedAnalyzerStudent[];
  filteredRows: EnrichedAnalyzerStudent[];
  scopeStats: GenderCohortStats;
  cardStats: GenderCohortStats;
}

const FEMALE_TOKENS = new Set(['FEMALE', 'GIRLS', 'GIRL', 'F']);

/**
 * Normalize raw student gender values to 'MALE' or 'FEMALE' while keeping totals additive.
 */
export function getStudentGender(student: Pick<User, 'gender'> | any): NormalizedGender {
  const normalized = String(student?.gender || '').trim().toUpperCase();
  return FEMALE_TOKENS.has(normalized) ? 'FEMALE' : 'MALE';
}

/**
 * Check whether a task applies to a given student based on class and department assignment.
 */
export function isStudentAssignedToTask(student: Pick<User, 'class_id' | 'department_id'>, task: Task): boolean {
  const taskClassIds = Array.isArray(task.class_ids) ? task.class_ids : [];
  if (taskClassIds.length > 0) {
    return taskClassIds.some(cid => String(cid) === String(student.class_id));
  }
  if (task.department_id) {
    return String(task.department_id) === String(student.department_id);
  }
  return true;
}

function getTaskId(task: Task): string {
  return String((task as any)?._id ?? task?.id ?? '');
}

/**
 * Check whether a normalized gender satisfies the active gender filter.
 */
export function matchesGenderFilter(gender: NormalizedGender, filter: GenderFilter): boolean {
  if (filter === 'BOYS') return gender === 'MALE';
  if (filter === 'GIRLS') return gender === 'FEMALE';
  return true;
}

function summarizeCohort(cohort: EnrichedAnalyzerStudent[]): GenderCohortStats {
  let boysTotal = 0;
  let girlsTotal = 0;
  let responded = 0;
  let boysResponded = 0;
  let girlsResponded = 0;
  let completed = 0;
  let boysCompleted = 0;
  let girlsCompleted = 0;
  let skipped = 0;
  let boysSkipped = 0;
  let girlsSkipped = 0;

  for (const s of cohort) {
    const isBoy = s.normalizedGender === 'MALE';
    if (isBoy) boysTotal++;
    else girlsTotal++;

    if (s.isResponded) {
      responded++;
      if (isBoy) boysResponded++;
      else girlsResponded++;
    }
    if (s.isDone) {
      completed++;
      if (isBoy) boysCompleted++;
      else girlsCompleted++;
    }
    if (s.isSkipped) {
      skipped++;
      if (isBoy) boysSkipped++;
      else girlsSkipped++;
    }
  }

  const total = cohort.length;
  return {
    total,
    boysTotal,
    girlsTotal,
    responded,
    boysResponded,
    girlsResponded,
    completed,
    boysCompleted,
    girlsCompleted,
    skipped,
    boysSkipped,
    girlsSkipped,
    pending: total - completed,
  };
}

/**
 * Compute unified scope, event, gender, and status datasets plus consistent card statistics.
 */
export function computeAnalyzerData(params: AnalyzerFilterParams): AnalyzerSnapshot {
  const {
    role,
    users,
    tasks,
    submissions,
    classes,
    userDepartmentId,
    userClassId,
    adminDeptFilter = '',
    analyzerClassFilter = '',
    analyzerYearFilter = '',
    analyzerTaskFilter = '',
    analyzerGenderFilter,
    analyzerStatusFilter,
  } = params;

  const isGlobal = role === 'SUPREME_ADMIN';
  const isDept = role === 'HOD';
  const isCls = role === 'CLASS_ADVISOR' || role === 'COORDINATOR';
  const currentDeptId = isGlobal ? adminDeptFilter : userDepartmentId;
  const currentClassId = isCls ? userClassId : analyzerClassFilter;

  const classMap = new Map<string, Class>();
  for (const c of classes) {
    classMap.set(String(c.id), c);
  }

  const subsByUser = new Map<string, Submission[]>();
  for (const sub of submissions) {
    const uid = String(sub.user_id || '');
    if (!uid) continue;
    const list = subsByUser.get(uid);
    if (list) list.push(sub);
    else subsByUser.set(uid, [sub]);
  }

  const selectedTask = analyzerTaskFilter
    ? tasks.find(t => getTaskId(t) === String(analyzerTaskFilter))
    : undefined;

  // 1. Scope student roster by role, department, year, class, and selected event eligibility.
  const scopedUsers = users.filter(u => {
    if (u.role !== 'STUDENT') return false;
    if (isCls) {
      if (String(u.class_id || '') !== String(currentClassId || '')) return false;
    } else if (currentDeptId && String(u.department_id || '') !== String(currentDeptId)) {
      return false;
    }

    if (!isCls && analyzerClassFilter && String(u.class_id || '') !== String(analyzerClassFilter)) {
      return false;
    }

    if ((isDept || isGlobal) && analyzerYearFilter && !analyzerClassFilter) {
      const studentClass = classMap.get(String(u.class_id || ''));
      if (String(studentClass?.year || '') !== String(analyzerYearFilter)) return false;
    }

    if (selectedTask) {
      const userSubs = subsByUser.get(String(u.id)) || [];
      const hasTaskSub = userSubs.some(s => String(s.task_id) === String(analyzerTaskFilter));
      if (!hasTaskSub && !isStudentAssignedToTask(u, selectedTask)) {
        return false;
      }
    }

    return true;
  });

  // 2. Single enrichment pass per student so every card, chart, and row shares one truth.
  const scopeStudents: EnrichedAnalyzerStudent[] = scopedUsers.map(student => {
    const uid = String(student.id);
    const normalizedGender = getStudentGender(student);
    const clsName = classMap.get(String(student.class_id || ''))?.name || '—';
    const studentSubs = subsByUser.get(uid) || [];

    let submissionStatus = 'PENDING';
    let submissionLabel = 'Not Registered';
    let missingTasks: Task[] = [];
    let isDone = false;
    let isResponded = false;
    let isSkipped = false;

    if (analyzerTaskFilter) {
      const sub = studentSubs.find(s => String(s.task_id) === String(analyzerTaskFilter));
      if (sub) {
        submissionStatus = sub.status;
        submissionLabel = sub.status === 'VERIFIED'
          ? 'Verified'
          : sub.status === 'REJECTED'
            ? 'Rejected'
            : sub.status === 'NOT_PARTICIPATING'
              ? 'Not Interested'
              : 'Submitted';
        isDone = sub.status === 'VERIFIED' || sub.status === 'SUBMITTED';
        isResponded = sub.status !== 'NOT_PARTICIPATING';
        isSkipped = sub.status === 'NOT_PARTICIPATING';
      }
    } else {
      const visibleTasks = tasks.filter(t => {
        const taskClassIds = Array.isArray(t.class_ids) ? t.class_ids : [];
        if (analyzerClassFilter) {
          if (taskClassIds.some(cid => String(cid) === String(analyzerClassFilter))) return true;
          if (t.department_id && String(t.department_id) === String(student.department_id || '') && taskClassIds.length === 0) return true;
          if (!t.department_id && taskClassIds.length === 0) return true;
          return false;
        }
        return isStudentAssignedToTask(student, t);
      });

      const visibleTaskIds = new Set(visibleTasks.map(getTaskId));
      const studentSubsInContext = studentSubs.filter(s => visibleTaskIds.has(String(s.task_id)));
      const totalTasks = visibleTasks.length;
      const doneTaskIds = new Set(
        studentSubsInContext
          .filter(s => s.status === 'VERIFIED' || s.status === 'SUBMITTED')
          .map(s => String(s.task_id))
      );
      const doneCount = doneTaskIds.size;

      missingTasks = visibleTasks.filter(t => !doneTaskIds.has(getTaskId(t)));
      submissionLabel = `${doneCount} / ${totalTasks} Events`;

      if (totalTasks === 0) {
        submissionStatus = 'PENDING';
      } else if (doneCount === totalTasks) {
        submissionStatus = 'VERIFIED';
      } else if (doneCount > 0) {
        submissionStatus = 'SUBMITTED';
      } else {
        submissionStatus = 'PENDING';
      }

      isDone = submissionStatus === 'VERIFIED';
      isResponded = studentSubsInContext.some(s => s.status !== 'NOT_PARTICIPATING');
      isSkipped = studentSubsInContext.some(s => s.status === 'NOT_PARTICIPATING');
    }

    return {
      ...student,
      normalizedGender,
      submissionStatus,
      submissionLabel,
      clsName,
      missingTasks,
      isDone,
      isResponded,
      isSkipped,
    };
  });

  // 3. Apply shared gender filter BEFORE deriving all 4 card counts and visualizations.
  const genderCohort = scopeStudents.filter(s => matchesGenderFilter(s.normalizedGender, analyzerGenderFilter));

  // 4. Apply status filter within the gender-filtered cohort for table rows & status pills.
  const filteredRows = genderCohort.filter(s => {
    if (analyzerStatusFilter === 'COMPLETED') return s.isDone;
    if (analyzerStatusFilter === 'PENDING') return !s.isDone && !s.isSkipped;
    if (analyzerStatusFilter === 'NOT_PARTICIPATING') return s.isSkipped;
    return true;
  });

  return {
    scopeStudents,
    genderCohort,
    filteredRows,
    scopeStats: summarizeCohort(scopeStudents),
    cardStats: summarizeCohort(genderCohort),
  };
}
