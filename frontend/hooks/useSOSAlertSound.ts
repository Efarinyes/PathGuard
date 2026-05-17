'use client';

import { useCallback, useRef } from 'react';

interface UseSOSAlertSoundReturn {
  playAlertSound: () => void;
  stopAlertSound: () => void;
  isPlaying: boolean;
}

const BEEP_FREQUENCY_HZ = 1500;
const BEEP_DURATION_MS = 100;
const BEEP_GAP_MS = 100;
const BEEP_REPEAT = 3;

export function useSOSAlertSound(): UseSOSAlertSoundReturn {
  const audioContextRef = useRef<AudioContext | null>(null);
  const isPlayingRef = useRef(false);

  const stopAlertSound = useCallback(() => {
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    isPlayingRef.current = false;
  }, []);

  const playAlertSound = useCallback(() => {
    if (isPlayingRef.current) return;

    try {
      audioContextRef.current = new AudioContext();
      isPlayingRef.current = true;

      const ctx = audioContextRef.current;
      let beepIndex = 0;

      function playBeep() {
        if (!isPlayingRef.current || beepIndex >= BEEP_REPEAT) {
          stopAlertSound();
          return;
        }

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.value = BEEP_FREQUENCY_HZ;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + BEEP_DURATION_MS / 1000);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + BEEP_DURATION_MS / 1000);

        beepIndex++;

        if (beepIndex < BEEP_REPEAT) {
          setTimeout(playBeep, BEEP_DURATION_MS + BEEP_GAP_MS);
        } else {
          setTimeout(() => {
            stopAlertSound();
          }, BEEP_DURATION_MS + BEEP_GAP_MS);
        }
      }

      playBeep();
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