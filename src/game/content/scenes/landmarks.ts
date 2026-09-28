// Landmarks: fixed points on the road where the route itself makes a demand of
// you. The Gate is the finale, and it asks the hardest question of all.

import type { SceneDef } from "../../types.ts";
import { fx, o } from "../fx.ts";

export const LANDMARK_SCENES: SceneDef[] = [
  {
    id: "ninefold-crossing",
    kind: "landmark",
    weight: 0,
    title: "Ninefold Bridge",
    intro: [
      "Nine stone arches carry the road over a brown, fast river. The fifth is gone. Where it stood, a single slab of roadbed hangs over the water, cracked through the middle.",
      "The far bank is forty yards away. On it, someone has left a lantern burning.",
    ],
    options: [
      {
        id: "cross",
        label: "Cross the broken span quickly, one wagon at a time",
        hours: 1.5,
        results: {
          any: [
            o("The slab bows and groans and holds. You cross with your hearts in your throats.", [fx.nerve("all", -2)], 6, [{ if: { role: "mechanic" }, add: 2 }]),
            o("The slab cracks under the last wagon. It goes. The rest of the train watches it fall, cargo and all.", [fx.wagons(-1), fx.nerve("all", -6)], 3),
          ],
        },
      },
      {
        id: "plank",
        label: "Bridge the gap with wagon planks",
        hint: "Costs 1 spare part. Slow and sure.",
        hours: 5,
        hoursMod: { if: { role: "mechanic" }, mult: 0.6 },
        cost: { spares: 1 },
        results: { any: [o("A rickety span of planks and rope. It is not pretty. It is enough.", [], 1)] },
      },
      {
        id: "ford",
        label: "Ford the river below the bridge",
        hours: 2,
        results: {
          any: [
            o("Cold, brown, waist deep. Every ox complains. Every wagon floats, and lands.", [fx.repair(-6), fx.res("rations", [-6, -2])], 6),
            o("The river takes a wagon by the wheels, and does not give it back.", [fx.wagons(-1), fx.hp("actor", [-9, -4]), fx.nerve("all", -5)], 3),
          ],
        },
      },
    ],
  },
  {
    id: "glass-fork",
    kind: "landmark",
    weight: 0,
    title: "The Fork at Glass Cross",
    intro: [
      "Two roads meet in the salt. A weathered sign points both ways.",
      "THE OLD RAIL LINE — 45 MILES SAVED, MIND THE TUNNELS. THE PILGRIM ROAD — LONGER, SAFER, BLESSED.",
      "Someone has crossed out BLESSED with a knife.",
    ],
    options: [
      {
        id: "rail",
        label: "Take the old rail line",
        hint: "The old railbed is flat and fast. There is a reason nobody takes it.",
        hours: 0.5,
        results: {
          any: [
            o("The rails still hold, and the bed is flat as a table. You fly. Twice, you pass things that were once trains.", [fx.advance([40, 55]), fx.nerve("all", -1)], 5),
            o("A broken rail. A wagon leaves the track and goes over. It is a long afternoon of repairs.", [fx.advance([16, 26]), fx.repair(-25), fx.hours(3)], 2),
            o("Something has been living in the tunnels, and it does not like visitors.", [fx.advance([20, 30]), fx.combat("hollowed-pack"), fx.nerve("all", -3)], 3),
          ],
        },
      },
      {
        id: "pilgrim",
        label: "Take the pilgrim road",
        hint: "Slower. The cairns often hold offerings.",
        hours: 3,
        results: {
          any: [
            o("A long, dry, winding road, marked with cairns. In several of them, someone has left food.", [fx.res("rations", [5, 12]), fx.nerve("all", 2)], 6),
            o("A long, dry, winding road. It is safe. You resent every mile of it.", [fx.nerve("all", -1)], 4),
          ],
        },
      },
    ],
  },
  {
    id: "saint-ambrose",
    kind: "landmark",
    weight: 0,
    genuineOdds: 0.5,
    title: "The Mission of Saint Ambrose",
    intro: [
      "A whitewashed mission with a squat bell tower, at the top of a low rise, with a single light burning in a window. As you draw near, the bell begins to ring.",
      "Someone has laid a cloth on the wall by the gate. On it: bread, water, a bowl of salt.",
    ],
    tells: [
      { text: "The bell rings irregularly, pulled by an unsteady hand.", shows: "genuine", p: 0.5 },
      { text: "There are small graves in the yard. Fresh, neat, with wildflowers on each one.", shows: "genuine", p: 0.5 },
      { text: "Someone has been at the garden: the beans are staked, and the weeds are pulled. Slowly, but pulled.", shows: "genuine", p: 0.45 },
      { text: "Every shutter is closed. Every one. From the outside.", shows: "trap", p: 0.55 },
      { text: "The light in the window does not flicker. Not once.", shows: "trap", p: 0.5 },
      { text: "The bell rings again, on the exact same beat, for a very long time.", shows: "trap", p: 0.45 },
      { text: "There is no smoke from the chimney, and no scent of anything at all.", shows: "trap", p: 0.4 },
    ],
    options: [
      {
        id: "enter",
        label: "Take shelter inside for the night",
        hint: "Warmth, food, walls. If it is real.",
        hours: 6,
        tag: "help",
        results: {
          genuine: [o("A dozen weary monks and a scared dog. They give you soup, and a bed, and a chapel, and ask nothing at all. In the morning one of them, Brother Ambrose, asks if he may come with you.", [fx.nerve("all", 10), fx.hp("all", 12), fx.res("rations", [6, 12]), fx.res("medicine", [1, 3]), fx.bondAll(3), fx.recruit("ambrose", 0.8)], 1)],
          trap: [
            o("The doors close behind you. The monks' hoods fall back, one by one, and beneath them are the faces of people who have long since gone away.", [fx.combat("hollowed-pack"), fx.fog("two"), fx.nerve("all", -5)], 6),
            o("You sleep uneasily. In the morning, three of the rations sacks are open, and two of your party are staring at the roof, and neither of them will say what they saw.", [fx.res("rations", [-10, -5]), fx.fog("two"), fx.nerve("all", -6)], 3),
          ],
        },
      },
      {
        id: "yard",
        label: "Camp in the yard and speak at the gate",
        hint: "Trust them a little. Not entirely.",
        hours: 2,
        tag: "help",
        results: {
          genuine: [o("They bring bread and a little physic across the threshold, and ask for nothing. An old monk blesses the wagons.", [fx.res("rations", [3, 7]), fx.res("medicine", [0, 1]), fx.nerve("all", 4)], 1)],
          trap: [o("Nobody comes to the gate. The bell rings all night, patiently, and nobody sleeps.", [fx.nerve("all", -4)], 1)],
        },
      },
      {
        id: "pass",
        label: "Go on past",
        tag: "refuse",
        results: {
          genuine: [o("The bell rings behind you until you are out of earshot. It sounds, you think, like someone hoping.", [fx.nerve({ trait: "pious" }, -4), fx.flag("refusedGenuine")], 1)],
          trap: [o("The bell stops the moment you pass the gate. You do not look back.", [], 1)],
        },
      },
    ],
  },
  {
    id: "toll-gate",
    kind: "landmark",
    weight: 0,
    genuineOdds: 0.3,
    title: "The Toll Gate at the Spine",
    intro: [
      "A great iron chain stretched across the pass, a stone hut, and eight men in Company armbands who have been sitting in the sun for a long time.",
      "\"Toll's sixty scrip. And the road's the road. You want to go over, you pay.\"",
    ],
    tells: [
      { text: "The hut has a proper ledger, a proper strongbox, and a proper Company writ on the wall, faded with weather.", shows: "genuine", p: 0.5 },
      { text: "A rockfall has been cleared from the road ahead. Recently. By hand.", shows: "genuine", p: 0.4 },
      { text: "The men watch the sky as much as they watch you. They are afraid, too.", shows: "genuine", p: 0.4 },
      { text: "The chain is new. The hut is old. The men are neither.", shows: "trap", p: 0.5 },
      { text: "There are bones in the ditch beside the hut. Human ones.", shows: "trap", p: 0.4 },
      { text: "The writ on the hut wall is upside down.", shows: "trap", p: 0.4 },
      { text: "They ask what you are carrying, and what you have that you would rather not lose.", shows: "trap", p: 0.5 },
    ],
    options: [
      {
        id: "pay",
        label: "Pay the toll (60 scrip)",
        hours: 1,
        cost: { scrip: 60 },
        tag: "help",
        results: {
          genuine: [o("The chain drops. The captain stamps a chit, and in a low voice tells you what is on the other side of the pass. It is worth more than the toll.", [fx.gap([4, 8])], 1)],
          trap: [
            o("The chain drops. Then it rises again, and the captain smiles. \"And a bit extra, for the road.\"", [fx.res("rations", [-14, -8]), fx.res("ammo", [-8, -3]), fx.nerve("all", -3)], 6),
            o("The chain drops, and you pass. Nobody says a word. Nobody has to.", [], 3),
          ],
        },
      },
      {
        id: "parley",
        label: "Have your speaker negotiate",
        hours: 1.5,
        actor: { role: "speaker" },
        requires: [{ role: "speaker" }],
        why: "No one here can bargain.",
        results: {
          genuine: [o("{actor} spends a long hour arguing. It costs you a lower toll and a promise. It is fair.", [fx.scrip(-35)], 1)],
          trap: [o("{actor} knows a man in the Company by name, and mentions him twice. The captain's smile thins. The chain drops.", [fx.bond("actor", "leader", 3)], 1)],
        },
      },
      {
        id: "smash",
        label: "Drive through the chain",
        results: {
          genuine: [o("They do not laugh. They open fire.", [fx.combat("toll-thugs"), fx.repair(-10)], 1)],
          trap: [
            o("The chain snaps. The men scatter, and a shot takes an ox in the flank.", [fx.repair(-8), fx.hp("actor", [-9, -3])], 4),
            o("They close in on the wagons as one, clubs raised.", [fx.combat("toll-thugs")], 4),
          ],
        },
      },
    ],
  },
  {
    id: "the-gate",
    kind: "landmark",
    weight: 0,
    title: "The Gate of the Blue Reach",
    intro: [
      "A wall of white stone, sixty feet high, running north and south further than you can see. Above it, a sky the color of a robin's egg. It is very bright. It is very hard to look at.",
      "A small door opens in the base. A woman with a ledger and a lamp steps out. \"Names,\" she says. \"Everyone's. And I will need to look at everyone's eyes.\"",
    ],
    options: [
      {
        id: "enter",
        label: "Give your names, and step through together",
        requires: [{ not: { fog: true } }],
        why: "Someone among you has been marked. There is no unmarked way in.",
        results: {
          any: [
            o("She looks at each of you, and writes each of you down. The gate opens. On the other side there is grass, and a small child in the road who stares at your wagons. Overhead, the sky is very clean.", [
              fx.end("victory", "The Blue Reach", [
                "You have crossed eight hundred and forty miles and the whole world has followed you to the door.",
                "The gate closes behind you with a sound like a book. Somewhere, very far off, the Haze arrives at the wall and stops, as if listening.",
                "The sky above you is blue. At its very edge, where the wall meets it, it is, perhaps, a little pink.",
              ]),
            ]),
          ],
        },
      },
      {
        id: "leave-marked",
        label: "Leave the marked in the quarantine ward, and go in without them",
        hint: "\"For observation.\" Nobody has ever come out of it.",
        requires: [{ fog: true }, { leaderFog: false }],
        why: "Either no one is marked, or the mark is on you. You cannot leave yourself behind.",
        results: {
          any: [
            o("They take the marked ones gently, and put them in tents beyond the wall. They will be looked after, the woman says. You believe her. You cannot make yourself believe her.", [
              fx.leave("fogsick", "left in the quarantine ward at the Gate"),
              fx.end("victory", "The Blue Reach: the ones you left", [
                "The Gate opens for the rest of you. It closes on the marked, and on the last promise you made them.",
                "The sky is blue. It will be blue for a long time, if you can stand to look at it.",
                "There is a window in the ward, high up. Sometimes, at dusk, someone stands in it.",
              ]),
            ]),
          ],
        },
      },
      {
        id: "smuggle",
        label: "Hide the marked in the wagons and try to bluff the ledger-keeper",
        hint: "If you are caught, the Gate closes for good.",
        requires: [{ fog: true }],
        why: "No one here is marked.",
        results: {
          any: [
            o("She looks at each of you with her lamp. When she reaches the wagons she pauses, for a long, long moment. Then she writes down a number, and steps aside, and does not look up.", [
              fx.end("victory", "The Blue Reach: the ones you hid", [
                "The Gate opens, and takes you all. In the shade of the first tree, one of the marked opens their eyes and asks, very quietly, whether the sky is what it looks like.",
                "It is. Mostly.",
                "You do not sleep, that first night. But nobody comes for them. Yet.",
              ]),
            ], 4, [{ if: { role: "speaker" }, add: 3 }]),
            o("Her lamp swings up, and stops. The door is already closing. \"You knew,\" she says. Not angry. Just tired.", [
              fx.end("lost", "Turned away at the Gate", [
                "The door shuts, and does not open again.",
                "Behind you, the fog is arriving over the last hill, walking slowly, in no hurry at all, and it is a very long way back to the road.",
              ]),
            ], 4),
          ],
        },
      },
      {
        id: "stay-out",
        label: "Refuse to go in without them. Camp outside.",
        requires: [{ fog: true }],
        why: "No one here is marked.",
        results: {
          any: [
            o("You put your back to the white wall and your face to the fog. Somewhere in the night, you all begin to sing.", [
              fx.end("lost", "You stay", [
                "The Gate does not open. You do not ask it to.",
                "In the morning the Haze reaches the wall, and stops, as if surprised. It stays there for a long time.",
                "It is very quiet at the foot of the wall, beneath a blue sky none of you will ever stand under. But you are all still together.",
              ]),
            ]),
          ],
        },
      },
    ],
  },
];
