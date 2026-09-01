import type { Metadata } from "next";
import MatchLineupDisplay from "./lineup-client";

export const metadata: Metadata = {
  title: "Starting Lineups · Netball Americas",
  description: "In-venue starting-position matchup presentation.",
};

export default function LineupPage() {
  return <MatchLineupDisplay />;
}
