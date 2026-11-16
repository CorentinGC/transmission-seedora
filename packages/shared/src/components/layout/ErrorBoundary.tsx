import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorFallback } from './ErrorFallback';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render errors in its subtree and shows a recoverable screen instead
 * of a blank window. Shared by the Electron renderer and the web app.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Render error caught by ErrorBoundary', error, info.componentStack);
  }

  private retry = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) return <ErrorFallback onRetry={this.retry} />;
    return this.props.children;
  }
}
