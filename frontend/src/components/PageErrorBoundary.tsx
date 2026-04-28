import { Component, ErrorInfo, ReactNode } from 'react';
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react';

interface Props {
  children: ReactNode;
  pageName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Page-level error boundary. Catches errors within a single page
 * without crashing the entire app (sidebar, navigation, etc. remain functional).
 * 
 * Usage: Wraps each <Route> component inside <Layout>.
 */
export default class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error(`[PageErrorBoundary] ${this.props.pageName || 'Unknown page'}:`, error, errorInfo);
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 animate-fade-in">
          <div className="max-w-md w-full text-center">
            <div className="mx-auto h-16 w-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mb-6">
              <IconAlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {this.props.pageName ? `${this.props.pageName} Error` : 'Page Error'}
            </h2>
            
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Something went wrong loading this page. The rest of the app is still working.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-left">
                <p className="text-xs font-mono text-red-700 dark:text-red-300 break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white text-sm font-bold rounded-xl hover:bg-primary-700 transition-all shadow-lg shadow-primary-500/20"
            >
              <IconRefresh className="h-4 w-4" />
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
