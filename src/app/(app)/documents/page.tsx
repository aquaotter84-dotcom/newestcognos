"use client";

import PageHeader from "@/components/PageHeader";

export default function DocumentsPage() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title="Documents"
        subtitle="Files and extracted context for the council"
      />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-xl mx-auto rounded-2xl p-8 text-center" style={{ background: "#0c0f1e", border: "1px solid #1a1f3a" }}>
          <div className="text-4xl mb-4" style={{ color: "#4f7aff" }}>▥</div>
          <h2 className="text-base font-semibold" style={{ color: "#c7d2fe" }}>
            Document ingestion is coming next
          </h2>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: "#64748b" }}>
            The Base44 version uploaded files, captured camera/screen, and extracted text
            into the council context. This open-source build will add the same
            document pipeline behind a storage provider (Supabase, S3, or Vercel Blob).
          </p>
          <p className="text-xs mt-3" style={{ color: "#334155" }}>
            To get there, this module needs: a documents table, upload API, text extraction,
            and a document browser. The rest of COGNOS is already wired around that data model.
          </p>
        </div>
      </div>
    </div>
  );
}
