import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MESSAGES } from '@/lib/messages';
import { logError } from '@/lib/errorHandler';

class ErrorBoundary extends React.Component<any, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    logError('ErrorBoundary', error, { componentStack: errorInfo?.componentStack });
  }

  handleRetry = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
          <Card className="w-full max-w-md bg-slate-900 border-red-900/50">
            <CardHeader>
              <div className="flex items-center gap-2 text-red-500 mb-2">
                <AlertTriangle className="h-6 w-6" />
                <CardTitle>{MESSAGES.UNEXPECTED.title}</CardTitle>
              </div>
              <CardDescription className="text-slate-400">
                {MESSAGES.UNEXPECTED.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Button onClick={this.handleRetry} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                  <RefreshCw className="mr-2 h-4 w-4" /> Reload Page
                </Button>
                <Button onClick={this.handleGoHome} variant="outline" className="flex-1 border-slate-700 hover:bg-slate-800 text-white">
                  <Home className="mr-2 h-4 w-4" /> Go Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
