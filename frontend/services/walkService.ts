import { API_BASE_URL } from '@/lib/config';

export interface WalkHistoryItem {
  id: number;
  start_time: string;
  end_time?: string | null;
  active: boolean;
  duration_seconds: number;
  distance_meters?: number;
  incidents_count?: number;
  signal_loss?: boolean;
}

export interface ActiveWalkSnapshot {
  id: number;
  active: boolean;
  start_time: string;
  end_time?: string | null;
  patient_id: number;
  initiated_by_type: string;
  initiated_by_id?: number;
  stopped_by_type?: string;
  stopped_by_id?: number;
  locations?: Array<{
    id: number;
    latitude: number;
    longitude: number;
    timestamp: string;
    is_recovered?: boolean;
  }>;
}

export interface AnalyticsData {
  avg_duration_minutes: number;
  common_start_hours: { hour: number; count: number }[];
  walk_frequency: { date: string; count: number }[];
}

export const walkService = {
  /**
   * Fetches the list of walk sessions for the family group.
   * Requires a valid caregiver userToken.
   */
  async getWalks(token: string): Promise<WalkHistoryItem[]> {
    const response = await fetch(`${API_BASE_URL}/walks/`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('No s\'ha pogut carregar l\'historial de passejos');
    }
    
    return response.json();
  },

  /**
   * Fetches basic analytics for the caregiver dashboard.
   */
  async getAnalytics(token: string): Promise<AnalyticsData> {
    const response = await fetch(`${API_BASE_URL}/analytics/`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('No s\'ha pogut carregar les analítiques');
    }
    
    return response.json();
  },

  /**
   * Fetches the active walk state (snapshot) for initial hydration.
   */
  async getActiveWalk(userToken: string | null, deviceToken: string | null): Promise<ActiveWalkSnapshot | null> {
    if (!userToken && !deviceToken) {
      return null;
    }

    const response = await fetch(`${API_BASE_URL}/walks/active`, {
      headers: {
        'Content-Type': 'application/json',
        ...(userToken 
          ? { 'Authorization': `Bearer ${userToken}` } 
          : deviceToken 
            ? { 'X-Patient-Token': deviceToken } 
            : {}
        ),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch active walk: ${response.status}`);
    }

    return response.json();
  },

  /**
   * Fetches the current user's group info including patient name and ownership status.
   */
  async getUserGroupInfo(token: string): Promise<{
    patient_name: string;
    group_name: string;
    is_owner: boolean;
  }> {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('No s\'ha pogut carregar la informació del grup');
    }
    
    return response.json();
  }
};
