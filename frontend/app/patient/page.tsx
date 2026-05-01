'use client';

import PatientWalkController from '@/components/PatientWalkController';

export default function PatientPage() {
  // Hydration and deviceToken validation are now handled globally by RoleGuard
  return <PatientWalkController />;
}
