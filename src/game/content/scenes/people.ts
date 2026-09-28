// The party itself: quarrels between members, and crises that surface in the
// night. Disputes run through the same scene engine as strangers, so a false
// accusation can carry tells just like a false plea for help.

import type { Cond, Effect, Member, OptionDef, Outcome, SceneDef } from "../../types.ts";
import { fx, o } from "../fx.ts";

interface QuarrelCfg {
  id: string;
  weight: number;
  title: string;
  intro: string[];
  when?: Cond[];
  genuineOdds?: number;
  tells?: SceneDef["tells"];
  pairWeight: (a: Member, b: Member, bond: number) => number;
  /** Override what happens when you back {a}. */
  sideA?: OptionDef["results"];
  sideB?: OptionDef["results"];
  extras?: OptionDef[];
  mediateFx?: Effect[];
}

const MEDIATOR_MODS = [
  { if: { trait: "charming" } as Cond, add: 2 },
  { if: { role: "speaker" } as Cond, add: 2 },
  { if: { trait: "pious" } as Cond, add: 1 },
  { if: { trait: "kind" } as Cond, add: 1 },
];

function quarrel(cfg: QuarrelCfg): SceneDef {
  const defaultA: Outcome[] = [
    o("You side with {a}. {b} swallows it, and it sits badly.", [fx.trust("a", 5), fx.trust("b", -7), fx.bond("a", "b", -4), fx.nerve("b", -3)]),
  ];
  const defaultB: Outcome[] = [
    o("You side with {b}. {a} goes quiet, and stays quiet.", [fx.trust("b", 5), fx.trust("a", -7), fx.bond("a", "b", -4), fx.nerve("a", -3)]),
  ];
  return {
    id: cfg.id,
    kind: "dispute",
    weight: cfg.weight,
    when: cfg.when,
    genuineOdds: cfg.genuineOdds,
    tells: cfg.tells,
    pairWeight: cfg.pairWeight,
    title: cfg.title,
    intro: cfg.intro,
    options: [
      { id: "side-a", label: "Back {a}", results: cfg.sideA ?? { any: defaultA } },
      { id: "side-b", label: "Back {b}", results: cfg.sideB ?? { any: defaultB } },
      {
        id: "mediate",
        label: "Sit them down and hear them both out",
        hint: "Takes time. Might actually work.",
        hours: 2,
        hoursMod: { if: { any: [{ trait: "charming" }, { role: "speaker" }] }, mult: 0.5 },
        results: {
          any: [
            o("It takes an hour and a half. By the end they are not friends. They are not enemies either, which is progress.", [fx.bond("a", "b", 8), fx.nerve("a", 3), fx.nerve("b", 3), fx.trust("a", 2), fx.trust("b", 2), ...(cfg.mediateFx ?? [])], 3, MEDIATOR_MODS),
            o("You hear them both. You do not fix it. But it is out in the open.", [fx.bond("a", "b", 2), fx.nerve("a", 1), fx.nerve("b", 1)], 3),
            o("It goes worse. Someone says the one thing that cannot be taken back.", [fx.bond("a", "b", -7), fx.nerve("a", -3), fx.nerve("b", -3)], 2, [{ if: { trait: "hothead" }, add: 1 }]),
          ],
        },
      },
      {
        id: "hush",
        label: "Cut it off. We keep moving.",
        hint: "Nobody likes being shouted down.",
        results: {
          any: [o("You speak in the voice that has kept them alive. They stop. They do not forgive it.", [fx.trust("a", -2), fx.trust("b", -2), fx.bond("a", "b", -2), fx.nerve("a", -1), fx.nerve("b", -1)], 1)],
        },
      },
      {
        id: "ignore",
        label: "Look away and let it burn out",
        results: {
          any: [
            o("It burns down to embers, and then to something colder.", [fx.bond("a", "b", -4)], 6),
            o("It does not burn out. It gets hot.", [fx.scene("fistfight", 1, true)], 4, [{ if: { trait: "hothead" }, add: 2 }]),
          ],
        },
      },
      ...(cfg.extras ?? []),
    ],
  };
}

