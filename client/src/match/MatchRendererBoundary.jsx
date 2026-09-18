import React from "react";

export default class MatchRendererBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.props.onFailure?.(error, info);
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="production-match-experience-error" role="alert">
          <strong>The match screen needs to restart.</strong>
          <p>Your match is still on the server.</p>
          <button type="button" onClick={() => this.setState({ error: null })}>Retry match screen</button>
          {this.props.onLeaveMatch && <button type="button" onClick={this.props.onLeaveMatch}>Return to menu</button>}
        </div>
      );
    }
    return this.props.children;
  }
}
