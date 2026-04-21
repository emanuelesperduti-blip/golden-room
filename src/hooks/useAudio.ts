import { useCallback, useEffect } from "react";
import { useGameStore } from "@/lib/gameStore";

type SfxKind = "tap" | "draw" | "mark" | "win" | "reveal" | "error" | "coin" | "purchase" | "claim";

let audioCtx: AudioContext | null = null;
let musicTimer: ReturnType<typeof setTimeout> | null = null;
let musicGain: GainNode | null = null;
let italianVoice: SpeechSynthesisVoice | null = null;
let listenersBound = false;
let voicesBound = false;

function isBrowser() {
  return typeof window !== "undefined";
}

function isPageVisible() {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

function isMuted() {
  return useGameStore.getState().muted;
}

function isMusicMuted() {
  return useGameStore.getState().musicMuted;
}

function stopSpeechGlobal() {
  if (!isBrowser() || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }
}

function stopMusicGlobal() {
  if (musicTimer !== null) {
    clearTimeout(musicTimer);
    musicTimer = null;
  }

  if (musicGain && audioCtx) {
    try {
      musicGain.gain.cancelScheduledValues(audioCtx.currentTime);
      musicGain.gain.setValueAtTime(Math.max(0.0001, musicGain.gain.value || 0.0001), audioCtx.currentTime);
      musicGain.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 0.18);
    } catch {
      // ignore
    }

    const gainToDisconnect = musicGain;
    setTimeout(() => {
      try {
        gainToDisconnect.disconnect();
      } catch {
        // ignore
      }
    }, 250);
  }

  musicGain = null;
}

function stopAllGlobal() {
  stopSpeechGlobal();
  stopMusicGlobal();
}

function bindGlobalListeners() {
  if (!isBrowser() || listenersBound) return;
  listenersBound = true;

  const stopIfHidden = () => {
    if (!isPageVisible()) stopAllGlobal();
  };

  document.addEventListener("visibilitychange", stopIfHidden);
  window.addEventListener("pagehide", stopAllGlobal);
  window.addEventListener("beforeunload", stopAllGlobal);
  window.addEventListener("unload", stopAllGlobal);
  window.addEventListener("blur", stopAllGlobal);
  window.addEventListener("popstate", stopAllGlobal);
  window.addEventListener("hashchange", stopAllGlobal);
  document.addEventListener("freeze", stopAllGlobal as EventListener);
}

function bindVoices() {
  if (!isBrowser() || !("speechSynthesis" in window) || voicesBound) return;
  voicesBound = true;

  const pick = () => {
    const voices = window.speechSynthesis.getVoices();
    const it = voices.find((v) => v.lang === "it-IT") ?? voices.find((v) => v.lang.startsWith("it")) ?? null;
    if (it) italianVoice = it;
  };

  pick();
  window.speechSynthesis.addEventListener?.("voiceschanged", pick);
  window.speechSynthesis.onvoiceschanged = pick;
}

function getCtx() {
  if (!isBrowser()) return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

function playNote(
  freq: number,
  startSec: number,
  durSec: number,
  type: OscillatorType = "triangle",
  vol = 0.12,
  ctx?: AudioContext,
  destination?: AudioNode,
) {
  const c = ctx ?? getCtx();
  if (!c) return;

  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, startSec);
  gain.gain.exponentialRampToValueAtTime(vol, startSec + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startSec + durSec - 0.01);
  osc.connect(gain);
  gain.connect(destination ?? c.destination);
  osc.start(startSec);
  osc.stop(startSec + durSec + 0.05);
}

const MELODY: [number, number][] = [
  [440, 0.0], [554, 0.25], [659, 0.5], [880, 0.75],
  [880, 1.0], [698, 1.25], [554, 1.5], [440, 1.75],
  [523, 2.0], [659, 2.25], [784, 2.5], [659, 2.75],
  [523, 3.0], [440, 3.25], [392, 3.5], [440, 3.75],
];

const BASS: [number, number][] = [
  [220, 0.0], [220, 0.5], [247, 1.0], [247, 1.5],
  [196, 2.0], [196, 2.5], [220, 3.0], [220, 3.5],
];

const LOOP_SECONDS = 4.0;

