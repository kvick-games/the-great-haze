import type { SceneDef } from "../../types.ts";
import { HAZARDS } from "./hazards.ts";
import { STRANGERS } from "./strangers.ts";
import { FINDS, HAZE_EVENTS, ODDITIES, RESPITES } from "./finds.ts";
import { QUARRELS, CRISES } from "./people.ts";
import { LANDMARK_SCENES } from "./landmarks.ts";
import { ROUTE_SCENES } from "../route-scenes.ts";
import { COMPANION_SCENES } from "./companions.ts";
import { ROMANCE_SCENES } from "./romance.ts";
import { AFFAIR_SCENES } from "./affairs.ts";
import { BOND_SCENES } from "./bonds.ts";
import { WITCH_SCENES } from "./witch.ts";

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
  ...ROUTE_SCENES,
  ...COMPANION_SCENES,
  ...ROMANCE_SCENES,
  ...AFFAIR_SCENES,
  ...BOND_SCENES,
  ...WITCH_SCENES,
];

const BY_ID = new Map<string, SceneDef>(SCENES.map((s) => [s.id, s]));

export function sceneById(id: string): SceneDef | undefined {
  return BY_ID.get(id);
}
