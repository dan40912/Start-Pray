import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-route-auth";
import { readBanner, writeBanner } from "@/lib/banner";

function toAdminPayload(banner) {
  return {
    id: 1,
    eyebrow: banner?.eyebrow ?? "",
    headline: banner?.headline ?? "",
    subheadline: banner?.subheadline ?? "",
    description: banner?.description ?? "",
    primaryCtaLabel: banner?.primaryCta?.label ?? "",
    primaryCtaHref: banner?.primaryCta?.href ?? "",
    secondaryCtaLabel: banner?.secondaryCta?.label ?? "",
    secondaryCtaHref: banner?.secondaryCta?.href ?? "",
    heroImage: banner?.heroImage ?? "",
  };
}

function fromAdminPayload(body) {
  return {
    eyebrow: body?.eyebrow ?? "",
    headline: body?.headline ?? "",
    subheadline: body?.subheadline ?? "",
    description: body?.description ?? "",
    primaryCta: {
      label: body?.primaryCtaLabel ?? "",
      href: body?.primaryCtaHref ?? "",
    },
    secondaryCta: body?.secondaryCtaLabel && body?.secondaryCtaHref
      ? {
          label: body.secondaryCtaLabel,
          href: body.secondaryCtaHref,
        }
      : null,
    heroImage: body?.heroImage ?? "",
  };
}

export async function GET(request) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const banner = await readBanner();
    return NextResponse.json([toAdminPayload(banner)]);
  } catch (err) {
    console.error("GET /api/admin/banners error:", err);
    return NextResponse.json({ message: "無法取得 Banner" }, { status: 500 });
  }
}

export async function POST(request) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const data = await request.json();
    const saved = await writeBanner(fromAdminPayload(data));
    return NextResponse.json(toAdminPayload(saved));
  } catch (err) {
    console.error("POST /api/admin/banners error:", err);
    return NextResponse.json({ message: "新增 Banner 失敗" }, { status: 500 });
  }
}

export async function PATCH(request) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const data = await request.json();
    const saved = await writeBanner(fromAdminPayload(data));
    return NextResponse.json(toAdminPayload(saved));
  } catch (err) {
    console.error("PATCH /api/admin/banners error:", err);
    return NextResponse.json({ message: "更新 Banner 失敗" }, { status: 500 });
  }
}

export async function DELETE(request) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const body = await request.json().catch(() => null);
    if (body?.id && Number(body.id) !== 1) {
      return NextResponse.json({ message: "Invalid banner id" }, { status: 400 });
    }

    const reset = await writeBanner({});
    return NextResponse.json({ success: true, banner: toAdminPayload(reset) });
  } catch (err) {
    console.error("DELETE /api/admin/banners error:", err);
    return NextResponse.json({ message: "刪除 Banner 失敗" }, { status: 500 });
  }
}
