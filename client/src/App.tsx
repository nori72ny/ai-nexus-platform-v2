import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import TaskProgress from "./pages/TaskProgress";
import Report from "./pages/Report";
import History from "./pages/History";
import TaskDetail from "./pages/TaskDetail";
import ReportList from "./pages/ReportList";

function Router() {
  const rootPath = "/";
  const loginPath = "/login";
  const dashboardPath = "/dashboard";
  const historyPath = "/history";
  const taskDetailPath = "/task-detail/:taskId";
  const taskProgressPath = "/task-progress/:taskId";
  const reportListPath = "/reports";
  const reportPath = "/report/:reportId";
  const notFoundPath = "/404";

  return (
    <Switch>
      <Route path={rootPath} component={Home} />
      <Route path={loginPath} component={Login} />
      <Route path={dashboardPath} component={Dashboard} />
      <Route path={historyPath} component={History} />
      <Route path={taskDetailPath} component={TaskDetail} />
      <Route path={taskProgressPath} component={TaskProgress} />
      <Route path={reportListPath} component={ReportList} />
      <Route path={reportPath} component={Report} />
      <Route path={notFoundPath} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
