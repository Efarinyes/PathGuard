'use client';

import React from 'react';
import { AppErrorBoundary } from '@/components/shared/AppErrorBoundary';

interface Props {
  children: React.ReactNode;
}

export class MapErrorBoundary extends React.Component<Props> {
  render() {
    return (
      <AppErrorBoundary
        title="Error carregant el mapa"
        onRetry={() => window.location.reload()}
        retryLabel="Reintentar"
      >
        {this.props.children}
      </AppErrorBoundary>
    );
  }
}