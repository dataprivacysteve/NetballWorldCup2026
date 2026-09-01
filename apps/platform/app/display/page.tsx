import type { Metadata } from "next";
import LiveAudienceDisplay from "./display-client";

export const metadata: Metadata = {
  title: "Live audience display · GameDay",
  description: "Venue display driven by the authoritative GameDay broadcast feed.",
};

export default function DisplayPage() {
  return <LiveAudienceDisplay />;
}
