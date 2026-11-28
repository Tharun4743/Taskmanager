import React, { Suspense, useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import { ViewLoadingFallback } from '../components/common/ViewLoadingFallback';
import { lazyWithRetry } from '../components/common/helpers';
import { canAccessView, getDefaultViewForUser } from '../lib/rbac';

// Modular Feature Views
import { DashboardView } from './dashboard/DashboardView';
import { TasksView } from './tasks/TasksView';
import { VerificationsView } from './verifications/VerificationsView';
import { SubmissionsView } from './submissions/SubmissionsView';
import { CodingProgressView } from './coding/CodingProgressView';
import { NoticeBoardView } from './notices/NoticeBoardView';
import { DepartmentsView } from './admin/DepartmentsView';
import { ClassesView } from './admin/ClassesView';
import { UsersView } from './admin/UsersView';
import { IndustryApprovalsView } from './admin/IndustryApprovalsView';
import { StudentProfileView } from './profile/StudentProfileView';
import { SettingsView } from './settings/SettingsView';
import { FeatureComparisonView } from './comparison/FeatureComparisonView';

// Specialized Lazy Modules
const LiveTeachingHubView = lazyWithRetry(() => import('./teaching/LiveTeachingHubView'));
const SkillAssessmentView = lazyWithRetry(() => import('./assessments/SkillAssessmentView'));
const PlacementReadinessView = lazyWithRetry(() => import('./placement/PlacementReadinessView'));
const StudentOpportunitiesView = lazyWithRetry(() => import('./opportunities/StudentOpportunitiesView'));
const SkillGapAnalyzerView = lazyWithRetry(() => import('./analytics/SkillGapAnalyzerView'));
const StudentCodingAssessmentView = lazyWithRetry(() => import('./assessments/StudentCodingAssessmentView'));
const InstitutionalSkillHeatmapView = lazyWithRetry(() => import('./analytics/InstitutionalSkillHeatmapView'));
const IndustryPortalView = lazyWithRetry(() => import('./industry/IndustryPortalView'));

export function ViewRouter({ app }: { app: any }) {
  const isFooterRoute = app.view === 'privacy' || app.view === 'terms' || app.view === 'support';
  const hasViewAccess = isFooterRoute || canAccessView(app.user, app.view);

  useEffect(() => {
    if (isFooterRoute && app.footerModal !== app.view.toUpperCase()) {
      app.setFooterModal(app.view.toUpperCase());
    }
  }, [isFooterRoute, app.view, app.footerModal, app]);

  useEffect(() => {
    if (app.user && !hasViewAccess) {
      app.setView(getDefaultViewForUser(app.user));
    }
  }, [app.user, hasViewAccess, app]);

  if (app.user && !hasViewAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
          <ShieldAlert size={28} />
        </div>
        <div className="space-y-1 max-w-md">
          <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white">Access Restricted</h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            This portal view is outside your active role permissions. Redirecting you to your workspace home...
          </p>
        </div>
        <button
          type="button"
          onClick={() => app.setView(getDefaultViewForUser(app.user))}
          className="px-4 py-2.5 rounded-xl bg-black text-white text-xs font-bold hover:bg-zinc-800 transition-colors"
        >
          Return to Portal Home
        </button>
      </div>
    );
  }

  switch (app.view) {
    case 'dashboard':
      return (
        <DashboardView
          user={app.user}
          token={app.token}
          departments={app.departments}
          classes={app.classes}
          users={app.users}
          tasks={app.tasks}
          submissions={app.submissions}
          hodStats={app.hodStats}
          advisorStats={app.advisorStats}
          coordinatorStats={app.coordinatorStats}
          studentStats={app.studentStats}
          myClass={app.myClass}
          pendingIndustryList={app.pendingIndustryList}
          myLeetcodeProgress={app.myLeetcodeProgress}
          setView={app.setView}
          onOpenTelegramModal={() => app.setShowTelegramLinkModal(true)}
          addToast={app.addToast}
        />
      );
    case 'tasks':
      return (
        <TasksView
          user={app.user}
          token={app.token}
          tasks={app.tasks}
          submissions={app.submissions}
          departments={app.departments}
          classes={app.classes}
          myInvitations={app.myInvitations}
          myTeams={app.myTeams}
          isAdmin={app.isAdmin}
          isHOD={app.isHOD}
          isAdvisor={app.isAdvisor}
          isCoordinator={app.isCoordinator}
          isStudent={app.isStudent}
          fetchTasks={app.fetchTasks}
          fetchSubmissions={app.fetchSubmissions}
          fetchCoordinatorStats={app.fetchCoordinatorStats}
          deleteTask={app.deleteTask}
          toggleTaskStatus={app.toggleTaskStatus}
          openTeamModal={app.openTeamModal}
          handleRespondInvitation={app.handleRespondInvitation}
          openTaskPendingEmailModal={app.openTaskPendingEmailModal}
          setExtendingTask={app.setExtendingTask}
          setExtendedDeadline={app.setExtendedDeadline}
          setShowExtendModal={app.setShowExtendModal}
          setProofPreviewData={app.setProofPreviewData}
          addToast={app.addToast}
          highlightedTaskId={app.highlightedTaskId}
        />
      );
    case 'verifications':
    case 'verification':
      return (
        <VerificationsView
          submissions={app.submissions}
          teamSubmissions={app.teamSubmissions}
          tasks={app.tasks}
          classes={app.classes}
          departments={app.departments}
          users={app.users}
          user={app.user}
          token={app.token}
          isAdmin={app.isAdmin}
          isHOD={app.isHOD}
          isAdvisor={app.isAdvisor}
          isCoordinator={app.isCoordinator}
          isFaculty={app.isFaculty}
          verifySubmission={app.verifySubmission}
          onInspectSubmission={app.setInspectingSubmission}
          onOpenRejectionModal={app.setShowRejectionModal}
          onOpenTeamReviewModal={app.setTeamReviewModal}
          onRefresh={() => {
            app.fetchSubmissions();
            app.fetchTeamSubmissions?.();
          }}
          addToast={app.addToast}
        />
      );
    case 'submissions':
      return (
        <SubmissionsView
          submissions={app.submissions}
          user={app.user}
          isAdmin={app.isAdmin}
          isHOD={app.isHOD}
          isAdvisor={app.isAdvisor}
          isCoordinator={app.isCoordinator}
          verifySubmission={app.verifySubmission}
          onOpenRejectionModal={(idOrSub) => {
            const found = typeof idOrSub === 'object'
              ? idOrSub
              : app.submissions.find((s: any) => String(s.id) === String(idOrSub)) || ({ id: idOrSub } as any);
            app.setShowRejectionModal(found);
          }}
        />
      );
    case 'leetcode-targets':
    case 'coding-progress':
      return (
        <CodingProgressView
          user={app.user}
          token={app.token}
          departments={app.departments}
          classes={app.classes}
          users={app.users}
          codingPlatformTab={app.codingPlatformTab}
          onPlatformTabChange={app.setCodingPlatformTab}
          addToast={app.addToast}
        />
      );
    case 'notice-board':
      return (
        <NoticeBoardView
          notices={app.notices}
          user={app.user}
          isAdmin={app.isAdmin}
          isHOD={app.isHOD}
          isAdvisor={app.isAdvisor}
          onOpenCreateNoticeModal={() => app.setShowCreateNoticeModal(true)}
          onDeleteNotice={app.handleDeleteNotice}
          onPinNotice={app.handlePinNotice}
          onShareNotice={app.handleShareNotice}
          onShareBoard={app.handleShareBoard}
        />
      );
    case 'departments':
      return (
        <DepartmentsView
          departments={app.departments}
          token={app.token}
          onRefresh={app.fetchInitialData}
          addToast={app.addToast}
        />
      );
    case 'classes':
    case 'my-class':
      return (
        <ClassesView
          classes={app.classes}
          departments={app.departments}
          myClass={app.myClass}
          user={app.user}
          token={app.token}
          isAdmin={app.isAdmin}
          isHOD={app.isHOD}
          isAdvisor={app.isAdvisor}
          isAdvisorMode={app.view === 'my-class'}
          onRefresh={app.fetchInitialData}
          addToast={app.addToast}
        />
      );
    case 'users':
      return (
        <UsersView
          users={app.users}
          departments={app.departments}
          classes={app.classes}
          user={app.user}
          token={app.token}
          isAdmin={app.isAdmin}
          isHOD={app.isHOD}
          isAdvisor={app.isAdvisor}
          isIndustry={app.isIndustry}
          myClass={app.myClass}
          onViewStudentProfile={(id) => app.setViewingStaffStudentProfile(id)}
          onRefresh={app.fetchUsers}
          addToast={app.addToast}
        />
      );
    case 'industry-approvals':
      return (
        <IndustryApprovalsView
          user={app.user}
          token={app.token}
          addToast={app.addToast}
          onRefresh={() => app.fetchIndustryData()}
        />
      );
    case 'profile':
      return (
        <StudentProfileView
          user={app.user}
          token={app.token}
          addToast={app.addToast}
          onOpenTelegramModal={() => app.setShowTelegramLinkModal(true)}
        />
      );
    case 'settings':
      return (
        <SettingsView
          user={app.user}
          token={app.token}
          addToast={app.addToast}
        />
      );
    case 'feature-comparison':
    case 'sources':
      return <FeatureComparisonView />;
    case 'live-teaching-hub':
    case 'teaching-hub':
      return <LiveTeachingHubView user={app.user} token={app.token} addToast={app.addToast} />;
    case 'skill-assessment':
    case 'assessment':
    case 'assessments':
      return <SkillAssessmentView user={app.user} token={app.token} addToast={app.addToast} />;
    case 'placement-readiness':
    case 'placement':
    case 'placement-rating':
    case 'boost':
    case 'boost-readiness':
      return (
        <PlacementReadinessView
          user={app.user}
          token={app.token}
          departments={app.departments}
          classes={app.classes}
          setView={app.setView}
          onNavigateToAssessment={() => app.setView('skill-assessment')}
          onViewStudentProfile={(student) => app.setViewingStaffStudentProfile(student)}
          addToast={app.addToast}
        />
      );
    case 'opportunities':
      return <StudentOpportunitiesView user={app.user} token={app.token} />;
    case 'skill-gap-analyzer':
    case 'skill-gap':
    case 'analyzer':
    case 'progress-analyzer':
      return <SkillGapAnalyzerView user={app.user} token={app.token} />;
    case 'student-coding-assessments':
    case 'coding-tests':
      return <StudentCodingAssessmentView user={app.user} token={app.token} />;
    case 'institutional-skill-heatmap':
    case 'skill-heatmap':
    case 'heatmap':
      return <InstitutionalSkillHeatmapView user={app.user} token={app.token} />;
    case 'privacy':
    case 'terms':
    case 'support': {
      return (
        <DashboardView
          user={app.user}
          token={app.token}
          departments={app.departments}
          classes={app.classes}
          users={app.users}
          tasks={app.tasks}
          submissions={app.submissions}
          hodStats={app.hodStats}
          advisorStats={app.advisorStats}
          coordinatorStats={app.coordinatorStats}
          studentStats={app.studentStats}
          myClass={app.myClass}
          pendingIndustryList={app.pendingIndustryList}
          myLeetcodeProgress={app.myLeetcodeProgress}
          setView={app.setView}
          onOpenTelegramModal={() => app.setShowTelegramLinkModal(true)}
          addToast={app.addToast}
        />
      );
    }
    case 'industry-portal':
    case 'industry-dashboard':
    case 'industry-postings':
    case 'industry-coding-assessments':
    case 'industry-applications':
    case 'industry-reports':
    case 'industry-profile': {
      const activeTab = (app.view === 'industry-portal' || app.view === 'industry-dashboard')
        ? 'dashboard'
        : (app.view.replace('industry-', '') as any);
      return (
        <IndustryPortalView
          user={app.user}
          token={app.token}
          activeTab={activeTab}
          onTabChange={(tab) => app.setView(tab === 'dashboard' ? 'industry-dashboard' : `industry-${tab}`)}
          addToast={app.addToast}
        />
      );
    }
    default:
      return (
        <DashboardView
          user={app.user}
          token={app.token}
          departments={app.departments}
          classes={app.classes}
          users={app.users}
          tasks={app.tasks}
          submissions={app.submissions}
          hodStats={app.hodStats}
          advisorStats={app.advisorStats}
          coordinatorStats={app.coordinatorStats}
          studentStats={app.studentStats}
          myClass={app.myClass}
          pendingIndustryList={app.pendingIndustryList}
          myLeetcodeProgress={app.myLeetcodeProgress}
          setView={app.setView}
          onOpenTelegramModal={() => app.setShowTelegramLinkModal(true)}
          addToast={app.addToast}
        />
      );
  }
}
