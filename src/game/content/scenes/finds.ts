// Finds: scavenging opportunities. No hidden truth, but every one is a bet
// between what you might gain and the hours (and blood) it takes.

import type { SceneDef } from "../../types.ts";
import { fx, o } from "../fx.ts";

export const FINDS: SceneDef[] = [
  {
    id: "ruined-farmhouse",
    kind: "find",
    regions: ["tallow", "fen", "pines", "threshold"],
    weight: 6,
    title: "A ruined farmhouse",
    intro: [
      "A farmhouse stands back from the road, front door open, curtains moving. The barn behind it has fallen in. Whoever lived here left in a hurry, or did not leave.",
    ],
    options: [
      {
        id: "search-all",
        label: "Search it top to bottom",
        hint: "Best odds. Longest time.",
        hours: 3,
        results: {
          any: [
            o("A cellar full of jars, a locked chest, and a rifle under a floorboard. It is a good haul.", [fx.res("rations", [8, 16]), fx.scrip([10, 35]), fx.res("ammo", [3, 8])], 5),
            o("Slim pickings, but food is food.", [fx.res("rations", [3, 7])], 5),
            o("You find the family. They are all in the kitchen, at the table. They turn their heads together.", [fx.combat("hollowed-single"), fx.nerve("all", -3)], 2),
            o("The upstairs floor gives way. {actor} goes through it.", [fx.hp("actor", [-12, -5]), fx.res("rations", [2, 6])], 2),
          ],
        },
      },
      {
        id: "search-quick",
        label: "Send {actor} in for what they can grab",
        hours: 1,
        results: {
          any: [
            o("{actor} is back in twenty minutes with a sack of flour and something in their pocket they do not talk about.", [fx.res("rations", [2, 6])], 5),
            o("{actor} comes out empty-handed and a little pale. They will not say what was in the house.", [fx.nerve("actor", -4)], 3),
            o("There is a scream, and then there is a fight, and then it is over. {actor} is bleeding but alive.", [fx.hp("actor", [-10, -4]), fx.combat("hollowed-single")], 1.5),
          ],
        },
      },
      { id: "leave", label: "Leave it alone", results: { any: [o("You do not stop. It is probably nothing. It is always probably nothing.", [], 1)] } },
    ],
  },
  {
    id: "company-cache",
    kind: "find",
    weight: 3,
    title: "A Company cache",
    intro: ["A Company depot marker stands beside a chained hatch in the ground: MERIDIAN CO. — EMERGENCY STORES — DO NOT REMOVE."],
    options: [
      {
        id: "force",
        label: "Force the chain",
        hours: 1,
        results: {
          any: [
            o("The chain gives. Below: rations, powder, and even a case of physic.", [fx.res("rations", [8, 16]), fx.res("ammo", [4, 10]), fx.res("medicine", [1, 2])], 5),
            o("The hatch is booby-trapped. A charge goes off in {actor}'s face.", [fx.hp("actor", [-13, -6]), fx.res("rations", [3, 6])], 3),
            o("It is empty except for a message scratched on the floor: 'THEY LOOTED IT FIRST.'", [fx.nerve("all", -1)], 2),
          ],
        },
      },
      {
        id: "pick",
        label: "Pick the lock carefully",
        hours: 1.5,
        actor: { role: "mechanic" },
        requires: [{ role: "mechanic" }],
        why: "You need a mechanic for this.",
        results: {
          any: [
            o("{actor} works the lock with a length of wire. It swings open. The stores are all there.", [fx.res("rations", [10, 18]), fx.res("ammo", [4, 10]), fx.res("medicine", [1, 3]), fx.res("spares", [0, 1])], 8),
            o("The lock opens. The stores inside are half spoiled.", [fx.res("rations", [4, 8])], 2),
          ],
        },
      },
      { id: "leave", label: "Leave it", results: { any: [o("Nothing is worth an hour. You keep moving.", [], 1)] } },
    ],
  },
  {
    id: "fresh-graves",
    kind: "find",
    weight: 3,
    title: "A row of graves",
    intro: [
      "A row of fresh graves beside the road. Each has a marker. Each has, buried shallow, a corner of something showing: a trunk, a bag, a boot with a coin in it.",
    ],
    options: [
      {
        id: "dig",
        label: "Dig up the belongings",
        hint: "The dead do not need them.",
        hours: 2,
        results: {
          any: [
            o("A bag of powder, a purse, a tin of biscuits, a ring. It is a good haul. It is also graves.", [fx.scrip([20, 55]), fx.res("ammo", [4, 8]), fx.res("rations", [2, 6]), fx.nerve("all", -3), fx.nerve({ trait: "kind" }, -3), fx.nerve({ trait: "pious" }, -4), fx.trust({ trait: "pious" }, -5)], 1),
          ],
        },
      },
      {
        id: "pray",
        label: "Say a prayer and move on",
        hours: 1,
        results: { any: [o("Not much to it. But something in the party settles.", [fx.nerve("all", 3), fx.nerve({ trait: "pious" }, 3), fx.bondAll(1)], 1)] },
      },
      { id: "pass", label: "Drive on", results: { any: [o("You go on. Behind you, the graves lie as they lay.", [], 1)] } },
    ],
  },
  {
    id: "red-orchard",
    kind: "find",
    regions: ["tallow", "pines", "threshold"],
    weight: 3,
    title: "Fruit that glows",
    intro: ["An orchard of gnarled apple trees, gone wild. The fruit is heavy and faintly red, and gives off a light of its own, like an ember."],
    options: [
      {
        id: "harvest",
        label: "Strip the trees. Now",
        hours: 2,
        results: {
          any: [
            o("Sweet. Very sweet. Two baskets' worth for the road.", [fx.res("rations", [10, 18])], 5),
            o("The first bite is wrong. By dusk your teeth have gone dark and two of the party have fever.", [fx.res("rations", [8, 14]), fx.fog("two"), fx.sick("random")], 5),
          ],
        },
      },
      {
        id: "taste",
        label: "Have {actor} taste one and wait an hour",
        hours: 3,
        results: {
          any: [
            o("An hour. Two. {actor} is fine, and hungry, and it is decided. You fill every sack you can spare.", [fx.res("rations", [12, 20])], 5),
            o("{actor} keels over with a look like someone opened a window in their head. The fruit is left to rot.", [fx.fog("actor"), fx.nerve("actor", -6)], 5),
          ],
        },
      },
      { id: "pass", label: "Do not touch it", results: { any: [o("Some things are not food. The party agrees, and a few of them look hungrily back.", [fx.nerve("all", -1)], 1)] } },
    ],
  },
  {
    id: "overturned-freight",
    kind: "find",
    weight: 3,
    title: "A Company freight wagon",
    intro: ["A freight wagon lies on its side, its oxen dead in the traces, cargo strewn across the road. Some of it is intact."],
    options: [
      {
        id: "salvage",
        label: "Salvage what you can carry",
        hours: 3,
        hoursMod: { if: { role: "mechanic" }, mult: 0.7 },
        results: {
          any: [
            o("Spare wheels, an axle, tins of beef. Somebody, somewhere, will not be needing these.", [fx.res("spares", [1, 2]), fx.res("rations", [4, 10])], 5, [{ if: { role: "mechanic" }, add: 3 }]),
            o("Half of it is ruined. Half is not.", [fx.res("rations", [3, 7]), fx.res("spares", [0, 1])], 4),
            o("There is a pocket of red fog under the wagon. {actor} breathes it before anyone can shout.", [fx.fog("actor"), fx.res("rations", [3, 6])], 2),
          ],
        },
      },
      { id: "pass", label: "Leave it. No time.", results: { any: [o("You leave it. You will think about it later, when you need a wheel.", [], 1)] } },
    ],
  },
  {
    id: "roadside-shrine",
    kind: "find",
    weight: 2,
    title: "A roadside shrine",
    intro: ["A cairn of stacked stones with offerings around it: coins, bread, a child's boots, a lock of hair tied in blue ribbon."],
    options: [
      {
        id: "take",
        label: "Take the coins and the bread",
        hours: 0.5,
        results: {
          any: [
            o("A handful of scrip and half a loaf. You hear no thunder.", [fx.scrip([12, 35]), fx.res("rations", [2, 4]), fx.nerve({ trait: "pious" }, -5), fx.nerve("all", -1), fx.trust({ trait: "pious" }, -4)], 1),
          ],
        },
      },
      {
        id: "leave-offering",
        label: "Leave a ration and say a word",
        cost: { rations: 1 },
        results: { any: [o("It is a small thing. But it steadies the ones who needed it.", [fx.nerve({ trait: "pious" }, 5), fx.nerve("all", 2)], 1)] },
      },
      { id: "pass", label: "Drive on", results: { any: [o("You go on. The cairn watches you leave, as cairns do.", [], 1)] } },
    ],
  },
  {
    id: "thin-deer",
    kind: "find",
    regions: ["tallow", "pines", "threshold"],
    weight: 5,
    title: "Deer at the treeline",
    intro: ["A herd of deer stands at the edge of the wood, thin and watchful. There is a great deal of meat on them. There is not much time."],
    options: [
      {
        id: "hunt",
        label: "Send {actor} to hunt them",
        hours: 2,
        actor: { role: "hunter" },
        cost: { ammo: 3 },
        results: {
          any: [
            o("Three shots. Two deer. {actor} drags them back with a grin and a bloody sleeve.", [fx.res("rations", [16, 26])], 5, [{ if: { role: "hunter" }, add: 4 }]),
            o("One clean shot, one wasted. It is enough.", [fx.res("rations", [8, 14])], 4),
            o("The deer were not deer. They look up at once, all together, and their eyes are red.", [fx.combat("haze-hounds"), fx.nerve("all", -3)], 1.5),
          ],
        },
      },
      { id: "pass", label: "Let them be", results: { any: [o("A missed meal. You watch them all the way to the bend.", [], 1)] } },
    ],
  },
];

