import type { SceneDef } from "../../types.ts";
import { HAZARDS } from "./hazards.ts";
import { STRANGERS } from "./strangers.ts";
import { FINDS, HAZE_EVENTS, ODDITIES, RESPITES } from "./finds.ts";
import { QUARRELS, CRISES } from "./people.ts";
import { LANDMARK_SCENES } from "./landmarks.ts";

export const SCENES: SceneDef[] = [
  ...HAZARDS,
  ...STRANGERS,
  ...FINDS,
  ...HAZE_EVENTS,
  ...ODDITIES,
  ...RESPITES,
  ...QUARRELS,
  ...CRISES,
  ...LANDMARK_SCENES,
];

const BY_ID = new Map<string, SceneDef>(SCENES.map((s) => [s.id, s]));

export function sceneById(id: string): SceneDef | undefined {
  return BY_ID.get(id);
}
