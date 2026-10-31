import { Component, type ReactNode } from 'react';
import { Button } from '../components/Button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch() {
    console.error('Error inesperado en la interfaz');
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main
        className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-4"
        role="alert"
      >
        <h1 className="text-2xl font-bold">Algo ha fallado</h1>
        <p>Recarga la aplicación para continuar.</p>
        <Button onClick={() => window.location.reload()}>Recargar</Button>
      </main>
    );
  }
}