export const HAZE_EVENTS: SceneDef[] = [
  {
    id: "red-tongue",
    kind: "haze",
    weight: 5,
    closeBias: 2.5,
    title: "A tongue of red fog",
    intro: ["A finger of the Haze has reached ahead of the wall and lies across the road: a hundred yards of low red fog, warm and silent, filled with a slow movement."],
    options: [
      {
        id: "drive",
        label: "Drive through it at speed",
        hours: 0.5,
        results: {
          any: [
            o("You hold your breath. You do not know why you hold your breath. Then you are out the other side, coughing, alive.", [fx.fog("two"), fx.nerve("all", -3)], 5),
            o("You emerge from the other side. Everyone is looking at their hands.", [fx.nerve("all", -4)], 3),
          ],
        },
      },
      {
        id: "veils",
        label: "Fit veils and drive through",
        hint: "Needs a veil for most of the party.",
        hours: 0.5,
        requires: [{ res: "veils", min: 3 }],
        why: "Not enough veils.",
        results: { any: [o("The veils reek of vinegar and are damp within a minute. You come out the far side, blinking, unmarked.", [fx.nerve("all", -1)], 1)] },
      },
      {
        id: "wait",
        label: "Wait for it to pass",
        hours: 4,
        results: {
          any: [
            o("It thins slowly. Four hours. You have time to think about all of it.", [fx.nerve("all", -2)], 7),
            o("It does not pass. It comes closer. You have to run for it.", [fx.gap([-6, -3]), fx.nerve("all", -4)], 3),
          ],
        },
      },
      {
        id: "detour",
        label: "Cut a detour around it",
        hours: 2.5,
        results: { any: [o("A wide swing through scrub and rock. Slow, but clean.", [fx.repair(-4)], 1)] },
      },
    ],
  },
  {
    id: "voices-in-the-fog",
    kind: "haze",
    weight: 4,
    others: true,
    closeBias: 3,
    title: "Voices in the fog",
    intro: [
      "It starts as one voice. Then a chorus, calling names. The names are those of people you knew. They are calling them kindly.",
    ],
    options: [
      {
        id: "listen",
        label: "Listen. It may have something to say.",
        hours: 1,
        results: {
          any: [
            o("A place, a name, a warning. It is a real warning. You will never know how it knew.", [fx.gap([3, 7]), fx.nerve("actor", -8)], 3),
            o("It knows things. About {actor}. About {other}. It says them aloud.", [fx.nerve("actor", -10), fx.bond("actor", "other", -10), fx.nerve("all", -3)], 5),
          ],
        },
      },
      {
        id: "sing",
        label: "Sing over it",
        hours: 1,
        actor: { trait: "pious" },
        requires: [{ trait: "pious" }],
        why: "Nobody here will sing.",
        results: { any: [o("{actor} begins a hymn. One by one, the others join. The voices thin out and stop.", [fx.nerve("all", 3), fx.bondAll(2)], 1)] },
      },
      {
        id: "block",
        label: "Cover your ears and drive",
        results: { any: [o("The voices follow for a mile. Then they are gone. Everyone drives on in silence.", [fx.nerve("all", -3)], 1)] },
      },
    ],
  },
  {
    id: "hollowed-procession",
    kind: "haze",
    weight: 4,
    closeBias: 3,
    regions: ["pines", "fen", "flats", "spine", "threshold"],
    title: "The procession",
    intro: [
      "A column of people walks along the ridge above the road, single file, carrying lanterns that are not lit. They are heading the same way as the Haze. They do not look at you.",
    ],
    options: [
      {
        id: "still",
        label: "Douse everything and hold still",
        hint: "Lose the light. Lose the time. Maybe lose nothing else.",
        hours: 3,
        results: {
          any: [
            o("They pass, one at a time. It takes an hour. Nobody breathes. Then they are gone.", [fx.nerve("all", -3)], 7),
            o("They stop. All at once. Every head turns to you.", [fx.combat("hollowed-pack")], 3),
          ],
        },
      },
      {
        id: "run",
        label: "Drive on hard and hope",
        results: {
          any: [
            o("You cover a mile in three minutes, wagons rattling. You do not look up.", [fx.repair(-8), fx.nerve("all", -4)], 5),
            o("They follow you along the ridge. Then down, onto the road, silent and fast.", [fx.combat("hollowed-single"), fx.repair(-5)], 4),
          ],
        },
      },
      {
        id: "torch",
        label: "Torch the road between you",
        cost: { torches: 3 },
        hours: 0.5,
        results: { any: [o("A line of fire across the road. They stop at the edge of it, and look. They look for a long time. Then they go on.", [fx.nerve("all", -1)], 1)] },
      },
    ],
  },
  {
    id: "telegraph-hum",
    kind: "haze",
    weight: 3,
    title: "The hum in the wire",
    intro: [
      "A Company telegraph line runs alongside the road, sagging between poles. It is humming. Not the wind's hum: clicks, in the old code, long and short.",
    ],
    options: [
      {
        id: "decode",
        label: "Have {actor} decode it",
        hours: 1,
        actor: { first: [{ role: "speaker" }, { role: "scout" }] },
        requires: [{ any: [{ role: "speaker" }, { role: "scout" }] }],
        why: "No one here reads the code.",
        results: {
          any: [
            o("It is a real message, months old: a Company route bulletin. It is useful.", [fx.gap([4, 8])], 4),
            o("The message is addressed to {actor}, by full name. The rest is a list of where they will be standing in three days.", [fx.nerve("actor", -10), fx.nerve("all", -2)], 4),
            o("It says only: STOP. STOP. STOP. STOP. It goes on for eleven minutes.", [fx.nerve("all", -3)], 2),
          ],
        },
      },
      {
        id: "cut",
        label: "Cut the wire",
        hours: 0.5,
        results: { any: [o("The hum stops. A moment later, from further up the line, it starts again.", [fx.nerve("all", -1)], 1)] },
      },
      { id: "ignore", label: "Ignore it", results: { any: [o("It follows you for miles, patient and quiet.", [], 1)] } },
    ],
  },
  {
    id: "sky-bleeds",
    kind: "haze",
    weight: 3,
    closeBias: 3,
    title: "The last stars go out",
    intro: [
      "Overhead, one by one, the stars go dark. Not clouded. Erased. Where they were the sky is running with red, like a wound that has just opened.",
    ],
    options: [
      {
        id: "rally",
        label: "Light torches and sing",
        hint: "Show the sky you are still here.",
        cost: { torches: 1 },
        hours: 1,
        results: { any: [o("The circle of firelight holds. The party sings, badly, and fights back the dark with sound.", [fx.nerve("all", 3), fx.bondAll(2)], 1)] },
      },
      {
        id: "ignore",
        label: "Keep your heads down and keep going",
        results: { any: [o("No one looks up. It is heavier than any load.", [fx.nerve("all", -3)], 1)] },
      },
    ],
  },
];

