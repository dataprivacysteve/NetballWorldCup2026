import type { Metadata } from "next";
import GymDisplayRouter from "./gym-client";

export const metadata: Metadata = {
  title: "Gymnasium Screen · Netball Americas",
  description: "Remotely controlled arena and live-score projector output.",
};

export default function GymPage() {
  return <GymDisplayRouter />;
}
