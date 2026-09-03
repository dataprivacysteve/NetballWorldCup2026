import type { Metadata } from "next";
import ArenaHoldingDisplay from "./arena-client";

export const metadata: Metadata = {
  title: "Arena Championship Hub · Netball Americas",
  description:
    "Long-distance-readable standings and match information for the gymnasium data screen.",
};

export default function ArenaPage() {
  return <ArenaHoldingDisplay />;
}

