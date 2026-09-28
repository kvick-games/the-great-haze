// The party itself: quarrels between members, and crises that surface in the
// night. Disputes run through the same scene engine as strangers, so a false
// accusation can carry tells just like a false plea for help.

import type { CheckKind, Cond, Effect, Line, Member, OptionDef, Outcome, SceneDef } from "../../types.ts";
import { fx, o } from "../fx.ts";

/** An outcome with spoken lines, optionally gated on the option's check. */
const said = (out: Outcome, talk: Line[], needs?: "success" | "fail"): Outcome => ({ ...out, talk, ...(needs ? { needs } : {}) });

interface QuarrelCfg {
  id: string;
  weight: number;
  title: string;
  intro: string[];
  /** The quarrel itself, spoken: 2-6 lines between {a} and {b}. */
  talk: Line[];
  when?: Cond[];
  genuineOdds?: number;
  tells?: SceneDef["tells"];
  pairWeight: (a: Member, b: Member, bond: number) => number;
  /** Override what happens when you back {a}. */
  sideA?: OptionDef["results"];
  sideB?: OptionDef["results"];
  /** Lines for the default "back {a}" / "back {b}" outcomes. */
  backA?: Line[];
  backB?: Line[];
  extras?: OptionDef[];
  mediateFx?: Effect[];
  /** Which charisma check the mediation is. Default calm, dc 11. */
  mediateCheck?: { kind: CheckKind; dc: number };
  /** Per-quarrel words for the mediation that works, and the one that goes wrong. */
  mediateGood?: Line[];
  mediateBad?: Line[];
}

const MEDIATOR_MODS = [
  { if: { trait: "charming" } as Cond, add: 2 },
  { if: { role: "speaker" } as Cond, add: 2 },
  { if: { trait: "pious" } as Cond, add: 1 },
  { if: { trait: "kind" } as Cond, add: 1 },
];

// Shared words. Generic enough for any quarrel, but people still sound like themselves.

const BACK_A: Line[] = [
  { who: "leader", text: "{a}'s right. That's the end of it.", mood: "cold", alt: { kind: "I'm sorry, {b}. {a}'s right this time." } },
  { who: "b", text: "Fine. Fine.", mood: "angry", gesture: "turn-away", alt: { hothead: "You'll remember you said that.", coward: "I didn't... fine. Whatever you say.", stoic: "Understood." } },
];

const BACK_B: Line[] = [
  { who: "leader", text: "Leave {b} be. I mean it.", mood: "cold", alt: { kind: "{a}, that's enough. {b}'s done nothing wrong." } },
  { who: "a", text: "Right. Of course.", mood: "cold", gesture: "turn-away", alt: { hothead: "Pick your favourite, then. See where it gets you.", paranoid: "So that's how it is. Noted.", coward: "I'm sorry. I'm sorry I said anything." } },
];

const MEDIATE_GOOD: Line[] = [
  { who: "by", text: "Both of you. Sit. Nobody's walking off.", mood: "calm", gesture: "beckon", alt: { pious: "Sit down. We'll say it plain, like at meeting.", veteran: "Sit. I've watched trains die over less.", charming: "Sit. Both of you. I'll pour the coffee." } },
  { who: "a", text: "I was scared. That's all it was.", mood: "grieving", alt: { hothead: "I shouldn't have said it like that.", stoic: "I spoke too hard." } },
  { who: "b", text: "Me too. Every night.", mood: "grieving", alt: { stoic: "Aye. Well.", greedy: "...So was I, if I'm honest." } },
];

const MEDIATE_MID: Line[] = [
  { who: "by", text: "Say it all, out loud. Then it's said.", mood: "calm" },
  { who: "a", text: "I don't trust you, {b}. I'm sorry. I don't.", mood: "cold", alt: { kind: "I want to trust you. I can't yet." } },
  { who: "b", text: "Then don't. Just stand watch with me.", mood: "calm" },
];

const MEDIATE_BAD: Line[] = [
  { who: "by", text: "Just listen to each other. Please.", mood: "pleading", alt: { hothead: "Shut up, the pair of you, and listen!" } },
  { who: "a", text: "You know what you are, {b}. Everyone knows.", mood: "angry", gesture: "point" },
  { who: "b", text: "...", mood: "grieving", gesture: "turn-away" },
];

const MEDIATE_WEAK: Line[] = [
  { who: "by", text: "That's enough for tonight. Go and sleep.", mood: "calm", alt: { coward: "I don't... I don't know. Let's just stop." } },
  { who: "a", text: "Nothing's fixed.", mood: "cold" },
  { who: "b", text: "No. It isn't.", mood: "cold" },
];

