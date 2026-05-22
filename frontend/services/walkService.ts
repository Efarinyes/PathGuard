import { API_BASE_URL } from '@/lib/config';
import { LocationPayload } from '@/services/locationService';

export interface WalkHistoryItem {
  id: number;
  start_time: string;
  end_time?: string | null;
  active: boolean;
  duration_seconds: number;
  distance_meters?: number;
}

export interface ActiveWalkSnapshot {
  id: number;
  patient_id: number;
  start_time: string;
  status: string;
  latest_location?: {
    latitude: number;
    longitude: number;
    timestamp: string;
  } | null;
  history: Array<{
    latitude: number;
    longitude: number;
    timestamp: string;
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

    const data = await response.json();
    return data.active_walk || null;
  },

  /**
   * Fetches the current user's group info including patient name and ownership status.
   */
  async getUserGroupInfo(token: string): Promise<{
    patient_name: string;
    group_name: string;
    is_owner: boolean;
    sos_enabled: boolean;
  }> {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user group info');
    }

    return response.json();
  },

  /**
   * Fetches the patient activation code for the owner's group.
   * If the code has been used, the endpoint regenerates it automatically.
   * Requires owner privileges.
   */
  async getActivationCode(token: string): Promise<{
    activation_code: string;
    is_used: boolean;
  }> {
    const response = await fetch(`${API_BASE_URL}/auth/patient/activation-code`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('No s\'ha pogut obtenir el codi d\'activació');
    }

    return response.json();
  },

  /**
   * Toggles the SOS enabled state for the current user's group.
   * Only the group owner can call this endpoint.
   */
  async toggleSOS(token: string): Promise<{ sos_enabled: boolean }> {
    const response = await fetch(`${API_BASE_URL}/groups/sos-toggle`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('No s\'ha pogut canviar l\'estat SOS');
    }

    return response.json();
  },

  /**
   * Fetches locations for a specific walk (owner-only).
   */
  async getWalkLocations(token: string, walkId: number): Promise<LocationPayload[]> {
    const response = await fetch(`${API_BASE_URL}/walks/${walkId}/locations`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('No s\'ha pogut carregar la ruta del passeig');
    }

    return response.json();
  },

  /**
   * Starts a new walk session for the patient device.
   * Returns the walk_id on success.
   * Throws StuckWalkError if a walk is already active (caller should stop and retry).
   */
  async startWalk(deviceToken: string | null): Promise<number> {
    const response = await fetch(`${API_BASE_URL}/walks/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(deviceToken ? { 'X-Patient-Token': deviceToken } : {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let detail = 'Failed to start walk';
      try {
        const parsed = JSON.parse(errorText);
        detail = parsed.detail || detail;
      } catch {
        detail = errorText || detail;
      }

      if (response.status === 400 && detail === 'Walk already active') {
        throw new StuckWalkError(detail);
      }

      throw new Error(detail);
    }

    const data = await response.json();
    return typeof data === 'number' ? data : data.walk_id;
  },

  /**
   * Stops the current active walk session.
   */
  async stopWalk(deviceToken: string | null): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/walks/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(deviceToken ? { 'X-Patient-Token': deviceToken } : {}),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to stop walk');
    }
  }
};

export class StuckWalkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StuckWalkError';
  }
}
