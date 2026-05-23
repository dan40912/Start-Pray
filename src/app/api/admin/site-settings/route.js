import { NextResponse } from "next/server";

import { logAdminAction } from "@/lib/logger";
import { readSiteSettings, setMaintenanceMode } from "@/lib/siteSettings";
import { requireAdmin, roleSet } from "@/lib/admin-route-auth";

const SUPER_ONLY = roleSet("SUPER");

export async function GET(request) {
  const { error } = requireAdmin(request);
  if (error) return error;

  try {
    const settings = await readSiteSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("GET /api/admin/site-settings error:", error);
    return NextResponse.json({ message: "Failed to load site settings" }, { status: 500 });
  }
}

export async function PATCH(request) {
  const { error, session } = requireAdmin(request, SUPER_ONLY);
  if (error) return error;

  const role = session.role;

  try {
    const payload = await request.json().catch(() => null);
    const maintenanceMode = payload?.maintenanceMode;

    if (typeof maintenanceMode !== "boolean") {
      return NextResponse.json({ message: "maintenanceMode must be a boolean" }, { status: 400 });
    }

    const updated = await setMaintenanceMode({
      maintenanceMode,
      updatedBy: role || null,
    });

    await logAdminAction({
      action: maintenanceMode ? "maintenance.enable" : "maintenance.disable",
      message: maintenanceMode ? "Enabled maintenance mode" : "Disabled maintenance mode",
      actorId: session.adminId,
      actorEmail: session.username,
      requestPath: request.url,
      metadata: { maintenanceMode, role },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/admin/site-settings error:", error);
    return NextResponse.json({ message: "Failed to update site settings" }, { status: 500 });
  }
}
