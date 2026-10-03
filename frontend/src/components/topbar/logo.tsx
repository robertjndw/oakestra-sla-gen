export function Logo({ className }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" className={className}>
      <circle cx="5" cy="11" r="3" fill="currentColor" />
      <circle cx="17" cy="5" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17" cy="17" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10 L14 6.5 M8 12 L14 15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
