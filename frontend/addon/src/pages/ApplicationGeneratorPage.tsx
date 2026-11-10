import { useParams } from "react-router";
import ApplicationGenerator from "../generate/ApplicationGenerator";

export default function ApplicationGeneratorPage() {
  const { applicationId = "" } = useParams();
  // Keyed so moving to another application starts from that one's seed and session.
  return <ApplicationGenerator key={applicationId} applicationId={applicationId} layout="page" />;
}
