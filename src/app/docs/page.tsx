"use client";

import { useEffect } from "react";
import Head from "next/head";

export default function DocsPage() {
  useEffect(() => {
    // Dynamically load Swagger UI CSS and bundle
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-bundle.js";
    script.onload = () => {
      // @ts-ignore
      if (window.SwaggerUIBundle) {
        // @ts-ignore
        window.SwaggerUIBundle({
          url: "/api/v1/openapi.json",
          dom_id: "#swagger-ui",
          deepLinking: true,
          presets: [
            // @ts-ignore
            window.SwaggerUIBundle.presets.apis,
            // @ts-ignore
            window.SwaggerUIBundle.SwaggerUIStandalonePreset,
          ],
          layout: "BaseLayout",
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      if (link.parentNode) link.parentNode.removeChild(link);
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 border-b border-slate-800 py-4 px-6 text-white flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Teamly API Reference</h1>
          <p className="text-xs text-slate-400">OpenAPI 3.0 Interactive Specification</p>
        </div>
        <div className="flex gap-4 text-sm">
          <a
            href="/api/v1/openapi.json"
            target="_blank"
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            Raw JSON
          </a>
          <a
            href="/dashboard"
            className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium transition"
          >
            App Dashboard
          </a>
        </div>
      </header>
      <main className="max-w-6xl mx-auto py-6 px-4">
        <div id="swagger-ui" className="bg-white rounded-xl shadow-sm border border-slate-200 p-4" />
      </main>
    </div>
  );
}

