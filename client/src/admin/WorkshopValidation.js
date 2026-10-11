export default function WorkshopValidation({ validation, domain, id, field, guide }) {
  const messages = [...validation.errors.map((entry) => ({ ...entry, severity: "Error" })), ...validation.warnings.map((entry) => ({ ...entry, severity: "Warning" }))]
    .filter((entry) => !domain || (entry.domain === domain && entry.id === id && (!field || entry.field === field)));
  if (!messages.length) return domain ? null : <p className="admin-good">{guide.validationPassed}</p>;
  return <ul className="admin-alert">{messages.map((entry, index) => <li key={index}><strong>{entry.severity}</strong> · {!domain && [entry.domain, entry.id, entry.field].filter(Boolean).join(" / ")} {entry.message}</li>)}</ul>;
}
