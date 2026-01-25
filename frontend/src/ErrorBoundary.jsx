import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-slate-900 text-white flex flex-col items-center justify-center p-8">
          <h1 className="text-3xl font-bold text-red-500 mb-4">Something went wrong.</h1>
          <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 max-w-2xl w-full overflow-auto">
            <p className="text-lg mb-4 text-slate-300">The application encountered an error and could not render.</p>
            <details className="whitespace-pre-wrap font-mono text-sm text-red-300">
              <summary className="cursor-pointer mb-2 text-slate-400">Error Details</summary>
              {this.state.error && this.state.error.toString()}
              <br />
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </details>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="mt-8 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors"
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
