import { Component, type ErrorInfo, type ReactNode } from "react";
import { logger } from "../lib/logger";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error("ErrorBoundary caught", error.message, info.componentStack);
  }

  handleReset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 px-6 text-center text-slate-100">
        <h1 className="text-2xl font-semibold">Etwas ist schiefgelaufen</h1>
        <p className="max-w-sm text-sm text-slate-400">
          Die App hat einen unerwarteten Fehler gemeldet. Versuche es erneut oder lade die
          Seite neu.
        </p>
        <button
          type="button"
          onClick={this.handleReset}
          className="rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-900"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }
}
