"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { apiRequest, ClientApiError } from "@/lib/api-client";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!name.trim()) {
      setFieldErrors((prev) => ({ ...prev, name: "Name is required" }));
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setFieldErrors((prev) => ({ ...prev, email: "Valid email is required" }));
      return;
    }
    if (password.length < 8) {
      setFieldErrors((prev) => ({ ...prev, password: "Password must be at least 8 characters" }));
      return;
    }

    try {
      setLoading(true);
      await apiRequest("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      router.push("/dashboard");
    } catch (err: any) {
      if (err instanceof ClientApiError) {
        if (err.details && err.details.length > 0) {
          const map: Record<string, string> = {};
          err.details.forEach((d) => {
            if (d.field) map[d.field] = d.message || "Invalid value";
          });
          setFieldErrors(map);
        }
        setError(err.message);
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-4">
          <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-md">
            <Shield className="h-6 w-6" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-900">Teamly</span>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Create your account
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-500">
            Sign in
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl sm:px-10">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700">Full Name</label>
              <div className="mt-1">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  className={`block w-full rounded-xl border px-3.5 py-2.5 text-slate-900 shadow-sm focus:ring-2 focus:ring-blue-600 sm:text-sm ${
                    fieldErrors.name ? "border-red-300 focus:ring-red-500" : "border-slate-300"
                  }`}
                />
                {fieldErrors.name && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Email Address</label>
              <div className="mt-1">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className={`block w-full rounded-xl border px-3.5 py-2.5 text-slate-900 shadow-sm focus:ring-2 focus:ring-blue-600 sm:text-sm ${
                    fieldErrors.email ? "border-red-300 focus:ring-red-500" : "border-slate-300"
                  }`}
                />
                {fieldErrors.email && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 chars, letters & numbers"
                  className={`block w-full rounded-xl border px-3.5 py-2.5 text-slate-900 shadow-sm focus:ring-2 focus:ring-blue-600 sm:text-sm ${
                    fieldErrors.password ? "border-red-300 focus:ring-red-500" : "border-slate-300"
                  }`}
                />
                {fieldErrors.password && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
                )}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Minimum 8 characters with at least one letter and one number.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm disabled:opacity-50 transition"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

