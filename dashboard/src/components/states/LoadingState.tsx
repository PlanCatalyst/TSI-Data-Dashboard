type LoadingStateProps = {
  message?: string;
};

export function LoadingState({ message = "Loading dashboard data" }: LoadingStateProps) {
  return (
    <div className="state state--loading" role="status" aria-live="polite">
      <span className="h2">{message}</span>
      <div className="bar" aria-hidden="true" />
    </div>
  );
}
