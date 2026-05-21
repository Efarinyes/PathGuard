'use client';

import { useCallback, useRef } from 'react';

interface UseSOSAlertSoundReturn {
  playAlertSound: () => void;
  stopAlertSound: () => void;
  isPlaying: boolean;
}

const CHIME_NOTES = [440, 523, 660];
const TONE_DURATION_S = 0.5;
const TONE_GAP_S = 0.3;
const CHIME_PAUSE_S = 1.0;
const CHIME_CYCLES = 3;

export function useSOSAlertSound(): UseSOSAlertSoundReturn {
  const audioContextRef = useRef<AudioContext | null>(null);
  const isPlayingRef = useRef(false);
  const timeoutsRef = useRef<number[]>([]);

  const stopAlertSound = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    isPlayingRef.current = false;
  }, []);

  const playAlertSound = useCallback(() => {
    if (isPlayingRef.current) return;

    try {
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      isPlayingRef.current = true;

      // Ensure audio context is resumed (required by browser autoplay policies)
      ctx.resume().catch(() => {});

      let offset = ctx.currentTime + 0.05;

      for (let cycle = 0; cycle < CHIME_CYCLES; cycle++) {
        for (let i = 0; i < CHIME_NOTES.length; i++) {
          const freq = CHIME_NOTES[i];
          const oscillator = ctx.createOscillator();
          const gainNode = ctx.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(ctx.destination);

          oscillator.frequency.value = freq;
          oscillator.type = 'sine';

          gainNode.gain.setValueAtTime(0.001, offset);
          gainNode.gain.linearRampToValueAtTime(0.25, offset + 0.08);
          gainNode.gain.setValueAtTime(0.25, offset + TONE_DURATION_S - 0.1);
          gainNode.gain.linearRampToValueAtTime(0.001, offset + TONE_DURATION_S);

          oscillator.start(offset);
          oscillator.stop(offset + TONE_DURATION_S);

          offset += TONE_DURATION_S + TONE_GAP_S;
        }

        if (cycle < CHIME_CYCLES - 1) {
          offset += CHIME_PAUSE_S;
        }
      }

      const totalTimeMs = (offset - ctx.currentTime) * 1000 + 200;
      const tid = window.setTimeout(() => {
        stopAlertSound();
      }, totalTimeMs);
      timeoutsRef.current.push(tid);
    } catch {
      isPlayingRef.current = false;
    }
  }, [stopAlertSound]);

  return {
    playAlertSound,
    stopAlertSound,
    isPlaying: isPlayingRef.current,
  };
}