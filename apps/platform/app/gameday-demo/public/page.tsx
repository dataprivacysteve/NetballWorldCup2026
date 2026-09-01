import { notFound } from "next/navigation";
import AudienceScreen from "./public-client";

export default function GameDayAudiencePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <AudienceScreen />;
}
