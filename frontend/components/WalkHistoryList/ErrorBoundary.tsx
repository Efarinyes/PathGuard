'use client';

import React from 'react';
import { AppErrorBoundary } from '@/components/shared/AppErrorBoundary';

interface Props {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<Props> {
  render() {
    return (
      <AppErrorBoundary
        title="Error carregant l'historial"
        description="Hi ha hagut un problema en mostrar les caminades anteriors."
        onRetry={() => window.location.reload()}
        retryLabel="Tornar a intentar"
      >
        {this.props.children}
      </AppErrorBoundary>
    );
  }
}