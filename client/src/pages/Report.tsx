import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useParams } from "wouter";
import { Download, Loader2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { Streamdown } from "streamdown";

interface ReportSection {
  id: number;
  sectionType: string;
  content: string;
  order: number;
}

export default function Report() {
  const { reportId } = useParams<{ reportId: string }>();
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState(false);

  const reportQuery = trpc.report.getDetail.useQuery(Number(reportId) as any);
  const exportPDFMutation = trpc.report.exportPDF.useMutation();

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const result = await exportPDFMutation.mutateAsync(Number(reportId) as any);
      if (result.success) {
        const link = document.createElement("a");
        link.href = `data:application/pdf;base64,${result.pdf}`;
        link.download = result.filename;
        link.click();
      }
    } catch (error) {
      console.error("Failed to export PDF:", error);
    } finally {
      setIsExporting(false);
    }
  };

  if (reportQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading report...</p>
        </div>
      </div>
    );
  }

  if (reportQuery.isError || !reportQuery.data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="border-0 shadow-lg border-l-4 border-red-500 bg-red-50">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">Error</p>
              <p className="text-red-700 text-sm mt-1">Failed to load report</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const report = reportQuery.data;
  const sections = (report.sections as ReportSection[]) || [];
  const sectionOrder = ["conclusion", "reason", "benefits", "drawbacks", "risks", "recommendations", "sources", "graphs"];
  const sectionLabels: Record<string, string> = {
    conclusion: "結論",
    reason: "今やるべき理由",
    benefits: "メリット",
    drawbacks: "デメリット",
    risks: "リスク",
    recommendations: "推奨アクション",
    sources: "出典",
    graphs: "グラフ",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2" style={{ fontFamily: "Playfair Display" }}>
              {report.title}
            </h1>
            <p className="text-slate-600">
              Generated on {new Date(report.createdAt).toLocaleDateString()}
            </p>
          </div>
          <Button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </>
            )}
          </Button>
        </div>

        {/* Summary */}
        {report.summary && (
          <Card className="border-0 shadow-lg mb-8 bg-gradient-to-r from-blue-50 to-blue-100">
            <CardContent className="pt-6">
              <p className="text-slate-700 leading-relaxed">{report.summary}</p>
            </CardContent>
          </Card>
        )}

        {/* Sections */}
        <div className="space-y-6">
          {sectionOrder.map((sectionType) => {
            const section = sections.find((s) => s.sectionType === sectionType);
            if (!section || !section.content) return null;

            return (
              <Card key={sectionType} className="border-0 shadow-lg hover:shadow-xl transition">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
                  <CardTitle className="text-xl text-blue-900" style={{ fontFamily: "Playfair Display" }}>
                    {sectionLabels[sectionType] || sectionType}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed">
                    <Streamdown>{section.content}</Streamdown>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Citations */}
        {report.citations && report.citations.length > 0 && (
          <Card className="border-0 shadow-lg mt-8">
            <CardHeader>
              <CardTitle className="text-lg">Sources & References</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(report.citations as any[]).map((citation, index) => (
                  <div key={index} className="text-sm text-slate-700">
                    <p className="font-medium">{citation.source}</p>
                    {citation.url && (
                      <a
                        href={citation.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-xs"
                      >
                        {citation.url}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-slate-600 text-sm">
          <p>Report ID: {reportId}</p>
          <p>Status: {report.status}</p>
        </div>
      </div>
    </div>
  );
}
