import { redirect } from "next/navigation";

import { readHomeCards } from "@/lib/homeCards";

export const dynamic = "force-dynamic";

export default async function PrayForOnePage() {
  const [card] = await readHomeCards({ sort: "needsPrayer", limit: 1 });
  if (!card) redirect("/prayfor?match=empty");
  redirect(`/prayfor/${card.id}#response-composer`);
}