function quarrel(cfg: QuarrelCfg): SceneDef {
  const defaultA: Outcome[] = [
    said(o("You side with {a}. {b} swallows it, and it sits badly.", [fx.trust("a", 5), fx.trust("b", -7), fx.bond("a", "b", -4), fx.nerve("b", -3)]), cfg.backA ?? BACK_A),
  ];
  const defaultB: Outcome[] = [
    said(o("You side with {b}. {a} goes quiet, and stays quiet.", [fx.trust("b", 5), fx.trust("a", -7), fx.bond("a", "b", -4), fx.nerve("a", -3)]), cfg.backB ?? BACK_B),
  ];
  const check = cfg.mediateCheck ?? { kind: "calm" as const, dc: 11 };
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
    talk: cfg.talk,
    options: [
      { id: "side-a", label: "Back {a}", results: cfg.sideA ?? { any: defaultA } },
      { id: "side-b", label: "Back {b}", results: cfg.sideB ?? { any: defaultB } },
      {
        id: "mediate",
        label: "Sit them down and hear them both out",
        hint: "Takes time. Someone steady has to do the talking.",
        hours: 2,
        hoursMod: { if: { any: [{ trait: "charming" }, { role: "speaker" }] }, mult: 0.5 },
        check: { kind: check.kind, dc: check.dc, exclude: ["a", "b"] },
        results: {
          any: [
            said(
              o("An hour and a half. Not friends. Not enemies either.", [fx.bond("a", "b", 8), fx.nerve("a", 3), fx.nerve("b", 3), fx.trust("a", 2), fx.trust("b", 2), ...(cfg.mediateFx ?? [])], 3, MEDIATOR_MODS),
              cfg.mediateGood ?? MEDIATE_GOOD,
              "success",
            ),
            said(o("Nothing's fixed. But it's out in the open.", [fx.bond("a", "b", 2), fx.nerve("a", 1), fx.nerve("b", 1)], 3), MEDIATE_MID, "success"),
            said(
              o("It goes worse. Someone says the thing that can't be taken back.", [fx.bond("a", "b", -7), fx.nerve("a", -3), fx.nerve("b", -3)], 2, [{ if: { trait: "hothead" }, add: 1 }]),
              cfg.mediateBad ?? MEDIATE_BAD,
              "fail",
            ),
            said(o("They stop shouting. That's all it buys.", [fx.bond("a", "b", 1)], 3), MEDIATE_WEAK, "fail"),
          ],
        },
      },
      {
        id: "hush",
        label: "Cut it off. We keep moving.",
        hint: "Nobody likes being shouted down.",
        results: {
          any: [
            said(o("They stop. They don't forgive it.", [fx.trust("a", -2), fx.trust("b", -2), fx.bond("a", "b", -2), fx.nerve("a", -1), fx.nerve("b", -1)], 1), [
              { who: "leader", text: "Enough! Both of you, back to the wagons. Now.", mood: "angry", gesture: "point", alt: { stoic: "Enough. Wagons. Now.", kind: "Please. Not tonight. We haven't got the strength." } },
              { who: "a", text: "Yes, boss.", mood: "cold", alt: { hothead: "This isn't over, {b}." } },
              { who: "b", text: "Whatever you say.", mood: "cold", gesture: "turn-away" },
            ]),
          ],
        },
      },
      {
        id: "ignore",
        label: "Look away and let it burn out",
        results: {
          any: [
            said(o("It burns down to embers, then to something colder.", [fx.bond("a", "b", -4)], 6), [
              { who: "a", text: "Forget it. Forget I said anything.", mood: "cold", gesture: "turn-away" },
              { who: "b", text: "I will.", mood: "cold", alt: { kind: "I won't. But I'll try.", haunted: "I don't forget things. That's my trouble." } },
            ]),
            said(o("It doesn't burn out. It gets hot.", [fx.scene("fistfight", 1, true)], 4, [{ if: { trait: "hothead" }, add: 2 }]), [
              { who: "a", text: "Don't you walk away from me!", mood: "angry", gesture: "point" },
              { who: "b", text: "Then make me stay.", mood: "angry", alt: { coward: "Leave me alone. Just leave me alone!" } },
            ]),
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
    intro: ["{a} shakes out a ration sack in front of everyone. It is two days light."],
    talk: [
      { who: "a", text: "Somebody's been in the stores. Somebody in this train.", mood: "angry", gesture: "point", alt: { paranoid: "I counted twice. Somebody's eating while the rest of us starve." } },
      { who: "a", text: "Where were you last night, {b}?", mood: "angry" },
      { who: "b", text: "Are you mad? I'm starving same as you.", mood: "angry", gesture: "raise-hands", alt: { coward: "I didn't. I swear I didn't. Please.", greedy: "Prove it. Go on. Prove it." } },
      { who: "observer", text: "Nobody move. Let's just look.", mood: "calm" },
    ],
    tells: [
      { text: "Crumbs and grease in {b}'s bedroll, and a smell of salt pork.", shows: "genuine", p: 0.6, severity: 2, say: "There's pork grease all through {b}'s bedroll." },
      { text: "{b} is thinner in the face than yesterday, and won't look at anyone.", shows: "genuine", p: 0.45, severity: 1, say: "{b} hasn't looked anyone in the eye. Not once." },
      { text: "The sack has been re-tied with a knot {b} does not use.", shows: "trap", p: 0.5, severity: 2, say: "That's not {b}'s knot. Never seen {b} tie it." },
      { text: "{a} is the only one who counted. Nobody else knew the total.", shows: "trap", p: 0.5, severity: 2, say: "Only {a} counted. Nobody else ever knew the number." },
      { text: "Someone has been chewing. It is on {a}'s breath, not {b}'s.", shows: "trap", p: 0.35, severity: 3, say: "Smell that? It's on {a}'s breath. Not {b}'s." },
      { text: "{b} is furious. Guilt or innocence, it is hard to tell.", shows: "noise", p: 0.5, severity: 1, say: "{b}'s furious. Guilty or wronged, I can't tell." },
    ],
    pairWeight: (a, b, bond) => (b.traits.includes("greedy") ? 3 : b.nerve < 45 ? 1.5 : 0.6) * (a.traits.includes("greedy") ? 0.4 : 1) * (bond < 0 ? 1.5 : 1),
    sideA: {
      genuine: [
        said(o("After a long minute, {b} hands over what's left.", [fx.res("rations", 3), fx.trust("b", -10), fx.trust("a", 5), fx.bond("a", "b", -6), fx.nerve("b", -6)], 1), [
          { who: "leader", text: "Turn out your bedroll, {b}.", mood: "cold" },
          { who: "b", text: "I was hungry. I was so hungry.", mood: "grieving", gesture: "clutch" },
          { who: "a", text: "We're all hungry.", mood: "cold", alt: { kind: "You could have asked. We'd have shared." } },
        ]),
      ],
      trap: [
        said(o("Later the sack's found. The count was wrong. Nothing was ever stolen.", [fx.trust("b", -14), fx.trust("a", -4), fx.bond("a", "b", -10), fx.nerve("b", -8)], 1), [
          { who: "b", text: "You believed {a}. Over me.", mood: "grieving" },
          { who: "a", text: "I counted wrong. I'm sorry. I counted wrong.", mood: "afraid", alt: { hothead: "Well, it looked like you. Anyone would've thought it." } },
          { who: "b", text: "Don't. Don't talk to me.", mood: "cold", gesture: "turn-away" },
        ]),
      ],
    },
    sideB: {
      genuine: [
        said(o("{a} says nothing. Two days later, more is gone.", [fx.trust("a", -9), fx.trust("b", 2), fx.res("rations", [-6, -3]), fx.nerve("a", -5)], 1), [
          { who: "leader", text: "{b} didn't do this. Drop it.", mood: "cold" },
          { who: "a", text: "Check the sack again in two days.", mood: "cold", gesture: "turn-away", alt: { hothead: "Fine. Starve, then. All of you." } },
        ]),
      ],
      trap: [
        said(o("{a} stalks off, humiliated, and wrong.", [fx.trust("b", 8), fx.trust("a", -5), fx.bond("a", "b", -5)], 1), [
          { who: "b", text: "Thank you. I thought you'd believe it.", mood: "grieving" },
          { who: "a", text: "Count it yourselves, then.", mood: "angry", gesture: "turn-away" },
        ]),
      ],
    },
    mediateGood: [
      { who: "by", text: "{a}. Count it again, with {b}. Out loud.", mood: "calm", gesture: "beckon" },
      { who: "a", text: "Nine. Ten. Eleven... it's all here. God.", mood: "afraid" },
      { who: "b", text: "You'd have had me hanged for eleven biscuits.", mood: "grieving", alt: { kind: "It's all right. We're all half mad." } },
    ],
  }),
  quarrel({
    id: "torch-hoarding",
    weight: 3,
    genuineOdds: 0.5,
    title: "Missing torches",
    when: [{ res: "torches", min: 1 }],
    intro: ["{a} counts the torches a third time, then turns to {b}."],
    talk: [
      { who: "a", text: "Three short. Someone's keeping their own.", mood: "angry", alt: { paranoid: "Three gone. Somebody wants light when the rest of us don't." } },
      { who: "a", text: "Your bedroll's awful fat tonight, {b}.", mood: "sly", gesture: "point" },
      { who: "b", text: "Touch my things and see what happens.", mood: "angry", alt: { coward: "I'm scared of the dark. That's not a crime." } },
      { who: "observer", text: "Nobody touch anything yet.", mood: "calm" },
    ],
    tells: [
      { text: "{b}'s bedroll is bulky in the wrong places.", shows: "genuine", p: 0.55, severity: 2, say: "{b}'s bedroll is lumpy in all the wrong places." },
      { text: "{b}'s torch burns all night by their bed, while everyone else's go out.", shows: "genuine", p: 0.4, severity: 2, say: "{b}'s torch burns till dawn. Nobody else's does." },
      { text: "A split crate at the back of the wagon. The torches rolled into the gap.", shows: "trap", p: 0.55, severity: 3, say: "Crate's split at the back. Something rolled in there." },
      { text: "{a} has a fresh burn on their hand, and no story for it.", shows: "trap", p: 0.4, severity: 1, say: "{a}'s got a fresh burn. Never said from what." },
    ],
    pairWeight: (_a, b, bond) => (b.traits.includes("greedy") ? 3 : 0.7) * (bond < 0 ? 1.4 : 1),
    sideA: {
      genuine: [
        said(o("Two torches and a tin of matches fall out of {b}'s bedroll.", [fx.res("torches", 2), fx.trust("b", -9), fx.bond("a", "b", -6), fx.trust("a", 4)], 1), [
          { who: "b", text: "I can't sleep in the dark. Not with it out there.", mood: "afraid" },
          { who: "a", text: "None of us can.", mood: "cold", alt: { kind: "Then sleep by my fire. Don't steal." } },
        ]),
      ],
      trap: [
        said(o("Nothing. {b}'s things lie scattered across the road.", [fx.trust("b", -13), fx.bond("a", "b", -8), fx.nerve("b", -7)], 1), [
          { who: "b", text: "Happy? Pick it up. Go on.", mood: "angry", alt: { coward: "...", stoic: "Put it back how you found it." } },
          { who: "a", text: "I was sure. I was sure.", mood: "afraid" },
        ]),
      ],
    },
    sideB: {
      genuine: [
        said(o("That night, two more torches go missing.", [fx.res("torches", -2), fx.trust("a", -6), fx.trust("b", 2)], 1), [
          { who: "a", text: "Two more gone. Tell me it wasn't {b} now.", mood: "angry", gesture: "point" },
        ]),
      ],
      trap: [
        said(o("The split crate turns up. {a} goes red, and stays that way.", [fx.trust("b", 6), fx.trust("a", -4), fx.bond("a", "b", -3)], 1), [
          { who: "b", text: "Look in the crate next time.", mood: "cold" },
          { who: "a", text: "...Sorry.", mood: "cold", gesture: "turn-away", alt: { charming: "Well. I'll be eating my hat for supper." } },
        ]),
      ],
    },
  }),
  quarrel({
    id: "blame-breakdown",
    weight: 4,
    title: "Whose fault was it?",
    intro: ["{a} has {b} by the collar. {b} has {a} by the wrist. Everyone is watching."],
    talk: [
      { who: "a", text: "You were meant to check the linchpin!", mood: "angry", gesture: "point", alt: { paranoid: "You wanted it to break. Didn't you?" } },
      { who: "b", text: "I checked it! It sheared. Wood does that.", mood: "angry", gesture: "raise-hands", alt: { coward: "Let go. Please, let go of me." } },
      { who: "a", text: "Half a day lost. Half a day, with that behind us.", mood: "angry" },
    ],
    backA: [
      { who: "leader", text: "It was your job, {b}. Own it.", mood: "cold" },
      { who: "b", text: "Next time you check it, then.", mood: "angry", gesture: "turn-away", alt: { stoic: "Aye. My job. My fault.", haunted: "Everything I touch breaks. Always has." } },
    ],
    backB: [
      { who: "leader", text: "Wood breaks. Let go of {b}.", mood: "cold" },
      { who: "a", text: "When it breaks again, it's on you.", mood: "cold", alt: { hothead: "Fine. Fine! Protect the one who nearly killed us." } },
    ],
    pairWeight: (a, b, bond) => (a.traits.includes("hothead") || a.traits.includes("paranoid") ? 2 : 0.6) * (b.role === "mechanic" ? 2 : 1) * (bond < 0 ? 1.4 : 1),
  }),
  quarrel({
    id: "refused-help-rage",
    weight: 6,
    when: [{ flag: "refusedGenuine", min: 1 }],
    title: "\"You should have stopped\"",
    intro: ["{a} has been quiet for two days. Now it pours out, in front of everyone."],
    talk: [
      { who: "a", text: "There were people. There was a child. You drove on!", mood: "angry", gesture: "point", alt: { pious: "God watched us drive past them. God watched." } },
      { who: "b", text: "We can't save everyone. We'd be dead.", mood: "cold", alt: { coward: "They'd have got us killed. You know they would." } },
      { who: "a", text: "Then what are we even for?", mood: "grieving" },
    ],
    pairWeight: (a, b) => (a.traits.includes("kind") ? 4 : a.traits.includes("pious") ? 2 : 0) * (b.traits.includes("kind") ? 0.4 : 1),
    mediateFx: [fx.flag("refusedGenuine", -1)],
    mediateCheck: { kind: "persuade", dc: 11 },
    mediateGood: [
      { who: "by", text: "{a}, you're right to grieve them. {b}'s right we're alive.", mood: "calm", alt: { pious: "We'll pray for them tonight. All of us. Together." } },
      { who: "a", text: "I keep hearing that child.", mood: "grieving" },
      { who: "b", text: "So do I. Every night.", mood: "grieving", alt: { stoic: "...So do I." } },
    ],
    mediateBad: [
      { who: "by", text: "Nobody here wanted to leave them. Nobody.", mood: "pleading" },
      { who: "a", text: "{b} did. Look at {b}'s face. {b} did.", mood: "angry", gesture: "point" },
      { who: "b", text: "Yes. I did. I want to live.", mood: "cold" },
    ],
    extras: [
      {
        id: "own-it",
        label: "Own it. \"It was my call. I'd make it again.\"",
        hint: "Take the weight, and what comes with it.",
        results: {
          any: [
            said(o("It doesn't make it right. It makes it yours.", [fx.trust("a", -4), fx.trust("b", 6), fx.nerve("a", -2), fx.flag("refusedGenuine", -1)], 1), [
              { who: "leader", text: "It was my call. I'd make it again.", mood: "cold", alt: { kind: "It was my call. I'll carry it. Not you." } },
              { who: "a", text: "Then it's on you. All of it.", mood: "grieving", gesture: "turn-away", alt: { kind: "I know. I'm sorry it had to be yours." } },
              { who: "b", text: "Thank you.", mood: "calm" },
            ]),
          ],
        },
      },
    ],
  }),
  quarrel({
    id: "faith-and-fear",
    weight: 3,
    title: "Faith and fear",
    intro: ["{a} is praying aloud, on their knees, facing the Haze."],
    talk: [
      { who: "a", text: "Lord, turn it from us. Turn it back.", mood: "pleading", gesture: "kneel" },
      { who: "b", text: "Stop it. You're calling it here.", mood: "angry", alt: { paranoid: "It listens. Don't you understand? It listens.", stoic: "Quieter. Please. It doesn't need help finding us." } },
      { who: "a", text: "It's all I have left, {b}.", mood: "grieving" },
    ],
    pairWeight: (a, b) => (a.traits.includes("pious") ? 3 : 0) * (b.traits.includes("paranoid") || b.traits.includes("hothead") || b.traits.includes("stoic") ? 2 : 0.2) * (b.traits.includes("pious") ? 0 : 1),
    mediateCheck: { kind: "persuade", dc: 11 },
    mediateGood: [
      { who: "by", text: "Pray quiet, {a}. Face east. For {b}'s sake.", mood: "calm", alt: { pious: "God hears a whisper, {a}. Face east with me." } },
      { who: "b", text: "...Say one for me, then.", mood: "grieving", alt: { stoic: "Fine. East." } },
      { who: "a", text: "I always do.", mood: "calm" },
    ],
    backA: [
      { who: "leader", text: "Let {a} pray. It's not hurting anyone.", mood: "calm" },
      { who: "b", text: "You'll see. It hears.", mood: "afraid", gesture: "turn-away", alt: { hothead: "Then don't come crying when it answers." } },
    ],
    backB: [
      { who: "leader", text: "Pray quiet, {a}, or not at all.", mood: "cold" },
      { who: "a", text: "Then God help us, because you won't.", mood: "grieving", gesture: "turn-away" },
    ],
  }),
  quarrel({
    id: "dead-weight",
    weight: 4,
    title: "Dead weight",
    intro: ["{b} has been slow and sick for days. {a} finally says it aloud."],
    talk: [
      { who: "a", text: "We can't keep dragging {b}. We all know it.", mood: "cold", alt: { greedy: "{b} eats what we eat and pulls nothing." } },
      { who: "b", text: "I can walk. I can still walk.", mood: "pleading" },
      { who: "a", text: "Every hour counts. Every single one.", mood: "cold" },
    ],
    pairWeight: (a, b) => ((b.wounded || b.sick || b.fog > 0 ? 3 : 0) * (a.traits.includes("kind") ? 0.3 : 1)) || 0,
    backA: [
      { who: "leader", text: "Keep up, {b}. Or we talk about this again.", mood: "cold" },
      { who: "b", text: "I'll keep up. I'll keep up.", mood: "afraid" },
    ],
    backB: [
      { who: "leader", text: "Nobody's being left. Drop it, {a}.", mood: "cold" },
      { who: "a", text: "Then we'll all be slow together.", mood: "cold", gesture: "turn-away" },
    ],
    extras: [
      {
        id: "leave-behind",
        label: "Leave {b} at the nearest shelter with food",
        hint: "Costs 5 rations. Costs more than that.",
        hours: 1,
        cost: { rations: 5 },
        results: {
          any: [
            said(o("A farm, a bed, a bag of food, a lie. No one meets your eyes after.", [fx.leave("b", "left behind at a farm with food and a promise"), fx.nerve("all", -5), fx.nerve({ trait: "kind" }, -4), fx.trust({ trait: "kind" }, -6), fx.trust("a", 3)], 1), [
              { who: "leader", text: "There's a bed here. Food. We'll come back.", mood: "calm", gesture: "offer" },
              { who: "b", text: "You won't. You won't come back.", mood: "grieving", gesture: "clutch" },
              { who: "a", text: "It's the right thing.", mood: "cold", alt: { kind: "I'm sorry, {b}. I'm so sorry." } },
            ]),
          ],
        },
      },
      {
        id: "carry",
        label: "\"We carry our own.\"",
        results: {
          any: [
            said(o("You say it in front of everyone, and it settles something.", [fx.trust("b", 8), fx.trust("a", -4), fx.bond("a", "b", -4), fx.trust({ trait: "kind" }, 2)], 1), [
              { who: "leader", text: "We carry our own. All of us.", mood: "calm" },
              { who: "b", text: "Thank you. Thank you.", mood: "grieving" },
              { who: "a", text: "...", mood: "cold", gesture: "turn-away" },
            ]),
          ],
        },
      },
    ],
  }),
  quarrel({
    id: "slept-on-watch",
    weight: 4,
    title: "Asleep on watch",
    intro: ["{a} finds {b} asleep at the post, the fire nearly out, and kicks them awake."],
    talk: [
      { who: "a", text: "Asleep! We could all be dead!", mood: "angry", gesture: "point", alt: { veteran: "Men get shot for this. You know that?" } },
      { who: "b", text: "I shut my eyes a minute. One minute.", mood: "afraid", gesture: "raise-hands", alt: { sickly: "I'm sick, {a}. I can barely stand." } },
      { who: "a", text: "A minute is all it needs.", mood: "angry" },
    ],
    pairWeight: (a, b) => (b.nerve < 55 || b.traits.includes("sickly") ? 2 : 0.5) * (a.traits.includes("hothead") ? 1.8 : 1),
    backA: [
      { who: "leader", text: "{a}'s right. You nearly killed us all.", mood: "cold" },
      { who: "b", text: "It won't happen again.", mood: "afraid", alt: { haunted: "It came right up to the fire. I saw it." } },
    ],
    backB: [
      { who: "leader", text: "{b}'s dead on their feet. Ease off.", mood: "calm" },
      { who: "a", text: "Then you stand the next watch.", mood: "angry" },
    ],
  }),
  quarrel({
    id: "old-grudge",
    weight: 3,
    title: "An old grudge",
    intro: ["It starts over a spilled cup. Then {a} says something about {b}'s past."],
    talk: [
      { who: "a", text: "Everybody knows what you did back east, {b}.", mood: "sly", alt: { hothead: "Go on. Tell them what you did back east." } },
      { who: "b", text: "Say it again. Say it.", mood: "angry", alt: { coward: "Please. Not here. Not in front of them.", haunted: "You don't know. You weren't there." } },
      { who: "a", text: "I'll say it as often as I like.", mood: "cold" },
    ],
    pairWeight: (_a, _b, bond) => (bond <= -20 ? -bond / 8 : 0),
    mediateGood: [
      { who: "by", text: "Whatever happened back east stays back east.", mood: "calm", alt: { pious: "Nobody here is who they were. Nobody." } },
      { who: "b", text: "I was different then. I swear I was.", mood: "grieving" },
      { who: "a", text: "...All right. All right.", mood: "calm" },
    ],
  }),
  {
    id: "fistfight",
    kind: "dispute",
    weight: 0,
    title: "Blows",
    intro: ["It goes past words. {a} swings, {b} swings back, and they're down in the dust."],
    talk: [
      { who: "a", text: "Come on, then! Come on!", mood: "angry" },
      { who: "b", text: "I'll kill you!", mood: "angry", alt: { coward: "Get off me! Someone get them off!" } },
      { who: "leader", text: "Stop it! Both of you!", mood: "angry" },
    ],
    pairWeight: anyone,
    options: [
      {
        id: "break-up",
        label: "Wade in and pull them apart",
        hours: 1,
        results: {
          any: [
            said(o("You take an elbow in the mouth. But it stops.", [fx.hp("leader", -3), fx.bond("a", "b", -3), fx.trust("a", -2), fx.trust("b", -2)], 5), [
              { who: "leader", text: "Enough! Enough!", mood: "angry" },
              { who: "a", text: "I didn't mean to hit you. Sorry.", mood: "afraid", alt: { hothead: "You should've stayed out of it." } },
            ]),
            said(o("It takes three of you. Both are bleeding.", [fx.hp("a", [-6, -2]), fx.hp("b", [-6, -2]), fx.bond("a", "b", -5)], 3), [
              { who: "a", text: "Let go of me!", mood: "angry" },
              { who: "b", text: "Keep them away from me.", mood: "afraid" },
            ]),
          ],
        },
      },
      {
        id: "shot",
        label: "Fire a shot in the air",
        hint: "Costs 1 powder & shot. Loud.",
        cost: { ammo: 1 },
        results: {
          any: [
            said(o("The crack rings off the sky. Everyone freezes.", [fx.trust("a", -3), fx.trust("b", -3), fx.nerve("all", -2)], 1), [
              { who: "leader", text: "Next one isn't in the air.", mood: "cold", gesture: "draw-weapon" },
              { who: "a", text: "All right. All right.", mood: "afraid", gesture: "raise-hands" },
            ]),
          ],
        },
      },
      {
        id: "let-it-run",
        label: "Let them get it out of their systems",
        results: {
          any: [
            said(o("Two minutes, then it stops. Both bruised, both ashamed.", [fx.hp("a", [-6, -2]), fx.hp("b", [-6, -2]), fx.bond("a", "b", -6)], 5), [
              { who: "a", text: "We done?", mood: "cold" },
              { who: "b", text: "We're done.", mood: "cold", alt: { kind: "I'm sorry. I don't know why I did that." } },
            ]),
            said(o("It doesn't stop. A knife comes out.", [fx.hp("a", [-14, -8]), fx.hp("b", [-14, -8]), fx.wound("a"), fx.bond("a", "b", -14), fx.nerve("all", -4)], 3), [
              { who: "leader", text: "Knife! Get the knife off them!", mood: "afraid" },
              { who: "role:medic", text: "Hold them down. Water, now!", mood: "calm" },
              { who: "b", text: "I didn't mean it. I didn't mean it.", mood: "afraid" },
            ]),
          ],
        },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Crises: surface at night, queued directly by the engine
// ---------------------------------------------------------------------------

const LOST_TO_HAZE = "walked into the Haze";
const TURNED = "turned by the Haze, and fought in the dark";
const DESERTED = "took a share of the stores and left in the night";

export const CRISES: SceneDef[] = [
  {
    id: "breakdown",
    kind: "crisis",
    weight: 0,
    title: "{actor} is walking toward the Haze",
    intro: ["One bedroll empty. Past the torchlight, {actor} walks slowly toward the red, calm as a sleepwalker."],
    talk: [
      { who: "leader", text: "{actor}! {actor}, stop!", mood: "afraid" },
      { who: "actor", text: "It's all right. It's so quiet in there.", mood: "calm", alt: { haunted: "They're all in there. Everyone I left behind.", pious: "It's singing. Can't you hear it singing?" } },
      { who: "actor", text: "I'm so tired of being afraid.", mood: "grieving" },
    ],
    options: [
      {
        id: "run-after",
        label: "Run after {actor}",
        hint: "You may breathe the Haze yourself.",
        hours: 2,
        results: {
          any: [
            said(o("You catch them at the edge, where it smells of clean linen, and drag them back.", [fx.nerve("actor", 18), fx.trust("actor", 8), fx.fog("leader")], 5, [{ if: { role: "scout" }, add: 1 }]), [
              { who: "leader", text: "I've got you. I've got you.", mood: "pleading", gesture: "clutch" },
              { who: "actor", text: "Why'd you stop me? It was so quiet.", mood: "grieving" },
            ]),
            said(o("At the edge, {actor} steps over, and does not turn around.", [fx.leave("actor", LOST_TO_HAZE), fx.nerve("all", -6)], 3), [
              { who: "leader", text: "{actor}! Please!", mood: "pleading" },
              { who: "actor", text: "Don't follow me.", mood: "calm", gesture: "turn-away" },
            ]),
          ],
        },
      },
      {
        id: "sedate",
        label: "Stop them with a dose of laudanum",
        cost: { medicine: 1 },
        hours: 0.5,
        results: {
          any: [
            said(o("{actor} goes down slowly. They will wake ashamed, and alive.", [fx.nerve("actor", 12), fx.trust("actor", -4)], 1), [
              { who: "leader", text: "I'm sorry. Just sleep.", mood: "grieving" },
              { who: "actor", text: "Don't... don't make me go back...", mood: "afraid" },
            ]),
          ],
        },
      },
      {
        id: "speak",
        label: "Send your speaker to talk them back",
        hours: 1,
        requires: [{ any: [{ role: "speaker" }, { trait: "pious" }] }],
        why: "No one here has the gift.",
        results: {
          any: [
            said(o("A low voice, walking beside them, turning them slowly around. It works.", [fx.nerve("actor", 14), fx.bond("actor", { role: "speaker" }, 6)], 6), [
              { who: "role:speaker", text: "Walk with me a while. This way. That's it.", mood: "calm", gesture: "beckon" },
              { who: "actor", text: "Is it far? Back?", mood: "afraid" },
            ]),
            said(o("{actor} keeps walking. The fog comes for them, and closes.", [fx.leave("actor", LOST_TO_HAZE), fx.nerve("all", -6)], 2), [
              { who: "role:speaker", text: "Come back. Please come back.", mood: "pleading" },
              { who: "actor", text: "I'm sorry.", mood: "calm", gesture: "turn-away" },
            ]),
          ],
        },
      },
      {
        id: "let-go",
        label: "Let them go",
        hint: "You cannot save everyone.",
        results: {
          any: [
            said(o("The longest walk you have ever watched anyone take.", [fx.leave("actor", LOST_TO_HAZE), fx.nerve("all", -8)], 1), [
              { who: "leader", text: "Let them go.", mood: "cold", alt: { kind: "God forgive me. Let them go.", pious: "Go with God, {actor}." } },
              { who: "actor", text: "...", mood: "calm", gesture: "turn-away" },
            ]),
          ],
        },
      },
      {
        id: "call-back",
        label: "Walk out beside {actor} and talk them home",
        hint: "No shouting. Someone gentle. It could go wrong.",
        hours: 1,
        check: { kind: "calm", dc: 12, exclude: ["actor"] },
        results: {
          any: [
            said(o("{by} walks beside {actor}, and slowly turns them home.", [fx.nerve("actor", 12), fx.bond("actor", "by", 5)], 1), [
              { who: "by", text: "Tell me about home. Just one thing.", mood: "calm", alt: { veteran: "I walked toward it once too. Come back." } },
              { who: "actor", text: "There was a porch. My mother sang.", mood: "grieving" },
              { who: "by", text: "Then come and sing it to us.", mood: "calm", gesture: "beckon" },
            ], "success"),
            said(o("{actor} stops, but won't look at anyone. {by} leads them back by the hand.", [fx.nerve("actor", 4), fx.nerve("by", -4)], 1), [
              { who: "by", text: "Please. Please just turn around.", mood: "pleading" },
              { who: "actor", text: "...", mood: "grieving", gesture: "turn-away" },
            ], "fail"),
            said(o("{actor} steps into the red while {by} is still talking.", [fx.leave("actor", LOST_TO_HAZE), fx.nerve("all", -6), fx.nerve("by", -4)], 1), [
              { who: "by", text: "Wait. Wait, I wasn't finished.", mood: "pleading", gesture: "raise-hands" },
              { who: "actor", text: "You were kind. Thank you.", mood: "calm" },
            ], "fail"),
          ],
        },
      },
    ],
  },
  {
    id: "turned",
    kind: "crisis",
    weight: 0,
    title: "{actor} sits up in the dark",
    intro: [
      "In the small hours {actor} sits up. Their eyes are the color of the sky.",
      "They look at the sleepers, one by one, as if counting.",
    ],
    talk: [
      { who: "actor", text: "Shh. Don't wake them.", mood: "calm", alt: { kind: "Shh. Let them sleep. They're all so tired." } },
      { who: "actor", text: "It doesn't hurt. I thought it would hurt.", mood: "calm" },
      { who: "leader", text: "{actor}? Look at me. Look at me.", mood: "afraid" },
      { who: "actor", text: "I am looking. I can see all of you.", mood: "calm" },
    ],
    options: [
      {
        id: "fight",
        label: "Rouse everyone and fight",
        results: {
          any: [
            said(o("They come at you quietly, without malice. It is worse for that.", [fx.leave("actor", TURNED), fx.combat("the-turned")], 1), [
              { who: "leader", text: "Everyone up! Up!", mood: "afraid" },
              { who: "actor", text: "Why are you frightened? It's only me.", mood: "calm", gesture: "beckon" },
            ]),
          ],
        },
      },
      {
        id: "cure",
        label: "Try everything in the physic chest",
        hint: "Costs 4 physic. There is one chance.",
        cost: { medicine: 4 },
        hours: 2,
        results: {
          any: [
            said(o("The red clears slowly, like ink in water. Not over. Not the end.", [fx.cureFog("actor"), fx.cureFog("actor"), fx.nerve("actor", -10), fx.nerve("all", 4)], 4), [
              { who: "actor", text: "What... why is everyone holding me?", mood: "afraid" },
              { who: "leader", text: "You're back. You're back.", mood: "grieving", gesture: "clutch" },
              { who: "actor", text: "I was counting you. Why was I counting you?", mood: "afraid" },
            ]),
            said(o("It doesn't work. They pull free, and smile, and come.", [fx.leave("actor", TURNED), fx.combat("the-turned")], 3), [
              { who: "actor", text: "You tried. That was sweet of you.", mood: "calm" },
              { who: "leader", text: "Get back! Everyone get back!", mood: "afraid" },
            ]),
          ],
        },
      },
      {
        id: "mercy",
        label: "End it, quietly, before they wake anyone",
        cost: { ammo: 1 },
        results: {
          any: [
            said(o("Over in a moment. It will not be over for a long time.", [fx.kill("actor", "put down by a friend, in the dark"), fx.nerve("all", -8), fx.nerve("leader", -8)], 1), [
              { who: "leader", text: "Close your eyes. Just close your eyes.", mood: "grieving" },
              { who: "actor", text: "Will you remember me? The real one?", mood: "calm" },
              { who: "leader", text: "...", mood: "grieving", gesture: "turn-away" },
            ]),
          ],
        },
      },
      {
        id: "walk",
        label: "Open the wagon gate and let them walk out",
        results: {
          any: [
            said(o("They walk into the fog, arms open. Nobody speaks until dawn.", [fx.leave("actor", "walked into the Haze, smiling"), fx.nerve("all", -5)], 1), [
              { who: "actor", text: "Thank you. I'll wait for you there.", mood: "calm", gesture: "beckon" },
              { who: "leader", text: "...", mood: "grieving", gesture: "turn-away" },
            ]),
          ],
        },
      },
      {
        id: "their-name",
        label: "Say their name. Make them remember.",
        hint: "Someone who loves them. It may only make them come.",
        hours: 1,
        check: { kind: "persuade", dc: 14, exclude: ["actor"] },
        results: {
          any: [
            said(o("For a moment the red clears. {actor} says goodbye, and walks out alone.", [fx.leave("actor", "walked into the Haze, remembering their name"), fx.nerve("all", -3)], 1), [
              { who: "by", text: "{actor}. It's me. You know me.", mood: "pleading", gesture: "kneel" },
              { who: "actor", text: "{by}? Oh. Oh, I'm so sorry.", mood: "grieving" },
              { who: "actor", text: "Don't follow me. Promise me.", mood: "grieving", gesture: "turn-away" },
            ], "success"),
            said(o("They listen to every word, smiling. Then they come.", [fx.leave("actor", TURNED), fx.combat("the-turned")], 1), [
              { who: "by", text: "The river, remember? You remember the river.", mood: "pleading" },
              { who: "actor", text: "I remember everything. Come and see.", mood: "calm", gesture: "beckon" },
            ], "fail"),
          ],
        },
      },
    ],
  },
  {
    id: "fogsick-quarantine",
    kind: "crisis",
    weight: 0,
    title: "{actor}'s eyes are changing",
    intro: ["{actor}'s pupils are bleeding red at the edges. They have hidden it under a hat brim for two days."],
    talk: [
      { who: "leader", text: "Take off the hat, {actor}.", mood: "calm" },
      { who: "actor", text: "I'm fine. I'm fine. I can keep going.", mood: "afraid", alt: { stoic: "It's nothing. Leave it be.", coward: "Don't look at me. Please don't look." } },
      { who: "actor", text: "Don't leave me. Please don't leave me here.", mood: "pleading" },
    ],
    options: [
      {
        id: "treat",
        label: "Spend physic to slow it",
        cost: { medicine: 2 },
        hours: 1,
        results: {
          any: [
            said(o("It will not last. But it buys them a few days.", [fx.cureFog("actor"), fx.nerve("actor", 4)], 1), [
              { who: "role:medic", text: "This buys days. Not weeks.", mood: "calm" },
              { who: "actor", text: "Days is plenty. Days is plenty.", mood: "grieving" },
            ]),
          ],
        },
      },
      {
        id: "isolate",
        label: "Put them in the last wagon, alone",
        hours: 0.5,
        results: {
          any: [
            said(o("They lie down and stare at the canvas.", [fx.nerve("actor", -5), fx.nerve("all", 1)], 1), [
              { who: "leader", text: "Last wagon. Just till we know.", mood: "cold" },
              { who: "actor", text: "I understand.", mood: "grieving", gesture: "turn-away", alt: { hothead: "Like a sick dog. Fine." } },
            ]),
          ],
        },
      },
      {
        id: "leave",
        label: "Leave them at the next shelter",
        hint: "A hard thing to do to someone.",
        results: {
          any: [
            said(o("They climb down at the next shelter. The wagon doesn't stop.", [fx.leave("actor", "left at a shelter, marked by the Haze"), fx.nerve("all", -6), fx.trust({ trait: "kind" }, -6)], 1), [
              { who: "actor", text: "{leader}? {leader}, wait!", mood: "afraid", gesture: "raise-hands" },
              { who: "leader", text: "...", mood: "cold", gesture: "turn-away" },
            ]),
          ],
        },
      },
      {
        id: "carry-on",
        label: "\"You're fine. We keep going.\"",
        results: {
          any: [
            said(o("Nobody says what everyone is thinking. It hangs there all day.", [fx.nerve("others", -1)], 1), [
              { who: "leader", text: "You're fine. We keep going.", mood: "calm" },
              { who: "actor", text: "Thank you. I'm fine. I'm fine.", mood: "afraid" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "deserter",
    kind: "crisis",
    weight: 0,
    title: "{actor} is packing",
    intro: ["Before dawn, {actor} is stuffing a sack at the back wagon. They see you. They don't stop."],
    talk: [
      { who: "leader", text: "Going somewhere?", mood: "cold" },
      { who: "actor", text: "Don't. Don't try to stop me.", mood: "afraid", alt: { greedy: "I'm taking my share. I earned it.", coward: "I can't do another night. I can't." } },
      { who: "actor", text: "We're all going to die out here.", mood: "afraid" },
    ],
    options: [
      {
        id: "let-go",
        label: "Let them go",
        results: {
          any: [
            said(o("They go with what they can carry, and don't look back.", [fx.leave("actor", DESERTED, { rations: 6, ammo: 4 }), fx.nerve("all", -3)], 1), [
              { who: "actor", text: "Good luck. I mean that.", mood: "grieving", gesture: "turn-away" },
            ]),
          ],
        },
      },
      {
        id: "confront",
        label: "Block the way and talk",
        hours: 1,
        results: {
          any: [
            said(o("A long, low argument. At last the sack goes down.", [fx.trust("actor", 10), fx.nerve("actor", 3)], 4), [
              { who: "leader", text: "Put it down. Please.", mood: "pleading" },
              { who: "actor", text: "...Fine. Fine.", mood: "grieving" },
            ]),
            said(o("They go anyway, with more than they came with, after a scuffle.", [fx.leave("actor", DESERTED, { rations: 10, ammo: 8 }), fx.hp("leader", [-8, -3]), fx.nerve("all", -3)], 4), [
              { who: "leader", text: "Put it down!", mood: "angry" },
              { who: "actor", text: "Get out of my way!", mood: "angry", gesture: "draw-weapon", alt: { coward: "Please move. Please. I don't want to hurt you." } },
            ]),
          ],
        },
      },
      {
        id: "pay",
        label: "Offer 40 scrip to stay",
        cost: { scrip: 40 },
        results: {
          any: [
            said(o("A poor sort of loyalty, and everyone knows it. But they stay.", [fx.trust("actor", 18)], 1), [
              { who: "leader", text: "Forty scrip. Stay.", mood: "cold", gesture: "offer" },
              { who: "actor", text: "...For forty, I'll stay.", mood: "sly", alt: { greedy: "Forty. Now we're talking." } },
            ]),
          ],
        },
      },
      {
        id: "shame",
        label: "Send your speaker to talk to them",
        hours: 1,
        requires: [{ role: "speaker" }],
        why: "No one here has the gift.",
        results: {
          any: [
            said(o("An hour on a wagon step. Both stand wet-eyed, and the sack is unpacked.", [fx.trust("actor", 14), fx.bond("actor", { role: "speaker" }, 5)], 6), [
              { who: "role:speaker", text: "Sit with me a minute. Just a minute.", mood: "calm", gesture: "beckon" },
              { who: "actor", text: "I don't want to die out here.", mood: "grieving" },
              { who: "role:speaker", text: "Then don't die alone out there.", mood: "calm" },
            ]),
            said(o("{actor} shoulders the sack and goes.", [fx.leave("actor", DESERTED, { rations: 6, ammo: 4 }), fx.nerve("all", -3)], 2), [
              { who: "role:speaker", text: "Please.", mood: "pleading" },
              { who: "actor", text: "Tell them I'm sorry.", mood: "grieving", gesture: "turn-away" },
            ]),
          ],
        },
      },
      {
        id: "ask-stay",
        label: "Have someone they trust ask them to stay",
        hint: "It could go either way.",
        hours: 1,
        check: { kind: "persuade", dc: 12, exclude: ["actor"] },
        results: {
          any: [
            said(o("{actor} puts the sack down. {by} helps unpack it.", [fx.trust("actor", 12), fx.bond("actor", "by", 4)], 1), [
              { who: "by", text: "If you go, who holds my end of the rope?", mood: "calm", alt: { veteran: "Deserters die alone. I've buried them. Stay." } },
              { who: "actor", text: "...I'd miss you. That's the stupid part.", mood: "grieving" },
            ], "success"),
            said(o("{actor} shoulders the sack and goes.", [fx.leave("actor", DESERTED, { rations: 6, ammo: 4 }), fx.nerve("all", -3)], 1), [
              { who: "by", text: "Please. We need you.", mood: "pleading" },
              { who: "actor", text: "You'll manage. You always do.", mood: "cold", gesture: "turn-away" },
            ], "fail"),
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
      "The red is at the tailgate, warm and patient, closing faster than the oxen can pull.",
      "There is a way to buy time. Everyone has thought it. No one has said it.",
    ],
    talk: [
      { who: "leader", text: "It's gaining. Whip them! Whip them!", mood: "afraid" },
      { who: "role:guard", text: "They're done. The oxen are done.", mood: "afraid", alt: { stoic: "They've nothing left. We have to decide." } },
      { who: "role:medic", text: "Nobody say it. Please, nobody say it.", mood: "pleading" },
    ],
    options: [
      {
        id: "volunteer",
        label: "Ask for a volunteer to hold the line",
        hint: "Someone stays behind with the last torches. They do not come back.",
        actor: "weakest",
        requires: [{ partyMin: 2 }],
        why: "There is no one else to ask.",
        results: {
          any: [
            said(
              o("{actor} climbs down unasked, takes the last torches, and walks back toward the red.", [fx.kill("actor", "held the Haze at bay so the train could run"), fx.res("torches", [-8, -4]), fx.gap([12, 16]), fx.nerve("all", -10)], 1),
              [
                { who: "actor", text: "Give me the torches.", mood: "calm", gesture: "offer", alt: { coward: "I'm scared. Give me the torches anyway." } },
                { who: "actor", text: "Don't look back. I mean it.", mood: "calm", gesture: "turn-away" },
                { who: "leader", text: "...", mood: "grieving" },
              ],
            ),
          ],
        },
      },
      {
        id: "cut-wagon",
        label: "Cut loose a wagon and its cargo",
        hint: "Lighter wagons are faster wagons.",
        requires: [{ wagonsMin: 2 }],
        why: "There is only one wagon left to cut loose.",
        results: {
          any: [
            said(o("The wagon rolls a little way alone, and stops, and the fog folds over it.", [fx.wagons(-1), fx.gap([8, 11]), fx.nerve("all", -4)], 1), [
              { who: "leader", text: "Cut it! Cut the traces!", mood: "angry" },
              { who: "role:guard", text: "Everything we had was in there.", mood: "grieving" },
            ]),
          ],
        },
      },
      {
        id: "firebreak",
        label: "Burn a firebreak across the road",
        hint: "Costs 6 torches.",
        cost: { torches: 6 },
        results: {
          any: [
            said(o("Fire across the road. The Haze pauses at the edge of it, considering.", [fx.gap([6, 9])], 1), [
              { who: "leader", text: "Light it! All of it!", mood: "angry" },
              { who: "role:scout", text: "It's stopped. It's... thinking.", mood: "afraid" },
            ]),
          ],
        },
      },
      {
        id: "refuse",
        label: "\"No one stays behind. We go on together.\"",
        results: {
          any: [
            said(o("It won't hold the fog back. It holds the train together.", [fx.trust("all", 3), fx.nerve("all", 2)], 1), [
              { who: "leader", text: "No one stays. We go together or not at all.", mood: "calm", alt: { hothead: "Nobody's dying for me. Drive!" } },
              { who: "role:speaker", text: "Together, then.", mood: "calm" },
            ]),
          ],
        },
      },
    ],
  },
];
