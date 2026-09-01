import { notFound } from "next/navigation";
import GameDayCaptureDemo from "./demo-client";

export default function GameDayDemoPage() {
  // This route is deliberately unavailable in production until the capture
  // workflow has completed local/UAT acceptance and is wired to named roles.
  if (process.env.NODE_ENV !== "development") notFound();

  return <GameDayCaptureDemo />;
}
