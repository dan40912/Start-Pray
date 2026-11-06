import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-route-auth";
import { writeBanner } from "@/lib/banner";

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

// PATCH /api/admin/banners/:id
export async function PATCH(req, { params }) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  try {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id !== 1) {
      return NextResponse.json({ message: "Invalid banner id" }, { status: 400 });
    }

    const body = await req.json();
    const saved = await writeBanner(fromAdminPayload(body));
    return NextResponse.json(toAdminPayload(saved));
  } catch (error) {
    console.error("PATCH /api/admin/banners/:id error:", error);
    return NextResponse.json({ message: "更新失敗" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const id = Number(params?.id);
    if (!Number.isInteger(id) || id !== 1) {
      return NextResponse.json({ message: "Invalid banner id" }, { status: 400 });
    }

    const reset = await writeBanner({});
    return NextResponse.json({ message: "已重置", banner: toAdminPayload(reset) });
  } catch (error) {
    console.error("DELETE /api/admin/banner error:", error);
    return NextResponse.json({ message: "刪除失敗" }, { status: 500 });
  }
}
