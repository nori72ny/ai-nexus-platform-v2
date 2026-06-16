import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Loader2, Search, Download, Trash2, ChevronRight } from "lucide-react";
import { useState } from "react";

export default function ReportList() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const reportsQuery = trpc.report.list.useQuery();

  if (reportsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading reports...</p>
        </div>
      </div>
    );
  }

  const reports = reportsQuery.data || [];

  // Filter reports
  const filteredReports = reports.filter((report) => {
    const matchesSearch =
      report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.summary?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !filterStatus || report.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2" style={{ fontFamily: "Playfair Display" }}>
            All Reports
          </h1>
          <p className="text-slate-600">Browse and manage your generated reports</p>
        </div>

        {/* Search & Filter */}
        <Card className="border-0 shadow-lg mb-8">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <Input
                  placeholder="Search reports..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 border-slate-200"
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={filterStatus === null ? "default" : "outline"}
                  onClick={() => setFilterStatus(null)}
                  className={filterStatus === null ? "bg-blue-600" : "border-slate-300"}
                >
                  All
                </Button>
                <Button
                  variant={filterStatus === "completed" ? "default" : "outline"}
                  onClick={() => setFilterStatus("completed")}
                  className={filterStatus === "completed" ? "bg-green-600" : "border-slate-300"}
                >
                  Completed
                </Button>
                <Button
                  variant={filterStatus === "draft" ? "default" : "outline"}
                  onClick={() => setFilterStatus("draft")}
                  className={filterStatus === "draft" ? "bg-blue-600" : "border-slate-300"}
                >
                  Draft
                </Button>
                <Button
                  variant={filterStatus === "archived" ? "default" : "outline"}
                  onClick={() => setFilterStatus("archived")}
                  className={filterStatus === "archived" ? "bg-red-600" : "border-slate-300"}
                >
                  Archived
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reports Grid */}
        {filteredReports.length === 0 ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6 text-center">
              <p className="text-slate-600">No reports found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReports.map((report) => (
              <Card
                key={report.id}
                className="border-0 shadow-lg hover:shadow-xl transition cursor-pointer"
                onClick={() => navigate(`/report/${report.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg line-clamp-2">{report.title}</CardTitle>
                    <span className="text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ml-2 bg-green-100 text-green-700">
                      {report.status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  {report.summary && (
                    <p className="text-sm text-slate-600 mb-3 line-clamp-3">{report.summary}</p>
                  )}
                  <p className="text-xs text-slate-500 mb-4">
                    {new Date(report.createdAt).toLocaleDateString()}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/report/${report.id}`);
                      }}
                      className="flex-1 border-slate-300"
                    >
                      View
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      className="text-blue-600 hover:bg-blue-50"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6">
              <p className="text-sm text-slate-600 mb-1">Total Reports</p>
              <p className="text-3xl font-bold text-blue-600">{reports.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6">
              <p className="text-sm text-slate-600 mb-1">Completed</p>
              <p className="text-3xl font-bold text-green-600">
                {reports.filter((r) => r.status === "completed").length}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6">
              <p className="text-sm text-slate-600 mb-1">Success Rate</p>
              <p className="text-3xl font-bold text-purple-600">
                {reports.length > 0
                  ? Math.round(
                      (reports.filter((r) => r.status === "completed").length / reports.length) * 100
                    )
                  : 0}
                %
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
