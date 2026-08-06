import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PatientStatusCard, {
  isSilenceStatus,
  silenceLabel,
} from './PatientStatusCard';

describe('SPEC-189 PatientStatusCard silence copy', () => {
  it('treats limbo and offline as silence', () => {
    expect(isSilenceStatus('limbo')).toBe(true);
    expect(isSilenceStatus('offline')).toBe(true);
    expect(isSilenceStatus('online')).toBe(false);
    expect(isSilenceStatus('gps_online')).toBe(false);
  });

  it('uses waiting copy for limbo', () => {
    expect(silenceLabel('limbo', 'fa 2min', true)).toBe(
      'Passeig actiu — Esperant actualització…'
    );
  });

  it('uses last-known copy for offline with location', () => {
    expect(silenceLabel('offline', 'fa 7min', true)).toBe(
      'Sense actualitzacions (fa 7min) — darrera posició coneguda'
    );
  });

  it('handles offline without location', () => {
    expect(silenceLabel('offline', 'fa 7min', false)).toBe(
      'Sense actualitzacions — posició encara no disponible'
    );
  });

  it('renders offline label and hides live ping', () => {
    const { container } = render(
      <PatientStatusCard
        isConnected
        isActive
        isPatientConnected={false}
        presenceStatus="offline"
        currentLocation={{ timestamp: '2026-08-06T15:00:00.000Z' }}
        timeAgo="fa 7min"
      />
    );

    expect(
      screen.getByText('Sense actualitzacions (fa 7min) — darrera posició coneguda')
    ).toBeTruthy();
    expect(container.querySelector('.animate-ping')).toBeNull();
  });

  it('keeps live ping when online', () => {
    const { container } = render(
      <PatientStatusCard
        isConnected
        isActive
        isPatientConnected
        presenceStatus="online"
        currentLocation={{ timestamp: '2026-08-06T15:00:00.000Z' }}
        timeAgo="Ara mateix"
      />
    );

    expect(screen.getByText('Passeig actiu — En línia')).toBeTruthy();
    expect(container.querySelector('.animate-ping')).not.toBeNull();
  });
});
