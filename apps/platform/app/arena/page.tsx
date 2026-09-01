import type { Metadata } from "next";
import ArenaHoldingDisplay from "./arena-client";

export const metadata: Metadata = {
  title: "Arena Championship Hub · Netball Americas",
  description:
    "In-venue standings, upcoming match and partner display for the Americas Regional Qualifier.",
};

export default function ArenaPage() {
  return <ArenaHoldingDisplay />;
}