export function useAudio() {
  const muted = useGameStore((s) => s.muted);
  const musicMuted = useGameStore((s) => s.musicMuted);

  useEffect(() => {
    bindGlobalListeners();
    bindVoices();
  }, []);

  const sfx = useCallback((kind: SfxKind) => {
    if (isMuted() || !isPageVisible()) return;
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    switch (kind) {
      case "tap":
        playNote(1046, now, 0.07, "triangle", 0.12);
        break;
      case "draw":
        playNote(523, now, 0.1, "sine", 0.16);
        playNote(659, now + 0.08, 0.12, "sine", 0.15);
        playNote(880, now + 0.17, 0.14, "sine", 0.14);
        break;
      case "mark":
        playNote(1318, now, 0.08, "square", 0.09);
        playNote(1760, now + 0.06, 0.1, "triangle", 0.09);
        break;
      case "coin":
        playNote(1568, now, 0.07, "square", 0.11);
        playNote(2093, now + 0.06, 0.09, "square", 0.1);
        playNote(2637, now + 0.13, 0.1, "triangle", 0.1);
        break;
      case "reveal":
        [523, 659, 784, 988, 1047].forEach((f, i) => playNote(f, now + i * 0.09, 0.22, "triangle", 0.14));
        break;
      case "win":
        [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => playNote(f, now + i * 0.11, 0.28, "sawtooth", 0.15));
        playNote(2093, now + 0.75, 0.6, "triangle", 0.18);
        break;
      case "error":
        playNote(220, now, 0.12, "square", 0.13);
        playNote(165, now + 0.1, 0.18, "square", 0.12);
        break;
      case "purchase":
        [784, 988, 1319, 1568].forEach((f, i) => playNote(f, now + i * 0.08, 0.2, "triangle", 0.13));
        break;
      case "claim":
        [659, 784, 1047].forEach((f, i) => playNote(f, now + i * 0.1, 0.25, "sine", 0.14));
        break;
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (isMuted() || !isBrowser() || !("speechSynthesis" in window) || !isPageVisible()) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "it-IT";
      utterance.rate = 0.9;
      utterance.pitch = 1.08;
      utterance.volume = 1;
      if (italianVoice) utterance.voice = italianVoice;
      window.speechSynthesis.speak(utterance);
    } catch {
      // ignore
    }
  }, []);

  const speakNumber = useCallback((n: number) => speak(String(n)), [speak]);

  const startMusic = useCallback(() => {
    if (isMuted() || isMusicMuted() || !isPageVisible()) return;
    const ctx = getCtx();
    if (!ctx || musicGain) return;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);

    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(comp);
    gain.gain.linearRampToValueAtTime(0.65, ctx.currentTime + 0.4);
    musicGain = gain;

    let loopStart = ctx.currentTime;

    const schedule = () => {
      if (!musicGain || isMuted() || isMusicMuted() || !isPageVisible()) {
        stopMusicGlobal();
        return;
      }

      const now = ctx.currentTime;
      MELODY.forEach(([freq, beat]) => {
        const t = loopStart + beat;
        if (t > now - 0.05) {
          playNote(freq, t, 0.22, "triangle", 0.18, ctx, gain);
          playNote(freq * 2, t, 0.1, "sine", 0.07, ctx, gain);
        }
      });

      BASS.forEach(([freq, beat]) => {
        const t = loopStart + beat;
        if (t > now - 0.05) playNote(freq, t, 0.45, "square", 0.12, ctx, gain);
      });

      loopStart += LOOP_SECONDS;
      const waitMs = Math.max(50, (loopStart - ctx.currentTime - 0.2) * 1000);
      musicTimer = setTimeout(schedule, waitMs);
    };

    schedule();
  }, []);

  const stopMusic = useCallback(() => {
    stopMusicGlobal();
  }, []);

  const stopSpeech = useCallback(() => {
    stopSpeechGlobal();
  }, []);

  const stopAll = useCallback(() => {
    stopAllGlobal();
  }, []);

  useEffect(() => {
    if (musicMuted || muted) stopMusicGlobal();
    if (muted) stopSpeechGlobal();
  }, [musicMuted, muted]);

  return { sfx, speak, speakNumber, startMusic, stopMusic, stopSpeech, stopAll };
}
