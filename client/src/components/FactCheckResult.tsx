import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";

interface Agreement {
  statement: string;
  services: string[];
  confidence: number;
}

interface Disagreement {
  statement: string;
  serviceA: { name: string; position: string };
  serviceB: { name: string; position: string };
}

interface FactCheckResultProps {
  agreements: Agreement[];
  disagreements: Disagreement[];
  verificationRate: number;
}

export function FactCheckResult({
  agreements,
  disagreements,
  verificationRate,
}: FactCheckResultProps) {
  if (!agreements && !disagreements) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="pt-6 text-center">
          <p className="text-slate-600">No fact-check results available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Verification Rate */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-green-50 to-green-100">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Overall Verification Rate</p>
              <p className="text-4xl font-bold text-green-600">{verificationRate}%</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-600 mb-1">Consensus Level</p>
              <p className="text-2xl font-bold text-green-600">
                {verificationRate >= 80 ? "High" : verificationRate >= 60 ? "Medium" : "Low"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agreements */}
      {agreements && agreements.length > 0 && (
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 border-b border-green-200">
            <CardTitle className="flex items-center gap-2 text-green-900">
              <CheckCircle2 className="w-5 h-5" />
              Points of Agreement ({agreements.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {agreements.map((agreement, index) => (
                <div key={index} className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-slate-900 mb-2">{agreement.statement}</p>
                      <div className="flex flex-wrap gap-2">
                        {agreement.services.map((service, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium"
                          >
                            {service}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-slate-600 mt-2">
                        Confidence: <span className="font-semibold">{agreement.confidence}%</span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disagreements */}
      {disagreements && disagreements.length > 0 && (
        <Card className="border-0 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-orange-100 border-b border-orange-200">
            <CardTitle className="flex items-center gap-2 text-orange-900">
              <AlertCircle className="w-5 h-5" />
              Points of Disagreement ({disagreements.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {disagreements.map((disagreement, index) => (
                <div key={index} className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="font-medium text-slate-900 mb-3">{disagreement.statement}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 bg-white rounded border border-orange-200">
                      <p className="text-xs font-semibold text-slate-600 mb-1">{disagreement.serviceA.name}</p>
                      <p className="text-sm text-slate-900">{disagreement.serviceA.position}</p>
                    </div>
                    <div className="p-3 bg-white rounded border border-orange-200">
                      <p className="text-xs font-semibold text-slate-600 mb-1">{disagreement.serviceB.name}</p>
                      <p className="text-sm text-slate-900">{disagreement.serviceB.position}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Disagreements Alert */}
      {(!disagreements || disagreements.length === 0) && (
        <Card className="border-0 shadow-lg border-l-4 border-green-500 bg-green-50">
          <CardContent className="pt-6 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-green-900">Perfect Consensus</p>
              <p className="text-green-700 text-sm mt-1">All AI services agree on the findings.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
