import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Zap } from "lucide-react";

export default function Login() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Zap className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-900" style={{ fontFamily: "Playfair Display" }}>
              AI Nexus
            </h1>
          </div>
          <p className="text-slate-600">Orchestrate Multiple AIs</p>
        </div>

        {/* Login Card */}
        <Card className="border-0 shadow-2xl">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
            <CardTitle className="text-2xl text-center text-blue-900" style={{ fontFamily: "Playfair Display" }}>
              Sign In
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-8 space-y-4">
            {/* Manus OAuth Button */}
            <Button
              onClick={() => window.location.href = getLoginUrl()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-semibold"
            >
              Sign In with Manus
            </Button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">or</span>
              </div>
            </div>

            {/* Alternative Login Options (Placeholder) */}
            <Button
              variant="outline"
              className="w-full py-3 text-slate-700 border-slate-300 hover:bg-slate-50"
              disabled
            >
              Google
            </Button>

            <Button
              variant="outline"
              className="w-full py-3 text-slate-700 border-slate-300 hover:bg-slate-50"
              disabled
            >
              Microsoft
            </Button>

            {/* Terms */}
            <p className="text-xs text-slate-500 text-center mt-6">
              By signing in, you agree to our{" "}
              <a href="#" className="text-blue-600 hover:underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="text-blue-600 hover:underline">
                Privacy Policy
              </a>
            </p>
          </CardContent>
        </Card>

        {/* Features Highlight */}
        <div className="mt-12 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">5</div>
            <p className="text-xs text-slate-600">AI Services</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">8</div>
            <p className="text-xs text-slate-600">Report Sections</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">∞</div>
            <p className="text-xs text-slate-600">Possibilities</p>
          </div>
        </div>
      </div>
    </div>
  );
}
