"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PWAErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("PWA Error Boundary caught:", error, errorInfo);

    if (error.name === "SecurityError") {
      console.error("Security error - possibly blocked by browser");
    }

    if (error.message.includes("IndexedDB")) {
      console.error("IndexedDB unavailable - will work in memory-only mode");
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
          <div className="text-center max-w-md bg-white rounded-xl border border-slate-200 shadow-sm p-8">
            <div className="mb-6">
              <svg
                className="w-16 h-16 mx-auto text-danger"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-4">
              ERROR: {this.state.error?.name || "Error"}
            </h1>

            <p className="text-base text-slate-500 mb-6">
              {this.state.error?.message || "S'ha produït un error inesperat."}
            </p>

            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                className="block w-full px-6 py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors"
              >
                Tornar a intentar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}