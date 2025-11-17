import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";
type Product = {
  id: string;
  name: string;
  price: number;
  currency?: string;
  stock: number;
  availability?: string;
  category?: string;
  attributes?: Record<string, any>;
};

async function loadProducts(): Promise<Product[]> {
  const file = path.join(process.cwd(), "data", "products.json");
  const txt = await fs.readFile(file, "utf8");
  return JSON.parse(txt) as Product[];
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.toLowerCase() ?? "";
    const id = url.searchParams.get("id");
    const minPrice = Number(url.searchParams.get("minPrice") ?? NaN);
    const maxPrice = Number(url.searchParams.get("maxPrice") ?? NaN);
    const inStockParam = url.searchParams.get("inStock");

    const products = await loadProducts();

    let results = products;

    if (id) {
      results = results.filter((p) => p.id.toLowerCase() === id.toLowerCase());
    }

    if (q) {
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.category || "").toLowerCase().includes(q) ||
          (p.id || "").toLowerCase().includes(q) ||
          JSON.stringify(p.attributes || {}).toLowerCase().includes(q)
      );
    }

    if (!Number.isNaN(minPrice)) {
      results = results.filter((p) => typeof p.price === "number" && p.price >= minPrice);
    }

    if (!Number.isNaN(maxPrice)) {
      results = results.filter((p) => typeof p.price === "number" && p.price <= maxPrice);
    }

    if (inStockParam) {
      const wantInStock = inStockParam === "true" || inStockParam === "1";
      if (wantInStock) {
        results = results.filter((p) => p.stock > 0 && p.availability !== "out_of_stock");
      } else {
        results = results.filter((p) => p.stock === 0 || p.availability === "out_of_stock");
      }
    }

    return NextResponse.json({ results });
  } catch (err: any) {
    console.error("GET /api/products error:", err);
    return NextResponse.json({ error: err?.message ?? "unknown" }, { status: 500 });
  }
}
