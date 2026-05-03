const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

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
  async getActiveWalk(userToken: string | null, deviceToken: string | null): Promise<any> {
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
  }
};
