import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface AIResult {
  service: string;
  confidence: number;
  processingTime: number;
  agreementScore: number;
}

interface AIComparisonChartProps {
  results: AIResult[];
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export function AIComparisonChart({ results }: AIComparisonChartProps) {
  if (!results || results.length === 0) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="pt-6 text-center">
          <p className="text-slate-600">No AI results available</p>
        </CardContent>
      </Card>
    );
  }

  // Confidence Score Chart Data
  const confidenceData = results.map((r) => ({
    name: r.service,
    confidence: r.confidence,
  }));

  // Processing Time Chart Data
  const processingTimeData = results.map((r) => ({
    name: r.service,
    time: r.processingTime,
  }));

  // Agreement Score Data
  const agreementData = results.map((r) => ({
    name: r.service,
    agreement: r.agreementScore,
  }));

  // Average Agreement Score
  const avgAgreement =
    results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.agreementScore, 0) / results.length)
      : 0;

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-600 mb-1">Average Confidence</p>
            <p className="text-3xl font-bold text-blue-600">
              {Math.round(results.reduce((sum, r) => sum + r.confidence, 0) / results.length)}%
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-600 mb-1">Average Processing Time</p>
            <p className="text-3xl font-bold text-green-600">
              {Math.round(results.reduce((sum, r) => sum + r.processingTime, 0) / results.length)}ms
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-600 mb-1">Average Agreement</p>
            <p className="text-3xl font-bold text-purple-600">{avgAgreement}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Confidence Score Chart */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Confidence Scores by AI Service</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={confidenceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="confidence" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Processing Time Chart */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Processing Time by AI Service</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={processingTimeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="time" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Agreement Score Distribution */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Agreement Score Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={agreementData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, agreement }) => `${name}: ${agreement}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="agreement"
              >
                {results.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed Comparison Table */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Detailed Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-slate-900">AI Service</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-900">Confidence</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-900">Processing Time</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-900">Agreement Score</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, index) => (
                  <tr key={index} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{result.service}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {result.confidence}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{result.processingTime}ms</td>
                    <td className="px-4 py-3">
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${result.agreementScore}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-600 mt-1">{result.agreementScore}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
