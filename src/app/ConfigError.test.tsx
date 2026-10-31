import { render, screen } from '@testing-library/react';
import { ConfigError } from './ConfigError';

describe('ConfigError', () => {
  it('anuncia cada problema de configuración', () => {
    render(<ConfigError issues={['Falta VITE_SUPABASE_ANON_KEY']} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Falta VITE_SUPABASE_ANON_KEY');
  });
});
