'use client';

import React from 'react';

interface AppErrorBoundaryProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full p-4 bg-red-50 border border-red-100 rounded-xl text-center">
          <p className="text-red-600 font-semibold">{this.props.title}</p>
          {this.props.description && (
            <p className="text-red-500 text-sm mt-1">{this.props.description}</p>
          )}
          {this.props.onRetry && (
            <button
              onClick={this.handleRetry}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
            >
              {this.props.retryLabel || 'Reintentar'}
            </button>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}