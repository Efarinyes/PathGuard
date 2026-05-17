import { API_BASE_URL } from '@/lib/config';

export interface PatientStatus {
  sos_enabled: boolean;
  patient_name: string;
  group_id: number;
}

export const patientService = {
  async getPatientStatus(deviceToken: string | null): Promise<PatientStatus> {
    if (!deviceToken) {
      throw new Error('Device token is required');
    }

    const response = await fetch(`${API_BASE_URL}/patient/status`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Patient-Token': deviceToken,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch patient status: ${response.status}`);
    }

    return response.json();
  },
};