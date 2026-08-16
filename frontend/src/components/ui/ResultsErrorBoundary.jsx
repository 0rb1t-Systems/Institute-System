import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

class ResultsErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ResultsErrorBoundary caught an error:", error, errorInfo);
  }

  handleRefresh = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRefresh) {
      this.props.onRefresh();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-12 bg-slate-900 border border-slate-800 rounded-xl my-4">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-xl font-semibold text-slate-200 mb-2">Unable to load results.</h3>
          <p className="text-slate-400 mb-6 text-center max-w-md">
            There was an error while loading the examination results. Please refresh the page to try again.
          </p>
          <Button 
            onClick={this.handleRefresh}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Manual Refresh
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ResultsErrorBoundary;