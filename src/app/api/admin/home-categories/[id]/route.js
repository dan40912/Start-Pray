import { NextResponse } from "next/server";
import { updateCategory } from "@/lib/homeCategories";
import { requireAdmin } from "@/lib/admin-route-auth";

function sanitizePayload(body) {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid payload");
  }

  return {
    name: body.name,
    slug: body.slug,
    description: body.description,
    sortOrder: body.sortOrder,
    isActive: body.isActive,
  };
}

export async function PUT(request, { params }) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const id = Number.parseInt(params.id, 10);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ message: "Invalid category id" }, { status: 400 });
    }

    const body = await request.json();
    const payload = sanitizePayload(body);
    const updated = await updateCategory(id, payload);
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { message: error.message || "Failed to update category" },
      { status: 400 }
    );
  }
}
