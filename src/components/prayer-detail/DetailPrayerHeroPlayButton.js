"use client";

import { useAudio } from "@/context/AudioContext";
import { getDictionary, normalizeLocale } from "@/lib/i18n";

export default function DetailPrayerHeroPlayButton({
  prayerId,
  locale: localeProp = "zh-TW",
}) {
  const locale = normalizeLocale(localeProp);
  const text = getDictionary(locale);
  const { playlist, currentTrack, isPlaying, isQueueEnded, restartQueue, togglePlay, setIsCompanion } = useAudio();

  const hasPrayerAudio = playlist.some(
    (track) => String(track.homeCardId) === String(prayerId)
  );
  if (!hasPrayerAudio) return null;

  const label = isPlaying
    ? text.home.companion.pause
    : text.home.companion.listenEntry;

  const handleClick = () => {
    setIsCompanion(false);
    if (!currentTrack || isQueueEnded) {
      restartQueue();
      return;
    }
    togglePlay();
  };

  return (
    <button
      type="button"
      className="pdv2-hero-play-btn"
      onClick={handleClick}
      aria-label={label}
      aria-pressed={isPlaying}
    >
      <span className="pdv2-hero-play-btn__icon" aria-hidden="true">
        <i className={`fa-solid ${isPlaying ? "fa-pause" : "fa-play"}`} />
      </span>
      <span>{label}</span>
    </button>
  );
}
