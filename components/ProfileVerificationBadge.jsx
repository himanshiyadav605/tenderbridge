import { VERIFICATION_LABELS, VERIFICATION_STYLES } from "../lib/profile-completion";

export default function ProfileVerificationBadge({ status, size = "normal" }) {
  const normalized = status && VERIFICATION_LABELS[status] ? status : "self_declared";
  const label = VERIFICATION_LABELS[normalized];
  const style = VERIFICATION_STYLES[normalized];

  const sizeClasses =
    size === "sm"
      ? "px-2 py-0.5 text-xs font-medium"
      : "px-2.5 py-1 text-xs font-semibold uppercase tracking-wider";

  return (
    <span
      className={`inline-flex items-center rounded-full border ${style} ${sizeClasses}`}
      title={`Verification Status: ${label}`}
    >
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}
