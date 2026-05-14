import React, { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full rounded-xl flex items-center justify-center bg-slate-50 border border-red-200 p-6">
          <div className="text-center">
            <p className="text-red-600 font-medium mb-2">Error carregant l'historial</p>
            <p className="text-slate-500 text-sm mb-4">Hi ha hagut un problema en mostrar les caminades anteriors.</p>
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-300 transition-colors"
            >
              Tornar a intentar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
