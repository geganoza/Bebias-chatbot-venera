import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET() {
  try {
    const results: Record<string, any> = {};

    // Test if data files are accessible
    const filesToTest = [
      "data/products.json",
      "data/content/bot-instructions.md",
      "data/content/services.md",
      "data/content/faqs.md",
      "data/content/delivery-info.md",
      "data/content/payment-info.md"
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
