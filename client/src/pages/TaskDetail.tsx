import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useLocation, useParams } from "wouter";
import { Loader2, ChevronLeft, Play, Trash2 } from "lucide-react";

export default function TaskDetail() {
  const { taskId } = useParams<{ taskId: string }>();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const taskQuery = trpc.task.getDetail.useQuery(Number(taskId) as any);
  const reportsQuery = trpc.report.list.useQuery();

  if (taskQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading task...</p>
        </div>
      </div>
    );
  }

  if (taskQuery.isError || !taskQuery.data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6">
            <p className="text-slate-600">Task not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const task = taskQuery.data;
  const report = reportsQuery.data?.find((r) => r.taskId === task.id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/history")}
              className="text-slate-600 hover:text-slate-900"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900" style={{ fontFamily: "Playfair Display" }}>
                {task.title}
              </h1>
              <p className="text-slate-600 mt-1">
                Created on {new Date(task.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {task.status !== "completed" && (
              <Button
                onClick={() => navigate(`/task-progress/${task.id}`)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Play className="w-4 h-4 mr-2" />
                Run
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Status Card */}
        <Card className="border-0 shadow-lg mb-8">
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <span
                className={`text-sm px-4 py-2 rounded-full font-medium ${
                  task.status === "completed"
                    ? "bg-green-100 text-green-700"
                    : task.status === "processing"
                      ? "bg-blue-100 text-blue-700"
                      : task.status === "failed"
                        ? "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-700"
                }`}
              >
                {task.status.toUpperCase()}
              </span>
              {report && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-600" />
                  <span className="text-sm text-slate-600">Report Generated</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Description */}
        {task.description && (
          <Card className="border-0 shadow-lg mb-8">
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 leading-relaxed">{task.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Report Section */}
        {report && (
          <Card className="border-0 shadow-lg mb-8 bg-gradient-to-br from-green-50 to-green-100">
            <CardHeader>
              <CardTitle className="text-green-900">Generated Report</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-green-700 mb-4">{report.title}</p>
              <Button
                onClick={() => navigate(`/report/${report.id}`)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                View Full Report
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Task Details */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-600 mb-1">Task ID</p>
                <p className="font-mono text-slate-900">{task.id}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Created At</p>
                <p className="text-slate-900">{new Date(task.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Updated At</p>
                <p className="text-slate-900">{new Date(task.updatedAt).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
