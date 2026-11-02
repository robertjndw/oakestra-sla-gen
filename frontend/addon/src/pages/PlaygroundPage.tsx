import { DeployButton } from "../deploy/DeployButton";
import { ensureApiBase } from "../ensure-api-base";
import { DashboardHost } from "../host/DashboardHost";
import { PlaygroundFrame } from "../layout/PlaygroundFrame";

ensureApiBase();

export default function PlaygroundPage() {
  return (
    <DashboardHost scope="page" Actions={DeployButton}>
      <PlaygroundFrame size="fill" />
    </DashboardHost>
  );
}
