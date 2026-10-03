import { Component, type ReactNode } from "react";

interface Props {
  /** The SLA being drawn; a new one gets another try. */
  resetKey: unknown;
  children: ReactNode;
}

interface State {
  failedFor: unknown;
  failed: boolean;
}

// The Visual view reads hand-edited JSON that only has to parse, so a field with the wrong type
// (say "environment": "A=1") can throw while rendering. Without this boundary that unmounts the
// whole app and the conversation with it.
export class VisualBoundary extends Component<Props, State> {
  state: State = { failedFor: undefined, failed: false };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (state.failed && state.failedFor === undefined) return { failedFor: props.resetKey };
    if (state.failed && state.failedFor !== props.resetKey) return { failed: false, failedFor: undefined };
    return null;
  }

  render() {
    if (this.state.failed) {
      return (
        <p className="rounded-lg bg-rust-soft px-3 py-2 text-sm text-rust" role="status">
          This SLA can't be drawn because some fields have an unexpected shape. Fix it in the Code
          view.
        </p>
      );
    }
    return this.props.children;
  }
}
