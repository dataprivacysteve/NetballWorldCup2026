import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GameDay Venue Operations",
    short_name: "GameDay",
    description: "Offline-tolerant Netball Americas venue operations",
    start_url: "/scan",
    display: "standalone",
    background_color: "#f7f3ea",
    theme_color: "#11183d",
  };
}
