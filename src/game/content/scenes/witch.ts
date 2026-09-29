// The witch: a multi-stage storyline. Signs first (dolls in the trees, salt on the
// road), then she comes to the ring at night or in fog and takes one to three
// people. The train then chooses between fighting her at the tree line, following
// her into the hollow (a chain of scenes that each cost whole days while the Haze
// closes), bargaining, or rolling on and living with it. The mechanics are in
// ../../witch.ts; this file is only the story.
//
// Randomized per run: how many are taken and who (resistance rolls), what she
// asks for (`witch:demand`), which road through the hollow, and how each offer
// lands. Rescued people may come back changed (marks); people left behind call
// from the fog later (`witch-voice`).
//
// Chain scenes are `crisis` scenes with weight 0: the engine queues them by name,
// and `onlyIf: captives` drops them if the story has already ended.

import type { Cond, Effect, Line, Outcome, OptionDef, SceneDef } from "../../types.ts";
import { fx, o } from "../fx.ts";

const HELD: Cond[] = [{ captives: 1 }];
const demandIs = (k: number): Cond => ({ flag: "witch:demand", min: k, max: k });

export const WITCH_STRANGER: NonNullable<SceneDef["stranger"]> = {
  name: "The witch",
  look: {
    build: "gaunt",
    height: "tall",
    age: 72,
    skin: "waxy and pale, like a candle",
    hair: { style: "long", color: "white, hanging past the waist", facial: "none" },
    clothing: ["a long black oilcloth coat, hem stitched with knucklebones", "a hood of grey wool", "a belt of small rag dolls"],
    palette: ["oilcloth black", "bone white", "oxblood"],
    prop: { id: "doll-staff", desc: "a crooked staff hung with rag dolls, small bones and strips of other people's clothes" },
    marks: ["fingers too long for the hands", "a smile that arrives before she does"],
    summary: "A tall, gaunt old woman in a black oilcloth coat and grey hood, leaning on a staff hung with rag dolls, smiling.",
  },
};

/** An outcome with spoken lines, optionally gated on the option's check. */
function r(text: string, effects: Effect[], talk: Line[], weight = 1, needs?: "success" | "fail", mods?: Outcome["mods"]): Outcome {
  const out: Outcome = { ...o(text, effects, weight, mods), talk };
  if (needs) out.needs = needs;
  return out;
}

/** Time and the Haze are the price of the chase: shown on every option. */
const hazeHint = "The Haze moves about {hazeday} miles a day. The gap is {gap}.";

/** Give up on the captives. Always on offer while they are held. */
function turnBack(label = "Turn back and leave them to her"): OptionDef {
  return {
    id: "turn-back",
    label,
    hint: "No more days lost. The others will remember who chose.",
    results: {
      any: [
        r("You go back the way you came. The fog does not follow, but it watches you go.", [fx.lose("left to the witch", true), fx.nerve("leader", -4)], [
          { who: "leader", text: "We're done. We can't. We're done.", mood: "grieving", gesture: "turn-away" },
          { who: "actor", text: "You're leaving them. You're really leaving them.", mood: "angry", alt: { stoic: "Then let's not look back.", coward: "Thank God. Thank God, let's go." } },
        ], 3),
        r("Nobody speaks on the walk out. Behind you, faintly, someone sings.", [fx.lose("left to the witch", true), fx.nerve("all", -2)], [
          { who: "other", text: "Do you hear that? Somebody's singing.", mood: "afraid", alt: { pious: "Don't listen. Say the words and don't listen." } },
        ], 2),
      ],
    },
  };
}

/** After the first night: what will you do? `fight` only exists at the tree line. */
function decision(atRing: boolean): OptionDef[] {
  const opts: OptionDef[] = [];
  if (atRing) {
    opts.push({
      id: "fight",
      label: "Run her down at the tree line and fight",
      hint: "About an hour. She holds them in front of her. It will cost blood and nerve. The gap stays what it is.",
      hours: 1,
      requires: [{ flag: "witch:fought", max: 0 }],
      why: "She is already gone.",
      results: {
        any: [
          r("You go after her with torches and guns. She turns, and she is not alone.", [fx.set("witch:fought", 1), fx.scene("witch-fled"), fx.combat("witch")], [
            { who: "leader", text: "Fire and lead. Do not hit the ones she's holding.", mood: "cold", gesture: "draw-weapon" },
            { who: "other", text: "She's smiling. Why is she smiling at the guns?", mood: "afraid" },
          ]),
        ],
      },
    });
  }
  opts.push({
    id: "pursue",
    label: "Follow her into the hollow (2 to 4 days)",
    hint: `Every stage costs days. ${hazeHint}`,
    results: {
      any: [
        r("You take the drag marks into the fog, and leave the oxen with the youngest.", [fx.scene("witch-trail"), fx.nerve("all", -1)], [
          { who: "leader", text: "We get them back. Every one. Pack light.", mood: "cold", gesture: "beckon" },
          { who: "actor", text: "It's going to cost us days. You know that.", mood: "afraid", alt: { veteran: "Days we don't have. Good. Let's go." } },
        ], 3),
        r("There is no path to speak of. You follow it anyway.", [fx.scene("witch-trail")], [
          { who: "role:scout", text: "She wants us to come. That's what the trail says.", mood: "cold", gesture: "point" },
        ], 2),
      ],
    },
  });
  opts.push({
    id: "bargain",
    label: "Call her back and bargain (an hour)",
    hint: "No days lost, but she names her price at the ring, and it is worse here than at her own table.",
    hours: 1,
    requires: [{ flag: "witch:bargained", max: 0 }],
    why: "You have already called, and she did not come twice.",
    results: {
      any: [
        r("You call into the fog by name. Something out there is listening. Then it answers.", [fx.set("witch:bargained", 1), fx.scene("witch-bargain")], [
          { who: "leader", text: "I'll talk. Come out. I'll talk.", mood: "calm", gesture: "raise-hands" },
        ]),
      ],
    },
  });
  opts.push({
    id: "abandon",
    label: "Let them go and keep moving (no days lost)",
    hint: "Grief, and the train's trust. Their voices may find you later.",
    results: {
      any: [
        r("You roll out at dawn with the bedrolls still warm. Nobody says their names.", [fx.lose("left to the witch", true), fx.nerve("leader", -3)], [
          { who: "leader", text: "Hitch the oxen. We are not going after her.", mood: "cold", gesture: "turn-away" },
          { who: "actor", text: "They were ours. They were ours and you're leaving.", mood: "angry", alt: { stoic: "He's right. It's a bad trade. It's the right one.", coward: "Yes. Yes. Away from here." } },
          { who: "other", text: "I won't forget this.", mood: "cold", alt: { kind: "God forgive us. God forgive me for agreeing." } },
        ], 3),
        r("You leave a lantern burning on the road for them. It is a lie, and everyone knows it.", [fx.lose("left to the witch", true), fx.nerve("all", -2)], [
          { who: "other", text: "Leave the lantern. If they can walk, they'll find it.", mood: "grieving" },
          { who: "leader", text: "Leave it. Now move.", mood: "cold" },
        ], 2),
      ],
    },
  });
  return opts;
}