export const ODDITIES: SceneDef[] = [
  {
    id: "empty-town",
    kind: "oddity",
    weight: 3,
    title: "The town with the tables set",
    intro: [
      "A small town, every door open. In every house the table is set for dinner: bread, stew, candles lit. Steam still rises off the soup.",
      "There is nobody here. There is a great deal of food.",
    ],
    options: [
      {
        id: "eat",
        label: "Eat. And take what you can carry.",
        hours: 2,
        results: {
          any: [
            o("The food is good. It is better than it should be. It sits in your stomach like a stone.", [fx.res("rations", [14, 24]), fx.fog("two"), fx.nerve("all", 2)], 6),
            o("You are halfway through your meal when the candles all go out at once.", [fx.res("rations", [6, 12]), fx.fog("two"), fx.nerve("all", -5), fx.combat("hollowed-single")], 3),
          ],
        },
      },
      {
        id: "search",
        label: "Search the houses, but touch nothing hot",
        hours: 3,
        results: {
          any: [
            o("You find a stove that was never lit, and a cellar with real food. Every house has one.", [fx.res("rations", [8, 16]), fx.res("ammo", [2, 6])], 6),
            o("Every house has a full table. Every house has one more chair than people who lived there. The chair is pulled out, as if for you.", [fx.nerve("all", -5)], 2),
          ],
        },
      },
      { id: "pass", label: "Drive straight through", results: { any: [o("You do not stop. The candles flicker as you pass, one house after another, like a very slow wave.", [fx.nerve("all", -2)], 1)] } },
    ],
  },
  {
    id: "headcount",
    kind: "oddity",
    weight: 3,
    when: [{ recruitLeft: "orin" }],
    closeBias: 2,
    title: "One too many",
    intro: [
      "You count heads at supper, as you do every night. You count again. There is one more of you than there should be.",
      "Nobody has admitted it. Everyone is looking at the fire.",
    ],
    options: [
      {
        id: "search",
        label: "Turn out every wagon",
        hours: 2,
        results: {
          any: [
            o("You find a stowaway: a hungry, feral boy hiding among the sacks. He watches you with round eyes. He does not speak.", [fx.recruit("orin", 0.5), fx.nerve("all", 2), fx.res("rations", -2)], 4),
            o("There is nobody. The count is right now. You cannot say when it changed.", [fx.nerve("all", -6)], 6),
          ],
        },
      },
      {
        id: "sleep",
        label: "Say nothing and post a double watch",
        results: { any: [o("A restless, shivering night. No one is missing in the morning. No one wants to count.", [fx.nerve("all", -4)], 1)] },
      },
    ],
  },
  {
    id: "mirror-wagon",
    kind: "oddity",
    weight: 2,
    title: "Another wagon, the same as yours",
    intro: [
      "A wagon sits in the road ahead, hitched and empty. Same canvas, same patch on the tailgate, same crack in the left wheel. The same red splash on the seat.",
      "There is a diary on the seat. It is in your handwriting.",
    ],
    options: [
      {
        id: "examine",
        label: "Go through it",
        hours: 1.5,
        results: {
          any: [
            o("Everything you need is there: spares, food. You pack it all. The diary you leave.", [fx.res("spares", [1, 2]), fx.res("rations", [5, 9]), fx.nerve("actor", -7)], 5),
            o("You read three pages of the diary before you can stop. You wish you had not.", [fx.nerve("actor", -14), fx.nerve("all", -2)], 3),
          ],
        },
      },
      {
        id: "avoid",
        label: "Steer around it and do not look",
        results: { any: [o("It is behind you for hours. Then it is ahead of you, once more.", [fx.nerve("all", -3)], 1)] },
      },
    ],
  },
];

