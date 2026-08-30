import { NextResponse } from "next/server";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { resolveWorkspaceId, canAccessWorkspace } from "@/lib/workspace";
import { requireAuth } from "@/lib/auth";
import {
  analyzeDocument,
  classifyDocument,
  fetchTextFromUrl,
} from "@/lib/documents";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.user) return auth.response!;

  try {
    const { searchParams } = new URL(request.url);
    const workspace = await resolveWorkspaceId(searchParams.get("workspaceId"), auth.user.id);
    const all = await db
      .select()
      .from(documents)
      .where(eq(documents.workspaceId, workspace.id))
      .orderBy(desc(documents.createdAt))
      .limit(200);
    return NextResponse.json(all);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.user) return auth.response!;

  try {
    const body = await request.json().catch(() => ({}));
    const workspace = await resolveWorkspaceId(body.workspaceId, auth.user.id);

    const name = String(body.name || "").trim();
    const contentText = String(body.contentText || "").trim();
    const fileUrl = String(body.fileUrl || "").trim() || null;
    const pastedText = String(body.pastedText || "").trim();
    const mimeType = String(body.mimeType || "") || null;
    const source = String(body.source || "upload") || "upload";
    const sessionId = body.sessionId ? String(body.sessionId) : undefined;

    if (!name) {
      return NextResponse.json({ error: "A document name is required" }, { status: 400 });
    }
    if (!contentText && !fileUrl && pastedText.length < 3) {
      return NextResponse.json(
        { error: "Provide document text, a file URL, or pasted content" },
        { status: 400 }
      );
    }

    let extracted = contentText;
    let detectedType = mimeType || "";
    if (!extracted && fileUrl) {
      const fetched = await fetchTextFromUrl(fileUrl, mimeType);
      extracted = fetched.text;
      detectedType = fetched.detectedType;
    }
    if (!extracted) extracted = pastedText;

    const category = await classifyDocument(name, mimeType, source);
    const isImage = IMAGE_TYPES.includes((detectedType || "").toLowerCase()) || category === "image";

    const [doc] = await db
      .insert(documents)
      .values({
        workspaceId: workspace.id,
        sessionId,
        name,
        source,
        fileUrl,
        fileType: category,
        mimeType: detectedType || null,
        category,
        contentText: extracted.length ? extracted.slice(0, 50000) : null,
        processingStatus: isImage ? "error" : "processing",
        errorMessage: isImage ? "Image document analysis requires vision support; store the text transcript instead." : null,
      })
      .returning();

    if (!isImage && extracted.length > 0) {
      const analyzed = await analyzeDocument(doc.id, doc.name, extracted);
      if (analyzed) {
        const [updated] = await db
          .update(documents)
          .set({
            summary: analyzed.summary,
            analysis: analyzed.analysis,
            processingStatus: "complete",
          })
          .where(eq(documents.id, doc.id))
          .returning();
        return NextResponse.json(updated, { status: 201 });
      }
    }

    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Failed to create document";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (!auth.user) return auth.response!;

  try {
    const body = await request.json().catch(() => ({}));
    const id = body.id;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const [existing] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    if (!existing || !(await canAccessWorkspace(existing.workspaceId, auth.user.id))) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const [updated] = await db
      .update(documents)
      .set({
        name: body.name ?? undefined,
        sessionId: body.sessionId ?? undefined,
        summary: body.summary ?? undefined,
        analysis: body.analysis ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id))
      .returning();
    return NextResponse.json(updated);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAuth();
  if (!auth.user) return auth.response!;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const [existing] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    if (!existing || !(await canAccessWorkspace(existing.workspaceId, auth.user.id))) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    await db.delete(documents).where(eq(documents.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
