// Finds: scavenging opportunities. No hidden truth, but every one is a bet
// between what you might gain and the hours (and blood) it takes.
// Haze events and oddities are the fog showing itself; respites are the small
// mercies that keep people human on the road.

import type { Line, Outcome, SceneDef } from "../../types.ts";
import { fx, o } from "../fx.ts";

/** An outcome with spoken lines, optionally gated on the option's check. */
const t = (out: Outcome, talk: Line[], needs?: "success" | "fail"): Outcome => (needs ? { ...out, talk, needs } : { ...out, talk });

export const FINDS: SceneDef[] = [
  {
    id: "ruined-farmhouse",
    kind: "find",
    regions: ["tallow", "fen", "pines", "threshold"],
    weight: 6,
    title: "A ruined farmhouse",
    intro: ["A farmhouse back from the road. Front door open, curtains moving. The barn has fallen in."],
    talk: [
      { who: "actor", text: "Somebody left in a hurry.", alt: { paranoid: "Or somebody never left. Look at the curtains." } },
      { who: "leader", text: "Could be a cellar. Could be jars." },
      { who: "actor", text: "Could be a lot of things.", gesture: "shrug", alt: { greedy: "Could be a strongbox. Folks hide money in walls.", coward: "I don't want to go in there." } },
    ],
    options: [
      {
        id: "search-all",
        label: "Search it top to bottom",
        hint: "Best odds. Longest time.",
        hours: 3,
        results: {
          any: [
            t(o("A cellar of jars, a locked chest, a rifle under the floor.", [fx.res("rations", [8, 16]), fx.scrip([10, 35]), fx.res("ammo", [3, 8])], 5), [
              { who: "actor", text: "Peaches. Real peaches. Look at this.", mood: "calm", gesture: "offer" },
              { who: "leader", text: "Don't ask whose they were. Just carry them." },
            ]),
            t(o("Slim pickings. Food is food.", [fx.res("rations", [3, 7])], 5), [
              { who: "actor", text: "Three hours for a sack of meal.", alt: { stoic: "It's something. Load it." } },
            ]),
            t(o("The family is in the kitchen, at the table. They turn their heads together.", [fx.combat("hollowed-single"), fx.nerve("all", -3)], 2), [
              { who: "actor", text: "They're still sitting down to supper.", mood: "afraid", gesture: "point" },
              { who: "actor", text: "Oh God. Their eyes.", mood: "afraid", alt: { veteran: "Back up slow. Nobody run.", pious: "Lord keep us. Lord keep them." } },
            ]),
            t(o("The upstairs floor gives way. {actor} goes through it.", [fx.hp("actor", [-12, -5]), fx.res("rations", [2, 6])], 2), [
              { who: "actor", text: "My leg. Don't pull. Don't pull it.", mood: "pleading", gesture: "clutch" },
              { who: "leader", text: "I've got you. Breathe. I've got you." },
            ]),
          ],
        },
      },
      {
        id: "search-quick",
        label: "Send {actor} in to grab what they can",
        hours: 1,
        results: {
          any: [
            t(o("{actor} is back in twenty minutes with flour, and something in a pocket.", [fx.res("rations", [2, 6])], 5), [
              { who: "leader", text: "What's in the pocket?" },
              { who: "actor", text: "Nothing. It's nothing.", mood: "cold", gesture: "turn-away", alt: { charming: "A keepsake. You'd have taken it too." } },
            ]),
            t(o("{actor} comes out empty-handed and pale.", [fx.nerve("actor", -4)], 3), [
              { who: "leader", text: "What did you see?" },
              { who: "actor", text: "Don't ask me that. Please don't.", mood: "afraid", gesture: "turn-away" },
            ]),
            t(o("A scream. A fight. Then quiet. {actor} walks out bleeding.", [fx.hp("actor", [-10, -4]), fx.combat("hollowed-single")], 1.5), [
              { who: "actor", text: "It was a woman. It was wearing an apron.", mood: "afraid", gesture: "clutch" },
            ]),
          ],
        },
      },
      {
        id: "leave",
        label: "Leave it alone",
        results: {
          any: [
            t(o("You do not stop. It is probably nothing. It is always probably nothing.", [], 1), [
              { who: "actor", text: "The curtain moved. There's no wind.", mood: "afraid", alt: { stoic: "Right call." } },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "company-cache",
    kind: "find",
    weight: 3,
    title: "A Company cache",
    intro: ["A chained hatch beside a depot marker: MERIDIAN CO. — EMERGENCY STORES — DO NOT REMOVE."],
    talk: [
      { who: "actor", text: "Emergency stores. What do they call this?", gesture: "point", alt: { greedy: "Company owes us. Every one of us." } },
      { who: "leader", text: "Company doesn't leave things unguarded." },
      { who: "actor", text: "Company's gone. Company ran first.", mood: "angry", alt: { paranoid: "Then why's the chain so new?" } },
    ],
    options: [
      {
        id: "force",
        label: "Force the chain",
        hours: 1,
        results: {
          any: [
            t(o("The chain gives. Rations, powder, a case of physic.", [fx.res("rations", [8, 16]), fx.res("ammo", [4, 10]), fx.res("medicine", [1, 2])], 5), [
              { who: "actor", text: "Physic. Whole bottles of it.", gesture: "offer" },
              { who: "leader", text: "Company's gift. Nobody say thank you." },
            ]),
            t(o("The hatch is rigged. A charge goes off in {actor}'s face.", [fx.hp("actor", [-13, -6]), fx.res("rations", [3, 6])], 3), [
              { who: "actor", text: "I can't hear. I can't hear you.", mood: "afraid", gesture: "clutch" },
              { who: "leader", text: "They trapped their own food. Their own people." },
            ]),
            t(o("Empty. Scratched into the floor: THEY LOOTED IT FIRST.", [fx.nerve("all", -1)], 2), [
              { who: "actor", text: "Somebody got here hungrier.", gesture: "shrug", alt: { hothead: "Company men. Bet it was Company men." } },
            ]),
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
            t(o("A length of wire, a patient hour. The stores are all there.", [fx.res("rations", [10, 18]), fx.res("ammo", [4, 10]), fx.res("medicine", [1, 3]), fx.res("spares", [0, 1])], 8), [
              { who: "actor", text: "There. Sweet as you like.", mood: "calm" },
              { who: "actor", text: "And they wired a charge under it. Look.", gesture: "point" },
            ]),
            t(o("The lock opens. Half the stores are spoiled.", [fx.res("rations", [4, 8])], 2), [
              { who: "actor", text: "Damp got in. Take the tins, leave the sacks.", gesture: "shrug" },
            ]),
          ],
        },
      },
      {
        id: "leave",
        label: "Leave it",
        results: {
          any: [
            t(o("Nothing is worth an hour. You keep moving.", [], 1), [
              { who: "actor", text: "That was food. That was real food.", mood: "angry", alt: { stoic: "Fair enough." } },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "fresh-graves",
    kind: "find",
    weight: 3,
    title: "A row of graves",
    intro: ["Fresh graves beside the road, buried shallow. A trunk corner shows. A boot. A coin in the boot."],
    talk: [
      { who: "actor", text: "They buried them with their things.", gesture: "point" },
      { who: "actor", text: "They don't need boots now.", mood: "cold", alt: { kind: "Someone loved them enough to pack for them.", pious: "Don't. Don't even think it." } },
      { who: "leader", text: "Somebody dug these in a hurry. Yesterday, maybe." },
    ],
    options: [
      {
        id: "dig",
        label: "Dig up the belongings",
        hint: "The dead do not need them.",
        hours: 2,
        results: {
          any: [
            t(o("Powder, a purse, biscuits, a ring. A good haul. It is also graves.", [fx.scrip([20, 55]), fx.res("ammo", [4, 8]), fx.res("rations", [2, 6]), fx.nerve("all", -3), fx.nerve({ trait: "kind" }, -3), fx.nerve({ trait: "pious" }, -4), fx.trust({ trait: "pious" }, -5)], 1), [
              { who: "actor", text: "Her ring won't come off. It won't come off.", mood: "grieving", gesture: "kneel" },
              { who: "actor", text: "Leave it. God, just leave her the ring.", mood: "grieving", alt: { greedy: "Pull harder. She won't feel it." } },
              { who: "leader", text: "Fill them back in. All of them. Properly." },
            ]),
          ],
        },
      },
      {
        id: "pray",
        label: "Say a prayer and move on",
        hours: 1,
        results: {
          any: [
            t(o("Not much to it. But something in the party settles.", [fx.nerve("all", 3), fx.nerve({ trait: "pious" }, 3), fx.bondAll(1)], 1), [
              { who: "actor", text: "I don't know their names. Does that matter?", mood: "grieving", gesture: "kneel" },
              { who: "leader", text: "No. Say it anyway." },
            ]),
          ],
        },
      },
      {
        id: "pass",
        label: "Drive on",
        results: {
          any: [
            t(o("You go on. The graves lie as they lay.", [], 1), [
              { who: "actor", text: "Someone'll dig them up. Won't be us.", gesture: "turn-away" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "red-orchard",
    kind: "find",
    regions: ["tallow", "pines", "threshold"],
    weight: 3,
    title: "Fruit that glows",
    intro: ["A wild orchard. The apples hang heavy and faintly red, lit from inside like embers."],
    talk: [
      { who: "actor", text: "Apples. When did we last eat an apple?", mood: "calm", gesture: "point", alt: { sickly: "I could eat. I could actually eat one." } },
      { who: "leader", text: "Apples don't glow." },
      { who: "actor", text: "Maybe these ones do. Maybe it's the soil.", mood: "pleading", alt: { paranoid: "That's the fog. That's fog in the fruit.", greedy: "Two baskets. We'd eat for a week." } },
    ],
    options: [
      {
        id: "harvest",
        label: "Strip the trees. Now",
        hours: 2,
        results: {
          any: [
            t(o("Sweet. Very sweet. Two baskets for the road.", [fx.res("rations", [10, 18])], 5), [
              { who: "actor", text: "It tastes like summer. Like before.", mood: "calm" },
            ]),
            t(o("By dusk your teeth have gone dark. Two of the party are burning with fever.", [fx.res("rations", [8, 14]), fx.fog("two"), fx.sick("random")], 5), [
              { who: "actor", text: "It's in my mouth. I can taste it thinking.", mood: "afraid", gesture: "clutch" },
              { who: "leader", text: "Spit. Everybody spit. Now." },
            ]),
          ],
        },
      },
      {
        id: "taste",
        label: "Have {actor} taste one and wait an hour",
        hours: 3,
        results: {
          any: [
            t(o("An hour. Two. {actor} is fine, and hungry. You fill every sack.", [fx.res("rations", [12, 20])], 5), [
              { who: "actor", text: "Still me. Still hungry. Pick them.", mood: "calm", gesture: "beckon" },
            ]),
            t(o("{actor} goes over, face slack, like a window opened in their head.", [fx.fog("actor"), fx.nerve("actor", -6)], 5), [
              { who: "actor", text: "It's so warm in here. Why is it warm?", mood: "calm" },
              { who: "leader", text: "Drop it. Drop the apple. Look at me." },
            ]),
          ],
        },
      },
      {
        id: "talk-down",
        label: "Talk the hungry ones out of it",
        hint: "Takes a while. Hunger argues back.",
        hours: 0.5,
        check: { kind: "persuade", dc: 12, target: "the hungry" },
        results: {
          any: [
            t(o("{by} talks until the hunger gives. Nobody touches the fruit.", [fx.nerve("all", 1)], 1), [
              { who: "by", text: "We didn't come this far to eat the fog.", mood: "calm" },
              { who: "actor", text: "Fine. Fine. But I'm not looking back.", gesture: "turn-away", alt: { sickly: "You're right. I just wanted something sweet." } },
            ], "success"),
            t(o("They nod, and agree, and at dusk {actor}'s teeth are dark.", [fx.fog("actor"), fx.res("rations", [2, 4]), fx.nerve("all", -1)], 1), [
              { who: "by", text: "Please. Just leave them on the tree.", mood: "pleading" },
              { who: "actor", text: "Just one. I only had the one.", mood: "afraid", gesture: "clutch" },
            ], "fail"),
          ],
        },
      },
      {
        id: "pass",
        label: "Do not touch it",
        results: {
          any: [
            t(o("Some things are not food. Some of the party look back hungrily anyway.", [fx.nerve("all", -1)], 1), [
              { who: "actor", text: "I'll dream about those apples.", mood: "grieving", alt: { hothead: "Starving next to a tree. Brilliant." } },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "overturned-freight",
    kind: "find",
    weight: 3,
    title: "A Company freight wagon",
    intro: ["A freight wagon on its side, oxen dead in the traces. Cargo strewn across the road."],
    talk: [
      { who: "actor", text: "Axle's whole. Look at that axle.", gesture: "point", alt: { greedy: "Crates. Unopened crates." } },
      { who: "actor", text: "Where's the driver, though?", mood: "afraid", alt: { paranoid: "No driver. No blood. Where'd he go?" } },
    ],
    options: [
      {
        id: "salvage",
        label: "Salvage what you can carry",
        hours: 3,
        hoursMod: { if: { role: "mechanic" }, mult: 0.7 },
        results: {
          any: [
            t(o("Spare wheels, an axle, tins of beef.", [fx.res("spares", [1, 2]), fx.res("rations", [4, 10])], 5, [{ if: { role: "mechanic" }, add: 3 }]), [
              { who: "actor", text: "Somebody will miss these. Not us.", mood: "calm" },
            ]),
            t(o("Half of it is ruined. Half is not.", [fx.res("rations", [3, 7]), fx.res("spares", [0, 1])], 4), [
              { who: "actor", text: "Rats got the flour. Tins are fine.", gesture: "shrug" },
            ]),
            t(o("A pocket of red fog under the wagon. {actor} breathes it before anyone can shout.", [fx.fog("actor"), fx.res("rations", [3, 6])], 2), [
              { who: "actor", text: "It smelled like my mother's kitchen.", mood: "calm" },
              { who: "leader", text: "Get out from under there. Now." },
            ]),
          ],
        },
      },
      {
        id: "pass",
        label: "Leave it. No time.",
        results: {
          any: [
            t(o("You leave it. You will think about it later, when you need a wheel.", [], 1), [
              { who: "actor", text: "That axle. I'll remember that axle.", gesture: "turn-away" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "roadside-shrine",
    kind: "find",
    weight: 2,
    title: "A roadside shrine",
    intro: ["A cairn with offerings: coins, bread, a child's boots, a lock of hair in blue ribbon."],
    talk: [
      { who: "actor", text: "Somebody's little girl had that hair.", mood: "grieving", alt: { greedy: "There's real scrip in there." } },
      { who: "actor", text: "Bread's still soft. They left it today.", gesture: "point", alt: { pious: "Don't touch it. It isn't ours." } },
    ],
    options: [
      {
        id: "take",
        label: "Take the coins and the bread",
        hours: 0.5,
        results: {
          any: [
            t(o("A handful of scrip and half a loaf. No thunder.", [fx.scrip([12, 35]), fx.res("rations", [2, 4]), fx.nerve({ trait: "pious" }, -5), fx.nerve("all", -1), fx.trust({ trait: "pious" }, -4)], 1), [
              { who: "actor", text: "You left the boots. At least the boots.", mood: "cold", gesture: "turn-away", alt: { pious: "I won't forget you did that." } },
            ]),
          ],
        },
      },
      {
        id: "leave-offering",
        label: "Leave a ration and say a word",
        cost: { rations: 1 },
        results: {
          any: [
            t(o("A small thing. It steadies the ones who needed it.", [fx.nerve({ trait: "pious" }, 5), fx.nerve("all", 2)], 1), [
              { who: "actor", text: "For whoever she was.", mood: "grieving", gesture: "kneel" },
              { who: "leader", text: "For whoever we'll be." },
            ]),
          ],
        },
      },
      {
        id: "pass",
        label: "Drive on",
        results: {
          any: [
            t(o("You go on. The cairn watches you leave, as cairns do.", [], 1), [
              { who: "actor", text: "Blue ribbon. My sister wore blue ribbon.", mood: "grieving" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "thin-deer",
    kind: "find",
    regions: ["tallow", "pines", "threshold"],
    weight: 5,
    title: "Deer at the treeline",
    intro: ["Deer at the edge of the wood, thin and watchful. A lot of meat. Not much time."],
    talk: [
      { who: "actor", text: "Meat. Standing right there.", gesture: "point" },
      { who: "actor", text: "They're not running. Why aren't they running?", mood: "afraid", alt: { hothead: "Give me the rifle. Quick.", paranoid: "Deer run. These aren't running." } },
    ],
    options: [
      {
        id: "hunt",
        label: "Send {actor} to hunt them",
        hours: 2,
        actor: { role: "hunter" },
        cost: { ammo: 3 },
        results: {
          any: [
            t(o("Three shots. Two deer. {actor} drags them back grinning, sleeve bloody.", [fx.res("rations", [16, 26])], 5, [{ if: { role: "hunter" }, add: 4 }]), [
              { who: "actor", text: "Fresh meat tonight. Somebody get a fire going.", mood: "calm", gesture: "beckon" },
            ]),
            t(o("One clean shot, one wasted. Enough.", [fx.res("rations", [8, 14])], 4), [
              { who: "actor", text: "Pulled the second. Hands aren't what they were.", gesture: "shrug" },
            ]),
            t(o("They look up together. Their eyes are red. They were never deer.", [fx.combat("haze-hounds"), fx.nerve("all", -3)], 1.5), [
              { who: "actor", text: "Run! Back to the wagons! Run!", mood: "afraid", gesture: "draw-weapon" },
            ]),
          ],
        },
      },
      {
        id: "pass",
        label: "Let them be",
        results: {
          any: [
            t(o("A missed meal. You watch them all the way to the bend.", [], 1), [
              { who: "actor", text: "They watched us the whole way. Every one.", mood: "afraid" },
            ]),
          ],
        },
      },
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
    intro: ["A finger of the Haze lies across the road ahead: a hundred yards of low red fog. Something moves in it."],
    talk: [
      { who: "actor", text: "It's warm. I can feel it from here.", mood: "afraid", gesture: "raise-hands" },
      { who: "actor", text: "Something's walking in it. Slow. Like wading.", mood: "afraid", gesture: "point", alt: { veteran: "Hundred yards. Hold your breath, it's done.", coward: "No. I'm not going in there. No." } },
      { who: "leader", text: "Nobody panics. We decide, and we go." },
    ],
    options: [
      {
        id: "drive",
        label: "Drive through it at speed",
        hours: 0.5,
        results: {
          any: [
            t(o("You hold your breath without knowing why. Then you are out, coughing, alive.", [fx.fog("two"), fx.nerve("all", -3)], 5), [
              { who: "actor", text: "It said my name. It said it in there.", mood: "afraid", gesture: "clutch" },
              { who: "leader", text: "It didn't. Nothing did. Keep driving." },
            ]),
            t(o("You come out the far side. Everyone is looking at their hands.", [fx.nerve("all", -4)], 3), [
              { who: "actor", text: "Are these mine? These are mine, aren't they?", mood: "afraid" },
              { who: "actor", text: "Say they're mine.", mood: "pleading", gesture: "raise-hands" },
            ]),
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
        results: {
          any: [
            t(o("The veils reek of vinegar and go damp in a minute. You come out unmarked.", [fx.nerve("all", -1)], 1), [
              { who: "actor", text: "Vinegar. I'll never eat a pickle again.", mood: "calm", alt: { stoic: "Worked. Dry them out tonight." } },
            ]),
          ],
        },
      },
      {
        id: "wait",
        label: "Wait for it to pass",
        hours: 4,
        results: {
          any: [
            t(o("It thins slowly. Four hours to think about all of it.", [fx.nerve("all", -2)], 7), [
              { who: "actor", text: "I keep thinking about who we left behind.", mood: "grieving", gesture: "turn-away" },
            ]),
            t(o("It does not pass. It comes closer. You have to run.", [fx.gap([-6, -3]), fx.nerve("all", -4)], 3), [
              { who: "actor", text: "It's coming to us! Hitch up! Hitch up!", mood: "afraid", gesture: "point" },
            ]),
          ],
        },
      },
      {
        id: "detour",
        label: "Cut a detour around it",
        hours: 2.5,
        results: {
          any: [
            t(o("A wide swing through scrub and rock. Slow, but clean.", [fx.repair(-4)], 1), [
              { who: "actor", text: "Wheel's complaining. Better the wheel than us.", gesture: "shrug" },
            ]),
          ],
        },
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
    intro: ["One voice in the fog, then a chorus, calling names of people you knew. Calling them kindly."],
    talk: [
      { who: "actor", text: "That's my brother. That's his voice.", mood: "afraid", gesture: "point" },
      { who: "other", text: "Your brother's dead, {actor}. You buried him.", mood: "cold", alt: { kind: "Don't answer it. Please, don't answer it." } },
      { who: "actor", text: "He's calling me. He sounds all right.", mood: "pleading", gesture: "beckon" },
    ],
    options: [
      {
        id: "listen",
        label: "Listen. It may have something to say.",
        hours: 1,
        results: {
          any: [
            t(o("A place, a name, a warning. A real one. You will never know how it knew.", [fx.gap([3, 7]), fx.nerve("actor", -8)], 3), [
              { who: "actor", text: "He said go north of the creek.", mood: "grieving" },
              { who: "actor", text: "He said he's cold. He said it twice.", mood: "grieving", gesture: "turn-away" },
            ]),
            t(o("It knows things about {actor} and {other}. It says them aloud.", [fx.nerve("actor", -10), fx.bond("actor", "other", -10), fx.nerve("all", -3)], 5), [
              { who: "other", text: "Is it true? What it said. Is it true?", mood: "angry", gesture: "point" },
              { who: "actor", text: "You weren't supposed to hear that. Ever.", mood: "grieving", gesture: "turn-away" },
              { who: "other", text: "Don't touch me. Don't.", mood: "cold", alt: { kind: "I don't care. I don't. Come here." } },
            ]),
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
        results: {
          any: [
            t(o("{actor} starts a hymn. One by one the others join. The voices thin and stop.", [fx.nerve("all", 3), fx.bondAll(2)], 1), [
              { who: "actor", text: "Abide with me. Come on. All of you.", mood: "calm", gesture: "beckon" },
              { who: "other", text: "I don't know the words.", alt: { pious: "Fast falls the eventide." } },
              { who: "actor", text: "Then hum. Just be louder than it.", mood: "calm" },
            ]),
          ],
        },
      },
      {
        id: "calm",
        label: "Talk {actor} back from the fog",
        hint: "Someone holds on to them and keeps talking.",
        hours: 1,
        check: { kind: "calm", dc: 12, target: "the voice in the fog", exclude: ["actor"] },
        results: {
          any: [
            t(o("{by} holds on and keeps talking until the voice is only wind.", [fx.nerve("actor", -2), fx.nerve("all", -1), fx.bond("by", "actor", 4)], 1), [
              { who: "by", text: "Look at me. Not there. Me.", mood: "calm", gesture: "clutch" },
              { who: "actor", text: "He sounded so happy.", mood: "grieving" },
              { who: "by", text: "I know. I know he did.", mood: "grieving" },
            ], "success"),
            t(o("{actor} tears loose and runs a dozen yards in before they are dragged back.", [fx.nerve("actor", -8), fx.nerve("all", -2), fx.hp("actor", [-5, -2])], 1), [
              { who: "actor", text: "Let go! He's right there! Let me go!", mood: "angry", gesture: "turn-away" },
              { who: "by", text: "I'm not letting go. I'm not.", mood: "pleading" },
            ], "fail"),
          ],
        },
      },
      {
        id: "block",
        label: "Cover your ears and drive",
        results: {
          any: [
            t(o("The voices follow for a mile. Then they are gone. Nobody speaks.", [fx.nerve("all", -3)], 1), [
              { who: "actor", text: "I didn't answer him. I didn't even answer.", mood: "grieving", gesture: "clutch" },
            ]),
          ],
        },
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
    intro: ["People walk the ridge above the road in single file, carrying unlit lanterns. They go the way the Haze goes."],
    talk: [
      { who: "actor", text: "Don't look up. Don't let them see you look.", mood: "afraid", gesture: "turn-away" },
      { who: "actor", text: "That's the Pruitt girl. Third from the front.", mood: "grieving", alt: { paranoid: "They're counting us. I swear they're counting.", veteran: "Forty of them. Maybe more behind." } },
      { who: "leader", text: "Quiet. Whatever we do, we do it quiet." },
    ],
    options: [
      {
        id: "still",
        label: "Douse everything and hold still",
        hint: "Lose the light. Lose the time. Maybe lose nothing else.",
        hours: 3,
        results: {
          any: [
            t(o("They pass one at a time. It takes an hour. Nobody breathes.", [fx.nerve("all", -3)], 7), [
              { who: "actor", text: "She had her Sunday dress on. The Pruitt girl.", mood: "grieving" },
            ]),
            t(o("They stop, all at once. Every head turns to you.", [fx.combat("hollowed-pack")], 3), [
              { who: "actor", text: "They heard. Oh God, they heard us.", mood: "afraid", gesture: "draw-weapon" },
            ]),
          ],
        },
      },
      {
        id: "hush",
        label: "Keep everyone still and silent",
        hint: "Someone has to hold the frightened ones quiet.",
        hours: 3,
        check: { kind: "calm", dc: 12, target: "the party" },
        results: {
          any: [
            t(o("{by} goes wagon to wagon, a hand on every shoulder. The file passes.", [fx.nerve("all", -2)], 1), [
              { who: "by", text: "Breathe with me. In. Out. They can't see us.", mood: "calm" },
              { who: "actor", text: "Don't let go of my hand.", mood: "afraid", gesture: "clutch" },
            ], "success"),
            t(o("Someone sobs out loud. The whole file stops, and turns.", [fx.combat("hollowed-pack"), fx.nerve("all", -2)], 1), [
              { who: "by", text: "Shh. Shh, please, please.", mood: "pleading" },
              { who: "actor", text: "I'm sorry. I'm sorry, I couldn't.", mood: "afraid", gesture: "clutch" },
            ], "fail"),
          ],
        },
      },
      {
        id: "run",
        label: "Drive on hard and hope",
        results: {
          any: [
            t(o("A mile in three minutes, wagons rattling. Nobody looks up.", [fx.repair(-8), fx.nerve("all", -4)], 5), [
              { who: "actor", text: "Faster! Don't care about the wheels! Faster!", mood: "afraid" },
            ]),
            t(o("They follow along the ridge. Then down onto the road, silent and fast.", [fx.combat("hollowed-single"), fx.repair(-5)], 4), [
              { who: "actor", text: "One's on the tailgate! Get it off!", mood: "afraid", gesture: "draw-weapon" },
            ]),
          ],
        },
      },
      {
        id: "torch",
        label: "Torch the road between you",
        cost: { torches: 3 },
        hours: 0.5,
        results: {
          any: [
            t(o("A line of fire across the road. They stop at its edge and look a long time. Then they go on.", [fx.nerve("all", -1)], 1), [
              { who: "actor", text: "She looked right at me. Through the fire.", mood: "afraid" },
              { who: "leader", text: "And then she walked on. Remember that part." },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "telegraph-hum",
    kind: "haze",
    weight: 3,
    title: "The hum in the wire",
    intro: ["A Company telegraph line sags beside the road. It is clicking: long and short, the old code."],
    talk: [
      { who: "actor", text: "Nobody's sending. The stations are all gone.", mood: "afraid" },
      { who: "actor", text: "It's sending anyway. Listen.", gesture: "point", alt: { paranoid: "It knows we're here. That's why it started." } },
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
            t(o("A real message, months old: a Company route bulletin. Useful.", [fx.gap([4, 8])], 4), [
              { who: "actor", text: "Route bulletin. Ford's washed out. There's a cutoff.", mood: "calm" },
            ]),
            t(o("It is addressed to {actor} by full name. Then where they will stand in three days.", [fx.nerve("actor", -10), fx.nerve("all", -2)], 4), [
              { who: "actor", text: "It's my name. My whole name. Mother's name for me.", mood: "afraid", gesture: "clutch" },
              { who: "actor", text: "Don't ask me what else. Please.", mood: "pleading", gesture: "turn-away" },
            ]),
            t(o("STOP. STOP. STOP. STOP. For eleven minutes.", [fx.nerve("all", -3)], 2), [
              { who: "actor", text: "Stop. Just stop. Over and over.", mood: "afraid" },
              { who: "leader", text: "We are not stopping." },
            ]),
          ],
        },
      },
      {
        id: "cut",
        label: "Cut the wire",
        hours: 0.5,
        results: {
          any: [
            t(o("The hum stops. A moment later, further up the line, it starts again.", [fx.nerve("all", -1)], 1), [
              { who: "actor", text: "It's up ahead now. Waiting.", mood: "afraid", gesture: "point" },
            ]),
          ],
        },
      },
      {
        id: "ignore",
        label: "Ignore it",
        results: {
          any: [
            t(o("It follows you for miles, patient and quiet.", [], 1), [
              { who: "actor", text: "Still clicking. Mile after mile.", alt: { stoic: "It's wire. Let it click." } },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "sky-bleeds",
    kind: "haze",
    weight: 3,
    closeBias: 3,
    title: "The last stars go out",
    intro: ["The stars go out one by one. Not clouded. Erased. The sky runs red where they were."],
    talk: [
      { who: "actor", text: "There goes the Plough. It's just gone.", mood: "afraid", gesture: "point" },
      { who: "actor", text: "How do we steer without stars?", mood: "afraid", alt: { pious: "He's taking them back. We did something wrong.", haunted: "I knew. I knew this was coming." } },
    ],
    options: [
      {
        id: "rally",
        label: "Light torches and sing",
        hint: "Show the sky you are still here.",
        cost: { torches: 1 },
        hours: 1,
        results: {
          any: [
            t(o("The firelight holds. The party sings badly and fights the dark with noise.", [fx.nerve("all", 3), fx.bondAll(2)], 1), [
              { who: "leader", text: "Louder. Let it hear us down here." },
              { who: "actor", text: "I don't even know this one. Keep going.", mood: "calm" },
            ]),
          ],
        },
      },
      {
        id: "ignore",
        label: "Keep your heads down and keep going",
        results: {
          any: [
            t(o("No one looks up. It is heavier than any load.", [fx.nerve("all", -3)], 1), [
              { who: "actor", text: "Say something. Anybody. Please say something.", mood: "pleading" },
            ]),
          ],
        },
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
    intro: ["A small town, every door open. Every table set: bread, stew, candles lit. Steam off the soup. Nobody here."],
    talk: [
      { who: "actor", text: "Hello? Anybody? Your supper's getting cold.", mood: "afraid" },
      { who: "actor", text: "There's so much food.", mood: "pleading", alt: { greedy: "Whole town's larder. Just sitting here.", paranoid: "Who lit the candles? Who lit them?" } },
      { who: "leader", text: "Nobody sits down until I say." },
    ],
    options: [
      {
        id: "eat",
        label: "Eat. And take what you can carry.",
        hours: 2,
        results: {
          any: [
            t(o("The food is better than it should be. It sits in you like a stone.", [fx.res("rations", [14, 24]), fx.fog("two"), fx.nerve("all", 2)], 6), [
              { who: "actor", text: "It tastes like home. Exactly like home.", mood: "calm" },
              { who: "actor", text: "Why does it taste like my home?", mood: "afraid" },
            ]),
            t(o("Halfway through the meal, every candle goes out at once.", [fx.res("rations", [6, 12]), fx.fog("two"), fx.nerve("all", -5), fx.combat("hollowed-single")], 3), [
              { who: "actor", text: "Someone just pulled out the chair beside me.", mood: "afraid", gesture: "clutch" },
            ]),
          ],
        },
      },
      {
        id: "search",
        label: "Search the houses, but touch nothing hot",
        hours: 3,
        results: {
          any: [
            t(o("A stove never lit. A cellar with real food. Every house has one.", [fx.res("rations", [8, 16]), fx.res("ammo", [2, 6])], 6), [
              { who: "actor", text: "Cold cellar. Cold food. Real food.", mood: "calm", gesture: "offer" },
            ]),
            t(o("Every house has one chair more than it had people. Pulled out, as if for you.", [fx.nerve("all", -5)], 2), [
              { who: "actor", text: "It's pulled out for us. Every house.", mood: "afraid", gesture: "point" },
              { who: "leader", text: "Out. Everybody out. Now." },
            ]),
          ],
        },
      },
      {
        id: "pass",
        label: "Drive straight through",
        results: {
          any: [
            t(o("The candles flicker as you pass, house after house, like a slow wave.", [fx.nerve("all", -2)], 1), [
              { who: "actor", text: "They're waving us goodbye.", mood: "afraid", alt: { stoic: "Eyes on the road." } },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "headcount",
    kind: "oddity",
    weight: 3,
    when: [{ recruitLeft: "orin" }],
    closeBias: 2,
    title: "One too many",
    intro: ["You count heads at supper. You count again. There is one more of you than there should be."],
    talk: [
      { who: "leader", text: "Count off. Everybody. Out loud." },
      { who: "actor", text: "Again? We just did.", mood: "afraid" },
      { who: "leader", text: "I got one too many. Again." },
      { who: "actor", text: "Then who isn't one of us?", mood: "afraid", gesture: "turn-away", alt: { paranoid: "I knew it. I've felt it for days." } },
    ],
    options: [
      {
        id: "search",
        label: "Turn out every wagon",
        hours: 2,
        results: {
          any: [
            t(o("A stowaway among the sacks: thin, filthy, clutching a ledger to his chest.", [fx.recruit("orin", 0.5), fx.nerve("all", 2), fx.res("rations", -2)], 4), [
              { who: "npc:orin", text: "Don't. I'm not one of them. I swear.", mood: "afraid", gesture: "raise-hands" },
              { who: "npc:orin", text: "Something's been following me. I needed people.", mood: "pleading" },
            ]),
            t(o("Nobody. The count is right now. You cannot say when it changed.", [fx.nerve("all", -6)], 6), [
              { who: "actor", text: "Count again. Count again!", mood: "afraid" },
              { who: "leader", text: "It's right. It's right now. That's worse." },
            ]),
          ],
        },
      },
      {
        id: "sleep",
        label: "Say nothing and post a double watch",
        results: {
          any: [
            t(o("A restless night. No one is missing come morning. No one wants to count.", [fx.nerve("all", -4)], 1), [
              { who: "actor", text: "I'm not counting. You count.", mood: "afraid", gesture: "turn-away" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "mirror-wagon",
    kind: "oddity",
    weight: 2,
    title: "Another wagon, the same as yours",
    intro: ["A wagon in the road, same patch, same cracked wheel, same red splash. On the seat, a diary in your handwriting."],
    talk: [
      { who: "actor", text: "That's our patch. I sewed that patch.", mood: "afraid", gesture: "point" },
      { who: "leader", text: "That's my hand. That's my writing." },
      { who: "actor", text: "Then who's been writing it?", mood: "afraid", alt: { haunted: "It's us. After. That's us after." } },
    ],
    options: [
      {
        id: "examine",
        label: "Go through it",
        hours: 1.5,
        results: {
          any: [
            t(o("Spares, food, everything you need. You pack it all. The diary you leave.", [fx.res("spares", [1, 2]), fx.res("rations", [5, 9]), fx.nerve("actor", -7)], 5), [
              { who: "actor", text: "Our flour. Our flour sack. Same stain.", mood: "afraid" },
            ]),
            t(o("Three pages of the diary before you can stop. You wish you had not.", [fx.nerve("actor", -14), fx.nerve("all", -2)], 3), [
              { who: "actor", text: "It says who dies next. It says when.", mood: "afraid", gesture: "clutch" },
              { who: "leader", text: "Burn it. Don't read me anything else." },
            ]),
          ],
        },
      },
      {
        id: "avoid",
        label: "Steer around it and do not look",
        results: {
          any: [
            t(o("It is behind you for hours. Then it is ahead of you, once more.", [fx.nerve("all", -3)], 1), [
              { who: "actor", text: "It's up ahead. How is it up ahead?", mood: "afraid", gesture: "point" },
            ]),
          ],
        },
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
    intro: ["Under the torches, {actor} hums something old. For the first time in days, someone laughs."],
    talk: [
      { who: "actor", text: "My mother sang this shelling peas.", mood: "calm" },
      { who: "actor", text: "Don't laugh. I know I can't carry it.", mood: "calm", gesture: "shrug", alt: { charming: "Somebody take the harmony. I can't do both." } },
    ],
    options: [
      {
        id: "join",
        label: "Let it run. Let everyone breathe.",
        hours: 1,
        results: {
          any: [
            t(o("An hour of a very old, very human sound. Nobody says it matters.", [fx.nerve("all", 6), fx.bondAll(2)], 1), [
              { who: "leader", text: "Second verse. I think I remember it." },
              { who: "actor", text: "You're flat. Keep singing anyway.", mood: "calm", gesture: "beckon" },
              { who: "actor", text: "She'd have liked you all. She would.", mood: "grieving", alt: { stoic: "Good. That was good." } },
            ]),
          ],
        },
      },
      {
        id: "hush",
        label: "Hush them. Sound carries.",
        results: {
          any: [
            t(o("They stop. Nobody speaks. Nobody thanks you.", [fx.nerve("all", -1), fx.trust("actor", -3)], 1), [
              { who: "actor", text: "Right. Course. Sorry.", mood: "grieving", gesture: "turn-away", alt: { hothead: "One song. We can't have one song?" } },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "shared-supper",
    kind: "respite",
    weight: 3,
    others: true,
    title: "A small kindness",
    intro: ["{actor} presses half their supper into {other}'s hands, and looks away so it won't be thanked."],
    talk: [
      { who: "other", text: "That's your share. I can't take your share.", mood: "pleading" },
      { who: "actor", text: "I'm not hungry. Eat it before it's cold.", gesture: "offer", alt: { stoic: "Eat.", charming: "I've been sneaking biscuits all day. Go on." } },
      { who: "other", text: "You're a bad liar, {actor}.", mood: "grieving" },
    ],
    options: [
      {
        id: "say-nothing",
        label: "Say nothing",
        results: {
          any: [
            t(o("It is not your business. It is the best thing you will see all week.", [fx.bond("actor", "other", 8), fx.nerve("actor", 3), fx.nerve("other", 4)], 1), [
              { who: "other", text: "Half. We split it. Don't argue.", mood: "calm", gesture: "offer" },
              { who: "actor", text: "...Half, then.", mood: "calm" },
            ]),
          ],
        },
      },
      {
        id: "praise",
        label: "Praise them in front of everyone",
        results: {
          any: [
            t(o("Awkward, embarrassing, and effective. Something loosens in the whole train.", [fx.bond("actor", "other", 6), fx.trust("all", 2), fx.nerve("all", 2)], 1), [
              { who: "leader", text: "Everybody see that? That's who we are." },
              { who: "actor", text: "Oh, stop it. It was only beans.", mood: "calm", gesture: "turn-away", alt: { charming: "Applause is welcome. Beans are better." } },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "square-of-blue",
    kind: "respite",
    weight: 2,
    title: "A patch of blue",
    intro: ["A gap in the cloud, no bigger than a window: clean blue sky, lit like day. It lasts about a minute."],
    talk: [
      { who: "actor", text: "Look. Look up. Everybody look.", mood: "calm", gesture: "point" },
      { who: "actor", text: "I forgot. I forgot it was that color.", mood: "grieving", alt: { haunted: "It's still there. It's still up there." } },
    ],
    options: [
      {
        id: "watch",
        label: "Stop and watch it",
        hours: 0.5,
        results: {
          any: [
            t(o("The cloud closes. Someone cries very quietly. Then everyone sits a little straighter.", [fx.nerve("all", 6)], 1), [
              { who: "actor", text: "My girl's eyes were that blue.", mood: "grieving" },
              { who: "leader", text: "It's still up there. Past all this. Remember it." },
            ]),
          ],
        },
      },
      {
        id: "go",
        label: "Keep going",
        results: {
          any: [
            t(o("You keep going. Most of the party turns to look back anyway.", [fx.nerve("all", 2)], 1), [
              { who: "actor", text: "Just a second more. Just one.", mood: "pleading", alt: { stoic: "It'll come again. It will." } },
            ]),
          ],
        },
      },
    ],
  },
];
