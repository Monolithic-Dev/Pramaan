import { lazy, Suspense } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/Guards.js";
import { CitizenLayout } from "./components/layout/CitizenLayout.js";
import { ConsoleLayout } from "./components/layout/ConsoleLayout.js";
import { PublicLayout } from "./components/layout/PublicLayout.js";
import { RouteAnnouncer, SkipLink } from "./components/layout/A11y.js";
import { useLanguage } from "./i18n/LanguageProvider.js";
import { Button, EmptyState, Spinner } from "./ui/kit.js";

// Each area is its own chunk: a citizen filing a report never downloads the officer console.
const Landing = lazy(() => import("./pages/Landing.js"));
const Login = lazy(() => import("./pages/Login.js"));
const ReportWizard = lazy(() => import("./pages/ReportWizard.js"));
const Transparency = lazy(() => import("./pages/Transparency.js"));
const MyReports = lazy(() => import("./pages/citizen/MyReports.js"));
const MyReportDetail = lazy(() => import("./pages/citizen/MyReportDetail.js"));
const Profile = lazy(() => import("./pages/citizen/Profile.js"));
const Overview = lazy(() => import("./pages/console/Overview.js"));
const Priorities = lazy(() => import("./pages/console/Priorities.js"));
const IssueDetail = lazy(() => import("./pages/console/IssueDetail.js"));
const MapPage = lazy(() => import("./pages/console/MapPage.js"));
const Projects = lazy(() => import("./pages/console/Projects.js"));
const Forecasts = lazy(() => import("./pages/console/Forecasts.js"));
const Equity = lazy(() => import("./pages/console/Equity.js"));
const Copilot = lazy(() => import("./pages/console/Copilot.js"));
const Team = lazy(() => import("./pages/console/Team.js"));
const States = lazy(() => import("./pages/console/States.js"));
const Audit = lazy(() => import("./pages/console/Audit.js"));
const Queue = lazy(() => import("./pages/console/Queue.js"));
const Planner = lazy(() => import("./pages/console/Planner.js"));
const Schemes = lazy(() => import("./pages/console/Schemes.js"));
const Impact = lazy(() => import("./pages/console/Impact.js"));
const Briefing = lazy(() => import("./pages/console/Briefing.js"));
const Track = lazy(() => import("./pages/Track.js"));
const Community = lazy(() => import("./pages/Community.js"));
const Accountability = lazy(() => import("./pages/Accountability.js"));
const OpenData = lazy(() => import("./pages/OpenData.js"));
const Channels = lazy(() => import("./pages/Channels.js"));
const About = lazy(() => import("./pages/About.js"));
const FollowTheMoney = lazy(() => import("./pages/FollowTheMoney.js"));
const NeedVsSpend = lazy(() => import("./pages/console/NeedVsSpend.js"));
const Notifications = lazy(() => import("./pages/citizen/Notifications.js"));

function NotFound() {
  const { t } = useLanguage();
  return (
    <EmptyState
      icon="map"
      title={t("notFound.title")}
      body={t("notFound.body")}
      action={
        <Link to="/">
          <Button>{t("notFound.home")}</Button>
        </Link>
      }
    />
  );
}

function App() {
  return (
    <>
    <SkipLink />
    <RouteAnnouncer />
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-brand-700">
          <Spinner size={32} />
        </div>
      }
    >
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/report" element={<ReportWizard />} />
          <Route path="/transparency" element={<Transparency />} />
          <Route path="/track" element={<Track />} />
          <Route path="/track/:code" element={<Track />} />
          <Route path="/community" element={<Community />} />
          <Route path="/accountability" element={<Accountability />} />
          <Route path="/open-data" element={<OpenData />} />
          <Route path="/channels" element={<Channels />} />
          <Route path="/follow-the-money" element={<FollowTheMoney />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route
          path="/my"
          element={
            <RequireAuth kind="citizen">
              <CitizenLayout />
            </RequireAuth>
          }
        >
          <Route index element={<MyReports />} />
          <Route path="profile" element={<Profile />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path=":submissionId" element={<MyReportDetail />} />
        </Route>

        <Route
          path="/console"
          element={
            <RequireAuth kind="officer">
              <ConsoleLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Overview />} />
          <Route path="queue" element={<Queue />} />
          <Route path="priorities" element={<Priorities />} />
          <Route path="planner" element={<RequireAuth kind="officer" permission="manage_projects"><Planner /></RequireAuth>} />
          <Route path="schemes" element={<Schemes />} />
          <Route path="impact" element={<Impact />} />
          <Route path="need-vs-spend" element={<NeedVsSpend />} />
          <Route path="briefing" element={<Briefing />} />
          <Route path="issues/:issueId" element={<IssueDetail />} />
          <Route path="map" element={<MapPage />} />
          <Route path="projects" element={<Projects />} />
          <Route path="forecasts" element={<Forecasts />} />
          <Route path="equity" element={<RequireAuth kind="officer" permission="view_equity"><Equity /></RequireAuth>} />
          <Route path="copilot" element={<Copilot />} />
          <Route path="team" element={<RequireAuth kind="officer" permission="manage_officers"><Team /></RequireAuth>} />
          <Route path="states" element={<RequireAuth kind="officer" permission="manage_states"><States /></RequireAuth>} />
          <Route path="audit" element={<RequireAuth kind="officer" permission="view_audit_log"><Audit /></RequireAuth>} />
        </Route>
      </Routes>
    </Suspense>
    </>
  );
}

export default App;
