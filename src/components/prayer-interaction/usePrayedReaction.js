"use client";

import { useEffect, useRef, useState } from "react";

// Shared "我已為你禱告" state, used by PrayedReactionButton on both the
// homepage and /prayfor/[id]. Server is the source of truth for count/reacted
// (see /api/home-cards/[id]/prayed) — this hook never optimistically assumes
// success beyond what the API actually confirms.
export function usePrayedReaction(prayerId) {
  const [count, setCount] = useState(0);
  const [reacted, setReacted] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [justReacted, setJustReacted] = useState(false);
  const generationRef = useRef(0);

  useEffect(() => {
    setJustReacted(false);
    setStatus("idle");
    if (!prayerId) {
      setCount(0);
      setReacted(false);
      return;
    }
    const generation = ++generationRef.current;
    fetch(`/api/home-cards/${prayerId}/prayed`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (generation !== generationRef.current) return; // Prayer switched mid-flight
        setCount(data?.count ?? 0);
        setReacted(Boolean(data?.reacted));
      })
      .catch(() => {
        if (generation !== generationRef.current) return;
        // Fail open: leave reacted/count at their defaults, the button stays
        // clickable so the user can still try to react.
      });
  }, [prayerId]);

  const react = async () => {
    if (!prayerId || reacted || status === "loading") return;
    const generation = generationRef.current;
    setStatus("loading");
    try {
      const res = await fetch(`/api/home-cards/${prayerId}/prayed`, { method: "POST" });
      if (generation !== generationRef.current) return;
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const data = await res.json();
      if (generation !== generationRef.current) return;
      setCount(data.count);
      setReacted(true);
      setJustReacted(true);
      setStatus("idle");
    } catch {
      if (generation !== generationRef.current) return;
      setStatus("error");
    }
  };

  const dismissJustReacted = () => setJustReacted(false);

  return { count, reacted, status, justReacted, react, dismissJustReacted };
}