const anyone = (): number => 1;

export const QUARRELS: SceneDef[] = [
  quarrel({
    id: "ration-accusation",
    weight: 5,
    genuineOdds: 0.5,
    title: "Missing rations",
    when: [{ partyMin: 3 }],
    intro: [
      "{a} shakes out a half-empty ration sack in front of everyone. It is two days lighter than it should be.",
      "\"Somebody's been in the stores. Somebody in this train.\" {a} is looking at {b}.",
    ],
    tells: [
      { text: "There are crumbs and grease in {b}'s bedroll, and a smell of stale salt pork.", shows: "genuine", p: 0.6 },
      { text: "{b} is thinner in the face than yesterday, and will not look at anyone.", shows: "genuine", p: 0.45 },
      { text: "The sack has been re-tied with a knot {b} does not use.", shows: "trap", p: 0.5 },
      { text: "{a} is the only one who counted. Nobody else was told the total.", shows: "trap", p: 0.5 },
      { text: "Someone has been chewing something. It is {a}'s breath, not {b}'s.", shows: "trap", p: 0.35 },
      { text: "{b} is furious. It could be guilt. It could be innocence. It is hard to tell.", shows: "noise", p: 0.5 },
    ],
    pairWeight: (a, b, bond) => (b.traits.includes("greedy") ? 3 : b.nerve < 45 ? 1.5 : 0.6) * (a.traits.includes("greedy") ? 0.4 : 1) * (bond < 0 ? 1.5 : 1),
    sideA: {
      genuine: [
        o("You confront {b}. After a very long minute, {b} admits it, and hands over what was left. The train is quieter than before.", [fx.res("rations", 3), fx.trust("b", -10), fx.trust("a", 5), fx.bond("a", "b", -6), fx.nerve("b", -6)], 1),
      ],
      trap: [
        o("You back {a}. {b} is shaken, then furious, then very quiet. Later, the sack is found, and the count was wrong. It was never stolen.", [fx.trust("b", -14), fx.trust("a", -4), fx.bond("a", "b", -10), fx.nerve("b", -8)], 1),
      ],
    },
    sideB: {
      genuine: [o("You defend {b}, and {a} says nothing at all. Two days later, more is gone.", [fx.trust("a", -9), fx.trust("b", 2), fx.res("rations", [-6, -3]), fx.nerve("a", -5)], 1)],
      trap: [o("You defend {b}, and {a} stalks off, humiliated, and wrong. It is not a mistake anyone forgets.", [fx.trust("b", 8), fx.trust("a", -5), fx.bond("a", "b", -5)], 1)],
    },
  }),
  quarrel({
    id: "torch-hoarding",
    weight: 3,
    genuineOdds: 0.5,
    title: "Missing torches",
    when: [{ res: "torches", min: 1 }],
    intro: ["{a} counts the torches twice, and then a third time. \"Three short. Someone is keeping their own. Someone is stashing them.\" {a} is looking at {b}."],
    tells: [
      { text: "{b}'s bedroll is bulky in the wrong places.", shows: "genuine", p: 0.55 },
      { text: "{b} keeps a torch burning by their own bed at night, while everyone else's have gone out.", shows: "genuine", p: 0.4 },
      { text: "There is a split crate at the back of the wagon. The torches rolled into the gap.", shows: "trap", p: 0.55 },
      { text: "{a} has a burn on their hand, fresh, and no story for it.", shows: "trap", p: 0.4 },
    ],
    pairWeight: (_a, b, bond) => (b.traits.includes("greedy") ? 3 : 0.7) * (bond < 0 ? 1.4 : 1),
    sideA: {
      genuine: [o("You order {b}'s bedroll turned out, and there they are: two torches and a tin of matches. {b} is furious. So is everyone else.", [fx.res("torches", 2), fx.trust("b", -9), fx.bond("a", "b", -6), fx.trust("a", 4)], 1)],
      trap: [o("You order {b}'s bedroll turned out. Nothing. {b} stands with their things scattered across the road.", [fx.trust("b", -13), fx.bond("a", "b", -8), fx.nerve("b", -7)], 1)],
    },
    sideB: {
      genuine: [o("You side with {b}. That night, two more torches go missing.", [fx.res("torches", -2), fx.trust("a", -6), fx.trust("b", 2)], 1)],
      trap: [o("You side with {b}. Later, the split crate is found. {a} goes red, and stays that way.", [fx.trust("b", 6), fx.trust("a", -4), fx.bond("a", "b", -3)], 1)],
    },
  }),
  quarrel({
    id: "blame-breakdown",
    weight: 4,
    title: "Whose fault was it?",
    intro: ["\"If you'd checked the linchpin, we'd have lost nothing.\" {a} has {b} by the collar. {b} has {a} by the wrist. Everyone is watching."],
    pairWeight: (a, b, bond) => (a.traits.includes("hothead") || a.traits.includes("paranoid") ? 2 : 0.6) * (b.role === "mechanic" ? 2 : 1) * (bond < 0 ? 1.4 : 1),
  }),
  quarrel({
    id: "refused-help-rage",
    weight: 6,
    when: [{ flag: "refusedGenuine", min: 1 }],
    title: "\"You should have stopped\"",
    intro: [
      "{a} has been quiet for two days. Now they are speaking, and nobody can stop them. \"There was a child. There were people. You just drove on. You drove on!\"",
      "{b} answers: \"We can't save everyone. We'd be dead.\"",
    ],
    pairWeight: (a, b) => (a.traits.includes("kind") ? 4 : a.traits.includes("pious") ? 2 : 0) * (b.traits.includes("kind") ? 0.4 : 1),
    mediateFx: [fx.flag("refusedGenuine", -1)],
    extras: [
      {
        id: "own-it",
        label: "Own it. \"It was my call, and I would make it again.\"",
        hint: "Take the weight, and the consequences.",
        results: {
          any: [o("You take it on your shoulders, and they listen. It does not make it right. It makes it yours.", [fx.trust("a", -4), fx.trust("b", 6), fx.nerve("a", -2), fx.flag("refusedGenuine", -1)], 1)],
        },
      },
    ],
  }),
  quarrel({
    id: "faith-and-fear",
    weight: 3,
    title: "Faith and fear",
    intro: ["{a} is praying aloud, at length, toward the Haze. {b} tells them to stop. \"You're calling it to us. It doesn't need help finding us.\""],
    pairWeight: (a, b) => (a.traits.includes("pious") ? 3 : 0) * (b.traits.includes("paranoid") || b.traits.includes("hothead") || b.traits.includes("stoic") ? 2 : 0.2) * (b.traits.includes("pious") ? 0 : 1),
  }),
  quarrel({
    id: "dead-weight",
    weight: 4,
    title: "Dead weight",
    intro: ["{b} has been slow and sick for days, and it shows. {a} says it aloud: \"We can't keep dragging {b}. We all know it. Every hour counts.\""],
    pairWeight: (a, b) => ((b.wounded || b.sick || b.fog > 0 ? 3 : 0) * (a.traits.includes("kind") ? 0.3 : 1)) || 0,
    extras: [
      {
        id: "leave-behind",
        label: "Leave {b} at the nearest shelter with food",
        hint: "Costs 5 rations. Costs more than that.",
        hours: 1,
        cost: { rations: 5 },
        results: {
          any: [o("You leave {b} at a farm, with a bed and a bag of food and a lie about coming back. No one meets your eyes on the road.", [fx.leave("b", "left behind at a farm with food and a promise"), fx.nerve("all", -5), fx.nerve({ trait: "kind" }, -4), fx.trust({ trait: "kind" }, -6), fx.trust("a", 3)], 1)],
        },
      },
      {
        id: "carry",
        label: "\"We carry our own.\"",
        results: {
          any: [o("You say it in front of everyone, and it settles something. {b} weeps quietly. {a} says nothing.", [fx.trust("b", 8), fx.trust("a", -4), fx.bond("a", "b", -4), fx.trust({ trait: "kind" }, 2)], 1)],
        },
      },
    ],
  }),
  quarrel({
    id: "slept-on-watch",
    weight: 4,
    title: "Asleep on watch",
    intro: ["{a} finds {b} dead asleep at their post, with the fire almost out. {a} kicks them awake and starts to shout."],
    pairWeight: (a, b) => (b.nerve < 55 || b.traits.includes("sickly") ? 2 : 0.5) * (a.traits.includes("hothead") ? 1.8 : 1),
  }),
  quarrel({
    id: "old-grudge",
    weight: 3,
    title: "An old grudge",
    intro: ["It starts over nothing: a spilled cup, a look. Then {a} says something about {b}'s past and the whole train goes very still."],
    pairWeight: (_a, _b, bond) => (bond <= -20 ? -bond / 8 : 0),
  }),
  {
    id: "fistfight",
    kind: "dispute",
    weight: 0,
    title: "Blows",
    intro: ["It goes past words. {a} swings, and {b} swings back, and then they are on the ground, in the dust, in the torchlight, with everyone shouting."],
    pairWeight: anyone,
    options: [
      {
        id: "break-up",
        label: "Wade in and pull them apart",
        hours: 1,
        results: {
          any: [
            o("You get an elbow in the mouth for your trouble. But it stops.", [fx.hp("leader", -3), fx.bond("a", "b", -3), fx.trust("a", -2), fx.trust("b", -2)], 5),
            o("It takes three of you. Both are bleeding. Nobody is happy with anyone.", [fx.hp("a", [-6, -2]), fx.hp("b", [-6, -2]), fx.bond("a", "b", -5)], 3),
          ],
        },
      },
      {
        id: "shot",
        label: "Fire a shot in the air",
        hint: "Costs 1 powder & shot. Loud.",
        cost: { ammo: 1 },
        results: { any: [o("The crack rings off the sky. Everyone freezes. Everyone remembers where they are.", [fx.trust("a", -3), fx.trust("b", -3), fx.nerve("all", -2)], 1)] },
      },
      {
        id: "let-it-run",
        label: "Let them get it out of their systems",
        results: {
          any: [
            o("Two minutes. Then it stops on its own. Both are bruised and ashamed.", [fx.hp("a", [-6, -2]), fx.hp("b", [-6, -2]), fx.bond("a", "b", -6)], 5),
            o("It does not stop. A knife comes out. It ends badly, and for one of them, seriously.", [fx.hp("a", [-14, -8]), fx.hp("b", [-14, -8]), fx.wound("a"), fx.bond("a", "b", -14), fx.nerve("all", -4)], 3),
          ],
        },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Crises: surface at night, queued directly by the engine
// ---------------------------------------------------------------------------

export const CRISES: SceneDef[] = [
  {
    id: "breakdown",
    kind: "crisis",
    weight: 0,
    title: "{actor} is walking toward the Haze",
    intro: [
      "You wake to a silence in the camp: one bedroll empty. Out past the torchlight, {actor} is walking slowly toward the red horizon, arms at their sides, calm as a sleepwalker.",
      "\"It's fine,\" {actor} says, when you call out. \"It's so quiet in there.\"",
    ],
    options: [
      {
        id: "run-after",
        label: "Run after {actor}",
        hint: "Risk breathing the Haze yourself.",
        hours: 2,
        results: {
          any: [
            o("You catch them at the edge of the fog, where it is warm and smells of clean linen. You hold them as they weep, and drag them back.", [fx.nerve("actor", 18), fx.trust("actor", 8), fx.fog("leader")], 5, [{ if: { role: "scout" }, add: 1 }]),
            o("You reach the edge of the fog. {actor} steps over it, and does not turn around.", [fx.leave("actor", "walked into the Haze"), fx.nerve("all", -6)], 3),
          ],
        },
      },
      {
        id: "sedate",
        label: "Stop them with a dose of laudanum",
        cost: { medicine: 1 },
        hours: 0.5,
        results: { any: [o("{actor} goes down slowly. They will wake ashamed, and alive.", [fx.nerve("actor", 12), fx.trust("actor", -4)], 1)] },
      },
      {
        id: "speak",
        label: "Send your speaker to talk them back",
        hours: 1,
        requires: [{ any: [{ role: "speaker" }, { trait: "pious" }] }],
        why: "No one here has the gift.",
        results: {
          any: [
            o("A low voice, walking beside them, turning them slowly around. It takes a long time. It works.", [fx.nerve("actor", 14), fx.bond("actor", { role: "speaker" }, 6)], 6),
            o("It does not work. {actor} keeps walking. The fog comes for them, and closes.", [fx.leave("actor", "walked into the Haze"), fx.nerve("all", -6)], 2),
          ],
        },
      },
      {
        id: "let-go",
        label: "Let them go",
        hint: "You cannot save everyone.",
        results: { any: [o("You watch them go. It is the longest walk you have ever seen anyone take.", [fx.leave("actor", "walked into the Haze"), fx.nerve("all", -8)], 1)] },
      },
    ],
  },
  {
    id: "turned",
    kind: "crisis",
    weight: 0,
    title: "{actor} sits up in the dark",
    intro: [
      "In the small hours, {actor} sits up without waking anyone. Their eyes are the color of the sky. They are calm. They are smiling.",
      "They are looking at the sleeping shapes around them, one by one, as if counting.",
    ],
    options: [
      {
        id: "fight",
        label: "Rouse everyone and fight",
        results: { any: [o("They come at you quietly, without malice. It is worse for that.", [fx.leave("actor", "turned by the Haze, and fought in the dark"), fx.combat("the-turned")], 1)] },
      },
      {
        id: "cure",
        label: "Try everything in the physic chest",
        hint: "Costs 4 physic. There is one chance.",
        cost: { medicine: 4 },
        hours: 2,
        results: {
          any: [
            o("The eyes clear slowly, like ink in water. {actor} blinks and asks what happened. It is not over. But it is not the end.", [fx.cureFog("actor"), fx.cureFog("actor"), fx.nerve("actor", -10), fx.nerve("all", 4)], 4),
            o("It does not work. They pull free of you, and smile, and come.", [fx.leave("actor", "turned by the Haze, and fought in the dark"), fx.combat("the-turned")], 3),
          ],
        },
      },
      {
        id: "mercy",
        label: "End it, quietly, before they wake anyone",
        cost: { ammo: 1 },
        results: { any: [o("It is over in a moment. It will not be over for a long time.", [fx.kill("actor", "put down by a friend, in the dark"), fx.nerve("all", -8), fx.nerve("leader", -8)], 1)] },
      },
      {
        id: "walk",
        label: "Open the wagon gate and let them walk out",
        results: { any: [o("They walk into the fog with a smile, arms open. Nobody speaks until dawn.", [fx.leave("actor", "walked into the Haze, smiling"), fx.nerve("all", -5)], 1)] },
      },
    ],
  },
  {
    id: "fogsick-quarantine",
    kind: "crisis",
    weight: 0,
    title: "{actor}'s eyes are changing",
    intro: [
      "{actor}'s pupils have started to bleed red at the edges. They know. They have been hiding it under a hat brim for two days.",
      "\"I'm fine,\" {actor} says. \"I'm fine. I can keep going.\"",
    ],
    options: [
      {
        id: "treat",
        label: "Spend physic to slow it",
        cost: { medicine: 2 },
        hours: 1,
        results: { any: [o("It will not last. But it buys them a few days.", [fx.cureFog("actor"), fx.nerve("actor", 4)], 1)] },
      },
      {
        id: "isolate",
        label: "Put them in the last wagon, alone",
        hours: 0.5,
        results: { any: [o("They do not argue. They lie down and stare at the canvas.", [fx.nerve("actor", -5), fx.nerve("all", 1)], 1)] },
      },
      {
        id: "leave",
        label: "Leave them at the next shelter",
        hint: "A hard thing to do to someone.",
        results: { any: [o("You do not tell them. You just do not stop the wagon the next time they climb down.", [fx.leave("actor", "left at a shelter, marked by the Haze"), fx.nerve("all", -6), fx.trust({ trait: "kind" }, -6)], 1)] },
      },
      {
        id: "carry-on",
        label: "\"You're fine. We keep going.\"",
        results: { any: [o("You do not say what everyone is thinking. It hangs there all day.", [fx.nerve("others", -1)], 1)] },
      },
    ],
  },
  {
    id: "deserter",
    kind: "crisis",
    weight: 0,
    title: "{actor} is packing",
    intro: ["Before dawn, you find {actor} at the back wagon, rolling a blanket and stuffing a sack with as much as it will hold. They have seen you. They do not stop."],
    options: [
      {
        id: "let-go",
        label: "Let them go",
        results: { any: [o("They go, with what they can carry, and they do not look back.", [fx.leave("actor", "took a share of the stores and left in the night", { rations: 6, ammo: 4 }), fx.nerve("all", -3)], 1)] },
      },
      {
        id: "confront",
        label: "Block the way and talk",
        hours: 1,
        results: {
          any: [
            o("A long, low argument. They put the sack down at last, and neither of you says anything more.", [fx.trust("actor", 10), fx.nerve("actor", 3)], 4),
            o("They go anyway, and take more than they came with, and there is a scuffle.", [fx.leave("actor", "took a share of the stores and left in the night", { rations: 10, ammo: 8 }), fx.hp("leader", [-8, -3]), fx.nerve("all", -3)], 4),
          ],
        },
      },
      {
        id: "pay",
        label: "Offer 40 scrip to stay",
        cost: { scrip: 40 },
        results: { any: [o("It is a poor sort of loyalty, and everyone knows it. But they stay.", [fx.trust("actor", 18)], 1)] },
      },
      {
        id: "shame",
        label: "Send your speaker to talk to them",
        hours: 1,
        requires: [{ role: "speaker" }],
        why: "No one here has the gift.",
        results: {
          any: [
            o("Your speaker sits with {actor} on a wagon step for an hour. When they stand, both are wet-eyed, and the sack is unpacked.", [fx.trust("actor", 14), fx.bond("actor", { role: "speaker" }, 5)], 6),
            o("It does not work. {actor} shoulders the sack and goes.", [fx.leave("actor", "took a share of the stores and left in the night", { rations: 6, ammo: 4 }), fx.nerve("all", -3)], 2),
          ],
        },
      },
    ],
  },
  {
    id: "last-stand",
    kind: "crisis",
    weight: 0,
    title: "The Haze is at your heels",
    intro: [
      "The oxen are heaving. The red is at the tailgate, low and warm and patient, and it is closing faster than the wagons can go.",
      "There is a way to buy time. It costs something. Everyone has thought of it. No one has said it aloud.",
    ],
    options: [
      {
        id: "volunteer",
        label: "Ask for a volunteer to hold the line",
        hint: "Someone stays behind with the last torches. They do not come back.",
        actor: "weakest",
        results: {
          any: [
            o("The weakest among you climbs down from the wagon without being asked, and takes the last of the torches, and walks back toward the red. Nobody watches. Everybody hears.", [fx.kill("actor", "held the Haze at bay so the train could run"), fx.gap([12, 16]), fx.nerve("all", -10)], 1),
          ],
        },
      },
      {
        id: "cut-wagon",
        label: "Cut loose a wagon and its cargo",
        hint: "Lighter wagons are faster wagons.",
        requires: [{ partyMin: 1 }],
        results: { any: [o("You cut the traces. The wagon rolls a little way by itself, and stops, and the fog folds over it.", [fx.wagons(-1), fx.gap([8, 11]), fx.nerve("all", -4)], 1)] },
      },
      {
        id: "firebreak",
        label: "Burn a firebreak across the road",
        hint: "Costs 6 torches.",
        cost: { torches: 6 },
        results: { any: [o("A wall of fire across the road. The Haze pauses at the edge of it, considering. You gain a little ground.", [fx.gap([6, 9])], 1)] },
      },
      {
        id: "refuse",
        label: "\"No one stays behind. We go on together.\"",
        results: { any: [o("You say it and mean it. It is not enough to hold the fog back. But it is enough to hold the train together.", [fx.trust("all", 3), fx.nerve("all", 2)], 1)] },
      },
    ],
  },
];
