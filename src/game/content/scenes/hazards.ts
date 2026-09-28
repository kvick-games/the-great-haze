// Hazards: the road itself trying to kill you. No hidden truth: what you see is
// what you get, but every answer costs time, cargo, or blood.

import type { SceneDef } from "../../types.ts";
import { fx, o } from "../fx.ts";

export const HAZARDS: SceneDef[] = [
  {
    id: "axle-break",
    kind: "hazard",
    weight: 3,
    title: "A wagon breaks down",
    intro: [
      "With a crack like a rifle shot, an axle goes on the rear wagon. The oxen bawl and pull sideways in their traces.",
      "Everyone looks east before they look at the wheel.",
    ],
    options: [
      {
        id: "replace",
        label: "Fit a spare axle",
        hint: "The proper fix.",
        hours: 3,
        hoursMod: { if: { role: "mechanic" }, mult: 0.5 },
        cost: { spares: 1 },
        results: {
          any: [
            o("The new axle seats true. {actor} wipes their hands and does not look at the sky.", [fx.repair(22)], 4),
            o("It takes longer than it should. The axle is sound; the hands doing the work are shaking.", [fx.repair(20), fx.nerve("actor", -2), fx.hours(1)], 1),
          ],
        },
      },
      {
        id: "splint",
        label: "Splint it with rope and scrap",
        hint: "Cheap and fast. It may not hold.",
        hours: 1.5,
        hoursMod: { if: { role: "mechanic" }, mult: 0.7 },
        results: {
          any: [
            o("The splint holds. For now.", [fx.repair(6)], 5, [{ if: { role: "mechanic" }, add: 3 }]),
            o("The splint gives a mile on. You stop again, and this time it takes hours to fix.", [fx.repair(-8), fx.hours(3), fx.nerve("all", -2)], 4),
          ],
        },
      },
      {
        id: "abandon",
        label: "Abandon the wagon and redistribute the load",
        hint: "Fast. You will not be able to carry as much.",
        hours: 1,
        requires: [{ partyMin: 1 }],
        results: {
          any: [o("You unhitch the oxen, split the cargo across the other wagons, and leave the broken one to the Haze.", [fx.wagons(-1), fx.nerve("all", -3)])],
        },
      },
    ],
  },
  {
    id: "swollen-creek",
    kind: "hazard",
    regions: ["tallow", "fen", "pines", "threshold"],
    weight: 5,
    title: "A swollen creek",
    intro: [
      "The road runs into black, fast water. The bridge is a memory. Somebody's shoe is stuck in the reeds.",
      "There is no telling how deep it is.",
    ],
    options: [
      {
        id: "drive",
        label: "Drive the wagons straight across",
        hours: 0.5,
        results: {
          any: [
            o("The oxen lean into the current. You come out the far side soaked, and moving.", [fx.repair(-4)], 6),
            o("A wagon slews on the far bank. Sacks go into the water, and are gone.", [fx.res("rations", [-12, -6]), fx.repair(-8), fx.hours(1)], 3),
            o("A wheel drops into a hole. The wagon goes over. {actor} is pinned for a long, cold minute.", [fx.res("rations", [-16, -8]), fx.hp("actor", [-14, -7]), fx.repair(-18), fx.hours(2)], 1.2),
          ],
        },
      },
      {
        id: "float",
        label: "Unload, rope the wagons across, and carry the cargo",
        hint: "The careful way.",
        hours: 4,
        hoursMod: { if: { role: "mechanic" }, mult: 0.75 },
        results: {
          any: [
            o("It takes all afternoon and everyone's skin. But nothing is lost.", [fx.nerve("all", -1)], 8),
            o("A rope parts. A crate drifts off, and you let it.", [fx.res("rations", [-4, -2])], 2),
          ],
        },
      },
      {
        id: "upstream",
        label: "Follow the creek upstream for a real crossing",
        hint: "Long. Out of the way.",
        hours: 6,
        results: {
          any: [
            o("A stone weir, mostly intact. You cross it one wagon at a time.", [], 7),
            o("You find the weir, and something sitting on it, facing the water. It stands up.", [fx.combat("hollowed-single")], 3),
          ],
        },
      },
    ],
  },
  {
    id: "sinkhole-road",
    kind: "hazard",
    regions: ["tallow", "fen", "flats", "pines"],
    weight: 3,
    title: "The road has fallen in",
    intro: [
      "Twenty yards ahead the road drops into the earth, edges crumbled, the hole disappearing into darkness with a faint warm wind coming out of it.",
    ],
    options: [
      {
        id: "edge",
        label: "Skirt the rim, one wagon at a time",
        hours: 1.5,
        results: {
          any: [
            o("The ground holds. Barely. No one speaks until it is behind you.", [fx.nerve("all", -1)], 6),
            o("The rim crumbles under a rear wheel. The wagon tilts. You get it back, but not without cost.", [fx.repair(-14), fx.hp("actor", [-9, -4]), fx.nerve("all", -2)], 3),
          ],
        },
      },
      {
        id: "detour",
        label: "Cut a wide detour through the brush",
        hint: "Slow, but safe.",
        hours: 4,
        results: { any: [o("You hack a road through the scrub. Hours of it. But solid ground.", [], 1)] },
      },
    ],
  },
  {
    id: "ash-squall",
    kind: "hazard",
    weight: 4,
    closeBias: 1.6,
    title: "The sky sheds ash",
    intro: [
      "A gray-red curtain sweeps across the road. It is not rain. Where it touches the oxen's hides it leaves a rust-colored dust.",
      "Everyone is coughing. The wind is carrying it into their lungs.",
    ],
    options: [
      {
        id: "veils",
        label: "Fit haze veils and drive through",
        hint: "Needs a veil for most of the party.",
        hours: 0.5,
        requires: [{ res: "veils", min: 3 }],
        why: "Not enough veils.",
        results: { any: [o("The veils turn the air to vinegar and wet linen, but you keep breathing. The squall passes.", [fx.nerve("all", -1)], 1)] },
      },
      {
        id: "shelter",
        label: "Hunker down and wait it out",
        hours: 4,
        results: {
          any: [
            o("Four hours under canvas, with the wind screaming. Then it passes as if it never was.", [fx.nerve("all", -1)], 8),
            o("It lasts longer than that. Someone has stopped coughing in a way that worries you.", [fx.sick("actor"), fx.hours(2)], 2),
          ],
        },
      },
      {
        id: "blind",
        label: "Drive blind and pray",
        results: {
          any: [
            o("You cannot see the oxen's heads. You cannot see anything. But the road holds, and so do they.", [fx.nerve("all", -3), fx.repair(-6)], 4),
            o("The wagons drift off the road. It takes hours to find it again, and a hand is torn on a splintered wheel.", [fx.hours(3), fx.hp("actor", [-9, -5]), fx.nerve("all", -3), fx.sick("random")], 3),
          ],
        },
      },
    ],
  },
  {
    id: "spoiled-stores",
    kind: "hazard",
    weight: 3,
    title: "The damp has got into the stores",
    intro: [
      "A sack splits when it is lifted, and a stink rolls out. Under the canvas, the rations have gone black and soft along one side.",
    ],
    options: [
      {
        id: "cull",
        label: "Sort through and cull the rot",
        hours: 1,
        results: { any: [o("You throw out what has turned. It is a lot.", [fx.res("rations", [-12, -5])], 1)] },
      },
      {
        id: "eat",
        label: "Eat it anyway. Waste nothing.",
        hint: "Nobody will thank you for this one.",
        results: {
          any: [
            o("It is foul, and tastes of copper. But everyone keeps it down.", [fx.nerve("all", -2)], 6),
            o("It was foul for a reason. By dusk three people are clutching their stomachs.", [fx.sick("two"), fx.sick("random"), fx.nerve("all", -3)], 5),
          ],
        },
      },
      {
        id: "forage",
        label: "Have {actor} forage to make up the loss",
        hint: "Best done by a hunter.",
        hours: 3,
        actor: { role: "hunter" },
        requires: [{ role: "hunter" }],
        why: "Nobody here can hunt.",
        cost: { ammo: 3 },
        results: {
          any: [
            o("{actor} comes back with two hares and a fistful of sour berries. It is enough.", [fx.res("rations", [8, 14])], 6),
            o("{actor} comes back with nothing, and a look that says the woods are wrong.", [fx.nerve("actor", -4)], 3),
          ],
        },
      },
    ],
  },
  {
    id: "fever",
    kind: "hazard",
    weight: 4,
    title: "A fever in the train",
    intro: ["{actor} wakes drenched in sweat, shaking, eyes glassy. Two others are watching them and keeping their distance."],
    options: [
      {
        id: "physic",
        label: "Treat {actor} at once",
        hours: 1,
        hoursMod: { if: { role: "medic" }, mult: 0.5 },
        cost: { medicine: 1 },
        results: { any: [o("It breaks before dawn. They will live, and will be angry about it.", [fx.cureSick("actor")], 1)] },
      },
      {
        id: "isolate",
        label: "Quarantine them in the last wagon",
        hint: "Slows the spread. Doesn't stop the fever.",
        hours: 1.5,
        results: {
          any: [
            o("The wagon is quiet. The fever runs its course.", [fx.sick("actor"), fx.hp("actor", -4)], 6),
            o("It runs its course. Not everyone is convinced the wall between them is thick enough.", [fx.sick("actor"), fx.nerve("all", -2)], 3),
          ],
        },
      },
      {
        id: "ignore",
        label: "Push on. No time to nurse anyone.",
        results: {
          any: [
            o("They ride, sweating, and eat little. Nothing changes.", [fx.sick("actor")], 4),
            o("The fever runs through the whole wagon. By dusk two more are down.", [fx.sick("actor"), fx.sick("two"), fx.nerve("all", -2)], 4),
          ],
        },
      },
    ],
  },
  {
    id: "oxen-balk",
    kind: "hazard",
    weight: 4,
    closeBias: 2,
    title: "The oxen will not move",
    intro: [
      "The lead ox stops in the road, and then all of them stop, and they turn their broad heads together to look east.",
      "They are trembling. They will not go on.",
    ],
    options: [
      {
        id: "wait",
        label: "Wait for them to calm",
        hours: 2,
        results: { any: [o("After a long time, one by one, they lower their heads. You go on.", [fx.nerve("all", -2)], 1)] },
      },
      {
        id: "goad",
        label: "Goad them forward",
        results: {
          any: [
            o("Whips and shouting. They lurch forward, wild-eyed, and drag the wagons on.", [fx.nerve("all", -2), fx.repair(-5)], 6),
            o("They bolt. One wagon jackknifes into a ditch; {actor} is thrown clear, badly.", [fx.repair(-16), fx.hp("actor", [-13, -6]), fx.hours(2)], 3),
          ],
        },
      },
      {
        id: "fire",
        label: "Light torches to lead them",
        hint: "Oxen trust fire. Mostly.",
        hours: 0.5,
        cost: { torches: 2 },
        results: {
          any: [
            o("They follow the fire the way they followed it in the old world. It works.", [], 1),
          ],
        },
      },
    ],
  },
  {
    id: "rockfall",
    kind: "hazard",
    regions: ["spine"],
    weight: 6,
    title: "Rockfall",
    intro: ["Scree slides down onto the switchback, big slabs of it, still rattling. The road is buried under thirty feet of broken stone."],
    options: [
      {
        id: "clear",
        label: "Clear a lane by hand",
        hint: "Everyone works. It is slow.",
        hours: 4,
        hoursMod: { if: { role: "mechanic" }, mult: 0.75 },
        results: {
          any: [
            o("You pry and drag rocks until your hands are bloody. It is enough.", [fx.hp("all", -2), fx.nerve("all", -1)], 7),
            o("More comes down while you work. {actor} is caught by it.", [fx.hp("actor", [-13, -6]), fx.hours(1)], 3),
          ],
        },
      },
      {
        id: "squeeze",
        label: "Squeeze the wagons through the gap",
        hours: 1,
        results: {
          any: [
            o("The wheels scream against stone. The wagons scrape through with inches to spare.", [fx.repair(-12)], 5),
            o("A wagon jams. The axle tears half off; you drag it free.", [fx.repair(-24), fx.hours(2)], 3),
          ],
        },
      },
    ],
  },
  {
    id: "rotted-trestle",
    kind: "hazard",
    regions: ["tallow", "fen", "pines"],
    weight: 3,
    title: "A rotted trestle",
    intro: ["A wooden trestle carries the road across a gorge. Half the planks are gone. The rest are gray as bone."],
    options: [
      {
        id: "rush",
        label: "Cross all at once, quickly",
        hours: 0.5,
        results: {
          any: [
            o("The old timbers groan and hold. You do not breathe until the last wheel is across.", [fx.nerve("all", -2)], 6),
            o("A plank gives. The rear wagon drops, dangling, and you cut it loose before it takes the others.", [fx.wagons(-1), fx.nerve("all", -5)], 2),
          ],
        },
      },
      {
        id: "single",
        label: "Cross one wagon at a time, unloaded",
        hint: "Slow. Careful.",
        hours: 3,
        results: { any: [o("It takes all afternoon. But you cross safely, and the trestle bows behind you.", [], 9), o("A rope snaps. A crate is lost to the gorge.", [fx.res("rations", [-6, -3])], 2)] },
      },
    ],
  },
  {
    id: "cold-night",
    kind: "hazard",
    regions: ["spine", "pines", "threshold"],
    weight: 4,
    title: "A killing cold",
    intro: ["The temperature drops as if a door has opened on winter. The oxen steam. Fingers go white."],
    options: [
      {
        id: "burn",
        label: "Burn extra torches for warmth",
        cost: { torches: 3 },
        results: { any: [o("Fire ringed round the wagons. It's a costly night, but a warm one.", [fx.nerve("all", 1)], 1)] },
      },
      {
        id: "huddle",
        label: "Huddle together under every blanket",
        hours: 3,
        results: { any: [o("No one sleeps. But you all wake alive, and a little closer.", [fx.bondAll(3)], 1)] },
      },
      {
        id: "push",
        label: "Keep moving to stay warm",
        results: {
          any: [
            o("Blue lips and stiff hands. But you go on.", [fx.hp("all", -3)], 5),
            o("The cold takes two of them badly.", [fx.hp("two", [-9, -5]), fx.sick("random"), fx.nerve("all", -2)], 3),
          ],
        },
      },
    ],
  },
  {
    id: "mud-road",
    kind: "hazard",
    regions: ["tallow", "fen", "pines"],
    weight: 4,
    title: "Bottomless mud",
    intro: ["The road has turned to stew. A wheel is already buried to the hub. The oxen strain and slip."],
    options: [
      {
        id: "dig",
        label: "Dig the wheels out and lay brush",
        hours: 3,
        results: { any: [o("A wretched hour of digging, then another, then it gives.", [fx.hp("all", -1)], 1)] },
      },
      {
        id: "lighten",
        label: "Dump 12 rations off the wagons to lighten them",
        hint: "Fast. Awful.",
        hours: 0.5,
        cost: { rations: 12 },
        results: { any: [o("The wagons rise out of the muck. You do not look at what you left behind.", [fx.nerve("all", -2)], 1)] },
      },
    ],
  },
];
