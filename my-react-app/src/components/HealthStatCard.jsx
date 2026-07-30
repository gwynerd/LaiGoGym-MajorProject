export default function HealthStatCard({ icon: Icon, title, value, status, statusClass = "text-green" }) {
  return (
    <div className="health-card">
      <div className="card-header">
        <Icon size={16} /> {title}
      </div>
      <div className="card-value">{value}</div>
      <div className={statusClass}>{status}</div>
    </div>
  );
}