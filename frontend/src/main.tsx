import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App';
import { Toaster } from '@/components/ui/toaster';
import { DataProvider } from '@/contexts/DataContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { PlatformThemeProvider } from '@/contexts/PlatformThemeContext';
import { PlatformLangProvider } from '@/contexts/PlatformLangContext';
import InstitutionBrandTheme from '@/components/InstitutionBrandTheme';
import '@/index.css';

// Simple Error Boundary for Auth Context failures
class ErrorBoundary extends React.Component<any, any> {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-4">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold mb-4 text-red-500">Something went wrong</h1>
            <p className="text-slate-400 mb-6">
              We encountered an unexpected error. Please try refreshing the page.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Refresh Page
            </button>
            <div className="mt-8 p-4 bg-slate-900 rounded text-left overflow-auto max-h-40 text-xs text-slate-500">
              {this.state.error?.toString()}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <PlatformThemeProvider>
            <PlatformLangProvider>
              <InstitutionBrandTheme />
              <DataProvider>
                <App />
                <Toaster />
              </DataProvider>
            </PlatformLangProvider>
          </PlatformThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </>
);