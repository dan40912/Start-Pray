"use client";

import { forwardRef, useCallback, useEffect, useRef } from "react";

import { attachPlaybackGain } from "@/lib/audio-gain";

// A drop-in replacement for <audio> that plays prayer recordings at an audible
// level. The uploaded files measure around -30 dBFS RMS against roughly -20 for
// comfortable speech, and an <audio> element cannot be pushed past volume 1, so
// the only fix is to route it through Web Audio — see src/lib/audio-gain.js for
// the measured gain, limiter and trim.
//
// It exists as a component because most of these players are rendered inside
// .map() calls with no ref of their own; swapping the tag is a one-word change
// at each call site, whereas threading a ref through each is not.
//
// The recorders' preview buttons do pass a ref and call play() on it. On React
// 18 a plain function component never receives `ref`, so those buttons always
// found null and reported "nothing to play" — hence forwardRef, with the one
// element shared between the caller and the gain hookup below.
const GainAudio = forwardRef(function GainAudio(props, forwardedRef) {
  const ref = useRef(null);

  const setRef = useCallback(
    (node) => {
      ref.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef]
  );

  useEffect(() => {
    const detach = attachPlaybackGain(ref.current);
    return () => detach?.();
  }, []);

  // eslint-disable-next-line jsx-a11y/media-has-caption
  return <audio ref={setRef} {...props} />;
});

export default GainAudio;
