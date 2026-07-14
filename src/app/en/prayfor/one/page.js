import { redirect } from "next/navigation";

import { readHomeCards } from "@/lib/homeCards";

export const dynamic = "force-dynamic";

export default async function EnglishPrayForOnePage() {
  const [card] = await readHomeCards({ sort: "needsPrayer", limit: 1 });
  if (!card) redirect("/en/prayfor?match=empty");
  redirect(`/en/prayfor/${card.id}#response-composer`);
}
