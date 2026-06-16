import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Plus, FileText, Clock, CheckCircle } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tasksQuery = trpc.task.list.useQuery();
  const reportsQuery = trpc.report.list.useQuery();
  const createTaskMutation = trpc.task.create.useMutation();

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await createTaskMutation.mutateAsync({
        title: taskTitle,
        description: taskDescription,
      });

      if (result.success) {
        setTaskTitle("");
        setTaskDescription("");
        tasksQuery.refetch();
        navigate(`/task-progress/${result.taskId}`);
      }
    } catch (error) {
      console.error("Failed to create task:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const recentTasks = tasksQuery.data?.slice(0, 5) || [];
  const recentReports = reportsQuery.data?.slice(0, 5) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2" style={{ fontFamily: "Playfair Display" }}>
            AI Nexus Platform
          </h1>
          <p className="text-slate-600">Welcome, {user?.name || "User"}. Create a task to get started.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Task Creation Panel */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Create New Task
                </CardTitle>
                <CardDescription>
                  Describe your task in natural language. Our AI will automatically route it to the best services.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Task Title</label>
                  <Input
                    placeholder="e.g., Analyze market trends for Q3 2026"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="border-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Description (Optional)</label>
                  <Textarea
                    placeholder="Provide more details about your task..."
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    className="border-slate-200 min-h-[120px]"
                  />
                </div>

                <Button
                  onClick={handleCreateTask}
                  disabled={!taskTitle.trim() || isSubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Task"
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Stats Panel */}
          <div className="space-y-4">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
              <CardHeader>
                <CardTitle className="text-lg">Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-slate-600">Total Tasks</p>
                  <p className="text-3xl font-bold text-blue-600">{tasksQuery.data?.length || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Reports Generated</p>
                  <p className="text-3xl font-bold text-blue-600">{reportsQuery.data?.length || 0}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Tasks & Reports */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          {/* Recent Tasks */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentTasks.length === 0 ? (
                <p className="text-slate-500 text-sm">No tasks yet. Create one to get started.</p>
              ) : (
                <div className="space-y-3">
                  {recentTasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition"
                      onClick={() => navigate(`/task-detail/${task.id}`)}
                    >
                      <p className="font-medium text-slate-900">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            task.status === "completed"
                              ? "bg-green-100 text-green-700"
                              : task.status === "processing"
                                ? "bg-blue-100 text-blue-700"
                                : task.status === "failed"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {task.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Navigation Links */}
          <div className="flex gap-3">
            <Button
              onClick={() => navigate("/history")}
              variant="outline"
              className="flex-1 border-slate-300"
            >
              View History
            </Button>
            <Button
              onClick={() => navigate("/reports")}
              variant="outline"
              className="flex-1 border-slate-300"
            >
              All Reports
            </Button>
          </div>
        </div>

        {/* Recent Reports */}
        <div>
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Recent Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentReports.length === 0 ? (
                <p className="text-slate-500 text-sm">No reports yet. Complete a task to generate one.</p>
              ) : (
                <div className="space-y-3">
                  {recentReports.map((report) => (
                    <div
                      key={report.id}
                      className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition"
                      onClick={() => navigate(`/report/${report.id}`)}
                    >
                      <p className="font-medium text-slate-900">{report.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-xs text-slate-600">
                          {new Date(report.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
