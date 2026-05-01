import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppStateProvider } from '@/hooks/useAppState';
import CaregiverPage from '@/app/caregiver/page';
import { RoleGuard } from '@/components/RoleGuard';

// Mock useRouter
const mockReplace = vi.fn();
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
  }),
  usePathname: () => '/caregiver',
}));

describe('Caregiver Session & Protection Integration', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('Scenario 3 & 5: Route Protection - Redirects to login if NO token', async () => {
    render(
      <AppStateProvider>
        <RoleGuard>
          <CaregiverPage />
        </RoleGuard>
      </AppStateProvider>
    );

    // Wait for hydration
    await waitFor(() => {
      // LoginForm should be visible (contains "Benvingut/da")
      expect(screen.getByText(/Benvingut/i)).toBeInTheDocument();
    });
  });

  it('Scenario 3: Session Persistence - Stays authenticated on reload', async () => {
    // 1. Simulate existing session in localStorage
    localStorage.setItem('pg_user_token', 'persisted-jwt-token');

    render(
      <AppStateProvider>
        <RoleGuard>
          <CaregiverPage />
        </RoleGuard>
      </AppStateProvider>
    );

    // 2. Dashboard should be visible instead of login
    await waitFor(() => {
      // CaregiverDashboard contains "Estat del passeig"
      expect(screen.getByText(/Estat del passeig/i)).toBeInTheDocument();
    });
    
    expect(screen.queryByText(/Benvingut/i)).not.toBeInTheDocument();
  });

  it('Scenario 4: Logout Flow', async () => {
    localStorage.setItem('pg_user_token', 'active-token');

    render(
      <AppStateProvider>
        <RoleGuard>
          <CaregiverPage />
        </RoleGuard>
      </AppStateProvider>
    );

    // Dashboard loaded
    const logoutBtn = await screen.findByText(/Sortir/i);
    
    // Trigger Logout
    fireEvent.click(logoutBtn);

    expect(localStorage.getItem('pg_user_token')).toBeNull();
  });
});
