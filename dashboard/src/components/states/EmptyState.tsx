type EmptyStateProps = {
  title: string;
  message: string;
};

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <div className="state">
      <span className="h2">{title}</span>
      <p className="small">{message}</p>
    </div>
  );
}