export const RESPITES: SceneDef[] = [
  {
    id: "campfire-song",
    kind: "respite",
    weight: 4,
    title: "Someone starts singing",
    intro: [
      "Under the torches, {actor} begins to hum something old, a lullaby, or a hymn, or a work song. For the first time in days, someone laughs.",
    ],
    options: [
      {
        id: "join",
        label: "Let it run. Let everyone breathe.",
        hours: 1,
        results: { any: [o("An hour of a very old, very human sound. Nobody says it, but it matters.", [fx.nerve("all", 6), fx.bondAll(2)], 1)] },
      },
      {
        id: "hush",
        label: "Hush them. Sound carries.",
        results: { any: [o("They stop. Nobody speaks. Nobody thanks you.", [fx.nerve("all", -1), fx.trust("actor", -3)], 1)] },
      },
    ],
  },
  {
    id: "shared-supper",
    kind: "respite",
    weight: 3,
    others: true,
    title: "A small kindness",
    intro: ["You catch {actor} pressing half of their supper into {other}'s hands, and looking away so it will not be thanked."],
    options: [
      {
        id: "say-nothing",
        label: "Say nothing",
        results: { any: [o("It is not your business. It is the best thing you will see all week.", [fx.bond("actor", "other", 8), fx.nerve("actor", 3), fx.nerve("other", 4)], 1)] },
      },
      {
        id: "praise",
        label: "Praise them in front of everyone",
        results: { any: [o("Awkward, and embarrassing, and effective. Something loosens in the whole train.", [fx.bond("actor", "other", 6), fx.trust("all", 2), fx.nerve("all", 2)], 1)] },
      },
    ],
  },
  {
    id: "square-of-blue",
    kind: "respite",
    weight: 2,
    title: "A patch of blue",
    intro: ["A gap in the cloud. Just one square of sky, no bigger than a window: clean blue, and lit as if by day. It lasts about a minute."],
    options: [
      {
        id: "watch",
        label: "Stop and watch it",
        hours: 0.5,
        results: { any: [o("Nobody speaks. Then the cloud closes and someone is crying, very quietly. But when you drive on, everyone is sitting a little straighter.", [fx.nerve("all", 6)], 1)] },
      },
      { id: "go", label: "Keep going", results: { any: [o("You keep going. Most of the party turns to look back at it, anyway.", [fx.nerve("all", 2)], 1)] } },
    ],
  },
];
