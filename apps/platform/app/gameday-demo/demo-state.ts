export const DEMO_STATE_KEY = "gameday.capture-demo.state.v1";
export const DEMO_CHANNEL = "gameday-capture-demo";

export type PublicDemoState = {
  status: "live" | "final";
  quarter: number;
  clock: number;
  scores: { home: number; away: number };
  centrePass: "home" | "away";
  lastPlay: string;
  updatedAt: number;
};

export const initialPublicDemoState: PublicDemoState = {
  status: "live",
  quarter: 1,
  clock: 900,
  scores: { home: 0, away: 0 },
  centrePass: "home",
  lastPlay: "Awaiting first event",
  updatedAt: 0,
};
