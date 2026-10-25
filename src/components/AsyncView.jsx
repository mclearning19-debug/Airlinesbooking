// Shared loading / error-with-retry rendering for a useAsync result.
export default function AsyncView({ state, children }) {
  if (state.loading) return <p className="muted">Loading…</p>;
  if (state.error) {
    return (
      <div className="empty">
        <p className="error-banner">{state.error.message}</p>
        <button className="btn" onClick={state.reload}>Try again</button>
      </div>
    );
  }
  return children(state.data);
}
