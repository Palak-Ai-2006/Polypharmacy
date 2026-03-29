// ============================================================
// POST /api/parse-report — PGx Report PDF Parsing
// Accepts a PDF or text report and extracts phenotypes.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { parsePGxReport } from "@/lib/pgx-report-parser";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      // Handle PDF upload
      const formData = await request.formData();
      const file = formData.get("report") as File | null;

      if (!file) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
      }

      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");

      const result = await parsePGxReport({
        pdfBase64: base64,
        mimeType: file.type || "application/pdf",
      });

      return NextResponse.json(result);
    } else {
      // Handle JSON text input
      const body = await request.json();
      const text = body.text;

      if (!text || typeof text !== "string") {
        return NextResponse.json({ error: "Missing 'text' field" }, { status: 400 });
      }

      const result = await parsePGxReport({ text });
      return NextResponse.json(result);
    }
  } catch (error) {
    console.error("Report parsing error:", error);
    return NextResponse.json(
      { error: "Failed to parse report" },
      { status: 500 }
    );
  }
}
