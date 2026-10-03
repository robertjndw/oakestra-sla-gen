import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

interface Props {
  turnRunning: boolean;
  hasSession: boolean;
}

function copyFor({ turnRunning, hasSession }: Props): { title: string; text: string } {
  if (turnRunning) {
    return {
      title: "Working on a draft",
      text: "The model writes the SLA, then it's validated and retried if needed. It appears here once it passes.",
    };
  }
  if (hasSession) {
    return {
      title: "No draft yet",
      text: "Answer the questions on the left so the model has enough to go on.",
    };
  }
  return {
    title: "Your SLA shows up here",
    text: "Visual shows the services and how they connect. Code is the SLA JSON, which you can edit, validate and download.",
  };
}

export function EmptyOutput(props: Props) {
  const { title, text } = copyFor(props);
  return (
    <Empty className="my-auto">
      <EmptyHeader>
        <EmptyMedia className="text-border">
          <svg width="120" height="64" viewBox="0 0 120 64" aria-hidden="true">
            <rect x="2" y="22" width="30" height="20" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
            <rect x="72" y="4" width="46" height="22" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
            <rect x="72" y="38" width="46" height="22" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path
              d="M32 30 C 52 30, 52 15, 72 15 M32 34 C 52 34, 52 49, 72 49"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{text}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
