import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { ArrowRight, Zap, Brain, BarChart3, Shield } from "lucide-react";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white bg-opacity-80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="text-2xl font-bold text-blue-600" style={{ fontFamily: "Playfair Display" }}>
            AI Nexus
          </div>
          <div>
            {isAuthenticated ? (
              <Button
                onClick={() => navigate("/dashboard")}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Dashboard
              </Button>
            ) : (
              <Button
                onClick={() => window.location.href = getLoginUrl()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Sign In
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1
              className="text-5xl lg:text-6xl font-bold text-slate-900 mb-6 leading-tight"
              style={{ fontFamily: "Playfair Display" }}
            >
              Orchestrate Multiple AIs
            </h1>
            <p className="text-xl text-slate-600 mb-8 leading-relaxed">
              Describe your task in natural language. Our AI automatically routes it to the best services—ChatGPT, Gemini, Perplexity, Genspark, and Manus—then synthesizes results into a comprehensive report.
            </p>
            <div className="flex gap-4">
              <Button
                onClick={() => isAuthenticated ? navigate("/dashboard") : window.location.href = getLoginUrl()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
              >
                Get Started
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-600 rounded-2xl blur-3xl opacity-20" />
            <div className="relative bg-white rounded-2xl shadow-2xl p-8 border border-blue-100">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm font-medium text-slate-700">ChatGPT</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-sm font-medium text-slate-700">Gemini</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  <span className="text-sm font-medium text-slate-700">Perplexity</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span className="text-sm font-medium text-slate-700">Genspark</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm font-medium text-slate-700">Manus</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white py-20 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-8">
          <h2
            className="text-4xl font-bold text-slate-900 mb-16 text-center"
            style={{ fontFamily: "Playfair Display" }}
          >
            Powerful Features
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Feature 1 */}
            <div className="p-6 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
              <Brain className="w-8 h-8 text-blue-600 mb-4" />
              <h3 className="font-semibold text-slate-900 mb-2">AI Routing</h3>
              <p className="text-slate-600 text-sm">
                Automatically selects the best AI for your task
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-xl bg-gradient-to-br from-green-50 to-green-100 border border-green-200">
              <Zap className="w-8 h-8 text-green-600 mb-4" />
              <h3 className="font-semibold text-slate-900 mb-2">Parallel Execution</h3>
              <p className="text-slate-600 text-sm">
                Run multiple AIs simultaneously for faster results
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200">
              <BarChart3 className="w-8 h-8 text-purple-600 mb-4" />
              <h3 className="font-semibold text-slate-900 mb-2">Fact Checking</h3>
              <p className="text-slate-600 text-sm">
                Compare and verify results across AI services
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200">
              <Shield className="w-8 h-8 text-orange-600 mb-4" />
              <h3 className="font-semibold text-slate-900 mb-2">Audit Logs</h3>
              <p className="text-slate-600 text-sm">
                Full tracking and compliance for all operations
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Report Format Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-8">
          <h2
            className="text-4xl font-bold text-slate-900 mb-16 text-center"
            style={{ fontFamily: "Playfair Display" }}
          >
            Structured Report Format
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: "結論", desc: "Executive summary" },
              { title: "今やるべき理由", desc: "Urgency analysis" },
              { title: "メリット", desc: "Benefits overview" },
              { title: "デメリット", desc: "Drawbacks analysis" },
              { title: "リスク", desc: "Risk assessment" },
              { title: "推奨アクション", desc: "Action items" },
              { title: "出典", desc: "References" },
              { title: "グラフ", desc: "Data visualization" },
            ].map((section, index) => (
              <div
                key={index}
                className="p-6 bg-white rounded-lg border border-slate-200 hover:shadow-lg transition"
              >
                <h3 className="font-semibold text-slate-900 mb-2">{section.title}</h3>
                <p className="text-slate-600 text-sm">{section.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-700 py-20">
        <div className="max-w-4xl mx-auto px-8 text-center">
          <h2
            className="text-4xl font-bold text-white mb-6"
            style={{ fontFamily: "Playfair Display" }}
          >
            Ready to orchestrate your AI?
          </h2>
          <p className="text-blue-100 text-lg mb-8">
            Start creating tasks and get comprehensive AI-powered reports in minutes.
          </p>
          <Button
            onClick={() => isAuthenticated ? navigate("/dashboard") : window.location.href = getLoginUrl()}
            className="bg-white text-blue-600 hover:bg-blue-50 px-8 py-3 text-lg font-semibold"
          >
            Get Started Now
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-8 text-center">
          <p>&copy; 2026 AI Nexus Platform. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
