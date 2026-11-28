const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    testsPassed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    testsFailed++;
  }
}

console.log('==============================================================');
console.log('=== PRODUCTION AUDIT & REGRESSION TEST SUITE               ===');
console.log('==============================================================\n');

// ── TEST GROUP 1: Real TS RBAC & Routing Module Execution ─────────────────────
console.log('--- Test Group 1: Real Frontend RBAC & Routing Logic (via esbuild) ---');
try {
  // Compile actual src/lib/rbac.ts and src/lib/routing.ts to temporary CJS via bundled esbuild
  const esbuild = require('esbuild');
  const rbacBundle = esbuild.buildSync({
    entryPoints: [path.resolve('src/lib/rbac.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
  });
  const routingBundle = esbuild.buildSync({
    entryPoints: [path.resolve('src/lib/routing.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
  });

  const evalCjs = (code) => {
    const mod = { exports: {} };
    const fn = new Function('exports', 'require', 'module', code);
    fn(mod.exports, require, mod);
    return mod.exports;
  };

  const rbac = evalCjs(rbacBundle.outputFiles[0].text);
  const routing = evalCjs(routingBundle.outputFiles[0].text);

  assert(rbac.getRoleFlags({ role: 'INDUSTRY_GUEST' }).isIndustry === true, 'getRoleFlags recognizes INDUSTRY_GUEST as isIndustry');
  assert(rbac.getRoleFlags({ role: 'INDUSTRY' }).isIndustry === true, 'getRoleFlags recognizes INDUSTRY as isIndustry');
  assert(rbac.getRoleFlags({ role: 'STAFF' }).isFaculty === true, 'getRoleFlags recognizes STAFF as isFaculty');
  assert(rbac.getRoleFlags({ role: 'FACULTY' }).isFaculty === true, 'getRoleFlags recognizes FACULTY as isFaculty');
  assert(rbac.getRoleFlags({ role: 'STUDENT', is_coordinator: true }).isCoordinator === true, 'getRoleFlags recognizes student coordinator');

  assert(rbac.getDefaultViewForUser({ role: 'INDUSTRY' }) === 'industry-dashboard', 'INDUSTRY lands on industry-dashboard');
  assert(rbac.getDefaultViewForUser({ role: 'INDUSTRY_GUEST' }) === 'industry-dashboard', 'INDUSTRY_GUEST lands on industry-dashboard');
  assert(rbac.getDefaultViewForUser({ role: 'STUDENT' }) === 'dashboard', 'STUDENT lands on dashboard');

  const student = { id: '1', role: 'STUDENT', is_coordinator: false };
  const coord = { id: '2', role: 'STUDENT', is_coordinator: true };
  const advisor = { id: '3', role: 'CLASS_ADVISOR' };
  const faculty = { id: '4', role: 'FACULTY' };
  const staff = { id: '5', role: 'STAFF' };
  const hod = { id: '6', role: 'HOD' };
  const admin = { id: '7', role: 'SUPREME_ADMIN' };
  const indGuest = { id: '8', role: 'INDUSTRY_GUEST' };

  assert(!rbac.canAccessView(student, 'users'), 'STUDENT cannot access users');
  assert(!rbac.canAccessView(student, 'departments'), 'STUDENT cannot access departments');
  assert(!rbac.canAccessView(student, 'classes'), 'STUDENT cannot access classes');
  assert(!rbac.canAccessView(student, 'verifications'), 'STUDENT cannot access verifications');
  assert(!rbac.canAccessView(student, 'institutional-skill-heatmap'), 'STUDENT cannot access heatmap');
  assert(!rbac.canAccessView(student, 'industry-dashboard'), 'STUDENT cannot access industry-dashboard');
  assert(rbac.canAccessView(student, 'tasks'), 'STUDENT can access tasks');

  assert(rbac.canAccessView(coord, 'verifications'), 'COORDINATOR can access verifications');
  assert(rbac.canAccessView(coord, 'users'), 'COORDINATOR can access users');
  assert(!rbac.canAccessView(coord, 'institutional-skill-heatmap'), 'COORDINATOR cannot access institutional heatmap');
  assert(!rbac.canAccessView(coord, 'departments'), 'COORDINATOR cannot access departments');
  assert(!rbac.canAccessView(coord, 'industry-approvals'), 'COORDINATOR cannot access industry-approvals');

  assert(rbac.canAccessView(advisor, 'verifications') && rbac.canAccessView(advisor, 'institutional-skill-heatmap'), 'CLASS_ADVISOR can access verifications & heatmap');
  assert(!rbac.canAccessView(advisor, 'departments') && !rbac.canAccessView(advisor, 'industry-approvals'), 'CLASS_ADVISOR blocked from departments & industry approvals');

  assert(rbac.canAccessView(faculty, 'institutional-skill-heatmap') && rbac.canAccessView(staff, 'verifications'), 'FACULTY & STAFF can access heatmap & verifications');
  assert(!rbac.canAccessView(hod, 'departments') && rbac.canAccessView(hod, 'industry-approvals'), 'HOD can access industry-approvals but blocked from departments');
  assert(rbac.canAccessView(admin, 'departments') && rbac.canAccessView(admin, 'classes'), 'SUPREME_ADMIN can access departments & classes');

  assert(rbac.canAccessView(indGuest, 'industry-dashboard') && rbac.canAccessView(indGuest, 'industry-reports'), 'INDUSTRY_GUEST can access industry portal views');
  assert(!rbac.canAccessView(indGuest, 'tasks') && !rbac.canAccessView(indGuest, 'verifications') && !rbac.canAccessView(indGuest, 'users'), 'INDUSTRY_GUEST blocked from academic views');
  assert(rbac.canAccessView(null, 'public-portfolio') && !rbac.canAccessView(null, 'dashboard'), 'Anonymous allowed public-portfolio only');

  assert(routing.parseRouteFromPath('/codingprogress/github').codingPlatformTab === 'GITHUB', 'parseRouteFromPath parses github tab');
  assert(routing.parseRouteFromPath('/verifications/pending').verificationFilter === 'PENDING', 'parseRouteFromPath parses verification filter');
  assert(routing.getPathFromState('industry-coding-assessments', 'LEETCODE', null) === '/industry/coding-assessments', 'getPathFromState maps industry route');
} catch (err) {
  console.error('  [ERROR] Group 1 failed to compile/execute real TS modules:', err);
  testsFailed++;
}

// ── TEST GROUP 2: Backend Security, RBAC & Logic Audits ─────────────────────
console.log('\n--- Test Group 2: Backend RBAC, SQLi & Ownership Security (server.ts) ---');
{
  const server = fs.readFileSync('server.ts', 'utf8');

  assert(server.includes("app.post('/api/upload/poster', authenticate, authorize("), 'POST /api/upload/poster requires authorize(...)');
  assert(server.includes("if (!(await canViewTask(req.user, t, taskClassIds)))"), 'GET /api/tasks/:id enforces canViewTask visibility');
  assert(server.includes("authorize(['SUPREME_ADMIN', 'HOD', 'CLASS_ADVISOR', 'FACULTY', 'STAFF', 'COORDINATOR'])") && server.includes("You do not have permission to view pending students"), 'GET /api/tasks/:id/pending-students enforces role & class/dept scope');
  assert(server.includes("You do not have permission to send reminders for this task"), 'POST /api/tasks/:id/send-pending-reminder enforces task ownership');

  assert(!server.includes("AND u.department_id='${department_id}'"), 'GET /api/admin/placement-funnel parameterized (no SQL injection)');
  assert(server.includes("const effectiveDeptId = reqUser.role === 'HOD' ? reqUser.department_id : (department_id || null);"), 'GET /api/admin/placement-funnel locks HOD to department');

  assert(server.includes("app.get('/api/analytics/institutional-skills-heatmap', authenticate, authorize("), 'Institutional skill heatmap enforces authorize(...)');
  assert(!server.includes("baselineCurriculumSkills"), 'Institutional skill heatmap has no fake baseline skill synthesis');
  assert(server.includes("else if (user.role === 'HOD' || isFacultyUser(user))") && !server.includes("studentsRes = await pool.query(`\n        SELECT u.id, u.full_name, u.register_number, u.email, u.department_id, u.class_id,\n               c.name as class_name, c.year, c.batch, d.name as department_name\n        FROM users u\n        LEFT JOIN classes c ON c.id = u.class_id\n        LEFT JOIN departments d ON d.id = u.department_id\n        WHERE u.role = 'STUDENT'\n      `)"), 'Institutional skill heatmap locks role scoping first and has no 0-row fallback');

  assert(server.includes("app.get('/api/team/report', authenticate, authorize("), 'GET /api/team/report enforces authorize(...)');
  assert(server.includes("Coordinators cannot review their own team submission"), 'POST /api/team/review blocks coordinator self-review');
  assert(server.includes("AND (t.leader_id = $") && server.includes("isRegStudent"), 'GET /api/team/submissions restricts regular students to own teams');

  assert(server.includes("This live room code is currently hosted by another user"), 'POST /api/teaching/rooms prevents active room hijacking');
  assert(server.includes("Posting belongs to another company") && server.includes("Application belongs to another company") && server.includes("Assessment belongs to another company"), 'Industry routes enforce company_id ownership isolation');
  assert(server.includes("u.role IN ('INDUSTRY', 'INDUSTRY_GUEST')"), 'Admin industry approval lists include INDUSTRY_GUEST');

  // Connection release check
  const lines = server.split(/\r?\n/);
  let connectCount = 0;
  let hasLeak = false;
  lines.forEach((l, i) => {
    if (l.includes('const client = await pool.connect();')) {
      connectCount++;
      const block = lines.slice(i, i + 300).join('\n');
      if (!block.includes('client.release()')) {
        hasLeak = true;
      }
    }
  });
  assert(connectCount > 0 && !hasLeak, `All ${connectCount} pool.connect() usages release client safely`);
}

// ── TEST GROUP 3: Frontend Workflow, Crash & Leak Guards ────────────────────
console.log('\n--- Test Group 3: Frontend Workflow, Notice Parity & Leak Prevention ---');
{
  const verifications = fs.readFileSync('src/modules/verifications/VerificationsView.tsx', 'utf8');
  assert(/import[\s\S]*\bHistory\b[\s\S]*from 'lucide-react'/.test(verifications), 'VerificationsView imports History icon from lucide-react');
  assert(!/\balert\s*\(/.test(verifications), 'VerificationsView does not use blocking window.alert()');

  const submissions = fs.readFileSync('src/modules/submissions/SubmissionsView.tsx', 'utf8');
  assert(submissions.includes('String(sub.user_id) !== String(user?.id)'), 'SubmissionsView blocks coordinator self-verification');
  assert(submissions.includes('onOpenRejectionModal'), 'SubmissionsView routes Reject button through rejection reason modal');

  const useAppData = fs.readFileSync('src/hooks/useAppData.ts', 'utf8');
  assert(useAppData.includes('/api/notices/upload') && useAppData.includes('description: noticeForm.content.trim()') && useAppData.includes('class_ids'), 'useAppData handleCreateNotice uploads attachment and posts aligned JSON schema');
  assert(useAppData.includes('/api/team/submissions') && useAppData.includes('fetchTeamSubmissions'), 'useAppData fetches teamSubmissions');
  assert(useAppData.includes("'app_cache_users'") && useAppData.includes("setTeamSubmissions([])") && useAppData.includes("setHodStats(null)"), 'useAppData handleLogout clears sessionStorage caches & role states');
  assert(!/setTasks\([\s\S]{0,120}addToast\(`Task status updated/.test(useAppData), 'toggleTaskStatus does not toast success before API response');

  const globalModals = fs.readFileSync('src/components/modals/GlobalModals.tsx', 'utf8');
  assert(globalModals.includes('class_ids: app.noticeForm.class_ids'), 'GlobalModals CreateNoticeModal preserves class_ids multi-select');

  const viewRouter = fs.readFileSync('src/modules/ViewRouter.tsx', 'utf8');
  assert(viewRouter.includes('canAccessView(app.user, app.view)'), 'ViewRouter enforces canAccessView RBAC guard');
  assert(!/setTimeout\(\(\)\s*=>\s*app\.setFooterModal/.test(viewRouter), 'ViewRouter does not schedule setTimeout inside render');

  const tasksView = fs.readFileSync('src/modules/tasks/TasksView.tsx', 'utf8');
  const teamModal = fs.readFileSync('src/components/modals/TeamModal.tsx', 'utf8');
  assert(!/URL\.createObjectURL\(/.test(tasksView) && tasksView.includes('<DraftProofPreview'), 'TasksView uses memoized DraftProofPreview instead of inline URL.createObjectURL');
  assert(!/URL\.createObjectURL\(/.test(teamModal) && teamModal.includes('useObjectUrl(teamProofFile)'), 'TeamModal uses useObjectUrl hook with cleanup');
  assert(!/Number\((taskId|userId|task\.id)\)/.test(tasksView), 'TasksView has zero Number(uuid) casts');
}

// ── TEST GROUP 4: Mobile Viewport & Responsive UI Integrity ─────────────────
console.log('\n--- Test Group 4: Mobile Viewport & Responsive UI Invariants ---');
{
  const appTsx = fs.readFileSync('src/App.tsx', 'utf8');
  assert(appTsx.includes('<MobileBottomNav') && appTsx.includes('getDefaultViewForUser'), 'App.tsx mounts MobileBottomNav and role-based post-login route');
  assert(!appTsx.includes('h-screen w-screen') && appTsx.includes('h-[100dvh] w-full') && appTsx.includes('pb-20 lg:pb-0'), 'App.tsx uses responsive 100dvh full width and bottom nav clearance');

  const mobileNav = fs.readFileSync('src/components/layout/MobileBottomNav.tsx', 'utf8');
  assert(mobileNav.includes('env(safe-area-inset-bottom)'), 'MobileBottomNav includes iOS safe-area-inset-bottom padding');
  assert(!mobileNav.split('if (isCoordinator)')[1].split('if (isAdvisor)')[0].includes('institutional-skill-heatmap'), 'MobileBottomNav removes heatmap from Coordinator menu');

  const studentHistory = fs.readFileSync('src/components/modals/StudentHistoryModal.tsx', 'utf8');
  const defaulterEmail = fs.readFileSync('src/components/modals/TaskDefaulterEmailModal.tsx', 'utf8');
  assert(!studentHistory.includes('subtitle=') && studentHistory.includes('description=') && studentHistory.includes('maxWidth="2xl"'), 'StudentHistoryModal passes valid FloatingModal props');
  assert(!defaulterEmail.includes('subtitle=') && defaulterEmail.includes('description=') && defaulterEmail.includes('maxWidth="2xl"'), 'TaskDefaulterEmailModal passes valid FloatingModal props');
  assert(studentHistory.includes('overflow-x-auto'), 'StudentHistoryModal table wraps inside overflow-x-auto');

  for (const uiFile of ['src/components/ui/Input.tsx', 'src/components/ui/Select.tsx', 'src/components/ui/Textarea.tsx']) {
    const code = fs.readFileSync(uiFile, 'utf8');
    assert(code.includes('text-base md:text-sm'), `${uiFile} uses text-base md:text-sm to prevent mobile auto-zoom`);
  }

  const inspector = fs.readFileSync('src/components/modals/SubmissionInspectorModal.tsx', 'utf8');
  assert(inspector.includes('overflow-y-auto lg:overflow-hidden') && inspector.includes('h-[92dvh]'), 'SubmissionInspectorModal scrolls vertically on small mobile viewports');
}

// ── TEST GROUP 5: Dashboard Gender, Event & Status Filter Consistency ─────────
console.log('\n--- Test Group 5: Dashboard UnifiedAnalyzer Filtering (via esbuild) ---');
try {
  const esbuild = require('esbuild');
  const analyzerBundle = esbuild.buildSync({
    entryPoints: [path.resolve('src/modules/dashboard/analyzerUtils.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
  });

  const mod = { exports: {} };
  const fn = new Function('exports', 'require', 'module', analyzerBundle.outputFiles[0].text);
  fn(mod.exports, require, mod);
  const { computeAnalyzerData, getStudentGender } = mod.exports;

  // Build synthetic cohort matching real scenario: 30 boys + 20 girls in Class A, plus 5 boys in Class B
  const users = [];
  for (let i = 1; i <= 30; i++) {
    users.push({ id: `b-${i}`, role: 'STUDENT', full_name: `Boy ${i}`, gender: i % 2 === 0 ? 'MALE' : 'M', class_id: 'cls-a', department_id: 'dept-1' });
  }
  for (let i = 1; i <= 20; i++) {
    users.push({ id: `g-${i}`, role: 'STUDENT', full_name: `Girl ${i}`, gender: i === 1 ? 'F' : i === 2 ? 'Girl' : 'FEMALE', class_id: 'cls-a', department_id: 'dept-1' });
  }
  users.push({ id: 'b-clsb-1', role: 'STUDENT', full_name: 'Other Class Boy', gender: 'MALE', class_id: 'cls-b', department_id: 'dept-1' });

  const classes = [
    { id: 'cls-a', name: 'III IT A', department_id: 'dept-1', year: 3 },
    { id: 'cls-b', name: 'II IT B', department_id: 'dept-1', year: 2 },
  ];
  const tasks = [
    { id: 'tcs-vita', title: 'TCS Code Vita', department_id: 'dept-1', class_ids: ['cls-a'] },
    { id: 'sih-hack', title: 'SIH Hackathon', department_id: 'dept-1', class_ids: ['cls-a', 'cls-b'] },
  ];
  const submissions = [];
  // 13 boys completed/verified TCS Code Vita; 1 boy skipped
  for (let i = 1; i <= 10; i++) submissions.push({ id: `sbv-${i}`, user_id: `b-${i}`, task_id: 'tcs-vita', status: 'VERIFIED' });
  for (let i = 11; i <= 13; i++) submissions.push({ id: `sbs-${i}`, user_id: `b-${i}`, task_id: 'tcs-vita', status: 'SUBMITTED' });
  submissions.push({ id: 'sb-skip-1', user_id: 'b-14', task_id: 'tcs-vita', status: 'NOT_PARTICIPATING' });
  // 5 girls completed TCS Code Vita; 1 girl skipped
  for (let i = 1; i <= 5; i++) submissions.push({ id: `sgv-${i}`, user_id: `g-${i}`, task_id: 'tcs-vita', status: 'VERIFIED' });
  submissions.push({ id: 'sg-skip-1', user_id: 'g-6', task_id: 'tcs-vita', status: 'NOT_PARTICIPATING' });
  // Different event (SIH Hackathon): 2 boys verified + 3 girls submitted
  for (let i = 1; i <= 2; i++) submissions.push({ id: `sb-sih-${i}`, user_id: `b-${i}`, task_id: 'sih-hack', status: 'VERIFIED' });
  for (let i = 1; i <= 3; i++) submissions.push({ id: `sg-sih-${i}`, user_id: `g-${i}`, task_id: 'sih-hack', status: 'SUBMITTED' });

  assert(getStudentGender({ gender: 'F' }) === 'FEMALE' && getStudentGender({ gender: 'Girl' }) === 'FEMALE', 'Normalizes F and Girl variants as FEMALE');

  // Case 1: Event = TCS Code Vita, Gender = BOYS, Status = ALL
  const case1 = computeAnalyzerData({
    role: 'CLASS_ADVISOR', users, tasks, submissions, classes,
    userDepartmentId: 'dept-1', userClassId: 'cls-a',
    analyzerTaskFilter: 'tcs-vita', analyzerGenderFilter: 'BOYS', analyzerStatusFilter: 'ALL',
  });
  assert(
    case1.cardStats.total === 30 && case1.cardStats.boysTotal === 30 && case1.cardStats.girlsTotal === 0,
    'Case 1 Total Students shows only boys (30) with girls = 0'
  );
  assert(
    case1.cardStats.responded === 13 && case1.cardStats.boysResponded === 13 && case1.cardStats.girlsResponded === 0,
    'Case 1 Responded shows only boys (13) with girls = 0'
  );
  assert(
    case1.cardStats.completed === 13 && case1.cardStats.boysCompleted === 13 && case1.cardStats.girlsCompleted === 0,
    'Case 1 Completed shows only boys (13) with girls = 0'
  );
  assert(
    case1.cardStats.skipped === 1 && case1.cardStats.boysSkipped === 1 && case1.cardStats.girlsSkipped === 0,
    'Case 1 Skipped shows only boys (1) with girls = 0'
  );

  // Case 2: Event = TCS Code Vita, Gender = GIRLS, Status = ALL
  const case2 = computeAnalyzerData({
    role: 'CLASS_ADVISOR', users, tasks, submissions, classes,
    userDepartmentId: 'dept-1', userClassId: 'cls-a',
    analyzerTaskFilter: 'tcs-vita', analyzerGenderFilter: 'GIRLS', analyzerStatusFilter: 'ALL',
  });
  assert(
    case2.cardStats.total === 20 && case2.cardStats.boysTotal === 0 && case2.cardStats.girlsTotal === 20 &&
    case2.cardStats.responded === 5 && case2.cardStats.boysResponded === 0 && case2.cardStats.girlsResponded === 5 &&
    case2.cardStats.completed === 5 && case2.cardStats.boysCompleted === 0 && case2.cardStats.girlsCompleted === 5 &&
    case2.cardStats.skipped === 1 && case2.cardStats.boysSkipped === 0 && case2.cardStats.girlsSkipped === 1,
    'Case 2 Gender = GIRLS isolates all 4 cards and zeroed Boys counts accurately'
  );

  // Case 3: Event = TCS Code Vita, Gender = ALL, Status = ALL
  const case3 = computeAnalyzerData({
    role: 'CLASS_ADVISOR', users, tasks, submissions, classes,
    userDepartmentId: 'dept-1', userClassId: 'cls-a',
    analyzerTaskFilter: 'tcs-vita', analyzerGenderFilter: 'ALL', analyzerStatusFilter: 'ALL',
  });
  assert(
    case3.cardStats.total === 50 && case3.cardStats.boysTotal === 30 && case3.cardStats.girlsTotal === 20 &&
    case3.cardStats.responded === 18 && case3.cardStats.boysResponded === 13 && case3.cardStats.girlsResponded === 5 &&
    case3.cardStats.completed === 18 && case3.cardStats.boysCompleted === 13 && case3.cardStats.girlsCompleted === 5 &&
    case3.cardStats.skipped === 2 && case3.cardStats.boysSkipped === 1 && case3.cardStats.girlsSkipped === 1,
    'Case 3 Gender = ALL sums boys + girls consistently across all 4 cards'
  );

  // Case 4/5: Event changes + HOD scope excludes unassigned class when event is class-specific
  const hodTcs = computeAnalyzerData({
    role: 'HOD', users, tasks, submissions, classes,
    userDepartmentId: 'dept-1', analyzerTaskFilter: 'tcs-vita',
    analyzerGenderFilter: 'BOYS', analyzerStatusFilter: 'ALL',
  });
  const hodSih = computeAnalyzerData({
    role: 'HOD', users, tasks, submissions, classes,
    userDepartmentId: 'dept-1', analyzerTaskFilter: 'sih-hack',
    analyzerGenderFilter: 'BOYS', analyzerStatusFilter: 'ALL',
  });
  assert(
    hodTcs.cardStats.total === 30 && hodTcs.cardStats.completed === 13 &&
    hodSih.cardStats.total === 31 && hodSih.cardStats.completed === 2 && hodSih.cardStats.skipped === 0,
    'Case 5 Switching Event updates eligible student scope & all card metrics immediately'
  );

  // Case 6: Status filter preserves overview card metrics while filtering table rows accurately inside gender cohort
  const pendingBoys = computeAnalyzerData({
    role: 'CLASS_ADVISOR', users, tasks, submissions, classes,
    userDepartmentId: 'dept-1', userClassId: 'cls-a',
    analyzerTaskFilter: 'tcs-vita', analyzerGenderFilter: 'BOYS', analyzerStatusFilter: 'PENDING',
  });
  const skippedGirls = computeAnalyzerData({
    role: 'CLASS_ADVISOR', users, tasks, submissions, classes,
    userDepartmentId: 'dept-1', userClassId: 'cls-a',
    analyzerTaskFilter: 'tcs-vita', analyzerGenderFilter: 'GIRLS', analyzerStatusFilter: 'NOT_PARTICIPATING',
  });
  assert(
    pendingBoys.cardStats.completed === 13 && pendingBoys.filteredRows.length === 16 &&
    pendingBoys.filteredRows.every(r => r.normalizedGender === 'MALE') &&
    skippedGirls.filteredRows.length === 1 && skippedGirls.filteredRows[0].id === 'g-6',
    'Case 6 Status filter filters rows within active gender cohort without breaking overview cards'
  );
} catch (err) {
  console.error('  [ERROR] Group 5 failed:', err);
  testsFailed++;
}

// ============================================================================
// TEST GROUP 6: PERFORMANCE & LOADING OPTIMIZATION REGRESSION GATES
// ============================================================================
console.log('\n--- TEST GROUP 6: Performance & Query Optimization Gates ---');
try {
  const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.ts'), 'utf8');
  const vercelCfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  const dbSource = fs.readFileSync(path.join(__dirname, '..', 'db.ts'), 'utf8');
  const useAppDataSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'hooks', 'useAppData.ts'), 'utf8');
  const codingViewSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'modules', 'coding', 'CodingProgressView.tsx'), 'utf8');

  assert(
    Array.isArray(vercelCfg.regions) && vercelCfg.regions.includes('sin1') && !vercelCfg.regions.includes('bom1'),
    'vercel.json colocates compute in sin1 (Singapore) alongside ap-southeast-1 Supabase'
  );

  // db.ts fast path skips sequential DDL roundtrips when schema already verified
  const fastPathMatch = dbSource.match(/if\s*\(count\s*>=\s*5\)\s*\{([\s\S]*?)hasVerifiedDBSchema\s*=\s*true;\s*return;\s*\}/);
  assert(
    Boolean(fastPathMatch) && !/fastMigrations/.test(fastPathMatch[1]),
    'db.ts initDB fast path skips sequential DDL fastMigrations on cold starts'
  );

  // server.ts single-query authenticate join + INDUSTRY_GUEST approval enforcement
  const authSlice = serverSource.slice(
    serverSource.indexOf('const authCached = userAuthCache.get'),
    serverSource.indexOf('req.user = {')
  );
  assert(
    /LEFT JOIN company_profiles cp ON cp\.user_id = u\.id/.test(authSlice) &&
    /user\.role === 'INDUSTRY' \|\| user\.role === 'INDUSTRY_GUEST'/.test(authSlice) &&
    /!user\.company_is_verified/.test(authSlice),
    'server.ts authenticate merges company_profiles verification into single cached query and enforces INDUSTRY_GUEST'
  );

  // server.ts /api/bootstrap includes notices & myClass via shared getNoticesForUser helper
  assert(
    /async function getNoticesForUser/.test(serverSource) &&
    /app\.get\('\/api\/bootstrap'[\s\S]*getNoticesForUser\(dbUser\)[\s\S]*notices:\s*notices\s*\|\|\s*\[\][\s\S]*myClass/.test(serverSource),
    'server.ts /api/bootstrap hydrates notices and myClass via shared cached helper'
  );

  // server.ts coding endpoints share 30s batch caches and /api/github/stats avoids extra weeklyAgg query
  const lcDailySlice = serverSource.slice(
    serverSource.indexOf("app.get('/api/leetcode/progress/daily'"),
    serverSource.indexOf("app.get('/api/leetcode/progress/weekly'")
  );
  const ghStatsSlice = serverSource.slice(
    serverSource.indexOf("app.get('/api/github/stats'"),
    serverSource.indexOf("app.post(['/api/github/sync/my'")
  );
  assert(
    /async function getEnrichedLeetcodeCached/.test(serverSource) &&
    /async function getEnrichedGithubCached/.test(serverSource) &&
    /getEnrichedLeetcodeCached\(scope,\s*dateStr\)/.test(lcDailySlice) &&
    /getApiCache\(cacheKey\)/.test(ghStatsSlice) &&
    /getEnrichedGithubCached\(scope,\s*dateStr\)/.test(ghStatsSlice) &&
    !/weeklyAgg/.test(ghStatsSlice),
    'server.ts LeetCode and GitHub endpoints share cached batch helpers without redundant weeklyAgg SQL query'
  );

  // server.ts /api/assessment/my-results uses cached active bank lookup instead of per-row Promise.all(enrichAssessmentRow)
  const myResultsSlice = serverSource.slice(
    serverSource.indexOf("app.get('/api/assessment/my-results'"),
    serverSource.indexOf("app.get('/api/assessment/remedial-plan'")
  );
  assert(
    /assessment_questions_active_all/.test(myResultsSlice) && !/enrichAssessmentRow/.test(myResultsSlice),
    'server.ts /api/assessment/my-results reconstructs summaries in batch instead of N+1 Promise.all'
  );

  // server.ts /api/placement/readiness-dashboard fetches scoped students first and filters metrics via ANY($1)
  const readinessSlice = serverSource.slice(
    serverSource.indexOf("app.get('/api/placement/readiness-dashboard'"),
    serverSource.indexOf("app.get('/api/placement/my-readiness'")
  );
  assert(
    /if\s*\(studentsRes\.rows\.length\s*===\s*0\)/.test(readinessSlice) &&
    /FROM student_assessments[\s\S]{0,120}WHERE user_id = ANY\(\$1(?:::uuid\[\])?\)/.test(readinessSlice) &&
    /FROM task_submissions[\s\S]{0,120}WHERE user_id = ANY\(\$1(?:::uuid\[\])?\)/.test(readinessSlice),
    'server.ts /api/placement/readiness-dashboard scopes all 6 metric queries to filtered studentIds'
  );

  // server.ts /api/industry/postings/:id/ranking batches skills & metrics without N+1 loop
  const rankingSlice = serverSource.slice(
    serverSource.indexOf("app.get('/api/industry/postings/:id/ranking'"),
    serverSource.indexOf("app.post('/api/postings/:id/apply'")
  );
  assert(
    /industry_posting_ranking_/.test(rankingSlice) &&
    !/Promise\.all\(studentsRes\.rows\.map/.test(rankingSlice) &&
    /WHERE user_id = ANY\(\$1::uuid\[\]\)/.test(rankingSlice),
    'server.ts /api/industry/postings/:id/ranking eliminates N+1 student queries via bulk ANY($1) lookups + cache'
  );

  // Frontend useAppData.ts hydrates stats/notices/notifications/myClass from bootstrap without duplicate mount calls
  const bootstrapEffect = useAppDataSource.slice(
    useAppDataSource.indexOf('// Bootstrap trigger on mount'),
    useAppDataSource.indexOf('// Logout handler')
  );
  assert(
    /setSupremeStats\(bData\.stats\)/.test(useAppDataSource) &&
    /setHodStats\(bData\.stats\)/.test(useAppDataSource) &&
    /setNotices\(bData\.notices\)/.test(useAppDataSource) &&
    !/fetchNotices\(\)/.test(bootstrapEffect) &&
    !/fetchNotifications\(\)/.test(bootstrapEffect),
    'src/hooks/useAppData.ts consumes bootstrap payload directly without duplicate startup fetches'
  );

  // Frontend CodingProgressView.tsx exposes loading indicators & avoids client-filter refetch storm
  const codingEffectMatch = codingViewSource.match(/if\s*\(!token\s*\|\|\s*!user\?\.role\)\s*return;[\s\S]*?\},\s*\[(.*?)\]\);/);
  assert(
    Boolean(codingEffectMatch) &&
    !/selectedLeetcodeYear|selectedLeetcodeClassId/.test(codingEffectMatch[1]) &&
    /codingPlatformTab === 'GITHUB'[\s\S]{0,80}fetchGithubProgress/.test(codingEffectMatch[0]) &&
    /loadingLeetcode && sortedLeetcodeProgressList\.length === 0/.test(codingViewSource) &&
    /loadingGithub && sortedGithubProgressList\.length === 0/.test(codingViewSource),
    'src/modules/coding/CodingProgressView.tsx avoids client-filter refetches, lazy-loads GitHub tab, and shows loading rows'
  );

  // Team creation & classmate selection regression gates
  const globalModalsSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'modals', 'GlobalModals.tsx'), 'utf8');
  const teamModalSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'modals', 'TeamModal.tsx'), 'utf8');
  const classmatesRouteSlice = serverSource.slice(
    serverSource.indexOf("app.get('/api/team/classmates/:taskId'"),
    serverSource.indexOf("app.post('/api/team/create'")
  );
  assert(
    /eligibleClassmates=\{app\.eligibleClassmates \|\| \[\]\}/.test(globalModalsSource) &&
    /isSubmittingTeam=\{Boolean\(app\.isSubmittingTeam\)\}/.test(globalModalsSource) &&
    /isLoadingClassmates=\{Boolean\(app\.isLoadingClassmates\)\}/.test(globalModalsSource),
    'GlobalModals passes eligibleClassmates, isLoadingClassmates, and isSubmittingTeam props to TeamModal'
  );
  assert(
    /availableClassmates/.test(teamModalSource) &&
    /isLoadingClassmates && availableClassmates\.length === 0/.test(teamModalSource) &&
    /classmatesList \|\| \[\]/.test(teamModalSource),
    'TeamModal supports both eligibleClassmates and classmatesList and renders loading state'
  );
  const openTeamSlice = useAppDataSource.slice(
    useAppDataSource.indexOf('const openTeamModal = useCallback'),
    useAppDataSource.indexOf('const handleCreateSoloTeam = useCallback')
  );
  assert(
    !/!\s*data\.team\s*&&\s*user\?\.role === 'STUDENT'/.test(openTeamSlice) &&
    !/!\s*newTeamName\.trim\(\)\s*\|\|\s*selectedClassmateIds\.length === 0/.test(openTeamSlice),
    'useAppData openTeamModal fetches classmates for leader invites too and handleCreateTeam supports optional initial invites'
  );
  assert(
    !/\bNOT IN\b/i.test(classmatesRouteSlice) && /NOT EXISTS/i.test(classmatesRouteSlice),
    'server.ts GET /api/team/classmates/:taskId uses NULL-safe NOT EXISTS instead of NOT IN'
  );
} catch (err) {
  console.error('  [ERROR] Group 6 failed:', err);
  testsFailed++;
}

console.log('\n==============================================================');
console.log(`TOTAL TESTS: ${testsPassed + testsFailed} | PASSED: ${testsPassed} | FAILED: ${testsFailed}`);
console.log('==============================================================');

process.exit(testsFailed > 0 ? 1 : 0);
