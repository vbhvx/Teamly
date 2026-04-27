"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, CheckCircle, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { apiRequest, ClientApiError } from "@/lib/api-client";

function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState(searchParams.get("token") || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [targetWorkspaceId, setTargetWorkspaceId] = useState<string | null>(null);

  const handleAccept = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!token.trim()) {
      setError("Please provide a valid invitation token.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest("/api/v1/invitations/accept", {
        method: "POST",
        body: JSON.stringify({ token: token.trim() }),
      });

      setSuccess(res.message || "Successfully joined workspace!");
      setTargetWorkspaceId(res.workspaceId);
    } catch (err: any) {
      if (err instanceof ClientApiError && err.status === 401) {
        setError("You must be logged in to accept an invitation. Please log in first.");
      } else {
        setError(err.message || "Invalid or expired invitation token.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl sm:px-10">
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {success ? (
        <div className="text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">{success}</h3>
          <p className="text-sm text-slate-500">
            You now have access according to your assigned workspace role.
          </p>
          <div className="pt-2">
            <Link
              href={targetWorkspaceId ? `/workspaces/${targetWorkspaceId}` : "/dashboard"}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition"
            >
              Go to Workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleAccept} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase">
              Invitation Secret Token
            </label>
            <input
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste token or link code..."
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono text-slate-900 focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Joining workspace...
              </>
            ) : (
              "Accept & Join Workspace"
            )}
          </button>
        </form>
      )}
    </div>
  );
}

export default function AcceptInvitationPage() {
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
          Accept Team Invitation
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Join your team's secure collaborative workspace.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <Suspense fallback={<div className="py-12 text-center text-slate-400">Loading...</div>}>
          <AcceptInvitationContent />
        </Suspense>
      </div>
    </div>
  );
}

