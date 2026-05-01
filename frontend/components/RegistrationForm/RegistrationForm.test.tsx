import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RegistrationForm from './index';
import { AppStateProvider } from '@/hooks/useAppState';

// Mock useRouter
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock Fetch
global.fetch = vi.fn();

describe('RegistrationForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Scenario 1: Successful Registration and Redirect', async () => {
    const mockOnSuccess = vi.fn();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        device_token: 'test-token',
        patient_id: 123
      }),
    });

    render(
      <AppStateProvider>
        <RegistrationForm onRegisterSuccess={mockOnSuccess} />
      </AppStateProvider>
    );

    // Fill form
    fireEvent.change(screen.getByLabelText(/Nom de la Família/i), { target: { value: 'Família Soler' } });
    fireEvent.change(screen.getByLabelText(/Nom del Pacient/i), { target: { value: 'Joan' } });
    fireEvent.change(screen.getByLabelText(/El teu correu/i), { target: { value: 'joan@example.com' } });
    fireEvent.change(screen.getByLabelText(/Contrasenya de seguretat/i), { target: { value: 'password123' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Continuar cap a l'activació/i }));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith('test-token', 123, true);
    });

    // Verify fetch call
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/auth/register'), expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        group_name: 'Família Soler',
        patient_name: 'Joan',
        email: 'joan@example.com',
        password: 'password123'
      })
    }));
  });

  it('Scenario 2: Handling Backend Errors', async () => {
    const mockOnSuccess = vi.fn();
    (global.fetch as any).mockResolvedValue({
      ok: false,
      json: async () => ({ detail: 'Correu ja registrat' }),
    });

    render(
      <AppStateProvider>
        <RegistrationForm onRegisterSuccess={mockOnSuccess} />
      </AppStateProvider>
    );

    fireEvent.change(screen.getByLabelText(/Nom de la Família/i), { target: { value: 'Família Soler' } });
    fireEvent.change(screen.getByLabelText(/Nom del Pacient/i), { target: { value: 'Joan' } });
    fireEvent.change(screen.getByLabelText(/El teu correu/i), { target: { value: 'joan@example.com' } });
    fireEvent.change(screen.getByLabelText(/Contrasenya de seguretat/i), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /Continuar cap a l'activació/i }));

    // Assert UI shows error
    await waitFor(() => {
      expect(screen.getByText(/Correu ja registrat/i)).toBeInTheDocument();
    });
    
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it('Scenario 3: Loading State', async () => {
    (global.fetch as any).mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(
      <AppStateProvider>
        <RegistrationForm onRegisterSuccess={vi.fn()} />
      </AppStateProvider>
    );

    fireEvent.change(screen.getByLabelText(/Nom de la Família/i), { target: { value: 'Família Soler' } });
    fireEvent.change(screen.getByLabelText(/Nom del Pacient/i), { target: { value: 'Joan' } });
    fireEvent.change(screen.getByLabelText(/El teu correu/i), { target: { value: 'joan@example.com' } });
    fireEvent.change(screen.getByLabelText(/Contrasenya de seguretat/i), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /Continuar cap a l'activació/i }));

    // Check button text changes
    expect(screen.getByRole('button')).toHaveTextContent(/Creant entorn/i);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
