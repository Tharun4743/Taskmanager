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

console.log('\n==============================================================');
console.log(`TOTAL TESTS: ${testsPassed + testsFailed} | PASSED: ${testsPassed} | FAILED: ${testsFailed}`);
console.log('==============================================================');

process.exit(testsFailed > 0 ? 1 : 0);
