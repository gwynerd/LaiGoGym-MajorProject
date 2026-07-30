export default function ConnectedAppCard({ name, status, bgClass = "bg-white", statusClass = "text-green", children }) {
  return (
    <div className="app-item">
      <div className={`app-icon-box ${bgClass}`}>
        {children}
      </div>
      <strong className="app-name">{name}</strong>
      <span className={statusClass}>{status}</span>
    </div>
  );
}