// ---------------------------------------------------------------------------
// Offers. The witch asks for one of four things (`witch:demand`), and will take
// the others at worse odds. `tier` is where the bargain happens: at her table
// (with something to lose) or shouted into the fog from the ring.
// ---------------------------------------------------------------------------

function offers(tier: "table" | "ring"): OptionDef[] {
  const table = tier === "table";
  const hours = table ? 4 : 1;
  const bad = table ? 2 : 3;
  const cheat = table ? 0 : 2;
  const suppliesCost = table ? { rations: 12, torches: 3 } : { rations: 18, torches: 4 };
  const at = table ? "her table" : "the fog";
  return [
    {
      id: "offer-supplies",
      label: `Pay her in supplies (${suppliesCost.rations} rations, ${suppliesCost.torches} torches)`,
      hint: `Cheapest in blood. ${table ? "" : "She marks up what she sells from the fog."}`.trim(),
      hours,
      cost: suppliesCost,
      results: {
        any: [
          r("She counts it twice, wetting her thumb, and stands aside. The ones she held blink like people waking.", [fx.restore(0.2)], [
            { who: "stranger", text: "Fair. Fair enough. Take your sleepers home.", mood: "sly", gesture: "offer" },
            { who: "taken", text: "Are we going? Is it over? Are we going now?", mood: "afraid" },
          ], 6, undefined, [{ if: demandIs(0), add: 6 }]),
          r("It is not enough, she says. She keeps the smallest of them and hands back the rest.", [fx.restore(0.3, 1)], [
            { who: "stranger", text: "Not enough, loves. I'll keep one to make up the weight.", mood: "sly" },
            { who: "leader", text: "We had a deal.", mood: "angry" },
          ], bad),
          ...(cheat ? [r(`She takes the sacks into ${at} and does not come back. The captives do not either.`, [fx.lose("kept by the witch")], [
            { who: "actor", text: "She took it all. She took it and she just went.", mood: "afraid", alt: { hothead: "I'll burn this whole fog down." } },
          ], cheat)] : []),
        ],
      },
    },
    {
      id: "offer-years",
      label: "Give her years off the wagon-master's life",
      hint: `A lasting mark: ${table ? "-15 maximum health, forever" : "-15 maximum health for you and one more"}. No goods spent.`,
      hours,
      results: {
        any: [
          r("She takes a hand and holds it too long. When she lets go, you are older, and the captives are breathing.", [fx.mark("leader", "aged"), fx.restore(0.25)], [
            { who: "stranger", text: "Ten years. Twenty. You'll not miss them until you need them.", mood: "sly", gesture: "beckon" },
            { who: "taken", text: "Why is your hair grey? Your hair wasn't grey.", mood: "afraid" },
          ], 6, undefined, [{ if: demandIs(1), add: 6 }]),
          r("She takes more than you meant to give, from you and from whoever held your hand.", [fx.mark("leader", "aged"), fx.mark("actor", "aged"), fx.restore(0.35)], [
            { who: "actor", text: "She's in my chest. She's taking it. Stop her!", mood: "afraid", gesture: "clutch" },
            { who: "stranger", text: "Share and share, dears.", mood: "sly" },
          ], bad),
          ...(cheat ? [r("You feel it go, and nothing stirs in the fog. She took the years and kept the people.", [fx.mark("leader", "aged"), fx.lose("kept by the witch")], [
            { who: "leader", text: "Cheat. Thief. You cheated.", mood: "angry", gesture: "point" },
          ], cheat)] : []),
        ],
      },
    },
    {
      id: "offer-memory",
      label: "Give her a memory (someone's, not the wagon-master's)",
      hint: "A lasting mark: someone forgets faces they should know, and reads people worse.",
      hours,
      results: {
        any: [
          r("{actor} steps forward and speaks a morning aloud. It leaves them like breath on glass. The captives stir.", [fx.mark("actor", "forgotten"), fx.restore(0.2)], [
            { who: "actor", text: "It was a good one. It was... what was it?", mood: "grieving", alt: { stoic: "Take it. It's only a memory." } },
            { who: "stranger", text: "Warm, and sweet, and not yours to spare. Lovely.", mood: "sly" },
          ], 6, undefined, [{ if: demandIs(2), add: 6 }]),
          r("She wants two. She gets one from {actor} and one from you, and you never learn what yours was.", [fx.mark("actor", "forgotten"), fx.mark("leader", "forgotten"), fx.restore(0.3)], [
            { who: "leader", text: "Something's missing. I know something's missing.", mood: "afraid" },
          ], bad),
          ...(cheat ? [r("She drinks the memory and shuts the fog. The captives do not come out.", [fx.mark("actor", "forgotten"), fx.lose("kept by the witch")], [
            { who: "actor", text: "I gave her everything. Why aren't they coming?", mood: "grieving" },
          ], cheat)] : []),
        ],
      },
    },
    {
      id: "offer-person",
      label: "Give her the weakest of you, to keep her company",
      hint: "One more person stays behind for good. Their spouse, lover or close friends may leave, or never forgive you.",
      hours,
      requires: [{ partyMin: 2 }],
      why: "There is no one left to give.",
      results: {
        any: [
          r("She picks the one who hurts most, gently, like fruit. They go with her, and the others walk out.", [fx.giveCrew(), fx.restore(0.1), fx.nerve("all", -6), fx.trust("all", -6)], [
            { who: "stranger", text: "Oh, this one will do nicely. Come, sweet.", mood: "sly", gesture: "beckon" },
            { who: "leader", text: "Walk. Don't look at them. Walk.", mood: "cold", gesture: "turn-away" },
            { who: "other", text: "You sold someone. You sold one of us.", mood: "angry", alt: { pious: "God help us. God help us all." } },
          ], 5, undefined, [{ if: demandIs(3), add: 7 }]),
          r("She takes the weakest and keeps a captive, too. A price of two, from a bargain of one.", [fx.giveCrew(), fx.restore(0.2, 1), fx.nerve("all", -8), fx.trust("all", -8)], [
            { who: "stranger", text: "A girl's gotta eat, hasn't she?", mood: "sly" },
          ], table ? 1 : bad),
        ],
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// The scenes
// ---------------------------------------------------------------------------

const WITCH_STAGE = (k: number): Cond => ({ flag: "witch:stage", min: k, max: k });

export const WITCH_SCENES: SceneDef[] = [
  // ---- Signs ---------------------------------------------------------------
  {
    id: "witch-signs",
    kind: "oddity",
    weight: 1,
    once: true,
    minMile: 60,
    maxMile: 680,
    when: [WITCH_STAGE(0)],
    title: "Dolls in the branches",
    intro: ["Rag dolls hang from every branch along the road, faces stitched shut. Each wears a scrap of somebody's clothes."],
    talk: [
      { who: "actor", text: "Somebody's been at these a long time.", mood: "afraid", alt: { veteran: "Markers. Somebody claims this ground.", coward: "Please don't touch them. Please." } },
      { who: "other", text: "That one has a wedding ribbon. That one's a child's sock.", mood: "grieving" },
      { who: "role:scout", text: "Salt on the road. Knucklebones in a ring. Fresh.", mood: "cold", gesture: "point" },
      { who: "leader", text: "Nobody takes a doll. Nobody counts them.", mood: "cold" },
    ],
    options: [
      {
        id: "ward",
        label: "Ring the camp in salt and torchlight tonight",
        hint: "The camp is warded when she comes. She takes fewer, and they hold against her better.",
        hours: 1,
        cost: { torches: 2 },
        results: {
          any: [
            r("You lay salt in a ring and light it. Whatever left the dolls watches from the trees and does not cross.", [fx.set("witch:stage", 1), fx.set("witch:warded", 1), fx.set("witch:due", [1, 3], true), fx.nerve("all", 1)], [
              { who: "leader", text: "Salt, fire, and nobody leaves the ring.", mood: "calm", gesture: "point" },
              { who: "actor", text: "It's just superstition. Isn't it just superstition?", mood: "afraid", alt: { pious: "Salt is blessed. I'll say the words." } },
            ], 3),
            r("The salt hisses where it touches the dolls' shadows. The scout does not sleep.", [fx.set("witch:stage", 1), fx.set("witch:warded", 1), fx.set("witch:due", [1, 3], true)], [
              { who: "role:scout", text: "Something walked the ring twice. It didn't step in.", mood: "afraid" },
            ], 2),
          ],
        },
      },
      {
        id: "study",
        label: "Study the marks and the salt",
        hint: "An hour and a half. A steady eye may learn how she works.",
        hours: 1.5,
        check: { kind: "spot", dc: 10, target: "the marks" },
        results: {
          any: [
            r("The dolls are stitched in threes. The salt lines point one way, and the way is where she sleeps.", [fx.set("witch:stage", 1), fx.set("witch:lore", 1), fx.set("witch:due", [1, 3], true)], [
              { who: "by", text: "Three to a branch. One for each she means to take.", mood: "cold", gesture: "point" },
              { who: "leader", text: "Then she counts. Good. Counters can be cheated.", mood: "cold" },
            ], 1, "success"),
            r("You look too long. One of the dolls has {actor}'s coat button on it.", [fx.set("witch:stage", 1), fx.set("witch:due", [1, 3], true), fx.nerve("actor", -4)], [
              { who: "actor", text: "That's my button. That's my button, I lost it a week ago.", mood: "afraid", gesture: "clutch" },
            ], 1, "fail"),
          ],
        },
      },
      {
        id: "press",
        label: "Ignore them and roll on",
        hint: "Free, and it costs nothing tonight.",
        results: {
          any: [
            r("You drive past them without looking. In the mirror of your mind they turn to watch you go.", [fx.set("witch:stage", 1), fx.set("witch:due", [1, 3], true), fx.nerve("all", -1)], [
              { who: "actor", text: "Faster. Just go faster.", mood: "afraid", alt: { stoic: "They're dolls. Keep your eyes on the oxen." } },
              { who: "leader", text: "Steady. Steady pace.", mood: "cold" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "witch-fog-lure",
    kind: "haze",
    weight: 0.8,
    once: true,
    minMile: 100,
    closeBias: 2,
    when: [WITCH_STAGE(0), { gapBelow: 42 }],
    title: "A woman in the red",
    intro: ["A figure stands in the red fog off the road, waving, as if she had been waiting for you all day."],
    stranger: WITCH_STRANGER,
    talk: [
      { who: "stranger", text: "Come in out of the road, loves. I've a fire.", mood: "calm", gesture: "beckon" },
      { who: "actor", text: "She's smiling too much. Nobody smiles like that now.", mood: "afraid", alt: { kind: "Maybe she's lost. Maybe she's like us.", paranoid: "No. No, no, no. That's wrong." } },
      { who: "stranger", text: "{actor}. {other}. Come and sit by me.", mood: "sly", gesture: "point" },
      { who: "other", text: "How does she know our names?", mood: "afraid" },
    ],
    options: [
      {
        id: "torches",
        label: "Light every torch and drive past",
        hint: "Costs 2 torches. She will come for the camp tonight, and it will be warded.",
        cost: { torches: 2 },
        hours: 0.5,
        results: {
          any: [
            r("You drive through a wall of fire, and she turns her face away from it. She is not angry. She is patient.", [fx.set("witch:stage", 1), fx.set("witch:warded", 1), fx.set("witch:due", [0, 1], true), fx.nerve("all", -1)], [
              { who: "leader", text: "Drive. Don't look at her. Drive.", mood: "cold", gesture: "point" },
              { who: "stranger", text: "See you tonight, loves. I'll leave the door open.", mood: "sly" },
            ]),
          ],
        },
      },
      {
        id: "refuse",
        label: "Turn the wagons from her",
        hint: "Free. She does not follow. She does not need to.",
        results: {
          any: [
            r("You turn the oxen away. Behind you she keeps waving, in the same rhythm, long after she should be out of sight.", [fx.set("witch:stage", 1), fx.set("witch:due", [0, 1], true), fx.nerve("all", -2)], [
              { who: "actor", text: "She's still waving. She's still waving, isn't she?", mood: "afraid", alt: { stoic: "Don't check. Don't check on her." } },
            ]),
          ],
        },
      },
      {
        id: "call",
        label: "Call out and ask what she wants",
        hint: "A steady voice might learn something. A shaky one invites her.",
        check: { kind: "persuade", dc: 13, target: "the woman in the red" },
        results: {
          any: [
            r("She names her price, sweetly, and you catch a word or two of the rest before she lets the fog take it.", [fx.set("witch:stage", 1), fx.set("witch:lore", 1), fx.set("witch:due", [1, 2], true)], [
              { who: "by", text: "State your business, ma'am. Nobody walks out of the road.", mood: "cold" },
              { who: "stranger", text: "Only the tired ones, dear. Only the tired ones.", mood: "sly" },
            ], 1, "success"),
            r("You called, and she took the call as an invitation. The singing starts in daylight.", [fx.set("witch:stage", 1), fx.scene("witch-takes")], [
              { who: "by", text: "What do you want with—", mood: "afraid" },
              { who: "stranger", text: "Oh, thank you for asking.", mood: "sly", gesture: "raise-hands" },
            ], 1, "fail"),
          ],
        },
      },
    ],
  },

  // ---- The taking ----------------------------------------------------------
  {
    id: "witch-takes",
    kind: "crisis",
    weight: 0,
    title: "The singing",
    intro: ["The singing starts before you see her. The torches gutter low, though there is no wind."],
    stranger: WITCH_STRANGER,
    talk: [
      { who: "stranger", text: "Sleep, little ones. I've room for all of you.", mood: "calm", gesture: "beckon" },
      { who: "actor", text: "Somebody's singing. Who's singing?", mood: "afraid", alt: { stoic: "Don't answer it. Whatever it says, don't answer.", pious: "Lord, hold my feet. Hold my feet." } },
      { who: "other", text: "My feet are moving. Why are my feet moving?", mood: "afraid", gesture: "clutch" },
      { who: "leader", text: "Hold the ring. Hold each other. Do not walk.", mood: "cold", gesture: "raise-hands" },
    ],
    options: [
      {
        id: "hold",
        label: "Hold the torches high and link arms",
        hint: "Costs 2 torches. Everyone holds against her better, and she takes fewer.",
        cost: { torches: 2 },
        hours: 0.5,
        results: {
          any: [
            r("The ring holds, for most of you. Something in the fog is patient, and picks at the edges.", [fx.abduct(true), fx.scene("witch-aftermath")], [
              { who: "leader", text: "Hold on! Hold! Don't let go of my arm!", mood: "afraid" },
              { who: "actor", text: "I can't feel my hand. Somebody— my hand—", mood: "afraid", gesture: "clutch" },
            ], 3),
            r("A torch goes out, then another. The singing gets closer and kinder.", [fx.abduct(true), fx.scene("witch-aftermath")], [
              { who: "stranger", text: "There. There, that's the way. Come to me.", mood: "sly" },
            ], 2),
            r("The salt and the fire hold. She walks the ring three times, and stops, and is gone before the first torch burns low.", [fx.set("witch:stage", 3), fx.nerve("all", 3)], [
              { who: "leader", text: "Stay in the ring. Stay in the ring till it's light.", mood: "calm" },
              { who: "actor", text: "She's gone. She just... gave up.", mood: "calm", alt: { stoic: "She'll be back. Not tonight." } },
            ], 0, undefined, [{ if: { flag: "witch:warded", min: 1 }, add: 6 }]),
          ],
        },
      },
      {
        id: "shout",
        label: "Shout her down",
        hint: "The best voice in camp answers her. Steady nerves help everyone hold.",
        check: { kind: "calm", dc: 12, target: "the witch" },
        results: {
          any: [
            r("{by} shouts the old hymn back at her, off-key and furious, and the ring stiffens around it.", [fx.abduct(true), fx.scene("witch-aftermath")], [
              { who: "by", text: "No. You don't get them. You don't get anyone.", mood: "angry", gesture: "point" },
              { who: "stranger", text: "Oh, but I do. I get whoever's listening.", mood: "sly" },
            ], 1, "success"),
            r("Your voice cracks on the first word. She heard the crack, and she sings to it.", [fx.abduct(false), fx.scene("witch-aftermath"), fx.nerve("by", -3)], [
              { who: "by", text: "Stay away from— stay away from— I—", mood: "afraid" },
            ], 1, "fail"),
          ],
        },
      },
      {
        id: "stand",
        label: "Stand still and say nothing",
        hint: "Free. It is the worst way to meet her.",
        results: {
          any: [
            r("Nobody moves. Nobody answers. It makes no difference to her at all.", [fx.abduct(false), fx.scene("witch-aftermath")], [
              { who: "other", text: "I'm not answering. I'm not— I'm walking.", mood: "afraid" },
              { who: "leader", text: "Grab them! Somebody grab them!", mood: "afraid", gesture: "point" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "witch-aftermath",
    kind: "crisis",
    weight: 0,
    onlyIf: HELD,
    title: "Empty bedrolls",
    intro: ["Gone from the ring: {captives}. Their boots are still by the fire.", "The fog has a path in it now, narrow as a hallway."],
    talk: [
      { who: "actor", text: "She took them. She just walked them out.", mood: "afraid" },
      { who: "other", text: "Which way? Which way did she go?", mood: "pleading", alt: { hothead: "I'll follow her myself. Give me a torch." } },
      { who: "role:scout", text: "Tracks stop at the tree line. After that, drag marks.", mood: "cold", gesture: "point" },
      { who: "leader", text: "We decide now. Every hour we stand here she gets farther.", mood: "cold" },
    ],
    options: decision(true),
  },
  {
    id: "witch-fled",
    kind: "crisis",
    weight: 0,
    onlyIf: HELD,
    title: "She is gone",
    intro: ["The fog has closed over the road where she stood. {captives} went with her."],
    talk: [
      { who: "other", text: "She's gone. She's gone and she took them.", mood: "afraid" },
      { who: "role:scout", text: "Drag marks, into the trees. She wants us to see them.", mood: "cold", gesture: "point" },
      { who: "leader", text: "Now we choose. Quickly.", mood: "cold" },
    ],
    options: decision(false),
  },

  // ---- Bargaining at the ring ------------------------------------------------
  {
    id: "witch-bargain",
    kind: "crisis",
    weight: 0,
    onlyIf: HELD,
    title: "A price, shouted into the fog",
    intro: ["She answers from where you cannot see. The voice comes from everywhere at once."],
    stranger: WITCH_STRANGER,
    talk: [
      { who: "stranger", text: "Bread and oil, love. What the wagons carry.", mood: "sly", when: [demandIs(0)] },
      { who: "stranger", text: "Years. A bite of yours, and I'll not need theirs.", mood: "sly", when: [demandIs(1)] },
      { who: "stranger", text: "A memory. Sweet, and not yours to spare.", mood: "sly", when: [demandIs(2)] },
      { who: "stranger", text: "One of you, to keep the chair warm.", mood: "sly", when: [demandIs(3)] },
      { who: "leader", text: "Name it plainly. What do you want for them?", mood: "cold" },
      { who: "taken", text: "Please. Please just say yes. Please say yes.", mood: "pleading" },
    ],
    options: [
      ...offers("ring"),
      {
        id: "decline",
        label: "Say no, and think again",
        hint: "Free. She loses interest in you at the ring.",
        results: {
          any: [
            r("You refuse. The fog laughs, kindly, and thins. You are left with the road and what to do next.", [fx.scene("witch-fled")], [
              { who: "stranger", text: "Come to my door, then. It's not locked.", mood: "sly" },
            ]),
          ],
        },
      },
    ],
  },

  // ---- Into the hollow ------------------------------------------------------
  {
    id: "witch-trail",
    kind: "crisis",
    weight: 0,
    onlyIf: HELD,
    title: "The trail into the hollow",
    intro: ["The drag marks end at a ditch of black water. Beyond it a footpath of pressed salt runs into the fog."],
    talk: [
      { who: "role:scout", text: "Three ways in. The marks, the salt, or the voice.", mood: "cold", gesture: "point" },
      { who: "taken", text: "Here. I'm here. Please don't leave me here.", mood: "pleading" },
      { who: "actor", text: "That's {taken}. That's their voice.", mood: "afraid" },
      { who: "leader", text: "Choose. Whatever we choose, we choose fast.", mood: "cold" },
    ],
    options: [
      {
        id: "track",
        label: "Read the drag marks (1 day)",
        hint: `The best tracker rolls. A good read finds a short road. ${hazeHint}`,
        check: { kind: "spot", dc: 10, target: "the trail" },
        results: {
          any: [
            r("The marks are old, and then they are fresh, and then you know which are which. You find a shorter way.", [fx.days(1), fx.scene("witch-door")], [
              { who: "by", text: "She dragged them. She tired, here. This way.", mood: "cold", gesture: "point" },
            ], 3, "success"),
            r("The trail bends back on itself and you follow it to a wood of dolls.", [fx.days(1), fx.scene("witch-wood")], [
              { who: "by", text: "Wait. I know this. I know this, we've passed it.", mood: "afraid" },
            ], 2, "success"),
            r("A pair of pale hounds lie across the path where the marks lead. You did not see them until you were close.", [fx.days(1), fx.scene("witch-hounds")], [
              { who: "by", text: "There's something there. Two somethings.", mood: "afraid", gesture: "point" },
            ], 1, "success"),
            r("You read the marks wrong, and read them again. It costs a day and a bad decision. The path goes under water.", [fx.days(2), fx.nerve("actor", -3), fx.scene("witch-bog")], [
              { who: "by", text: "I was sure. I was sure, and I was wrong.", mood: "grieving" },
              { who: "leader", text: "Then be sure now. Go.", mood: "cold" },
            ], 3, "fail"),
            r("You lose the trail for a night. When you find it again, dolls hang from every tree.", [fx.days(2), fx.scene("witch-wood")], [
              { who: "actor", text: "We've walked in a circle. We must have.", mood: "afraid" },
            ], 2, "fail"),
          ],
        },
      },
      {
        id: "salt",
        label: "Follow the path of salt (1 day)",
        hint: `No skill needed, no shortcut either. ${hazeHint}`,
        results: {
          any: [
            r("The salt path goes under the black water, then out again. It is a road for someone on foot who does not mind.", [fx.days(1), fx.nerve("all", -1), fx.scene("witch-bog")], [
              { who: "other", text: "It's a road. It's a road she made for us.", mood: "afraid" },
            ]),
            r("The salt leads through a wood where every tree has a face, and every face is somebody's.", [fx.days(1), fx.scene("witch-wood")], [
              { who: "actor", text: "Don't look at the trees. Look at the salt.", mood: "afraid" },
            ]),
            r("The salt ends at two dogs asleep in the path. They are not asleep.", [fx.days(1), fx.scene("witch-hounds")], [
              { who: "role:scout", text: "Dogs. Ribs stitched shut. Don't breathe loud.", mood: "cold" },
            ], 0.7),
          ],
        },
      },
      {
        id: "voice",
        label: "Follow the voice calling from the fog (1 day)",
        hint: `It knows the way. It may not be what it sounds like. ${hazeHint}`,
        results: {
          any: [
            r("{taken}'s voice leads you straight, and gently, and you do not want to think about why she wants you fast.", [fx.days(1), fx.nerve("leader", -4), fx.scene("witch-door")], [
              { who: "taken", text: "This way. Oh, this way. You came. You came for me.", mood: "pleading" },
            ], 2),
            r("The voice moves when you do, always ten steps ahead. It leads you through the dogs.", [fx.days(1), fx.nerve("actor", -4), fx.scene("witch-hounds")], [
              { who: "actor", text: "It's not them. It's her. She's using their voice.", mood: "afraid", alt: { pious: "Mercy. Mercy on whoever's asking us." } },
            ], 1),
            r("You follow the voice into a wood where the voices are all of them at once.", [fx.days(1), fx.mark("actor", "hexed", 0.5), fx.scene("witch-wood")], [
              { who: "taken", text: "Here I am. Here I am. Here I am.", mood: "pleading" },
            ], 1),
          ],
        },
      },
      turnBack("Give it up before it starts"),
    ],
  },
  {
    id: "witch-bog",
    kind: "crisis",
    weight: 0,
    onlyIf: HELD,
    title: "The drowned road",
    intro: ["The path goes under. Black water to the knee, then the waist, and things in it that brush your legs."],
    talk: [
      { who: "actor", text: "Something touched my leg. Something touched my leg.", mood: "afraid", alt: { stoic: "It's weed. It's weed. Keep moving." } },
      { who: "other", text: "Keep moving. Whatever it is, it's slow.", mood: "cold" },
      { who: "leader", text: "Rope. Hands on the rope. Nobody swims.", mood: "cold", gesture: "point" },
    ],
    options: [
      {
        id: "wade",
        label: "Wade straight across",
        hint: "Quick. The water takes something.",
        hours: 1,
        results: {
          any: [
            r("You come out black to the chest, and short a few things the water wanted.", [fx.res("rations", [-6, -3]), fx.scene("witch-door")], [
              { who: "actor", text: "Done. It's done. I'm never going in water again.", mood: "calm" },
            ], 4),
            r("Something holds {actor}'s ankle under. It lets go, in its own time.", [fx.hp("actor", [-14, -8]), fx.fog("actor"), fx.scene("witch-door")], [
              { who: "actor", text: "It had me. It had me by the foot. It let go.", mood: "afraid", gesture: "clutch" },
            ], 2),
          ],
        },
      },
      {
        id: "raft",
        label: "Lash a raft from reeds (half a day)",
        hint: "Slower, and safer for most.",
        hours: 6,
        results: {
          any: [
            r("The raft holds. Nobody talks. Something tugs at the reeds the whole way and never quite gets a grip.", [fx.nerve("all", -1), fx.scene("witch-door")], [
              { who: "role:mechanic", text: "Good lashing. It'll hold if nobody stands.", mood: "calm" },
            ], 5),
            r("A lash parts mid-water. You spend a spare part and everyone's temper getting to the far side.", [fx.res("spares", -1), fx.nerve("all", -2), fx.scene("witch-door")], [
              { who: "other", text: "I told you the knot was wrong.", mood: "angry" },
            ], 2),
          ],
        },
      },
      {
        id: "round",
        label: "Go round by dry ground (1 day)",
        hint: `No risk, and the day is gone. ${hazeHint}`,
        results: {
          any: [
            r("Dry ground, and a day of walking it. The fog does not thin, but nothing touches you.", [fx.days(1), fx.scene("witch-door")], [
              { who: "leader", text: "Slower. Safer. We'll pay for it later.", mood: "cold" },
            ]),
          ],
        },
      },
      turnBack(),
    ],
  },
  {
    id: "witch-wood",
    kind: "crisis",
    weight: 0,
    onlyIf: HELD,
    title: "The wood of dolls",
    intro: ["A doll in every tree, and every doll has a name pinned to it. Yours are here, in a child's hand."],
    talk: [
      { who: "actor", text: "That's my name. That's my name on it.", mood: "afraid", alt: { coward: "Don't read them. Don't read them.", veteran: "Bait. It's bait. Keep walking." } },
      { who: "other", text: "Don't read them. Walk and don't read them.", mood: "cold" },
      { who: "taken", text: "They're all so quiet here. Please don't be quiet.", mood: "pleading" },
      { who: "leader", text: "Eyes down. Put one foot in front of the other.", mood: "cold" },
    ],
    options: [
      {
        id: "walk",
        label: "Walk through with your eyes down",
        hint: "A steady head gets everyone through.",
        hours: 2,
        check: { kind: "calm", dc: 11, target: "the wood" },
        results: {
          any: [
            r("Somebody hums the whole way, badly, and the dolls do not like it. You come out the far side.", [fx.nerve("all", -1), fx.scene("witch-door")], [
              { who: "by", text: "Just keep walking. Don't look. Keep humming.", mood: "calm" },
            ], 1, "success"),
            r("Someone reads a name aloud, and the name answers. It costs you a bad half hour and a piece of {actor}.", [fx.nerve("actor", -8), fx.mark("actor", "hexed", 0.5), fx.scene("witch-door")], [
              { who: "actor", text: "It said my name back. It said it back to me.", mood: "afraid", gesture: "clutch" },
            ], 1, "fail"),
          ],
        },
      },
      {
        id: "burn",
        label: "Burn the dolls",
        hint: "Costs 2 torches. She will know you are coming, but fire hurts her, and will hurt her worse.",
        hours: 1,
        cost: { torches: 2 },
        results: {
          any: [
            r("The dolls burn with a sound like small breath. Somewhere deeper in, something old stops singing.", [fx.set("witch:weakened", 1), fx.nerve("all", 1), fx.scene("witch-door")], [
              { who: "leader", text: "Burn them all. Let her smell it from here.", mood: "angry", gesture: "point" },
            ], 3),
            r("A doll screams as it goes up. It was not made of rag. {actor} is burned trying to pull the rest back.", [fx.set("witch:weakened", 1), fx.hp("actor", [-10, -5]), fx.scene("witch-door")], [
              { who: "actor", text: "It had a heartbeat. It had a heartbeat!", mood: "afraid", gesture: "clutch" },
            ], 2),
          ],
        },
      },
      {
        id: "skirt",
        label: "Skirt the edge of the wood (1 day)",
        hint: `Safe, and long. ${hazeHint}`,
        results: {
          any: [
            r("The edge of the wood is a hem of black thorn. It takes a day to cut round it.", [fx.days(1), fx.scene("witch-door")], [
              { who: "other", text: "Every hour we cut thorn, she's getting further.", mood: "afraid" },
            ]),
          ],
        },
      },
      turnBack(),
    ],
  },
  {
    id: "witch-hounds",
    kind: "crisis",
    weight: 0,
    onlyIf: HELD,
    title: "Her hounds",
    intro: ["Two pale dogs lie across the path like a gate. Their ribs are stitched up with black thread."],
    talk: [
      { who: "role:hunter", text: "Not dogs. Not anymore. Look at the stitches.", mood: "cold" },
      { who: "actor", text: "They're not moving. Why aren't they moving?", mood: "afraid", alt: { coward: "We should leave them. We should leave everything." } },
      { who: "leader", text: "Ammunition, or nerve, or food. Pick one.", mood: "cold" },
    ],
    options: [
      {
        id: "fight",
        label: "Fight them on the path",
        hint: "Costs blood and shot. Fast.",
        hours: 0.5,
        results: {
          any: [
            r("They wake all at once, without a sound. You have to kill them twice.", [fx.scene("witch-door"), fx.combat("haze-hounds")], [
              { who: "leader", text: "Now! Before they finish waking!", mood: "angry", gesture: "draw-weapon" },
            ]),
          ],
        },
      },
      {
        id: "sneak",
        label: "Slip past them",
        hint: "A calm voice and a steady hand. If it fails, you fight anyway.",
        hours: 1,
        check: { kind: "calm", dc: 12, target: "the hounds" },
        results: {
          any: [
            r("You walk between them, breathing through your mouth. They do not lift their heads.", [fx.scene("witch-door")], [
              { who: "by", text: "Easy. Easy, easy. Nobody look at them.", mood: "calm" },
            ], 1, "success"),
            r("Someone's boot cracks a twig. The dogs open their eyes, and they are not a dog's eyes.", [fx.scene("witch-door"), fx.combat("haze-hounds")], [
              { who: "actor", text: "Run— no— don't run— oh God—", mood: "afraid" },
            ], 1, "fail"),
          ],
        },
      },
      {
        id: "feed",
        label: "Throw them food (8 rations)",
        hint: "Costs 8 rations. They eat like they have never been fed.",
        cost: { rations: 8 },
        hours: 0.5,
        results: {
          any: [
            r("They eat and eat. When you pass they follow with their eyes, and their mouths are still moving.", [fx.scene("witch-door")], [
              { who: "other", text: "Go. Go, while they're still eating.", mood: "afraid", alt: { kind: "Poor things. Poor, stitched-up things." } },
            ]),
          ],
        },
      },
      turnBack(),
    ],
  },

  // ---- Her table -------------------------------------------------------------
  {
    id: "witch-door",
    kind: "crisis",
    weight: 0,
    onlyIf: HELD,
    title: "The witch's table",
    intro: ["A crooked house on stilts in the fog, lit from inside. She sits at a table set for every one she took."],
    stranger: WITCH_STRANGER,
    talk: [
      { who: "stranger", text: "Bread and oil, love. What the wagons carry.", mood: "sly", gesture: "offer", when: [demandIs(0)] },
      { who: "stranger", text: "Years. A bite of yours, and I'll not need theirs.", mood: "sly", gesture: "offer", when: [demandIs(1)] },
      { who: "stranger", text: "A memory. Sweet, and not yours to spare.", mood: "sly", gesture: "offer", when: [demandIs(2)] },
      { who: "stranger", text: "One of you, to keep the chair warm.", mood: "sly", gesture: "offer", when: [demandIs(3)] },
      { who: "stranger", text: "Sit. Eat. You've come a long way for so little.", mood: "calm", gesture: "beckon" },
      { who: "leader", text: "Tell me what you want. Then let them stand up.", mood: "cold" },
      { who: "taken", text: "I'm here. I can't get up. Don't let me stay.", mood: "pleading" },
    ].slice(0, 6) as Line[],
    options: [
      {
        id: "riddle",
        label: "Answer her riddle",
        hint: "Half a night at her table. The best head gives the answer.",
        hours: 4,
        check: { kind: "persuade", dc: 12, target: "the witch" },
        results: {
          any: [
            r("She asks what is heavier every year it is carried. {by} says a name. She claps like a girl.", [fx.restore(0.15)], [
              { who: "stranger", text: "Grief! Yes! Nobody says grief anymore. Go on, then.", mood: "calm", gesture: "raise-hands" },
              { who: "taken", text: "Are we going? Did you win? Are we going home?", mood: "afraid" },
            ], 1, "success"),
            r("{by} answers, and she smiles. It was the wrong answer. She keeps one of them and takes a gift from {by}.", [fx.restore(0.4, 1), fx.mark("by", "hexed"), fx.nerve("by", -6)], [
              { who: "stranger", text: "Oh, close. Close. I'll keep one to remind you.", mood: "sly" },
              { who: "by", text: "I was sure. I was sure, I was so sure.", mood: "grieving" },
            ], 2, "fail"),
            r("She asks a riddle with no answer. {by} says the right nothing. She lets the rest go, and takes a memory.", [fx.mark("by", "forgotten"), fx.restore(0.3)], [
              { who: "stranger", text: "That'll do. That'll do nicely. I'll have something for it.", mood: "sly" },
            ], 1, "fail"),
          ],
        },
      },
      ...offers("table"),
      {
        id: "fight",
        label: "Overturn the table and take her by force",
        hint: "An hour of bad fighting. She holds them, and she turns them. Torches and a burned wood help.",
        hours: 1,
        results: {
          any: [
            r("The table goes over. Every plate on it is full of hair.", [fx.set("witch:fought", 1), fx.scene("witch-final-fled"), fx.combat("witch")], [
              { who: "leader", text: "Now! Fire! Grab them and pull!", mood: "angry", gesture: "draw-weapon" },
              { who: "stranger", text: "Is that all? I was going to be so kind.", mood: "cold" },
            ]),
          ],
        },
      },
      turnBack("Push the chair back and leave them at her table"),
    ],
  },
  {
    id: "witch-final-fled",
    kind: "crisis",
    weight: 0,
    onlyIf: HELD,
    title: "The hollow folds shut",
    intro: ["The house comes apart like paper in rain. What she kept, she keeps. The walk out takes the rest of the day."],
    talk: [
      { who: "actor", text: "Where's the door? Where did the door go?", mood: "afraid" },
      { who: "leader", text: "Out. Now. Whoever we have, we walk out with.", mood: "cold", gesture: "beckon" },
    ],
    options: [
      {
        id: "walk-out",
        label: "Walk out (1 day)",
        hint: `Whatever she kept stays kept. ${hazeHint}`,
        results: {
          any: [
            r("The fog lets you go the way it took you, without a sound. Behind you, a door that was never there closes.", [fx.days(1), fx.lose("kept by the witch"), fx.nerve("all", -3)], [
              { who: "other", text: "She kept them. She's kept them.", mood: "grieving" },
              { who: "leader", text: "We came. We tried. That's what we have.", mood: "cold" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "witch-freed",
    kind: "crisis",
    weight: 0,
    title: "What she left behind",
    intro: ["The witch is gone, and the ones she held sit in the road with their hands open, learning what they are."],
    talk: [
      { who: "actor", text: "You came. Nobody comes back. You came.", mood: "grieving", alt: { stoic: "You came. Good. That's enough talk." } },
      { who: "other", text: "Her dolls are still in the trees. All of them.", mood: "afraid" },
      { who: "leader", text: "We burn them or we leave them. Quickly.", mood: "cold" },
    ],
    options: [
      {
        id: "burn",
        label: "Burn the dolls",
        hint: "Costs 1 torch. Half an hour. It is a kind of grave.",
        hours: 0.5,
        cost: { torches: 1 },
        results: {
          any: [
            r("They burn quiet and small, and you feel the road lighten. Nobody sleeps badly that night.", [fx.nerve("all", 4), fx.bondAll(2)], [
              { who: "actor", text: "There. There. It's finished.", mood: "calm" },
            ]),
          ],
        },
      },
      {
        id: "leave",
        label: "Leave them and go",
        hint: "Free.",
        results: {
          any: [
            r("You leave the dolls in the trees, and hurry on before dark.", [], [
              { who: "leader", text: "Move out. All of us, together this time.", mood: "calm" },
            ]),
          ],
        },
      },
    ],
  },

  // ---- Later ------------------------------------------------------------------
  {
    id: "witch-voice",
    kind: "haze",
    weight: 4,
    closeBias: 1.5,
    when: [{ flag: "witch:lost", min: 1 }, { flag: "witch:haunts", max: 2 }],
    title: "A voice you know",
    intro: ["Out in the fog beside the road, someone is calling your name in a voice you have missed."],
    talk: [
      { who: "taken", text: "{leader}? {leader}, it's cold out here. Where did you go?", mood: "pleading" },
      { who: "actor", text: "That's {taken}. That's their voice. That's them.", mood: "afraid", alt: { stoic: "It isn't them. It stopped being them.", pious: "Rest them. Rest them and let them be." } },
      { who: "other", text: "We left them. They're calling because we left them.", mood: "grieving" },
      { who: "leader", text: "It isn't them. Keep walking.", mood: "cold" },
    ],
    options: [
      {
        id: "answer",
        label: "Call back to it",
        hint: "Free. It might be them.",
        results: {
          any: [
            r("You call, and it calls back, closer. Whatever it is, it knows your name better than it should.", [fx.set("witch:haunts", 0), fx.flag("witch:haunts"), fx.nerve("leader", -6), fx.nerve("actor", -4)], [
              { who: "leader", text: "I'm sorry. I'm so sorry. I'm sorry.", mood: "grieving" },
              { who: "taken", text: "It's all right. It's all right. Come and sit.", mood: "calm" },
            ], 3),
            r("The voice stops as soon as you speak. You wait a long time to hear it again, and you don't.", [fx.flag("witch:haunts"), fx.nerve("leader", -3)], [
              { who: "actor", text: "Why did it stop? Why did it stop?", mood: "afraid" },
            ], 2),
          ],
        },
      },
      {
        id: "ignore",
        label: "Ignore it and drive on",
        hint: "Free. It will not forget.",
        results: {
          any: [
            r("You drive on. It follows for a mile along the edge of the fog, saying the same three words.", [fx.flag("witch:haunts"), fx.nerve("all", -2)], [
              { who: "other", text: "It's still saying it. Make it stop saying it.", mood: "afraid", alt: { stoic: "Hum something. Anything." } },
            ]),
          ],
        },
      },
      {
        id: "pray",
        label: "Light a torch and sing them down",
        hint: "Costs 1 torch. The pious and the steady take it best.",
        cost: { torches: 1 },
        hours: 0.5,
        results: {
          any: [
            r("You sing the old hymn until the voice turns and walks off. Some of it rings true.", [fx.flag("witch:haunts"), fx.nerve("all", 2)], [
              { who: "actor", text: "Rest. Rest now. It's all right to rest.", mood: "calm", alt: { pious: "Lord, take them. They are yours." } },
            ], 3),
            r("The voice sings with you, perfectly, a half beat late. No one finishes the hymn.", [fx.flag("witch:haunts"), fx.nerve("all", -2)], [
              { who: "other", text: "It's singing with us. Why is it singing with us?", mood: "afraid" },
            ], 1),
          ],
        },
      },
    ],
  },
];
