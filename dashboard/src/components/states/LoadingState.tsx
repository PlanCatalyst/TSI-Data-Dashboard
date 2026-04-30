type LoadingStateProps = {
  message?: string;
};

export function LoadingState({ message = "Loading dashboard data..." }: LoadingStateProps) {
  return <div className="state-card">{message}</div>;
}
