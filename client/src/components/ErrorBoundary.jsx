import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error(error);
  }

  render() {
    if (this.state.failed)
      return (
        <main className="wrap">
          <p className="empty">Something went wrong. Please refresh the page.</p>
        </main>
      );
    return this.props.children;
  }
}