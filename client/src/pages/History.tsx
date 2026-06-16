import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Loader2, ChevronRight, Trash2 } from "lucide-react";
import { useState } from "react";

export default function History() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const tasksQuery = trpc.task.list.useQuery();
  const reportsQuery = trpc.report.list.useQuery();

  if (tasksQuery.isLoading || reportsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading history...</p>
        </div>
      </div>
    );
  }

  const tasks = tasksQuery.data || [];
  const reports = reportsQuery.data || [];

  // Group tasks by date
  const groupedTasks: Record<string, typeof tasks> = {};
  tasks.forEach((task) => {
    const date = new Date(task.createdAt).toLocaleDateString();
    if (!groupedTasks[date]) {
      groupedTasks[date] = [];
    }
    groupedTasks[date].push(task);
  });

  const sortedDates = Object.keys(groupedTasks).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2" style={{ fontFamily: "Playfair Display" }}>
            Task History
          </h1>
          <p className="text-slate-600">View and manage your past tasks and reports</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6">
              <p className="text-sm text-slate-600 mb-1">Total Tasks</p>
              <p className="text-3xl font-bold text-blue-600">{tasks.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6">
              <p className="text-sm text-slate-600 mb-1">Reports Generated</p>
              <p className="text-3xl font-bold text-green-600">{reports.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6">
              <p className="text-sm text-slate-600 mb-1">Completion Rate</p>
              <p className="text-3xl font-bold text-purple-600">
                {tasks.length > 0 ? Math.round((reports.length / tasks.length) * 100) : 0}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tasks by Date */}
        <div className="space-y-6">
          {sortedDates.length === 0 ? (
            <Card className="border-0 shadow-lg">
              <CardContent className="pt-6 text-center">
                <p className="text-slate-600">No tasks yet. Create one to get started.</p>
              </CardContent>
            </Card>
          ) : (
            sortedDates.map((date) => (
              <div key={date}>
                <h2 className="text-lg font-semibold text-slate-900 mb-4">{date}</h2>
                <div className="space-y-3">
                  {groupedTasks[date].map((task) => {
                    const report = reports.find((r) => r.taskId === task.id);
                    return (
                      <Card
                        key={task.id}
                        className="border-0 shadow-lg hover:shadow-xl transition cursor-pointer"
                        onClick={() => navigate(`/task-detail/${task.id}`)}
                      >
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-slate-900 mb-2">{task.title}</h3>
                              {task.description && (
                                <p className="text-sm text-slate-600 mb-3 line-clamp-2">{task.description}</p>
                              )}
                              <div className="flex items-center gap-3">
                                <span
                                  className={`text-xs px-2 py-1 rounded-full font-medium ${
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
                                {report && (
                                  <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 font-medium">
                                    Report Generated
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {report && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/report/${report.id}`);
                                  }}
                                  className="border-slate-300"
                                >
                                  View Report
                                  <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // TODO: Implement delete functionality
                                }}
                                className="text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
