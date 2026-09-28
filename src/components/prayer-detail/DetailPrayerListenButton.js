"use client";

import { usePrayerInteraction } from "@/components/prayer-interaction/usePrayerInteraction";
import { getDictionary, normalizeLocale } from "@/lib/i18n";

export default function DetailPrayerListenButton({
  prayerId,
  locale: localeProp = "zh-TW",
  prayerTitle = "",
  coverImage = "",
}) {
  const locale = normalizeLocale(localeProp);
  const companionText = getDictionary(locale).home.companion;
  const { openCompanion, hasCompanionEntry } = usePrayerInteraction(prayerId);

  if (!hasCompanionEntry) return null;

  return (
    <button
      type="button"
      className="pdv2-listen-btn"
      onClick={() =>
        openCompanion({
          anonymousLabel: companionText.anonymousLabel,
          prayerTitle,
          coverImage,
        })
      }
    >
      <span aria-hidden="true">♫</span>
      {companionText.listenEntry}
    </button>
  );
}
