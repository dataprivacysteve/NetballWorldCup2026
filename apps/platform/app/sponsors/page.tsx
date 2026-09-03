import type { Metadata } from "next";
import SponsorDisplay from "./sponsor-client";

export const metadata: Metadata = {
  title: "Venue Partner Screen · Netball Americas",
  description: "Dedicated full-screen sponsor presentation for the second gymnasium display.",
};

export default function SponsorsPage() {
  return <SponsorDisplay />;
}
