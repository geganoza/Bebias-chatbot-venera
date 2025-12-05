import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET() {
  try {
    const results: Record<string, any> = {};

    // Test if data files are accessible
    const filesToTest = [
      "main/data/content/bot-instructions-modular.md",
      "main/data/content/services.md",
      "main/data/content/faqs.md",
      "main/data/content/delivery-info.md",
      "main/data/content/payment-info.md",
      "main/data/content/tone-style.md"
    ];

    for (const file of filesToTest) {
      try {
        const fullPath = path.join(process.cwd(), file);
        const content = await fs.readFile(fullPath, "utf-8");
        results[file] = {
          exists: true,
          size: content.length,
          preview: content.substring(0, 200)
        };
      } catch (err: any) {
        results[file] = {
          exists: false,
          error: err.message
        };
      }
    }

    return NextResponse.json({
      success: true,
      cwd: process.cwd(),
      results
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message
    }, { status: 500 });
  }
}
