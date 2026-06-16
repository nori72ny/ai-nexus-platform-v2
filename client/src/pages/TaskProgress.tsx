import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Loader2, CheckCircle2, AlertCircle, Zap, Clock } from "lucide-react";

interface StreamEvent {
  type: "progress" | "ai_result" | "fact_check" | "report" | "error" | "complete";
  service?: string;
  message: string;
  data?: any;
  timestamp: number;
}

interface AgentStatus {
  name: string;
  status: "waiting" | "running" | "complete" | "error";
  message?: string;
}

export default function TaskProgress() {
  const { taskId } = useParams<{ taskId: string }>();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [reportId, setReportId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentStatus[]>([
    { name: "Router Agent", status: "waiting" },
    { name: "Research Agent", status: "waiting" },
    { name: "Analysis Agent", status: "waiting" },
    { name: "Report Agent", status: "waiting" },
  ]);

  const taskQuery = trpc.task.getDetail.useQuery(Number(taskId) as any);
  const streamMutation = trpc.report.stream.useMutation();

  useEffect(() => {
    if (!taskQuery.data || !user) return;

    const clientId = `client-${Date.now()}-${Math.random()}`;

    // SSEコネクションを確立
    const eventSource = new EventSource(`/api/sse/${clientId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as StreamEvent;
        setEvents((prev) => [...prev, data]);

        // エージェントステータスを更新
        if (data.type === "progress") {
          setAgents((prev) => {
            const updated = [...prev];
            if (data.message.includes("Router")) {
              updated[0].status = "running";
              updated[0].message = data.message;
            } else if (data.message.includes("Research")) {
              updated[1].status = "running";
              updated[1].message = data.message;
            } else if (data.message.includes("Analysis")) {
              updated[2].status = "running";
              updated[2].message = data.message;
            } else if (data.message.includes("Report")) {
              updated[3].status = "running";
              updated[3].message = data.message;
            }
            return updated;
          });
        }

        if (data.type === "complete") {
          setIsComplete(true);
          setAgents((prev) =>
            prev.map((agent) => ({
              ...agent,
              status: agent.status === "running" ? "complete" : agent.status,
            }))
          );
          if (data.data?.reportId) {
            setReportId(data.data.reportId);
          }
        } else if (data.type === "error") {
          setError(data.message);
          setAgents((prev) =>
            prev.map((agent) => ({
              ...agent,
              status: agent.status === "running" ? "error" : agent.status,
            }))
          );
          eventSource.close();
        }
      } catch (err) {
        console.error("Failed to parse SSE event:", err);
      }
    };

    eventSource.onerror = () => {
      setError("Connection lost");
      eventSource.close();
    };

    // レポート生成を開始
    streamMutation.mutate({
      taskId: Number(taskId),
      taskDescription: taskQuery.data.title,
      clientId,
    });

    return () => {
      eventSource.close();
    };
  }, [taskQuery.data, user, taskId, streamMutation]);

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

  if (!taskQuery.data) {
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

  const progressPercentage = Math.min((events.length / 10) * 100, 100);

  const getAgentIcon = (status: string) => {
    switch (status) {
      case "complete":
        return <CheckCircle2 className="w-6 h-6 text-green-600" />;
      case "running":
        return <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />;
      case "error":
        return <AlertCircle className="w-6 h-6 text-red-600" />;
      default:
        return <Clock className="w-6 h-6 text-slate-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2" style={{ fontFamily: "Playfair Display" }}>
            Task Progress
          </h1>
          <p className="text-slate-600">{taskQuery.data.title}</p>
        </div>

        {/* Agent Status Panel */}
        <Card className="border-0 shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Processing Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {agents.map((agent, index) => (
                <div key={index} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                  <div className="flex-shrink-0">{getAgentIcon(agent.status)}</div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{agent.name}</p>
                    {agent.message && <p className="text-sm text-slate-600 mt-1">{agent.message}</p>}
                  </div>
                  <span
                    className={`text-xs px-3 py-1 rounded-full font-medium ${
                      agent.status === "complete"
                        ? "bg-green-100 text-green-700"
                        : agent.status === "running"
                          ? "bg-blue-100 text-blue-700"
                          : agent.status === "error"
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {agent.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Progress Bar */}
        <Card className="border-0 shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Overall Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-slate-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <p className="text-sm text-slate-600 mt-2">{Math.round(progressPercentage)}% Complete</p>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Card className="border-0 shadow-lg mb-8 border-l-4 border-red-500 bg-red-50">
            <CardContent className="pt-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-900">Error</p>
                <p className="text-red-700 text-sm mt-1">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Live Log */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Live Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm">
              {events.length === 0 ? (
                <p className="text-slate-500">Waiting for processing to start...</p>
              ) : (
                events.map((event, index) => (
                  <div key={index} className="text-slate-300">
                    <span className="text-slate-500">[{new Date(event.timestamp).toLocaleTimeString()}]</span>{" "}
                    <span className="text-blue-400">{event.service || "system"}:</span> {event.message}
                  </div>
                ))
              )}
            </div>

            {isComplete && reportId && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-900 font-medium mb-3">Report generated successfully!</p>
                <button
                  onClick={() => navigate(`/report/${reportId}`)}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition"
                >
                  View Report
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
