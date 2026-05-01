import { useState, useEffect } from 'react';
import { walkService, AnalyticsData } from '../services/walkService';
import { WalkHistoryItem } from '../components/WalkHistoryList';

export function useCaregiverAnalytics(userToken: string | null, isActive: boolean) {
  const [walks, setWalks] = useState<WalkHistoryItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  // Fetch walks history
  useEffect(() => {
    if (!userToken) return;

    const fetchHistory = async () => {
      try {
        const data = await walkService.getWalks(userToken);
        setWalks(data);
      } catch (err) {
        console.error('Failed to fetch walks:', err);
      }
    };

    fetchHistory();
    
    // Refresh history when walk status changes or periodically
    const interval = setInterval(fetchHistory, 30000); // Every 30s
    return () => clearInterval(interval);
  }, [userToken, isActive]);

  // Fetch analytics
  useEffect(() => {
    if (!userToken) return;

    const fetchAnalytics = async () => {
      try {
        const data = await walkService.getAnalytics(userToken);
        setAnalytics(data);
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
      }
    };

    fetchAnalytics();
  }, [userToken, isActive]);

  return { walks, analytics };
}
