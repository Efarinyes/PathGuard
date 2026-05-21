'use client';

import { useState, useEffect, useCallback } from 'react';
import { walkService } from '@/services/walkService';

interface OwnerData {
  patientName: string;
  isOwner: boolean;
  groupName: string;
  sosEnabled: boolean;
}

interface UseOwnerDataResult extends OwnerData {
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetches and caches the current user's group information.
 * Used by both /caregiver and /caregiver/dashboard to avoid duplicate fetches.
 */
export function useOwnerData(token: string | null): UseOwnerDataResult {
  const [data, setData] = useState<OwnerData>({
    patientName: 'el Familiar',
    isOwner: false,
    groupName: '',
    sosEnabled: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await walkService.getUserGroupInfo(token);
      setData({
        patientName: result.patient_name,
        isOwner: result.is_owner,
        groupName: result.group_name,
        sosEnabled: result.sos_enabled,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    ...data,
    isLoading,
    error,
  };
}
