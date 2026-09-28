// Scenes that play partway along a road (see BeatDef in map-types.ts): the
// moments where the land is either what the map said or is not. They are queued
// by the route, never rolled from the road pool, so their weight is 0.
//
// `route:prepared` is 1 when the player's map warned them about what lies
// ahead, and 0 when it did not (or lied). Prepared trains do the work faster.
//
// These scenes have no hidden truth (no tells): the land is what it is. The
// spoken setup is the same whether or not the map warned you; the map's
// warning shows in the hours and the odds.

import type { Cond, Look, SceneDef } from "../types.ts";
import { fx, o, t } from "./fx.ts";

const PREPARED: Cond = { flag: "route:prepared", min: 1 };
const SURPRISED: Cond = { flag: "route:prepared", max: 0 };

const FERRYMAN_LOOK: Look = {
  build: "lean",
  height: "tall",
  age: 58,
  skin: "weathered brown, river-cracked at the knuckles",
  hair: { style: "shaggy", color: "grey, tied back with twine", facial: "long-beard" },
  clothing: ["an oilskin coat gone stiff and pale", "waders patched with tarred canvas", "a sodden felt hat"],
  palette: ["river brown", "oilskin grey", "rope hemp"],
  prop: { id: "ferry-rope", desc: "a wet hemp rope looped over one shoulder, worn shiny where it rides" },
  marks: ["rope scars across both palms", "counts under his breath"],
  summary: "A tall, lean ferryman in a pale oilskin coat and patched waders, a wet rope over his shoulder, standing on a flat barge.",
};

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
    talk: [
      { who: "actor", text: "This was Harrow. This was the whole of it.", mood: "grieving", alt: { stoic: "Harrow. Burned a while back. Ash is cold." } },
      { who: "other", text: "Then where is everybody?", mood: "afraid", alt: { pious: "God keep them, wherever they went." } },
      { who: "leader", text: "Nobody wanders off. We decide together.", mood: "calm" },
    ],
    options: [
      {
        id: "search",
        label: "Search the ruins for what the fire spared",
        hours: 3,
        hoursMod: { if: PREPARED, mult: 0.7 },
        results: {
          any: [
            t(o("A root cellar, sealed by its own collapsed floor. Jars, black with soot, and sound.", [fx.res("rations", [6, 12]), fx.res("ammo", [0, 4])], 4), [
              { who: "actor", text: "Jars! Under the floor. Still sealed.", mood: "calm", gesture: "beckon", alt: { greedy: "Mine. I found it. Count them first." } },
              { who: "leader", text: "Somebody planned to come back for these.", mood: "grieving" },
            ]),
            t(o("Ash and a child's shoe. You leave the shoe where it was.", [fx.nerve("all", -2)], 4), [
              { who: "actor", text: "It's small. So small.", mood: "grieving", gesture: "clutch", alt: { stoic: "Leave it. Leave it where it lies." } },
            ]),
            t(o("The ashes stir. Something that used to live here is not finished living.", [fx.combat("hollowed-single"), fx.nerve("all", -2)], 2, [{ if: SURPRISED, add: 2 }]), [
              { who: "other", text: "The ash. It's moving. Back away.", mood: "afraid", gesture: "raise-hands", alt: { coward: "Run! Get to the wagons! Run!" } },
            ]),
          ],
        },
      },
      {
        id: "well",
        label: "Draw water and move on within the hour",
        hours: 1,
        results: {
          any: [
            t(o("The water is cold and tastes of nothing. Nobody says what is in the well.", [fx.nerve("all", 1)], 4), [
              { who: "actor", text: "Cold. Clean. Don't look down.", mood: "calm", alt: { pious: "Cold water. Say a word for whoever is down there." } },
            ]),
            t(o("The bucket comes up with a wedding ring in it. {actor} pockets it without a word.", [fx.nerve("actor", -3)], 3), [
              { who: "other", text: "That's a ring. Put it back.", mood: "afraid" },
              { who: "actor", text: "No. Somebody should carry it.", mood: "grieving", gesture: "clutch" },
            ]),
          ],
        },
      },
      {
        id: "push",
        label: "Do not stop. Walk through the smoke",
        results: {
          any: [
            t(o("You pass the black timbers with the oxen leaning into their yokes. Nobody looks left.", [fx.nerve("all", -1)], 5, [{ if: PREPARED, add: 3 }]), [
              { who: "leader", text: "Eyes front. Keep the pace. Keep it steady.", mood: "cold" },
            ]),
            t(o("You had been counting on a village. The empty street takes something out of every one of you.", [fx.nerve("all", -5)], 4, [{ if: PREPARED, add: -4 }]), [
              { who: "other", text: "We needed that village. We needed it.", mood: "pleading", alt: { hothead: "The map said a village! The map lied!" } },
              { who: "leader", text: "Then we go on without it.", mood: "grieving" },
            ]),
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
    stranger: { name: "The ferryman", look: FERRYMAN_LOOK },
    talk: [
      { who: "stranger", text: "Twenty-five a crossing. Wagons dry. Oxen are extra worry.", mood: "cold", gesture: "point" },
      { who: "actor", text: "Twenty-five. For a rope and a raft?", mood: "angry", alt: { greedy: "Twenty-five! We could buy the river for that." } },
      { who: "other", text: "It's a long way down. And a long way round.", mood: "afraid" },
      { who: "leader", text: "Nobody talks price but one of us.", mood: "calm" },
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
            t(o("Three trips. He counts the coins twice, and says a thing you did not catch, and does not repeat it.", [fx.nerve("all", 1)], 6), [
              { who: "stranger", text: "Keep to the rope side. Don't look at the water after dark.", mood: "grieving", gesture: "turn-away" },
              { who: "actor", text: "What's in the water after dark?", mood: "afraid" },
            ]),
            t(o("He is honest. He is even kind, in his way. He gives you a string of dried fish for the oxen's trouble.", [fx.res("rations", [3, 6])], 2), [
              { who: "stranger", text: "Take these. Nobody's paid this fair in years.", mood: "calm", gesture: "offer" },
            ]),
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
        check: { kind: "haggle", dc: 11, target: "the ferryman" },
        results: {
          any: [
            t(o("{by} talks him down to a tenth of a sack of salt and a story. It costs a lot of words.", [fx.res("rations", [-3, -1])], 5), [
              { who: "by", text: "Salt and a story. You look like you need both.", mood: "sly", gesture: "offer" },
              { who: "stranger", text: "Salt. And I keep the story.", mood: "calm" },
            ], "success"),
            t(o("The ferryman laughs. The price goes up.", [fx.scrip(-40)], 2), [
              { who: "stranger", text: "Bargain? On my river? Forty.", mood: "cold" },
              { who: "by", text: "Forty. Fine. Forty.", mood: "angry", alt: { charming: "Forty. You drive a hard rope, friend." } },
            ], "fail"),
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
            t(o("The raft holds. The last wagon rides low, and you all stop breathing until it grounds.", [fx.repair(-6)], 5), [
              { who: "actor", text: "Hold it. Hold it. Hold it. Down!", mood: "afraid", gesture: "raise-hands" },
              { who: "stranger", text: "Fools. Lucky fools.", mood: "cold", gesture: "turn-away" },
            ]),
            t(o("The current takes a corner of the raft. A crate goes with it, and a man goes in after it.", [fx.res("rations", [-8, -3]), fx.hp("actor", [-9, -3]), fx.nerve("all", -3)], 3), [
              { who: "other", text: "He's under! Rope! Get him a rope!", mood: "afraid", gesture: "point" },
              { who: "actor", text: "Cold. God, it's cold. Pull!", mood: "afraid", alt: { stoic: "Pull. Just pull." } },
            ]),
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
    talk: [
      { who: "actor", text: "The bridge is gone. Where's the bridge?", mood: "afraid", alt: { stoic: "Bridge is out. We ford, or we go round." } },
      { who: "other", text: "Listen to those bells. Who rings them?", mood: "afraid", alt: { pious: "Bells over water. It sounds like a prayer." } },
      { who: "leader", text: "The river rings them. Nothing else. Come on.", mood: "cold" },
    ],
    options: [
      {
        id: "ford",
        label: "Ford the river below the wreck",
        hours: 2,
        results: {
          any: [
            t(o("Cold, brown, chest-deep on the oxen. Every wagon floats, and lands.", [fx.repair(-6), fx.res("rations", [-6, -2])], 6), [
              { who: "actor", text: "Steady. Steady. Easy on the yoke.", mood: "calm", gesture: "beckon" },
              { who: "other", text: "That's all of us. That's everyone.", mood: "grieving", alt: { coward: "I'm never doing that again. Never." } },
            ]),
            t(o("The river takes a wagon by the wheels, and does not give it back.", [fx.wagons(-1), fx.hp("actor", [-9, -4]), fx.nerve("all", -5)], 3, [{ if: SURPRISED, add: 1 }]), [
              { who: "actor", text: "It's going! Cut it loose! Cut it!", mood: "afraid", gesture: "raise-hands" },
              { who: "leader", text: "Let it go. Let it go. It's only wood.", mood: "grieving" },
            ]),
          ],
        },
      },
      {
        id: "survey",
        label: "Study the far bank before committing",
        hint: "Take an hour to find where the river is honest.",
        hours: 1,
        check: { kind: "spot", dc: 12, target: "the river" },
        results: {
          any: [
            t(o("{by} spots the line of the old ford: darker water, riffled, knee-deep. You cross on it.", [fx.repair(-2)], 1), [
              { who: "by", text: "There. The water's rippling. Somebody crossed there.", mood: "calm", gesture: "point" },
              { who: "other", text: "You are worth your weight in scrip.", mood: "calm" },
            ], "success"),
            t(o("{by} reads the water wrong. The bank gives way under the lead ox, and the river takes a while to let go.", [fx.repair(-8), fx.res("rations", [-6, -2]), fx.hp("by", [-6, -2]), fx.nerve("all", -2)], 1), [
              { who: "by", text: "That's shallow. I'm sure that's shallow. Oh, no.", mood: "afraid", gesture: "raise-hands" },
              { who: "leader", text: "Back. Everyone back from the edge.", mood: "afraid" },
            ], "fail"),
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
        results: {
          any: [
            t(o("A rickety span of planks and rope. It is not pretty. It is enough.", [], 1), [
              { who: "actor", text: "It's ugly. It'll hold. It'll hold.", mood: "calm", alt: { hothead: "If this goes, I'm blaming the river." } },
              { who: "leader", text: "One wagon at a time. Nobody hurries.", mood: "calm" },
            ]),
          ],
        },
      },
      {
        id: "round",
        label: "Go round by the upstream shallows",
        hint: "Long, wet and slow.",
        hours: 8,
        hoursMod: { if: PREPARED, mult: 0.75 },
        results: {
          any: [
            t(o("Reeds to the axle. You find the crossing at last, where the river spreads and forgets itself.", [fx.nerve("all", -1)], 5), [
              { who: "other", text: "There. It's wide there. It's slow.", mood: "calm", gesture: "point" },
              { who: "actor", text: "A day for a river. Fair trade.", mood: "calm", alt: { hothead: "A whole day. For a river. Unbelievable." } },
            ]),
            t(o("The shallows are full of Haze-touched hounds, drinking. They lift their heads.", [fx.combat("haze-hounds")], 2), [
              { who: "actor", text: "Hounds. Don't run. Don't run.", mood: "afraid", gesture: "draw-weapon", alt: { veteran: "Hounds. Form up. Slow and steady." } },
            ]),
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
    talk: [
      { who: "actor", text: "Smell that? Blankets. Somebody lives in there.", mood: "afraid", alt: { veteran: "That's a nest. I know a nest." } },
      { who: "other", text: "It's warm. Why is it warm?", mood: "afraid" },
      { who: "leader", text: "Quiet voices. We are not the only ones here.", mood: "cold" },
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
            t(o("Stone by stone. At the far side there is light, and dust in it, and nothing else.", [fx.hp("all", [-4, -1]), fx.nerve("all", -1)], 5), [
              { who: "actor", text: "Light. I can see light. Keep going.", mood: "calm", gesture: "beckon" },
            ]),
            t(o("The noise carries. Something in the hollow has been listening to you dig.", [fx.combat("hollowed-pack"), fx.nerve("all", -3)], 3, [{ if: SURPRISED, add: 1 }]), [
              { who: "other", text: "Stop. Stop digging. It heard us.", mood: "afraid", gesture: "raise-hands", alt: { coward: "We should never have touched the rock." } },
            ]),
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
            t(o("A goat track and a rope. The oxen scream the whole way. Nothing follows.", [fx.repair(-14), fx.nerve("all", -1)], 5), [
              { who: "actor", text: "Easy, girl. Easy. One more step.", mood: "calm", alt: { hothead: "Move, you stupid animal! Move!" } },
            ]),
            t(o("A wagon slips on the scree. It is not a fast death for the wagon, but the rest of you have to watch.", [fx.wagons(-1), fx.nerve("all", -5)], 2), [
              { who: "other", text: "The rope! It's gone! Let go!", mood: "afraid", gesture: "raise-hands" },
              { who: "leader", text: "Let it fall. Nobody goes after it.", mood: "grieving" },
            ]),
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
            t(o("The smoke rolls out of the hollow, and with it, things. You are ready for them.", [fx.nerve("all", 2)], 5), [
              { who: "actor", text: "Here they come. Let them come.", mood: "cold", gesture: "draw-weapon", alt: { coward: "Please let it burn. Please just burn." } },
            ]),
            t(o("The fire takes the old timbers. Half the tunnel comes down on the other half, and you are through, coughing.", [fx.hp("all", [-5, -1])], 3), [
              { who: "other", text: "Run! The roof! The roof is coming!", mood: "afraid", gesture: "point" },
              { who: "leader", text: "Out. Out. Everyone out, now.", mood: "afraid" },
            ]),
          ],
        },
      },
    ],
  },
];
