export default function InsightRow({ icon: Icon, title, description, showDivider = true }) {
  return (
    <>
      <div className="insight-row">
        <Icon size={24} className="insight-icon" />
        <div className="insight-text-container">
          <strong className="insight-title">{title}</strong>
          <p className="insight-desc">{description}</p>
        </div>
      </div>
      {showDivider && <hr className="divider" />}
    </>
  );
}