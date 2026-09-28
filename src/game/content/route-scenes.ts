// Scenes that play partway along a road (see BeatDef in map-types.ts): the
// moments where the land is either what the map said or is not. They are queued
// by the route, never rolled from the road pool, so their weight is 0.
//
// `route:prepared` is 1 when the player's map warned them about what lies
// ahead, and 0 when it did not (or lied). Prepared trains do the work faster.

import type { Cond, SceneDef } from "../types.ts";
import { fx, o } from "./fx.ts";

const PREPARED: Cond = { flag: "route:prepared", min: 1 };
const SURPRISED: Cond = { flag: "route:prepared", max: 0 };

export const ROUTE_SCENES: SceneDef[] = [
  {
    id: "route-harrow",
    kind: "landmark",
    weight: 0,
    title: "Harrow's End",
    intro: [
      "The village on the map is a chimney standing in a field of black timbers.",
      "The well is still here. Somebody has dropped things into it.",
    ],
    options: [
      {
        id: "search",
        label: "Search the ruins for what the fire spared",
        hours: 3,
        hoursMod: { if: PREPARED, mult: 0.7 },
        results: {
          any: [
            o("A root cellar, sealed by its own collapsed floor. Jars, black with soot, and sound.", [fx.res("rations", [6, 12]), fx.res("ammo", [0, 4])], 4),
            o("Ash and a child's shoe. You leave the shoe where it was.", [fx.nerve("all", -2)], 4),
            o("The ashes stir. Something that used to live here is not finished living.", [fx.combat("hollowed-single"), fx.nerve("all", -2)], 2, [{ if: SURPRISED, add: 2 }]),
          ],
        },
      },
      {
        id: "well",
        label: "Draw water and move on within the hour",
        hours: 1,
        results: {
          any: [
            o("The water is cold and tastes of nothing. Nobody says what is in the well.", [fx.nerve("all", 1)], 4),
            o("The bucket comes up with a wedding ring in it. {actor} pockets it without a word.", [fx.nerve("actor", -3)], 3),
          ],
        },
      },
      {
        id: "push",
        label: "Do not stop. Walk through the smoke",
        results: {
          any: [
            o("You pass the black timbers with the oxen leaning into their yokes. Nobody looks left.", [fx.nerve("all", -1)], 5, [{ if: PREPARED, add: 3 }]),
            o("You had been counting on a village. The empty street takes something out of every one of you.", [fx.nerve("all", -5)], 4, [{ if: PREPARED, add: -4 }]),
          ],
        },
      },
    ],
  },
  {
    id: "route-ferry",
    kind: "landmark",
    weight: 0,
    title: "The Ferryman's Bend",
    intro: [
      "A flat barge on a rope, and a man on it who has been alone for a long time.",
      "He watches the wagons the way a man watches weather.",
    ],
    options: [
      {
        id: "pay",
        label: "Pay the ferryman his price",
        hint: "25 scrip. Wagons across, dry.",
        hours: 1.5,
        cost: { scrip: 25 },
        results: {
          any: [
            o("Three trips. He counts the coins twice, and says a thing you did not catch, and does not repeat it.", [fx.nerve("all", 1)], 6),
            o("He is honest. He is even kind, in his way. He gives you a string of dried fish for the oxen's trouble.", [fx.res("rations", [3, 6])], 2),
          ],
        },
      },
      {
        id: "haggle",
        label: "Haggle with him",
        hint: "Your speaker takes the bank.",
        actor: { role: "speaker" },
        requires: [{ role: "speaker" }],
        why: "Nobody in the party is good with strangers.",
        hours: 2,
        results: {
          any: [
            o("{actor} talks him down to a tenth of a sack of salt and a story. It costs a lot of words.", [fx.res("rations", [-3, -1])], 5),
            o("The ferryman laughs. The price goes up.", [fx.scrip(-40)], 2),
          ],
        },
      },
      {
        id: "raft",
        label: "Lash a raft and cross it yourselves",
        hint: "Slow, and the river has opinions.",
        hours: 5,
        hoursMod: { if: { role: "mechanic" }, mult: 0.7 },
        results: {
          any: [
            o("The raft holds. The last wagon rides low, and you all stop breathing until it grounds.", [fx.repair(-6)], 5),
            o("The current takes a corner of the raft. A crate goes with it, and a man goes in after it.", [fx.res("rations", [-8, -3]), fx.hp("actor", [-9, -3]), fx.nerve("all", -3)], 3),
          ],
        },
      },
    ],
  },
  {
    id: "route-drowned-bridge",
    kind: "landmark",
    weight: 0,
    title: "The Drowned Bridge",
    intro: [
      "The road ends at a brown river. The bridge is in it, in three pieces.",
      "Bells hang from the broken rail on the far side, ringing over water that is moving faster than the bells.",
    ],
    options: [
      {
        id: "ford",
        label: "Ford the river below the wreck",
        hours: 2,
        results: {
          any: [
            o("Cold, brown, chest-deep on the oxen. Every wagon floats, and lands.", [fx.repair(-6), fx.res("rations", [-6, -2])], 6),
            o("The river takes a wagon by the wheels, and does not give it back.", [fx.wagons(-1), fx.hp("actor", [-9, -4]), fx.nerve("all", -5)], 3, [{ if: SURPRISED, add: 1 }]),
          ],
        },
      },
      {
        id: "plank",
        label: "Lay planks across the broken span",
        hint: "Costs 1 spare part.",
        hours: 5,
        hoursMod: { if: PREPARED, mult: 0.6 },
        cost: { spares: 1 },
        results: { any: [o("A rickety span of planks and rope. It is not pretty. It is enough.", [], 1)] },
      },
      {
        id: "round",
        label: "Go round by the upstream shallows",
        hint: "Long, wet and slow.",
        hours: 8,
        hoursMod: { if: PREPARED, mult: 0.75 },
        results: {
          any: [
            o("Reeds to the axle. You find the crossing at last, where the river spreads and forgets itself.", [fx.nerve("all", -1)], 5),
            o("The shallows are full of Haze-touched hounds, drinking. They lift their heads.", [fx.combat("haze-hounds")], 2),
          ],
        },
      },
    ],
  },
  {
    id: "route-tunnel",
    kind: "landmark",
    weight: 0,
    title: "Tunnel Three",
    intro: [
      "The rails run into the hill, and the hill has come down on them.",
      "There is a hollow at the top of the fall, dark and warm, and a smell of old blankets.",
    ],
    options: [
      {
        id: "dig",
        label: "Clear a passage through the fall",
        hint: "Hard, filthy work, and loud.",
        hours: 6,
        hoursMod: { if: PREPARED, mult: 0.65 },
        results: {
          any: [
            o("Stone by stone. At the far side there is light, and dust in it, and nothing else.", [fx.hp("all", [-4, -1]), fx.nerve("all", -1)], 5),
            o("The noise carries. Something in the hollow has been listening to you dig.", [fx.combat("hollowed-pack"), fx.nerve("all", -3)], 3, [{ if: SURPRISED, add: 1 }]),
          ],
        },
      },
      {
        id: "over",
        label: "Haul the wagons over the hill",
        hint: "Wear and sweat. Nothing waits at the top.",
        hours: 5,
        results: {
          any: [
            o("A goat track and a rope. The oxen scream the whole way. Nothing follows.", [fx.repair(-14), fx.nerve("all", -1)], 5),
            o("A wagon slips on the scree. It is not a fast death for the wagon, but the rest of you have to watch.", [fx.wagons(-1), fx.nerve("all", -5)], 2),
          ],
        },
      },
      {
        id: "torches",
        label: "Burn the hollow out",
        hint: "Costs 3 torches. Torches are what the dark understands.",
        hours: 3,
        cost: { torches: 3 },
        results: {
          any: [
            o("The smoke rolls out of the hollow, and with it, things. You are ready for them.", [fx.nerve("all", 2)], 5),
            o("The fire takes the old timbers. Half the tunnel comes down on the other half, and you are through, coughing.", [fx.hp("all", [-5, -1])], 3),
          ],
        },
      },
    ],
  },
];
