import type { Metadata } from "next";
import GymDisplayRouter from "./gym-client";

export const metadata: Metadata = {
  title: "Gymnasium Screen · Netball Americas",
  description: "Remotely controlled match-data output for the gymnasium screen above X.",
};

export default function GymPage() {
  return <GymDisplayRouter />;
}

