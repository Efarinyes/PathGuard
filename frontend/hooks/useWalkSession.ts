import { useState, useCallback } from 'react';
import { useAppState } from './useAppState';
import { walkService, StuckWalkError } from '../services/walkService';
import { locationService } from '../services/locationService';

export interface UseWalkSessionReturn {
  isWalking: boolean;
  isLoading: boolean;
  handleStartWalk: () => Promise<{ success: boolean; error?: string }>;
  handleStopWalk: () => Promise<{ success: boolean; error?: string }>;
}

/**
 * Encapsulates walk lifecycle logic: start, stop, and auto-recovery
 * for stuck walks. Keeps UI components free of fetch() details and
 * error-handling complexity.
 */
export function useWalkSession(): UseWalkSessionReturn {
  const { deviceToken, activeWalkId, startWalk, endWalk } = useAppState();
  const [isLoading, setIsLoading] = useState(false);

  const isWalking = activeWalkId !== null;

  const handleStartWalk = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const walkId = await walkService.startWalk(deviceToken);
      startWalk(walkId);
      return { success: true };
    } catch (error) {
      if (error instanceof StuckWalkError) {
        // Auto-recovery: stop the stuck walk and retry once
        try {
          await walkService.stopWalk(deviceToken);
          const walkId = await walkService.startWalk(deviceToken);
          startWalk(walkId);
          return { success: true };
        } catch (retryError) {
          return {
            success: false,
            error: retryError instanceof Error ? retryError.message : 'Failed to start walk after recovery',
          };
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start walk',
      };
    } finally {
      setIsLoading(false);
    }
  }, [deviceToken, startWalk]);

  const handleStopWalk = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      // Flush any remaining batched points before stopping
      await locationService.flushFinal();
      await walkService.stopWalk(deviceToken);
      endWalk();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop walk',
      };
    } finally {
      setIsLoading(false);
    }
  }, [deviceToken, endWalk]);

  return { isWalking, isLoading, handleStartWalk, handleStopWalk };
}
