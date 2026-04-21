import { useCallback, useEffect, useRef } from "react";
import { useGameStore } from "@/lib/gameStore";

type SfxKind = "tap" | "draw" | "mark" | "win" | "reveal" | "error" | "coin" | "purchase" | "claim";

export function useAudio() {
  const muted = useGameStore((s) => s.muted);
  const musicMuted = useGameStore((s) => s.musicMuted);
  const ctxRef = useRef<AudioContext | null>(null);
  const musicIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const itVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const stepRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      const it = voices.find((v) => v.lang === "it-IT") ?? voices.find((v) => v.lang.startsWith("it")) ?? null;
      if (it) itVoiceRef.current = it;
    };
    pick();
    window.speechSynthesis.onvoiceschanged = pick;
  }, []);

  const getCtx = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;
      ctxRef.current = new Ctx();
    }
    if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const playNote = useCallback(
    (freq: number, startSec: number, durSec: number, type: OscillatorType = "triangle", vol = 0.12, ctx?: AudioContext, masterGain?: GainNode) => {
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
      if (masterGain) gain.connect(masterGain);
      else gain.connect(c.destination);
      osc.start(startSec);
      osc.stop(startSec + durSec + 0.05);
    },
    [getCtx],
  );

  const sfx = useCallback(
    (kind: SfxKind) => {
      if (muted) return;
      const ctx = getCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      switch (kind) {
        case "tap":
          playNote(1046, now, 0.07, "triangle", 0.12);
          break;
        case "draw": {
          playNote(523, now, 0.1, "sine", 0.16);
          playNote(659, now + 0.08, 0.12, "sine", 0.15);
          playNote(880, now + 0.17, 0.14, "sine", 0.14);
          break;
        }
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
          [523, 659, 784, 988, 1047].forEach((f, i) =>
            playNote(f, now + i * 0.09, 0.22, "triangle", 0.14),
          );
          break;
        case "win":
          [523, 659, 784, 1047, 1319, 1568].forEach((f, i) =>
            playNote(f, now + i * 0.11, 0.28, "sawtooth", 0.15),
          );
          playNote(2093, now + 0.75, 0.6, "triangle", 0.18);
          break;
        case "error":
          playNote(220, now, 0.12, "square", 0.13);
          playNote(165, now + 0.1, 0.18, "square", 0.12);
          break;
        case "purchase":
          [784, 988, 1319, 1568].forEach((f, i) =>
            playNote(f, now + i * 0.08, 0.2, "triangle", 0.13),
          );
          break;
        case "claim":
          [659, 784, 1047].forEach((f, i) =>
            playNote(f, now + i * 0.1, 0.25, "sine", 0.14),
          );
          break;
      }
    },
    [muted, getCtx, playNote],
  );

  const speak = useCallback(
    (text: string) => {
      if (muted) return;
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "it-IT";
        u.rate = 0.9;
        u.pitch = 1.1;
        u.volume = 1;
        if (itVoiceRef.current) u.voice = itVoiceRef.current;
        window.speechSynthesis.speak(u);
      } catch { /* ignore */ }
    },
    [muted],
  );

  const speakNumber = useCallback((n: number) => speak(`${n}`), [speak]);

  // ── Background music: chiptune arpeggio loop ──
  // Golden Room theme: bouncy carnival/game melody in A minor pentatonic
  const MELODY = [
    // bar 1: upward arp
    [440, 0.0], [554, 0.25], [659, 0.5], [880, 0.75],
    // bar 2: descend
    [880, 1.0], [698, 1.25], [554, 1.5], [440, 1.75],
    // bar 3: hook
    [523, 2.0], [659, 2.25], [784, 2.5], [659, 2.75],
    // bar 4: resolve + ornament
    [523, 3.0], [440, 3.25], [392, 3.5], [440, 3.75],
  ] as [number, number][];

  const BASS = [
    [220, 0.0], [220, 0.5], [247, 1.0], [247, 1.5],
    [196, 2.0], [196, 2.5], [220, 3.0], [220, 3.5],
  ] as [number, number][];

  const BAR_DUR = 4.0; // seconds per full loop

  const startMusic = useCallback(() => {
    if (musicMuted || muted) return;
    const ctx = getCtx();
    if (!ctx || musicGainRef.current) return;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.0;
    masterGain.connect(ctx.destination);
    masterGain.gain.linearRampToValueAtTime(0.7, ctx.currentTime + 0.5);
    musicGainRef.current = masterGain;

    // Compressor for cleaner sound
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 4;
    masterGain.connect(comp);
    comp.connect(ctx.destination);

    let loopStart = ctx.currentTime;
    stepRef.current = 0;

    const schedule = () => {
      if (!musicGainRef.current) return;
      const now = ctx.currentTime;

      // Schedule melody
      MELODY.forEach(([freq, beat]) => {
        const t = loopStart + beat;
        if (t > now - 0.05) {
          playNote(freq, t, 0.22, "triangle", 0.18, ctx, masterGain);
          // octave above quiet
          playNote(freq * 2, t, 0.1, "sine", 0.07, ctx, masterGain);
        }
      });

      // Schedule bass
      BASS.forEach(([freq, beat]) => {
        const t = loopStart + beat;
        if (t > now - 0.05) {
          playNote(freq, t, 0.45, "square", 0.12, ctx, masterGain);
        }
      });

      loopStart += BAR_DUR;

      // Schedule next iteration 200ms before next bar starts
      const msUntilNext = Math.max(50, (loopStart - ctx.currentTime - 0.2) * 1000);
      musicIntervalRef.current = setTimeout(schedule, msUntilNext);
    };

    schedule();
  }, [getCtx, muted, musicMuted, playNote]);

  const stopMusic = useCallback(() => {
    if (musicIntervalRef.current !== null) {
      clearTimeout(musicIntervalRef.current);
      musicIntervalRef.current = null;
    }
    if (musicGainRef.current) {
      try {
        const g = musicGainRef.current;
        const ctx = ctxRef.current;
        if (ctx) g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
        setTimeout(() => {
          try { g.disconnect(); } catch { /* ignore */ }
        }, 400);
      } catch { /* ignore */ }
      musicGainRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (musicMuted || muted) stopMusic();
  }, [musicMuted, muted, stopMusic]);

  return { sfx, speak, speakNumber, startMusic, stopMusic };
}
