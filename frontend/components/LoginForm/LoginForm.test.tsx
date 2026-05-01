import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginForm from './index';
import { AppStateProvider } from '@/hooks/useAppState';

// Mock Fetch
global.fetch = vi.fn();

describe('LoginForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('Scenario 1: Successful Login', async () => {
    const mockOnLoginSuccess = vi.fn();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'test-jwt-token',
        token_type: 'bearer'
      }),
    });

    render(
      <AppStateProvider>
        <LoginForm onLoginSuccess={mockOnLoginSuccess} />
      </AppStateProvider>
    );

    // Fill form
    fireEvent.change(screen.getByLabelText(/Correu electrònic/i), { target: { value: 'caregiver@example.com' } });
    fireEvent.change(screen.getByLabelText(/Contrasenya/i), { target: { value: 'password123' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Iniciar sessió/i }));

    await waitFor(() => {
      expect(mockOnLoginSuccess).toHaveBeenCalledWith('test-jwt-token');
    });

    // Verify fetch call (OAuth2 format)
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/auth/login'), expect.objectContaining({
      method: 'POST',
      body: expect.any(URLSearchParams)
    }));
  });

  it('Scenario 2: Invalid Credentials', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      json: async () => ({ detail: 'Incorrect email or password' }),
    });

    render(
      <AppStateProvider>
        <LoginForm onLoginSuccess={vi.fn()} />
      </AppStateProvider>
    );

    fireEvent.change(screen.getByLabelText(/Correu electrònic/i), { target: { value: 'wrong@example.com' } });
    fireEvent.change(screen.getByLabelText(/Contrasenya/i), { target: { value: 'wrong' } });

    fireEvent.click(screen.getByRole('button', { name: /Iniciar sessió/i }));

    await waitFor(() => {
      expect(screen.getByText(/Incorrect email or password/i)).toBeInTheDocument();
    });
  });
});
