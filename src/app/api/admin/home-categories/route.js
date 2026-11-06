import { NextResponse } from "next/server";
import { createCategory, readAllCategories } from "@/lib/homeCategories";
import { requireAdmin } from "@/lib/admin-route-auth";

function sanitizePayload(body) {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid payload");
  }

  if (!body.name || typeof body.name !== "string") {
    throw new Error("Name is required");
  }

  return {
    name: body.name.trim(),
    slug: body.slug?.trim(),
    description: body.description?.trim(),
    sortOrder: Number.isFinite(body.sortOrder) ? body.sortOrder : 0,
    isActive: body.isActive !== false,
  };
}

export async function GET(request) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  const categories = await readAllCategories();
  return NextResponse.json(categories, { status: 200 });
}

export async function POST(request) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const body = await request.json();
    const payload = sanitizePayload(body);
    const created = await createCategory(payload);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error.message || "Failed to create category" },
      { status: 400 }
    );
  }
}
