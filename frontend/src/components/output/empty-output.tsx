import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

interface Props {
  turnRunning: boolean;
  hasSession: boolean;
}

function copyFor({ turnRunning, hasSession }: Props): { title: string; text: string } {
  if (turnRunning) {
    return {
      title: "Working on a draft",
      text: "Each attempt is validated and retried if it fails. The SLA appears here once one passes.",
    };
  }
  if (hasSession) {
    return {
      title: "No draft yet",
      text: "Answer the questions on the left so the model has enough to go on.",
    };
  }
  return {
    title: "No SLA yet",
    text: "Describe a deployment to start. Visual shows its services and how they connect. Code shows the JSON.",
  };
}

export function EmptyOutput(props: Props) {
  const { title, text } = copyFor(props);
  return (
    <Empty className="my-auto">
      <EmptyHeader>
        <EmptyTitle className="text-base">{title}</EmptyTitle>
        <EmptyDescription>{text}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
