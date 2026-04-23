import Link from "next/link";
import { Shield, Users, CheckCircle, Lock, Key, ArrowRight, FileText } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex-1 flex flex-col">
      {/* Navigation Bar */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm">
              <Shield className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">Teamly</span>
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              v1.0 Secure
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/docs"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
            >
              <FileText className="h-4 w-4" />
              API Docs
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
            >
              Log In
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg shadow-sm transition"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200 mb-6">
          <CheckCircle className="h-3.5 w-3.5" />
          Explicit RBAC & Server-Enforced Boundaries
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight max-w-4xl">
          Secure Team Task Management with <span className="text-blue-600">Zero Privilege Leaks</span>
        </h1>

        <p className="mt-6 text-lg text-slate-600 max-w-2xl leading-relaxed">
          Production-grade collaboration engineered with multi-tenant workspace isolation, server-validated workflows, cryptographic session tokens, and tamper-proof audit trails.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base shadow hover:shadow-md transition"
          >
            Create Your Workspace
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-base border border-slate-300 shadow-sm transition"
          >
            Open Dashboard
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 text-left w-full">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <Lock className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Workspace Isolation</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Every request strictly verifies team membership. A role in one workspace never grants permissions in another, and cross-workspace access attempts are concealed with intentional 404 responses.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Granular 4-Tier RBAC</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Explicit Owner, Admin, Member, and Viewer policies. Members only edit tasks they created or are assigned to; Viewers remain strictly read-only; and sole owners cannot be orphaned.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
              <Key className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Audit Trail & Security</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              State transitions, role updates, and assignment changes are recorded immutably in task activities with automatic credential redaction and CSRF validation.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© 2026 Teamly Platform. Secure Team Task Management.</p>
          <div className="flex gap-4">
            <Link href="/docs" className="hover:text-slate-900 underline">API Spec</Link>
            <Link href="/login" className="hover:text-slate-900">Log In</Link>
            <Link href="/register" className="hover:text-slate-900">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

