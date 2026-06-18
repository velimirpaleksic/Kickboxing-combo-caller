export default function ComboStepBox({ number, label, index = 0 }) {
  return (
    <div className="combo-step" style={{ '--step-delay': `${index * 45}ms` }}>
      <div className="combo-step-number" aria-hidden="true">
        {number}
      </div>
      <div className="combo-step-label">{label}</div>
    </div>
  );
}
