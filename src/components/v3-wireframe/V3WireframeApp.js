"use client";

/**
 * V3 Wireframe preview app (PRD-010 Track A / Phase 4).
 *
 * - Preview-only. Mock data. Does NOT call any production API.
 * - Voice flow is real and zero-cost:
 *     MediaRecorder        -> recording (browser built-in)
 *     Web Speech API       -> free speech-to-text with per-line timestamps
 *     Web Audio Analyser   -> real audio-reactive waveform
 *   Fallback chain: no recognition -> record + manual transcript;
 *   no timestamps -> evenly distributed subtitle sync; nothing -> audio only.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const CARDS = [
  {
    cat: "健康",
    title: "為張弟兄的治療過程禱告",
    body: "他正在面對一段辛苦的療程，家人也需要力量。一句短短的祝福，就能讓他知道自己沒有被忘記。",
    forWho: "為張弟兄",
    n: "0 則祝福",
  },
  {
    cat: "家庭",
    title: "為家人的關係恢復禱告",
    body: "一段長久的誤會讓家裡變得安靜。願這個家重新有溫度。",
    forWho: "為這個家庭",
    n: "3 則祝福",
  },
  {
    cat: "工作",
    title: "為工作焦慮禱告",
    body: "最近的變動讓人喘不過氣，希望能有平靜和清晰的方向。",
    forWho: "為這位朋友",
    n: "12 則祝福",
  },
  {
    cat: "健康",
    title: "為母親的手術禱告",
    body: "下週要進行手術，全家都很緊張。求平安順利。",
    forWho: "為這位母親",
    n: "1 則祝福",
  },
  { isPrivate: true, cat: "私密" },
];
const PUB_CARDS = CARDS.filter((c) => !c.isPrivate);

const MOCK_LYRICS = [
  { s: 0, e: 3, t: "願主賜你力量" },
  { s: 3, e: 6.2, t: "陪你走過這段治療" },
  { s: 6.2, e: 9, t: "你不是一個人" },
  { s: 9, e: 12, t: "今天也被記念" },
];
const MOCK_DUR = 12;
const REC_MAX = 60;
const REC_MIN = 3;

const NAV = [
  ["home", "⌂", "今天"],
  ["wall", "🙏", "禱告"],
  ["share", "＋", "分享"],
  ["world", "◍", "世界"],
  ["me", "●", "我"],
];

function fmt(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function V3WireframeApp({ initialScreen = "home" }) {
  /* ---------- navigation ---------- */
  const [screen, setScreen] = useState("home");
  const [mapOpen, setMapOpen] = useState(false);
  const timersRef = useRef([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearInterval(t));
    timersRef.current = [];
  }, []);

  const T = useCallback((fn, ms, once) => {
    const t = once ? setTimeout(fn, ms) : setInterval(fn, ms);
    timersRef.current.push(t);
    return t;
  }, []);

  const go = useCallback(
    (next) => {
      clearTimers();
      setScreen(next);
    },
    [clearTimers]
  );

  /* ---------- toast ---------- */
  const [toastMsg, setToastMsg] = useState("");
  const toastT = useRef(null);
  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToastMsg(""), 2400);
  }, []);

  /* ---------- one prayer ---------- */
  const [cardIdx, setCardIdx] = useState(0);
  const cardIdxRef = useRef(0);
  const [oneLoading, setOneLoading] = useState(true);
  const card = PUB_CARDS[cardIdx % PUB_CARDS.length];

  const startOnePrayer = useCallback(() => {
    go("one");
    setOneLoading(true);
    T(() => setOneLoading(false), 600, true);
  }, [go, T]);

  const bumpCard = useCallback(() => {
    cardIdxRef.current += 1;
    setCardIdx(cardIdxRef.current);
  }, []);

  const nextCard = useCallback(() => {
    bumpCard();
    startOnePrayer();
  }, [bumpCard, startOnePrayer]);

  const openCard = useCallback(
    (pubIdx) => {
      cardIdxRef.current = pubIdx;
      setCardIdx(pubIdx);
      go("detail");
    },
    [go]
  );

  /* ---------- text prayer ---------- */
  const [textVal, setTextVal] = useState("");
  const [textBusy, setTextBusy] = useState(false);
  const [hasOwnAudio, setHasOwnAudio] = useState(false);

  const submitText = useCallback(() => {
    setTextBusy(true);
    T(
      () => {
        setTextBusy(false);
        setTextVal("");
        bumpCard();
        setHasOwnAudio(false);
        go("success");
      },
      900,
      true
    );
  }, [T, bumpCard, go]);

  /* ---------- voice flow (real, zero-cost) ---------- */
  const SRRef = useRef(null);
  useEffect(() => {
    SRRef.current =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition || null
        : null;
  }, []);

  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const recogRef = useRef(null);
  const recStartMsRef = useRef(0);
  const segStartRef = useRef(0);
  const recRef = useRef({ url: null, duration: 0, transcript: "", segments: [] });
  const recSecRef = useRef(0);
  const pvAudioRef = useRef(null);
  const waveRef = useRef(null);

  const [recSec, setRecSec] = useState(0);
  const [countN, setCountN] = useState(3);
  const [liveText, setLiveText] = useState("");
  const [waveLive, setWaveLive] = useState(false);
  const [vcTx, setVcTx] = useState("");
  const [vcDur, setVcDur] = useState(0);
  const [vcHint, setVcHint] = useState("字幕可以修改，不會改變原語音。");
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [pvPlaying, setPvPlaying] = useState(false);

  const stopWaveAndRecog = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setWaveLive(false);
    if (recogRef.current) {
      try {
        recogRef.current.stop();
      } catch {}
      recogRef.current = null;
    }
  }, []);

  const stopRecorder = useCallback(() => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    } catch {}
  }, []);

  const releaseMic = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const startWave = useCallback(() => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = audioCtxRef.current || new AC();
      const src = audioCtxRef.current.createMediaStreamSource(mediaStreamRef.current);
      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      setWaveLive(true);
      const loop = () => {
        analyser.getByteFrequencyData(data);
        const bars = waveRef.current ? waveRef.current.querySelectorAll("i") : [];
        bars.forEach((b, i) => {
          b.style.height = `${Math.max(10, ((data[i + 2] || 0) / 255) * 56)}px`;
        });
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      setWaveLive(false); // fallback: CSS ambient wave
    }
  }, []);

  const startRecog = useCallback(() => {
    const SR = SRRef.current;
    if (!SR) return;
    const recog = new SR();
    recogRef.current = recog;
    recog.lang = "zh-TW";
    recog.continuous = true;
    recog.interimResults = true;
    recog.onresult = (ev) => {
      let interim = "";
      const now = (performance.now() - recStartMsRef.current) / 1000;
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) {
          const t = r[0].transcript.trim();
          if (t) {
            recRef.current.segments.push({
              s: +segStartRef.current.toFixed(1),
              e: +now.toFixed(1),
              t,
            });
            segStartRef.current = now;
          }
        } else {
          interim += r[0].transcript;
        }
      }
      const shown =
        recRef.current.segments.map((s) => s.t).join("，") + (interim ? `，${interim}` : "");
      if (shown) setLiveText(shown.replace(/^，/, ""));
    };
    recog.onerror = () => {}; // recognition failure must never break recording
    try {
      recog.start();
    } catch {}
  }, []);

  const finishRec = useCallback(
    (force) => {
      if (!force && recSecRef.current < REC_MIN) {
        toast("再多說一句祝福就可以送出");
        return;
      }
      recRef.current.duration = recSecRef.current;
      stopWaveAndRecog();
      stopRecorder();
      go("vproc");
      T(
        () => {
          const r = recRef.current;
          r.transcript = r.segments.map((s) => s.t).join("，");
          setVcDur(r.duration);
          setVcTx(r.transcript);
          setVcHint(
            r.transcript
              ? "字幕可以修改，不會改變原語音。"
              : "沒有取得即時字幕；可以自己補一句，或直接送出純語音。"
          );
          go("vconfirm");
        },
        1200,
        true
      );
    },
    [T, go, stopRecorder, stopWaveAndRecog, toast]
  );

  const startRec = useCallback(() => {
    recSecRef.current = 0;
    setRecSec(0);
    chunksRef.current = [];
    recRef.current = { url: null, duration: 0, transcript: "", segments: [] };
    recStartMsRef.current = performance.now();
    segStartRef.current = 0;
    setLiveText("");
    let recorder;
    try {
      recorder = new MediaRecorder(mediaStreamRef.current);
    } catch {
      toast("這個瀏覽器無法錄音，改用文字禱告");
      go("text");
      return;
    }
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      if (recRef.current.url) URL.revokeObjectURL(recRef.current.url);
      recRef.current.url = URL.createObjectURL(blob);
    };
    recorder.start();
    startWave();
    startRecog();
    T(() => {
      recSecRef.current += 1;
      setRecSec(recSecRef.current);
      if (recSecRef.current >= REC_MAX) {
        toast("已達 60 秒上限，已自動保存錄音");
        finishRec(true);
      }
    }, 1000);
  }, [T, finishRec, go, startRecog, startWave, toast]);

  const runCountdown = useCallback(() => {
    let n = 3;
    setCountN(3);
    T(() => {
      n -= 1;
      if (n > 0) {
        setCountN(n);
      } else {
        go("vrec");
        startRec();
      }
    }, 1000);
  }, [T, go, startRec]);

  const askMic = useCallback(async () => {
    setMapOpen(false);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      go("vdenied");
      return;
    }
    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      go("vcount");
      runCountdown();
    } catch {
      go("vdenied");
    }
  }, [go, runCountdown]);

  const restartRec = useCallback(() => {
    stopWaveAndRecog();
    stopRecorder();
    go("vcount");
    runCountdown();
  }, [go, runCountdown, stopRecorder, stopWaveAndRecog]);

  const cancelRec = useCallback(
    (to) => {
      stopWaveAndRecog();
      stopRecorder();
      releaseMic();
      go(to);
    },
    [go, releaseMic, stopRecorder, stopWaveAndRecog]
  );

  const playPreview = useCallback(() => {
    if (!recRef.current.url) {
      toast("沒有可播放的錄音");
      return;
    }
    if (pvAudioRef.current && !pvAudioRef.current.paused) {
      pvAudioRef.current.pause();
      setPvPlaying(false);
      return;
    }
    const a = new Audio(recRef.current.url);
    pvAudioRef.current = a;
    a.onended = () => setPvPlaying(false);
    a.play();
    setPvPlaying(true);
  }, [toast]);

  const submitVoice = useCallback(() => {
    const r = recRef.current;
    const edited = vcTx.trim();
    if (edited !== r.transcript) {
      // user edited transcript -> evenly distributed timestamps (free fallback sync)
      const lines = edited ? edited.split(/[，。,.!?！？\n]+/).filter(Boolean) : [];
      r.segments = lines.map((t, i) => ({
        s: +((i * r.duration) / lines.length).toFixed(1),
        e: +(((i + 1) * r.duration) / lines.length).toFixed(1),
        t,
      }));
      r.transcript = edited;
    }
    if (pvAudioRef.current) pvAudioRef.current.pause();
    setPvPlaying(false);
    setVoiceBusy(true);
    T(
      () => {
        setVoiceBusy(false);
        bumpCard();
        releaseMic();
        setHasOwnAudio(!!r.url);
        go("success");
      },
      900,
      true
    );
  }, [T, bumpCard, go, releaseMic, vcTx]);

  /* ---------- share flow ---------- */
  const [shTitle, setShTitle] = useState("");
  const [shBody, setShBody] = useState("");
  const [shAnon, setShAnon] = useState(true);
  const [shPrivate, setShPrivate] = useState(false);
  const [shCat, setShCat] = useState("健康");
  const [shBusy, setShBusy] = useState(false);

  const submitShare = useCallback(() => {
    setShBusy(true);
    T(
      () => {
        setShBusy(false);
        go("share-done");
      },
      900,
      true
    );
  }, [T, go]);

  /* ---------- wall ---------- */
  const [wallQ, setWallQ] = useState("");
  const [wallCat, setWallCat] = useState("");
  const wallRows = CARDS.map((c, i) => ({ c, i })).filter(({ c }) => {
    if (c.isPrivate) return !wallCat && !wallQ; // placeholder only, never searchable
    if (wallCat && c.cat !== wallCat) return false;
    if (wallQ && !(c.title + c.body).includes(wallQ)) return false;
    return true;
  });

  /* ---------- playback (mock data + real own recording) ---------- */
  const pbRef = useRef({
    cur: 0,
    playing: false,
    speed: 1,
    own: false,
    dur: MOCK_DUR,
    segs: MOCK_LYRICS,
    from: "detail",
  });
  const [pb, setPbState] = useState(pbRef.current);
  const pbAudioRef = useRef(null);
  const setPB = useCallback((patch) => {
    pbRef.current = { ...pbRef.current, ...patch };
    setPbState(pbRef.current);
  }, []);

  const endPB = useCallback(() => {
    setPB({ playing: false, cur: pbRef.current.dur });
  }, [setPB]);

  const openPlayback = useCallback(
    (mode) => {
      const r = recRef.current;
      const own = mode === "own" && !!r.url;
      const segs = own
        ? r.segments.length
          ? r.segments
          : [{ s: 0, e: r.duration || 1, t: r.transcript || "（純語音，沒有字幕）" }]
        : MOCK_LYRICS;
      const from = screen;
      setMapOpen(false);
      go("playback");
      setPB({
        own,
        segs,
        dur: own ? r.duration || 1 : MOCK_DUR,
        cur: 0,
        playing: true,
        from,
      });
      if (own) {
        const a = new Audio(r.url);
        pbAudioRef.current = a;
        a.playbackRate = pbRef.current.speed;
        a.onended = () => endPB();
        a.play();
      }
      T(() => {
        const s = pbRef.current;
        if (!s.playing) return;
        if (s.own && pbAudioRef.current) {
          setPB({ cur: Math.min(pbAudioRef.current.currentTime, s.dur) });
        } else {
          const c = Math.min(s.cur + 0.25 * s.speed, s.dur);
          setPB({ cur: c });
          if (c >= s.dur) endPB();
        }
      }, 250);
    },
    [T, endPB, go, screen, setPB]
  );

  const togglePlay = useCallback(() => {
    const s = pbRef.current;
    if (s.cur >= s.dur) {
      setPB({ cur: 0, playing: true });
      if (s.own && pbAudioRef.current) {
        pbAudioRef.current.currentTime = 0;
        pbAudioRef.current.play();
      }
    } else {
      const playing = !s.playing;
      setPB({ playing });
      if (s.own && pbAudioRef.current) {
        playing ? pbAudioRef.current.play() : pbAudioRef.current.pause();
      }
    }
  }, [setPB]);

  const seek = useCallback(
    (ev) => {
      const r = ev.currentTarget.getBoundingClientRect();
      const s = pbRef.current;
      const cur = Math.max(0, Math.min(s.dur, ((ev.clientX - r.left) / r.width) * s.dur));
      if (s.own && pbAudioRef.current) pbAudioRef.current.currentTime = cur;
      setPB({ cur });
    },
    [setPB]
  );

  const cycleSpeed = useCallback(() => {
    const sp = [0.75, 1, 1.25, 1.5];
    const speed = sp[(sp.indexOf(pbRef.current.speed) + 1) % sp.length];
    if (pbRef.current.own && pbAudioRef.current) pbAudioRef.current.playbackRate = speed;
    setPB({ speed });
  }, [setPB]);

  const closePB = useCallback(() => {
    if (pbAudioRef.current) pbAudioRef.current.pause();
    setPB({ playing: false });
    go(pbRef.current.from || "detail");
  }, [go, setPB]);

  /* ---------- entry route + unmount cleanup ---------- */
  useEffect(() => {
    if (initialScreen === "pray") startOnePrayer();
    else if (initialScreen === "playback") openPlayback();
    else setScreen(initialScreen);
    return () => {
      clearTimers();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (pbAudioRef.current) pbAudioRef.current.pause();
      if (pvAudioRef.current) pvAudioRef.current.pause();
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      if (recRef.current.url) URL.revokeObjectURL(recRef.current.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ================= render helpers ================= */
  const Switch = ({ on, onFlip, label }) => (
    <button
      type="button"
      className="switch"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onFlip}
    />
  );

  const BottomNav = () => (
    <nav className="bottomnav">
      {NAV.map(([id, ico, lbl]) => (
        <button
          key={id}
          type="button"
          className={id === screen ? "on" : ""}
          onClick={() => go(id)}
        >
          <span className="ico">{ico}</span>
          {lbl}
        </button>
      ))}
    </nav>
  );

  const WaveBars = ({ dark, live, paused, refEl }) => (
    <div
      ref={refEl}
      className={`wave${dark ? " dark" : ""}${live ? " live" : ""}${paused ? " paused" : ""}`}
      aria-hidden="true"
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <i key={i} style={{ animationDelay: `${(i * 0.11) % 0.36}s` }} />
      ))}
    </div>
  );

  /* ================= screens ================= */
  const S = {};

  S.home = (
    <>
      <div className="appbar">
        <span className="brand">Start Pray</span>
        <span className="meta">EN</span>
      </div>
      <div className="scroll">
        <div className="hero">
          <h1>
            30 秒，為一個人
            <br />
            留下祝福。
          </h1>
          <p className="sub">匿名、安靜、不需要先登入。</p>
          <button type="button" className="btn btn-primary" onClick={startOnePrayer}>
            <span className="label">我願意禱告</span>
          </button>
          <button type="button" className="btn-ghost" onClick={() => go("share")}>
            我需要代禱
          </button>
        </div>
        <div className="section">
          <h2>今天正在被守望</h2>
          <div className="card">
            <div className="tagline">
              <span className="tag">健康</span>
              <span className="tag">匿名</span>
              <span>需要一句祝福</span>
            </div>
            <h3>為張弟兄的治療過程禱告</h3>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginTop: 12 }}
              onClick={() => openCard(0)}
            >
              為他禱告
            </button>
          </div>
        </div>
        <div className="section">
          <h2>世界正在一起禱告</h2>
          <div
            className="worldproof"
            style={{ cursor: "pointer" }}
            onClick={() => go("world")}
          >
            <div className="mini-globe">
              <span className="dot" style={{ top: "22%", left: "64%" }} />
              <span className="dot" style={{ top: "48%", left: "30%", animationDelay: ".8s" }} />
              <span className="dot" style={{ top: "66%", left: "55%", animationDelay: "1.6s" }} />
              <span className="dot" style={{ top: "35%", left: "44%", animationDelay: "2.2s" }} />
            </div>
            <div className="stats">33 代禱 · 11 光點 · 49 語音</div>
          </div>
        </div>
        <div className="section">
          <h2>三步開始</h2>
          <div className="steps">
            <div className="step">
              <span className="n">1</span>看見一份需要
            </div>
            <div className="step">
              <span className="n">2</span>留下文字或語音
            </div>
            <div className="step">
              <span className="n">3</span>祝福加入世界光點
            </div>
          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );

  S.one = (
    <>
      <div className="appbar">
        <button type="button" className="back" onClick={() => go("home")} aria-label="返回">
          ←
        </button>
        <span className="title">Start Pray</span>
      </div>
      <div className="scroll" style={{ padding: "24px 16px" }}>
        <p style={{ fontSize: 18, fontWeight: 700, textAlign: "center", marginBottom: 16 }}>
          今天，先為這一個人禱告。
        </p>
        <div className="card">
          <div className="tagline">
            <span className={`tag${oneLoading ? " skeleton" : ""}`}>{card.cat}</span>
            <span className="tag">匿名</span>
          </div>
          <h3 className={oneLoading ? "skeleton" : ""}>{card.title}</h3>
          <p className={oneLoading ? "skeleton" : ""}>{card.body}</p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 16 }}
            disabled={oneLoading}
            onClick={() => go("choice")}
          >
            <span className="label">開始禱告</span>
          </button>
        </div>
        <button type="button" className="btn-ghost" onClick={nextCard}>
          換一份需要
        </button>
      </div>
    </>
  );

  const [anonResp, setAnonResp] = useState(true);
  S.choice = (
    <>
      <div className="appbar">
        <button type="button" className="back" onClick={() => go("one")} aria-label="返回">
          ←
        </button>
        <span className="title">為這份需要禱告</span>
      </div>
      <div className="scroll" style={{ padding: "24px 16px" }}>
        <h3 style={{ fontSize: 18, marginBottom: 8 }}>{card.title}</h3>
        <p style={{ color: "var(--text-muted)", fontSize: 15, marginBottom: 24 }}>
          你可以留下一句很短的祝福。
        </p>
        <button type="button" className="btn btn-primary" onClick={askMic}>
          <span className="label">🎙 語音禱告</span>
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ marginTop: 12 }}
          onClick={() => go("text")}
        >
          文字禱告
        </button>
        <div className="toggle-row" style={{ marginTop: 24 }}>
          <div>
            <div className="lbl">匿名顯示</div>
            <div className="desc">顯示名稱：匿名</div>
          </div>
          <Switch on={anonResp} onFlip={() => setAnonResp(!anonResp)} label="匿名顯示" />
        </div>
      </div>
    </>
  );

  S.text = (
    <>
      <div className="appbar">
        <button type="button" className="back" onClick={() => go("choice")} aria-label="返回">
          ←
        </button>
        <span className="title">文字禱告</span>
      </div>
      <div className="scroll" style={{ padding: 16 }}>
        <p style={{ fontSize: 15, color: "var(--text-muted)", marginBottom: 12 }}>{card.forWho}</p>
        <div className="field">
          <textarea
            rows={5}
            maxLength={1000}
            placeholder="願主賜你平安，也加添力量…"
            aria-label="祝福內容"
            value={textVal}
            onChange={(e) => setTextVal(e.target.value)}
          />
          <div className="charcount">{textVal.length} / 1000</div>
        </div>
        <div className="toggle-row" style={{ border: "none" }}>
          <div className="lbl">匿名顯示</div>
          <Switch on={anonResp} onFlip={() => setAnonResp(!anonResp)} label="匿名顯示" />
        </div>
        <button
          type="button"
          className={`btn btn-primary${textBusy ? " loading" : ""}`}
          disabled={textVal.trim().length < 2 || textBusy}
          onClick={submitText}
        >
          <span className="label">送出祝福</span>
          <span className="spinner" />
        </button>
        {textVal.trim().length < 2 && (
          <p className="hint" style={{ textAlign: "center", marginTop: 8 }}>
            寫下至少 2 個字就可以送出
          </p>
        )}
      </div>
    </>
  );

  S.vperm = (
    <>
      <div className="appbar">
        <button type="button" className="back" onClick={() => go("choice")} aria-label="返回">
          ←
        </button>
        <span className="title">語音禱告</span>
      </div>
      <div className="center-stage">
        <div style={{ fontSize: 44 }}>🎙</div>
        <h3 style={{ fontSize: 20 }}>用你的聲音，留下 30 秒祝福。</h3>
        <p style={{ color: "var(--text-muted)", fontSize: 15, lineHeight: "24px" }}>
          我們只會儲存這次禱告，
          <br />
          不會公開你的身份。
        </p>
        <button type="button" className="btn btn-primary" onClick={askMic}>
          <span className="label">開啟麥克風</span>
        </button>
        <button type="button" className="btn-ghost" onClick={() => go("text")}>
          改用文字禱告
        </button>
        <p className="hint">
          字幕使用瀏覽器內建語音辨識（免費）。不支援的瀏覽器仍可錄音，錄完可自行補上文字。
        </p>
      </div>
    </>
  );

  S.vdenied = (
    <>
      <div className="appbar">
        <button type="button" className="back" onClick={() => go("choice")} aria-label="返回">
          ←
        </button>
        <span className="title">無法使用麥克風</span>
      </div>
      <div className="center-stage">
        <div style={{ fontSize: 44 }}>🔇</div>
        <p style={{ fontSize: 16, lineHeight: "26px" }}>
          你可以改用文字禱告，
          <br />
          或到瀏覽器設定開啟麥克風。
        </p>
        <button type="button" className="btn btn-primary" onClick={() => go("text")}>
          <span className="label">改用文字禱告</span>
        </button>
        <button type="button" className="btn-ghost" onClick={askMic}>
          再試一次
        </button>
      </div>
    </>
  );

  S.vcount = (
    <>
      <div className="appbar">
        <button
          type="button"
          className="back"
          onClick={() => cancelRec("vperm")}
          aria-label="返回"
        >
          ←
        </button>
        <span className="title">準備錄音</span>
      </div>
      <div className="center-stage">
        <div className="breath-ring">
          <span className="countnum">{countN}</span>
        </div>
        <p style={{ fontSize: 17, fontWeight: 600 }}>深呼吸，慢慢說。</p>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          你可以說：「願你今天有平安。」
        </p>
      </div>
    </>
  );

  S.vrec = (
    <>
      <div className="appbar">
        <button
          type="button"
          className="back"
          onClick={() => cancelRec("choice")}
          aria-label="取消錄音"
        >
          ←
        </button>
        <span className="title">正在錄音</span>
        <span className="meta rec-timer">{fmt(recSec)}</span>
      </div>
      <div className="center-stage">
        <WaveBars live={waveLive} refEl={waveRef} />
        <div className="live-transcript" aria-live="polite">
          {liveText || (
            <span className="pending">
              {SRRef.current
                ? "開始說話，字幕會出現在這裡…"
                : "此瀏覽器不支援即時字幕，錄完可以自己補上"}
            </span>
          )}
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>剩餘 {REC_MAX - recSec} 秒</p>
        <button type="button" className="btn btn-primary" onClick={() => finishRec(false)}>
          <span className="label">完成</span>
        </button>
        <button type="button" className="btn-ghost" onClick={restartRec}>
          重新錄
        </button>
      </div>
    </>
  );

  S.vproc = (
    <>
      <div className="appbar">
        <span className="title" style={{ textAlign: "center", width: "100%" }}>
          語音禱告
        </span>
      </div>
      <div className="center-stage">
        <p style={{ fontSize: 18, fontWeight: 700 }}>正在整理成字幕</p>
        <div className="dots">
          <i />
          <i />
          <i />
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>你的錄音已保留，請不要關閉。</p>
      </div>
    </>
  );

  S.vconfirm = (
    <>
      <div className="appbar">
        <button type="button" className="back" onClick={restartRec} aria-label="返回">
          ←
        </button>
        <span className="title">確認字幕</span>
      </div>
      <div className="scroll" style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 14, color: "var(--text-muted)" }}>語音 {fmt(vcDur)}</span>
          <button type="button" className="chip" onClick={playPreview}>
            {pvPlaying ? "⏸ 暫停" : "▶ 播放"}
          </button>
        </div>
        <div className="field">
          <textarea
            rows={5}
            aria-label="逐字稿"
            placeholder="想的話，可以在這裡補上一句文字"
            value={vcTx}
            onChange={(e) => setVcTx(e.target.value)}
          />
          <p className="hint">{vcHint}</p>
        </div>
        <button
          type="button"
          className={`btn btn-primary${voiceBusy ? " loading" : ""}`}
          disabled={voiceBusy}
          onClick={submitVoice}
        >
          <span className="label">送出語音祝福</span>
          <span className="spinner" />
        </button>
        <button type="button" className="btn-ghost" onClick={restartRec}>
          重新錄
        </button>
      </div>
    </>
  );

  S.success = (
    <div className="center-stage">
      <div className="success-star">✦</div>
      <h3 style={{ fontSize: 22 }}>你的祝福已經留下。</h3>
      <p style={{ fontSize: 16, color: "var(--text-muted)" }}>今天，有一個人被記念。</p>
      <div className="worldproof" style={{ width: 200, marginTop: 12 }}>
        <div className="mini-globe" style={{ width: 100, height: 100 }}>
          <span className="dot" style={{ top: "30%", left: "60%" }} />
          <span className="dot" style={{ top: "55%", left: "35%", animationDelay: "1s" }} />
          <span className="dot newlight" style={{ top: "42%", left: "48%", width: 9, height: 9 }} />
        </div>
        <div className="stats" style={{ fontSize: 12 }}>
          你的光點已加入世界
        </div>
      </div>
      <button type="button" className="btn btn-primary" onClick={startOnePrayer}>
        <span className="label">再為一人禱告</span>
      </button>
      {hasOwnAudio && (
        <button type="button" className="btn-ghost" onClick={() => openPlayback("own")}>
          🎧 重聽你剛剛的祝福
        </button>
      )}
      <button type="button" className="btn-ghost" onClick={() => toast("POC：開啟系統分享")}>
        分享 Start Pray
      </button>
    </div>
  );

  S.share = (
    <>
      <div className="appbar">
        <button type="button" className="back" onClick={() => go("home")} aria-label="返回">
          ←
        </button>
        <span className="title">分享代禱</span>
      </div>
      <div className="scroll" style={{ padding: 16 }}>
        <p style={{ fontSize: 15, color: "var(--text-muted)", marginBottom: 16 }}>
          把此刻最需要被祝福的事寫下來。
        </p>
        <div className="field">
          <label htmlFor="v3w-sh-title">標題</label>
          <input
            id="v3w-sh-title"
            type="text"
            maxLength={80}
            placeholder="例如：為母親的手術禱告"
            value={shTitle}
            onChange={(e) => setShTitle(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="v3w-sh-body">
            內容 <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(可選)</span>
          </label>
          <textarea
            id="v3w-sh-body"
            rows={4}
            placeholder="想說多少都可以，短短一句也很好。"
            value={shBody}
            onChange={(e) => setShBody(e.target.value)}
          />
        </div>
        <div className="toggle-row">
          <div>
            <div className="lbl">匿名分享</div>
            <div className="desc">不顯示你的身份</div>
          </div>
          <Switch on={shAnon} onFlip={() => setShAnon(!shAnon)} label="匿名分享" />
        </div>
        <div className="toggle-row">
          <div>
            <div className="lbl">私密代禱</div>
            <div className="desc">公開頁只顯示匿名光點，不顯示內容</div>
          </div>
          <Switch on={shPrivate} onFlip={() => setShPrivate(!shPrivate)} label="私密代禱" />
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label>分類</label>
          <div className="chips">
            {["健康", "家庭", "工作", "個人"].map((c) => (
              <button
                key={c}
                type="button"
                className={`chip${shCat === c ? " on" : ""}`}
                onClick={() => setShCat(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="v3w-sh-loc">
            大致位置 <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(可略過)</span>
          </label>
          <input id="v3w-sh-loc" type="text" placeholder="例如：台灣" />
          <p className="hint">只會使用大致位置，不會記錄精確地點。</p>
        </div>
        <div className="field">
          <label>附件（可選）</label>
          <div className="chips">
            <button
              type="button"
              className="chip"
              onClick={() => toast("POC：僅接受站內上傳 /uploads/…")}
            >
              ＋ 圖片
            </button>
            <button type="button" className="chip" onClick={() => toast("POC：語音需要上傳")}>
              ＋ 語音
            </button>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!shTitle.trim()}
          onClick={() => go("preview")}
        >
          <span className="label">送出代禱</span>
        </button>
        {!shTitle.trim() && (
          <p className="hint" style={{ textAlign: "center", marginTop: 8 }}>
            填寫標題就可以送出
          </p>
        )}
      </div>
      <BottomNav />
    </>
  );

  S.preview = (
    <>
      <div className="appbar">
        <button type="button" className="back" onClick={() => go("share")} aria-label="返回">
          ←
        </button>
        <span className="title">送出前確認</span>
      </div>
      <div className="scroll" style={{ padding: 16 }}>
        <div className="priv-box priv-show" style={{ opacity: shPrivate ? 0.45 : 1 }}>
          <b style={{ color: "var(--success)" }}>公開後會顯示</b>
          標題、分類、匿名名稱、大致位置
        </div>
        <div className="priv-box priv-hide">
          <b style={{ color: "var(--danger)" }}>不會顯示</b>
          真實身份、精確位置、登入資料
        </div>
        {shPrivate && (
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: "24px",
              marginBottom: 16,
            }}
          >
            你開啟了<b>私密代禱</b>：公開頁只會出現一個匿名光點，標題與內容都不會顯示。
          </p>
        )}
        <button
          type="button"
          className={`btn btn-primary${shBusy ? " loading" : ""}`}
          disabled={shBusy}
          onClick={submitShare}
        >
          <span className="label">確認送出</span>
          <span className="spinner" />
        </button>
      </div>
    </>
  );

  S["share-done"] = (
    <div className="center-stage">
      <div className="success-star">🕊</div>
      <h3 style={{ fontSize: 22 }}>你的需要已被接住。</h3>
      <p style={{ fontSize: 15, color: "var(--text-muted)", lineHeight: "26px" }}>
        它已放上禱告牆，
        <br />
        有人為你禱告時你可以回來看。
      </p>
      <div className="card" style={{ width: "100%", textAlign: "left" }}>
        <b style={{ fontSize: 14 }}>保留這個管理連結</b>
        <p style={{ fontSize: 13, marginTop: 6, wordBreak: "break-all", color: "var(--primary)" }}>
          startpray.online/my/k7f…q2
        </p>
        <p className="hint">匿名分享不需要帳號；建立帳號可以更方便管理。</p>
      </div>
      <button type="button" className="btn btn-primary" onClick={() => go("home")}>
        <span className="label">回到今天</span>
      </button>
      <button type="button" className="btn-ghost" onClick={() => toast("POC：進入註冊流程")}>
        建立帳號以便管理
      </button>
    </div>
  );

  S.wall = (
    <>
      <div className="appbar">
        <span className="brand">禱告牆</span>
      </div>
      <div className="scroll" style={{ padding: 16 }}>
        <button type="button" className="btn btn-primary" onClick={startOnePrayer}>
          <span className="label">為一人禱告</span>
        </button>
        <div className="field" style={{ marginTop: 16 }}>
          <input
            type="text"
            placeholder="搜尋代禱主題"
            aria-label="搜尋"
            value={wallQ}
            onChange={(e) => setWallQ(e.target.value)}
          />
        </div>
        <div className="chips" style={{ marginBottom: 16 }}>
          {["", "健康", "家庭", "工作"].map((c) => (
            <button
              key={c || "all"}
              type="button"
              className={`chip${wallCat === c ? " on" : ""}`}
              onClick={() => setWallCat(c)}
            >
              {c || "全部"}
            </button>
          ))}
        </div>
        {wallRows.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 24 }}>
            <p style={{ marginBottom: 12 }}>找不到相符的代禱。</p>
            <button type="button" className="btn btn-secondary" onClick={startOnePrayer}>
              看一份需要代禱的卡片
            </button>
          </div>
        ) : (
          wallRows.map(({ c, i }) =>
            c.isPrivate ? (
              <div key={i} className="card" style={{ background: "var(--surface-muted)" }}>
                <div className="tagline">
                  <span className="tag">私密</span>
                  <span className="tag">匿名</span>
                </div>
                <p style={{ marginTop: 8 }}>一份私密代禱正在被守望（不顯示內容）</p>
              </div>
            ) : (
              <div key={i} className="card">
                <div className="tagline">
                  <span className="tag">匿名</span>
                  <span className="tag">{c.cat}</span>
                  <span>{c.n}</span>
                </div>
                <h3>{c.title}</h3>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ marginTop: 12 }}
                  onClick={() => openCard(i)}
                >
                  為他禱告
                </button>
              </div>
            )
          )
        )}
      </div>
      <BottomNav />
    </>
  );

  S.detail = (
    <>
      <div className="appbar">
        <button type="button" className="back" onClick={() => go("wall")} aria-label="返回">
          ←
        </button>
        <span className="title">代禱卡</span>
        <button
          type="button"
          className="back"
          style={{ margin: 0 }}
          onClick={() => toast("已回報，謝謝你幫忙守護這裡")}
          aria-label="檢舉"
        >
          ⚑
        </button>
      </div>
      <div className="scroll" style={{ padding: 16 }}>
        <div className="tagline">
          <span className="tag">匿名</span>
          <span className="tag">{card.cat}</span>
          <span className="tag">大致位置</span>
        </div>
        <h3 style={{ fontSize: 20, lineHeight: "30px", margin: "8px 0" }}>{card.title}</h3>
        <p style={{ color: "var(--text-muted)", fontSize: 15, lineHeight: "26px" }}>{card.body}</p>
        <button
          type="button"
          className="btn btn-primary"
          style={{ margin: "16px 0" }}
          onClick={() => go("choice")}
        >
          <span className="label">留下祝福</span>
        </button>
        <div className="section" style={{ padding: "8px 0" }}>
          <h2>語音祝福</h2>
          <div
            className="mini-player"
            onClick={() => openPlayback()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && openPlayback()}
          >
            <div className="row1">
              <span>匿名</span>
              <span>·</span>
              <span>0:12</span>
              <span style={{ marginLeft: "auto" }}>▶ 播放</span>
            </div>
            <div className="snip">「願主賜你力量，陪你走過這段治療…」</div>
          </div>
        </div>
        <div className="section" style={{ padding: "16px 0 0" }}>
          <h2>文字祝福</h2>
          <div className="card">
            <p style={{ color: "var(--text)" }}>
              願你今天有平安。 <span className="tag" style={{ marginLeft: 6 }}>匿名</span>
            </p>
          </div>
          <div className="card">
            <p style={{ color: "var(--text)" }}>
              為你禱告，不要怕。 <span className="tag" style={{ marginLeft: 6 }}>匿名</span>
            </p>
          </div>
        </div>
      </div>
    </>
  );

  S.playback = (
    <div className="player-full">
      <div className="appbar">
        <button type="button" className="back" onClick={closePB} aria-label="收合">
          ↓
        </button>
        <span className="title">語音祝福</span>
        <button
          type="button"
          className="back"
          style={{ margin: 0, fontSize: 14, width: "auto", padding: "0 10px" }}
          onClick={cycleSpeed}
        >
          {pb.speed}x
        </button>
      </div>
      <WaveBars dark paused={!pb.playing} />
      <div className="lyrics" aria-live="polite">
        {pb.segs.map((l, i) => (
          <div
            key={i}
            className={`line${pb.cur >= l.s && pb.cur < l.e ? " now" : ""}${
              pb.cur >= l.e ? " past" : ""
            }`}
          >
            {l.t}
          </div>
        ))}
      </div>
      <div className="player-ctl">
        <div className="progress" onClick={seek}>
          <div className="fill" style={{ width: `${(pb.cur / pb.dur) * 100}%` }} />
        </div>
        <div className="ptimes">
          <span>{fmt(pb.cur)}</span>
          <span>{fmt(pb.dur)}</span>
        </div>
        <div className="pbtns">
          <button type="button" className="btn btn-secondary" onClick={togglePlay}>
            {pb.cur >= pb.dur ? "重播" : pb.playing ? "暫停" : "播放"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              closePB();
              startOnePrayer();
            }}
          >
            <span className="label">下一篇代禱</span>
          </button>
        </div>
      </div>
    </div>
  );

  S.world = (
    <>
      <div className="appbar">
        <span className="brand">世界正在一起禱告</span>
      </div>
      <div className="scroll" style={{ padding: 16 }}>
        <div className="worldproof" style={{ padding: 24 }}>
          <div className="mini-globe" style={{ width: 180, height: 180 }}>
            <span className="dot" style={{ top: "20%", left: "66%" }} />
            <span className="dot" style={{ top: "45%", left: "28%", animationDelay: ".6s" }} />
            <span className="dot" style={{ top: "62%", left: "58%", animationDelay: "1.2s" }} />
            <span className="dot" style={{ top: "33%", left: "45%", animationDelay: "1.8s" }} />
            <span className="dot" style={{ top: "72%", left: "38%", animationDelay: "2.4s" }} />
            <span className="dot" style={{ top: "52%", left: "72%", animationDelay: "3s" }} />
          </div>
          <div className="stats">今天新增 12 個祝福光點</div>
        </div>
        <div className="section" style={{ padding: "16px 0" }}>
          <h2>最近的光點</h2>
          <div className="card">
            <div className="tagline">
              <span className="tag">台灣</span>
              <span className="tag">健康</span>
            </div>
            <p style={{ marginTop: 8, color: "var(--text)" }}>一份匿名代禱正在被守望</p>
          </div>
          <div className="card">
            <div className="tagline">
              <span className="tag">日本</span>
              <span className="tag">家庭</span>
            </div>
            <p style={{ marginTop: 8, color: "var(--text)" }}>有人剛留下一段語音祝福</p>
          </div>
          <div className="card">
            <div className="tagline">
              <span className="tag">私密</span>
            </div>
            <p style={{ marginTop: 8 }}>一份私密代禱正在被守望（不顯示內容）</p>
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={startOnePrayer}>
          <span className="label">為一人禱告</span>
        </button>
        <p className="hint" style={{ textAlign: "center", margin: "12px 0" }}>
          地圖只顯示匿名的大致光點，永遠不會顯示私密內容。
        </p>
      </div>
      <BottomNav />
    </>
  );

  S.me = (
    <>
      <div className="appbar">
        <span className="brand">我</span>
      </div>
      <div className="scroll" style={{ padding: "24px 16px" }}>
        <div className="card" style={{ textAlign: "center", padding: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🤍</div>
          <h3 style={{ fontSize: 18 }}>你現在是匿名使用</h3>
          <p style={{ fontSize: 14, margin: "8px 0 16px" }}>
            不需要帳號也可以禱告與分享。
            <br />
            建立帳號可以管理你的代禱卡、查看收到的祝福。
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => toast("POC：進入登入 / 註冊")}
          >
            登入或建立帳號
          </button>
          <button type="button" className="btn-ghost" onClick={startOnePrayer}>
            先繼續匿名禱告
          </button>
        </div>
        <div className="section" style={{ padding: "16px 0" }}>
          <h2>安心使用</h2>
          <div className="steps">
            <div className="step">
              <span className="n">🔒</span>匿名是預設，不會公開你的身份
            </div>
            <div className="step">
              <span className="n">🛡</span>私密代禱只會顯示匿名光點
            </div>
            <div className="step">
              <span className="n">⚑</span>每則內容旁都有檢舉入口
            </div>
          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );

  /* ---------- screen map (reviewer aid) ---------- */
  const jumps = [
    ["主要分頁", null],
    ["Home / Today", () => go("home")],
    ["禱告牆", () => go("wall")],
    ["分享代禱", () => go("share")],
    ["世界", () => go("world")],
    ["我", () => go("me")],
    ["禱告流程", null],
    ["一人禱告（出卡）", startOnePrayer],
    ["回應方式選擇", () => go("choice")],
    ["文字禱告", () => go("text")],
    ["成功頁", () => go("success")],
    ["語音流程", null],
    ["麥克風權限", () => go("vperm")],
    ["權限被拒", () => go("vdenied")],
    ["倒數＋錄音（真實麥克風）", askMic],
    ["處理中", () => go("vproc")],
    ["確認字幕", () => go("vconfirm")],
    ["分享流程", null],
    ["隱私預覽", () => go("preview")],
    ["分享成功", () => go("share-done")],
    ["播放", null],
    ["代禱卡詳情", () => go("detail")],
    ["全螢幕同步字幕播放", () => openPlayback()],
  ];

  return (
    <div className="v3w">
      <div className="poc-note">
        <b>Start Pray · V3 Wireframe 預覽</b>（PRD-010 Track A）— 假資料，不影響正式站。
        <br />
        語音流程是<b>真的</b>：真錄音＋瀏覽器內建免費辨識＋同步字幕，零 API 費用。右上 ⊞
        可跳任一畫面。
      </div>
      <div className="phone">
        <button
          type="button"
          className="mapfab"
          onClick={() => setMapOpen(true)}
          aria-label="畫面清單"
        >
          ⊞
        </button>
        <section className="screen">{S[screen] || S.home}</section>
        <div className={`toast${toastMsg ? " show" : ""}`} role="status">
          {toastMsg}
        </div>
        {mapOpen && (
          <div className="screenmap">
            <h2>
              畫面清單（審閱用）
              <button
                type="button"
                className="jump"
                style={{ float: "right", width: "auto" }}
                onClick={() => setMapOpen(false)}
              >
                ✕ 關閉
              </button>
            </h2>
            {jumps.map(([label, fn], i) =>
              fn ? (
                <button
                  key={i}
                  type="button"
                  className="jump"
                  onClick={() => {
                    setMapOpen(false);
                    fn();
                  }}
                >
                  {label}
                </button>
              ) : (
                <div key={i} className="grp">
                  {label}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
