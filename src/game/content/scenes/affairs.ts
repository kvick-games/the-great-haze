// Affairs: the scenes the relationship engine (../../relationships.ts) queues when
// someone in the train is cheating, and somebody finds out.
//
// Every scene here is bound: a = the wronged partner, b = the culprit, other = the
// lover, and actor = whoever the scene is centred on (never the lover). The engine
// only learns what the wagon-master does through `fx.affair`: every outcome leaves
// the secret where its story leaves it ("keep", "cover", "tell-wronged", "reveal",
// "silence", "end"). Order matters: an affair that has ended can no longer be told.
//
// `a` is nearly always the culprit's own partner. Anything that breaks the wronged
// couple is gated on the pair really being a couple, so the rare case where `a` is
// the lover's partner instead never marks strangers as estranged.

import type { Cond, Line, SceneDef, Trait, Who } from "../../types.ts";
import { fx, o, t } from "../fx.ts";

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

/** The wronged partner and the culprit really are a couple. */
const COUPLE: Cond = { relKind: { a: "a", b: "b", kinds: ["courting", "lovers", "spouses"] } };

/** A weight modifier: this bound person has this trait. */
const w = (who: Who, trait: Trait, add: number): { if: Cond; add: number } => ({ if: { ofWho: who, has: trait }, add });
/** Only possible when a and b are a couple. */
const coupled = (add: number): { if: Cond; add: number } => ({ if: COUPLE, add });

const MEDIATOR = [
  { if: { trait: "charming" } as Cond, add: 1 },
  { if: { role: "speaker" } as Cond, add: 2 },
  { if: { trait: "kind" } as Cond, add: 1 },
];

/** The wagon-master's steadying word to themself, before a hard choice. */
const LEADER_SEES: Line = {
  who: "leader",
  text: "{b}. And {other}. God help us all.",
  vary: ["{b} and {other}. Of course. Of course it is.", "Not {b}. Please, not {b}."],
  mood: "grieving",
  alt: {
    stoic: "So that's where {b} goes at night.",
    kind: "Oh, {b}. Not this. Not to {a}.",
    paranoid: "I knew it. I knew something was rotten.",
    veteran: "Seen it break better trains than this one.",
    hothead: "{b}, you damned fool.",
    haunted: "The fog saw it first. It always does.",
  },
};

// ---------------------------------------------------------------------------
// 1. The wagon-master sees them go
// ---------------------------------------------------------------------------

const GLIMPSE: SceneDef = {
  id: "rel-affair-glimpse",
  kind: "crisis",
  weight: 0,
  bound: true,
  secret: "player",
  title: "Two shapes past the firelight",
  intro: ["Past midnight, {b} rises from the bedrolls and slips out beyond the wagons.", "A moment later a second shape follows. It is {other}."],
  talk: [
    {
      who: "other",
      text: "Not here. Past the stock wagon.",
      vary: ["This way. Mind the tongue of the wagon.", "Quick, before the watch turns."],
      mood: "sly",
      alt: { coward: "Hurry. Someone'll see. Someone always sees.", charming: "Come on. The fog's our blanket tonight.", hothead: "Stop dawdling. Nobody's watching." },
    },
    {
      who: "b",
      text: "Quiet. {a} sleeps light.",
      vary: ["Hush. {a} turned over just now.", "Softly. {a}'s not asleep yet, I think."],
      mood: "afraid",
      alt: {
        pious: "God forgive me. Come on, quickly.",
        coward: "If anyone wakes, we were checking the stock.",
        charming: "Hush, now. Nobody's awake but the fog.",
        kind: "I hate this. I hate that I can't stop.",
        stoic: "Keep your voice down.",
      },
    },
    LEADER_SEES,
    {
      who: "a",
      text: "{b}? ...Cold. Come back to bed.",
      mood: "calm",
      alt: { haunted: "Is that the fog, {b}? Close the flap.", paranoid: "{b}? Who's up? Who's there?", kind: "Mm. Bring the other blanket, love." },
    },
  ],
  options: [
    {
      id: "follow",
      label: "Follow them and have a word with {b}",
      hint: "Privately, before anyone else wakes.",
      hours: 1,
      results: {
        any: [
          t(
            o("{b} goes grey at the sight of you, and swears on everything that it ends tonight.", [
              fx.affair("keep"),
              fx.affair("end"),
              fx.bond("b", "other", -8),
              fx.trust("b", -2),
              fx.nerve("b", -3),
              fx.nerve("other", -3),
              fx.note("b", "Was caught by {leader} with {other}, and ended it."),
            ], 3, [w("b", "pious", 2), w("b", "kind", 2), w("b", "coward", 1)]),
            [
              { who: "leader", text: "{b}. A word. Now.", mood: "cold", alt: { kind: "{b}. Come here. I'm not going to shout." } },
              { who: "b", text: "It's over. Tonight. I swear it.", mood: "pleading", gesture: "raise-hands", alt: { pious: "I swear on my mother's grave. It's done.", coward: "Don't tell {a}. Please. It's over, it's over." } },
              { who: "other", text: "...You heard, then. It's over.", mood: "grieving", gesture: "turn-away" },
            ],
          ),
          t(
            o("{b} squares up and tells you to mind your own wagon.", [fx.affair("keep"), fx.trust("b", -6), fx.nerve("leader", -1), fx.bond("b", "other", 3)], 3, [
              w("b", "hothead", 2),
              w("b", "greedy", 1),
              w("b", "charming", 1),
            ]),
            [
              { who: "b", text: "Who asked you? Go back to bed.", mood: "angry", gesture: "point", alt: { charming: "You saw nothing, {leader}. Nothing worth waking anyone.", greedy: "What do you want? Name it. Then forget." } },
              { who: "leader", text: "I'll forget nothing. Think about that.", mood: "cold" },
            ],
          ),
          t(
            o("It is {other} who steps between you and begs. {b} says nothing at all.", [fx.affair("keep"), fx.trust("other", -2), fx.nerve("other", -3), fx.nerve("b", -2)], 2),
            [
              { who: "other", text: "It's my fault. Not {b}'s. Mine.", mood: "pleading", alt: { hothead: "Leave {b} out of it. Take it up with me.", stoic: "Blame me. I'll carry it." } },
              { who: "b", text: "...", mood: "grieving", gesture: "turn-away" },
              { who: "leader", text: "Both of you. Back inside. We'll talk by daylight.", mood: "cold" },
            ],
          ),
        ],
      },
    },
    {
      id: "watch",
      label: "Stay in the dark and keep watching",
      hint: "Know what you're dealing with first.",
      hours: 1,
      results: {
        any: [
          t(
            o("An hour in the cold. It is not the first time. It is nowhere near the first.", [fx.affair("keep"), fx.nerve("leader", -2)], 3),
            [
              { who: "other", text: "Same as the fen. Same as the flats.", mood: "calm", alt: { charming: "Every night I think it's the last. Then it isn't." } },
              { who: "leader", text: "Weeks. It's been weeks.", mood: "grieving", alt: { stoic: "Long-standing, then.", veteran: "Not a slip. A habit." } },
            ],
          ),
          t(
            o("A twig goes under your boot. {other} looks straight at your hiding place for a long moment.", [fx.affair("keep"), fx.nerve("other", -4), fx.trust("other", -3)], 2),
            [
              { who: "other", text: "Who's there? ...Who's there?", mood: "afraid", alt: { hothead: "Come out, whoever you are. Come out!" } },
              { who: "b", text: "Fox. It's a fox. Come here.", mood: "calm", alt: { paranoid: "That's no fox. We're going back. Now." } },
            ],
          ),
          t(
            o("Beyond the pair, the Haze leans close and red. Something in it is watching them too. They hurry back, shaken.", [
              fx.affair("keep"),
              fx.nerve("leader", -2),
              fx.nerve("b", -2),
              fx.nerve("other", -2),
              fx.bond("b", "other", 3),
            ], 1),
            [
              { who: "b", text: "Did you hear that? Something breathing.", mood: "afraid", alt: { haunted: "It's listening. It always listens." } },
              { who: "leader", text: "Not only me out here, then.", mood: "afraid", alt: { veteran: "Easy. Don't run. Never run from it." } },
            ],
          ),
        ],
      },
    },
    {
      id: "wake-a",
      label: "Wake {a} and tell them now",
      hint: "No secrets on this train. It will cost somebody.",
      results: {
        any: [
          t(
            o("{a} listens without a sound, then lies back down facing the canvas. Nobody sleeps.", [
              fx.affair("tell-wronged"),
              fx.nerve("a", -6),
              fx.bond("a", "b", -12),
              fx.trust("a", 3),
              fx.note("a", "Learned from {leader} that {b} had been unfaithful."),
              fx.scene("rel-confrontation", 0.5, true),
            ], 3, [w("a", "stoic", 2)]),
            [
              { who: "leader", text: "{a}. Wake up. I'm sorry. It's {b}.", mood: "grieving", alt: { stoic: "{a}. Get up. You need to see something." } },
              { who: "a", text: "With who?", mood: "cold", alt: { paranoid: "{other}. It's {other}, isn't it. I knew.", coward: "No. Don't. I don't want to know." } },
              { who: "a", text: "Thank you. Go away now.", mood: "grieving", alt: { kind: "It's not your fault. Go on. Please." } },
            ],
          ),
          t(
            o("{a} does not believe a word of it, and says so loudly enough to wake the next wagon.", [
              fx.affair("tell-wronged"),
              fx.trust("a", -6),
              fx.nerve("a", -3),
              fx.bond("a", "b", -4),
              fx.note("a", "Refused to believe {leader} about {b} and {other}."),
            ], 2, [w("a", "kind", 1), w("a", "coward", 1)]),
            [
              { who: "a", text: "You're lying. Why would you say that?", mood: "angry", alt: { coward: "Stop. Stop it. That's a wicked thing to say." } },
              { who: "leader", text: "Go and look, then. I'll wait.", mood: "cold", alt: { kind: "I wish I were lying. I'm not." } },
            ],
          ),
          t(
            o("{a} is up before you finish, lantern in hand, walking straight toward the stock wagon.", [fx.affair("tell-wronged"), fx.nerve("a", -4), fx.scene("rel-caught-in-act", 1, true)], 1, [
              w("a", "hothead", 3),
              w("a", "paranoid", 1),
            ]),
            [
              { who: "a", text: "Where? Show me. No, I'll find them.", mood: "angry", gesture: "point" },
              { who: "leader", text: "{a}, wait. {a}!", mood: "afraid" },
            ],
          ),
        ],
      },
    },
    {
      id: "silence",
      label: "Say nothing. It isn't yours to carry.",
      hint: "They'll come back. You'll know. Nobody else will.",
      results: {
        any: [
          t(
            o("You lie awake until they come back, one and then the other, a careful minute apart.", [fx.affair("keep"), fx.nerve("leader", -1)], 3),
            [{ who: "leader", text: "Not my business. Not my business.", mood: "cold", vary: ["Let it lie. Let them lie in it.", "Sleep. Just sleep."], alt: { pious: "Forgive me. I'm keeping it." } }],
          ),
          t(
            o("{a} stirs and asks you straight. You lie, and it comes easily. That frightens you more than the fog.", [fx.affair("keep"), fx.nerve("leader", -2), fx.nerve("a", -1)], 2),
            [
              { who: "a", text: "Did you see {b} go out?", mood: "afraid", alt: { paranoid: "You're awake. You saw. Where's {b}?" } },
              { who: "leader", text: "Just checking the stock. Go back to sleep.", mood: "calm" },
            ],
          ),
          t(
            o("By morning {b} can't meet your eye. {b} knows you know.", [fx.affair("keep"), fx.nerve("b", -3), fx.trust("b", 1)], 1),
            [
              { who: "b", text: "You were awake last night.", mood: "afraid", alt: { hothead: "Whatever you think you saw, you didn't." } },
              { who: "leader", text: "I sleep when I can. Eat your breakfast.", mood: "cold" },
            ],
          ),
        ],
      },
    },
    {
      id: "cover",
      label: "Cover for them: move the watch, smooth the way",
      hint: "They'll owe you. It gets harder for anyone to see.",
      results: {
        any: [
          t(
            o("You shift the watch rota by an hour and say nothing. {b} understands, and is grateful.", [
              fx.affair("cover"),
              fx.trust("b", 4),
              fx.trust("other", 3),
              fx.nerve("leader", -2),
              fx.note("b", "Knew that {leader} was covering for them."),
            ], 3),
            [
              { who: "b", text: "Why would you do that for me?", mood: "calm", alt: { greedy: "What do you want for it?", pious: "I don't deserve that. I don't." } },
              { who: "leader", text: "We need this train in one piece. That's all.", mood: "cold", alt: { kind: "Because I don't know your whole story." } },
            ],
          ),
          t(
            o("{b} hates being known. Your kindness sits on them like a debt.", [fx.affair("cover"), fx.trust("b", -2), fx.nerve("b", -3)], 2, [w("b", "hothead", 1), w("b", "paranoid", 2)]),
            [
              { who: "b", text: "I didn't ask you for anything.", mood: "cold", alt: { paranoid: "What do you want? Everyone wants something." } },
              { who: "leader", text: "No. You didn't.", mood: "cold" },
            ],
          ),
          t(
            o("You cover them. {a} still watches {b} across the fire, reading something nobody says.", [fx.affair("cover"), fx.nerve("a", -3), fx.bond("a", "b", -3)], 1, [w("a", "paranoid", 2)]),
            [{ who: "a", text: "Something's wrong with {b}. You'd tell me, wouldn't you?", mood: "afraid", alt: { stoic: "{b}'s far away lately. You notice?" } }],
          ),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// 2. The wagon-master finds proof
// ---------------------------------------------------------------------------

const EVIDENCE: SceneDef = {
  id: "rel-affair-evidence",
  kind: "crisis",
  weight: 0,
  bound: true,
  secret: "player",
  title: "What was in the bedroll",
  intro: ["Shaking out bedrolls for lice, you find something of {b}'s where it has no business being: in {other}'s blankets."],
  talk: [
    {
      who: "leader",
      text: "This is {b}'s. In {other}'s bed.",
      vary: ["{b}'s ring. On a cord. In {other}'s blankets.", "{b}'s ribbon. Tied round a lock of hair."],
      mood: "cold",
      alt: { kind: "Oh no. Oh, {b}, no.", paranoid: "Knew it. Knew there was something." },
    },
    {
      who: "leader",
      text: "\"Same place. After the second watch.\" {b}'s hand.",
      vary: ["\"I think of you when the fog comes in.\"", "\"Don't wear it where {a} can see.\""],
      mood: "grieving",
    },
    {
      who: "a",
      text: "Found anything? Lice, I mean.",
      mood: "calm",
      alt: {
        paranoid: "What's that you've got? Show me.",
        kind: "Need a hand? I've finished ours.",
        stoic: "Need help with those?",
        hothead: "Hurry up, I want my blanket back.",
        haunted: "You look like you've seen someone dead.",
      },
    },
  ],
  options: [
    {
      id: "confront-b",
      label: "Take it to {b}, quietly",
      hint: "Proof is harder to lie around.",
      hours: 1,
      results: {
        any: [
          t(
            o("{b} looks at it a long time, then gives up. It is over; you watch {b} tell {other} so.", [
              fx.affair("keep"),
              fx.affair("end"),
              fx.nerve("b", -4),
              fx.trust("b", -2),
              fx.bond("b", "other", -8),
              fx.note("b", "Was shown proof by {leader}, and ended it with {other}."),
              fx.note("other", "Was left by {b} after {leader} found them out."),
            ], 3, [w("b", "pious", 2), w("b", "kind", 1), w("b", "stoic", 1)]),
            [
              { who: "b", text: "Where did you... it doesn't matter. It's true.", mood: "grieving", alt: { stoic: "Yes. It's mine. I'll end it." } },
              { who: "leader", text: "End it. Or I end it for you.", mood: "cold", alt: { kind: "End it, {b}. For your own sake." } },
              { who: "b", text: "I will. Today.", mood: "grieving" },
            ],
          ),
          t(
            o("{b} blusters: it's stolen, it's planted, it proves nothing. Nobody believes it, including {b}.", [fx.affair("keep"), fx.trust("b", -6), fx.nerve("b", -2)], 3, [
              w("b", "hothead", 2),
              w("b", "charming", 2),
              w("b", "greedy", 1),
            ]),
            [
              { who: "b", text: "Planted. Somebody's trying to ruin me.", mood: "angry", gesture: "point", alt: { charming: "That? A keepsake. {other} begged for it.", greedy: "Give it back. That's mine. It's worth something." } },
              { who: "leader", text: "It's your hand, {b}. Your words.", mood: "cold" },
              { who: "b", text: "Prove it to anyone else.", mood: "sly", gesture: "turn-away" },
            ],
          ),
          t(
            o("{b} begs you to burn it. Not for their sake: for {a}'s.", [fx.affair("keep"), fx.nerve("b", -3), fx.trust("b", 2)], 2, [w("b", "coward", 2)]),
            [
              { who: "b", text: "Please. It would kill {a}. Burn it.", mood: "pleading", gesture: "kneel" },
              { who: "leader", text: "You should have thought of {a} before.", mood: "cold", alt: { kind: "Get up. I'm not going to hand it round." } },
            ],
          ),
        ],
      },
    },
    {
      id: "show-other",
      label: "Put it in {other}'s hand and watch their face",
      hint: "{other} has less to lose. Or thinks so.",
      results: {
        any: [
          t(
            o("{other} closes a fist round it and says nothing. That evening it's back round {b}'s neck.", [fx.affair("keep"), fx.nerve("other", -3), fx.trust("other", -3)], 2),
            [
              { who: "other", text: "Thank you for returning it.", mood: "cold", alt: { charming: "You're a good sort. You'll keep being one." } },
              { who: "leader", text: "That's not what I'm doing.", mood: "cold" },
            ],
          ),
          t(
            o("{other} goes white and says it's over. By nightfall, {other} has told {b} so.", [
              fx.affair("keep"),
              fx.affair("end"),
              fx.nerve("other", -5),
              fx.bond("b", "other", -8),
              fx.note("other", "Ended it with {b} once {leader} found them out."),
            ], 2, [w("other", "coward", 2), w("other", "pious", 2), w("other", "kind", 1)]),
            [
              { who: "other", text: "It's done. I'll tell {b}. Just don't tell {a}.", mood: "afraid" },
              { who: "leader", text: "See that it is.", mood: "cold" },
            ],
          ),
          t(
            o("{other} stares you down. There is no shame in it at all.", [fx.affair("keep"), fx.trust("other", -5), fx.bond("b", "other", 2)], 2, [w("other", "hothead", 2), w("other", "greedy", 1)]),
            [
              { who: "other", text: "And? What will you do, turn the wagons round?", mood: "sly", alt: { hothead: "Go on. Tell {a}. See who thanks you." } },
              { who: "leader", text: "I'll remember. That's what I'll do.", mood: "cold" },
            ],
          ),
        ],
      },
    },
    {
      id: "show-a",
      label: "Show {a} what you found",
      hint: "There will be no explaining it away.",
      results: {
        any: [
          t(
            o("{a} turns it over in the light, again and again, and then asks you to leave.", [
              fx.affair("tell-wronged"),
              fx.nerve("a", -6),
              fx.bond("a", "b", -12),
              fx.bond("a", "other", -8),
              fx.note("a", "Was shown proof that {b} had been with {other}."),
              fx.scene("rel-confrontation", 0.6, true),
            ], 3),
            [
              { who: "leader", text: "I'm sorry. You'd want to know. I would.", mood: "grieving" },
              { who: "a", text: "{b} said {b} lost this at the ford.", mood: "grieving", alt: { stoic: "I see.", pious: "Before God, {b} swore it was lost." } },
              { who: "a", text: "Leave me alone with it.", mood: "cold", gesture: "turn-away" },
            ],
          ),
          t(
            o("{a} rounds on you instead. Why were you in {other}'s blankets? Who put it there?", [
              fx.affair("tell-wronged"),
              fx.trust("a", -5),
              fx.nerve("a", -3),
              fx.bond("a", "b", -6),
              fx.note("a", "Was shown proof about {b}, and suspected {leader} of lying."),
            ], 1, [w("a", "paranoid", 3), w("a", "coward", 1)]),
            [
              { who: "a", text: "Where did you really get this?", mood: "angry", alt: { paranoid: "You planted it. Why? What do you get?" } },
              { who: "leader", text: "Ask {b}. Ask {other}. Not me.", mood: "cold" },
            ],
          ),
          t(
            o("{a} doesn't say a word. {a} just walks, fast, straight at {other}.", [fx.affair("tell-wronged"), fx.nerve("a", -4), fx.scene("rel-triangle-brawl", 1, true)], 1, [w("a", "hothead", 3)]),
            [
              { who: "a", text: "{other}! You and me. Now!", mood: "angry", gesture: "point" },
              { who: "leader", text: "{a}, don't!", mood: "afraid" },
            ],
          ),
        ],
      },
    },
    {
      id: "put-back",
      label: "Put it back exactly as you found it",
      hint: "You know now. That's all that changes.",
      results: {
        any: [
          t(
            o("You fold the note along its old creases and tuck it back. Your hands aren't quite steady.", [fx.affair("keep"), fx.nerve("leader", -1)], 3),
            [{ who: "leader", text: "Never saw it. Never saw a thing.", mood: "cold", alt: { pious: "Lord, let me be wrong about this.", veteran: "Put it back. Carry on." } }],
          ),
          t(
            o("{a} comes round the wagon just as you tuck it away. {a} looks at the bed, then at you.", [fx.affair("keep"), fx.nerve("a", -2), fx.bond("a", "other", -3)], 2, [w("a", "paranoid", 2)]),
            [
              { who: "a", text: "Why are you in {other}'s things?", mood: "cold", alt: { paranoid: "What did you put there? What did you find?" } },
              { who: "leader", text: "Lice. Same as everyone's.", mood: "calm" },
            ],
          ),
        ],
      },
    },
    {
      id: "burn",
      label: "Burn it. No proof, no trouble.",
      hint: "You'll be covering for them.",
      results: {
        any: [
          t(
            o("The note curls and goes. {b} searches for it all evening, frightened, and never asks.", [fx.affair("cover"), fx.nerve("b", -3), fx.nerve("other", -2)], 3),
            [{ who: "b", text: "Has anyone seen... never mind. Never mind.", mood: "afraid", alt: { hothead: "Who's been through my things? Who?" } }],
          ),
          t(
            o("{b} works out who burned it, and comes to thank you with wet eyes.", [fx.affair("cover"), fx.trust("b", 4), fx.note("b", "Learned {leader} had burned the proof of the affair.")], 2),
            [
              { who: "b", text: "You burned it. Why?", mood: "calm", alt: { greedy: "I owe you. I don't like owing." } },
              { who: "leader", text: "One fire at a time. Don't make me regret it.", mood: "cold" },
            ],
          ),
          t(
            o("The smoke goes up red, not grey, and hangs over the camp too long. Everyone looks at it.", [fx.affair("cover"), fx.nerve("all", -1)], 1),
            [
              { who: "role:scout", text: "Smoke's the wrong colour. What are you burning?", mood: "afraid" },
              { who: "leader", text: "Rags. Only rags.", mood: "cold" },
            ],
          ),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// 3. Someone who saw it comes to the wagon-master
// ---------------------------------------------------------------------------

const CONFIDANT: SceneDef = {
  id: "rel-confidant",
  kind: "crisis",
  weight: 0,
  bound: true,
  secret: "player",
  title: "A word in private",
  intro: ["{actor} waits until the others are asleep, then sits beside you at the fire and won't look at you."],
  talk: [
    {
      who: "actor",
      text: "I saw something. I wish I hadn't.",
      mood: "afraid",
      alt: {
        paranoid: "I've been watching. Someone has to watch.",
        greedy: "I know something. Thought you'd want it first.",
        kind: "It's about {a}. I can't carry this alone.",
        pious: "I have to tell someone, or I'll burst.",
        hothead: "I've half a mind to wake {a} myself.",
        coward: "Promise you won't say it came from me.",
        haunted: "I keep seeing it when I shut my eyes.",
        veteran: "I'll tell it plain. You decide.",
        charming: "You'll want a drink for this one.",
      },
    },
    {
      who: "actor",
      text: "{b} and {other}. Out past the wagons. More than once.",
      vary: ["{b} and {other}. Not talking. Not just talking.", "{b} was with {other}. The way {b} should be with {a}."],
      mood: "cold",
    },
    { who: "leader", text: "You're sure?", vary: ["Sure of it?", "Say that again. Slowly."], mood: "cold", alt: { kind: "Oh, poor {a}.", paranoid: "Who else knows?" } },
    {
      who: "actor",
      text: "Sure as fog. What do I do?",
      mood: "pleading",
      alt: {
        stoic: "Sure. What do you want done?",
        pious: "I saw it. God help me, I did.",
        greedy: "Sure. Question is what it's worth to us.",
        hothead: "Sure. Say the word and I'll sort it.",
      },
    },
  ],
  options: [
    {
      id: "you-tell",
      label: "Tell {a}. Gently, and tonight.",
      hint: "{actor} saw it. {actor} should say it.",
      results: {
        any: [
          t(
            o("{actor} tells it kindly. {a} weeps into {actor}'s shoulder, and in the morning is very calm.", [
              fx.affair("tell-wronged"),
              fx.bond("actor", "a", 8),
              fx.bond("a", "b", -12),
              fx.nerve("a", -5),
              fx.note("a", "Was told by {actor} that {b} had strayed with {other}."),
              fx.scene("rel-confrontation", 0.5, true),
            ], 3, [w("actor", "kind", 2), w("actor", "pious", 1)]),
            [
              { who: "actor", text: "{a}. Sit down. I have to tell you something.", mood: "grieving", alt: { kind: "{a}, love. Come here. Sit with me." } },
              { who: "a", text: "Thank you for telling me. Nobody else did.", mood: "grieving", alt: { stoic: "Thank you. I'll handle it.", hothead: "Where is {b}? Where?" } },
            ],
          ),
          t(
            o("{a} turns on the messenger. By breakfast {a} won't sit near {actor}.", [
              fx.affair("tell-wronged"),
              fx.bond("actor", "a", -8),
              fx.bond("a", "b", -8),
              fx.nerve("a", -4),
              fx.nerve("actor", -3),
              fx.note("actor", "Told {a} about {b}, and was hated for it."),
              fx.scene("rel-confrontation", 0.3, true),
            ], 2, [w("a", "hothead", 2), w("a", "paranoid", 2)]),
            [
              { who: "a", text: "Why are you telling me this? What do you want?", mood: "angry", alt: { paranoid: "You've wanted {b} gone from the start." } },
              { who: "actor", text: "Nothing. I wanted nothing.", mood: "grieving" },
            ],
          ),
          t(
            o("{actor} loses nerve halfway and it comes out wrong, but it comes out. {a} understands enough.", [
              fx.affair("tell-wronged"),
              fx.nerve("actor", -2),
              fx.nerve("a", -5),
              fx.bond("a", "b", -10),
              fx.note("a", "Heard from {actor} about {b} and {other}."),
              fx.scene("rel-confrontation", 0.4, true),
            ], 1, [w("actor", "coward", 3)]),
            [
              { who: "actor", text: "It's {b}. And... I'm sorry. {other}.", mood: "afraid" },
              { who: "a", text: "Say it properly. Say all of it.", mood: "cold" },
            ],
          ),
        ],
      },
    },
    {
      id: "face-b",
      label: "Leave it with me. I'll deal with {b}.",
      hint: "{b} will guess who talked.",
      hours: 1,
      results: {
        any: [
          t(
            o("{b} doesn't argue. It ends that night. But {b} watches {actor} for days after.", [
              fx.affair("end"),
              fx.trust("b", -3),
              fx.bond("actor", "b", -6),
              fx.bond("b", "other", -8),
              fx.note("b", "Was faced by {leader} over {other}, and ended it."),
            ], 3, [w("b", "pious", 2), w("b", "kind", 1)]),
            [
              { who: "b", text: "Who told you? ...Never mind. I can guess.", mood: "cold" },
              { who: "leader", text: "End it. That's all I'm asking.", mood: "cold", alt: { hothead: "End it or I'll put you off this train." } },
              { who: "b", text: "It's ended.", mood: "grieving", gesture: "turn-away" },
            ],
          ),
          t(
            o("{b} denies everything and names {actor} a liar. The camp feels colder by nightfall.", [
              fx.affair("keep"),
              fx.trust("b", -5),
              fx.bond("actor", "b", -10),
              fx.nerve("actor", -3),
            ], 2, [w("b", "hothead", 2), w("b", "charming", 1)]),
            [
              { who: "b", text: "{actor} said that? {actor} would say anything.", mood: "angry", gesture: "point" },
              { who: "actor", text: "I know what I saw.", mood: "cold", alt: { coward: "I... maybe I was wrong. Maybe." } },
            ],
          ),
        ],
      },
    },
    {
      id: "hush",
      label: "Order {actor} to keep it quiet",
      hint: "You'll be covering for them. {actor} may not stand for it.",
      results: {
        any: [
          t(
            o("{actor} agrees, and hates it. You can see it sit in {actor}'s shoulders.", [fx.affair("cover"), fx.trust("actor", -4), fx.nerve("actor", -2)], 3, [w("actor", "kind", 1)]),
            [
              { who: "leader", text: "Not a word. To anyone. That's an order.", mood: "cold", alt: { kind: "Not yet. Let me handle it. Please." } },
              { who: "actor", text: "Fine. It's on you, then.", mood: "cold", alt: { kind: "{a} deserves better than this.", stoic: "Understood." } },
            ],
          ),
          t(
            o("{actor} is relieved to be told what to do. It stops being {actor}'s weight.", [fx.affair("cover"), fx.trust("actor", 2)], 2, [w("actor", "coward", 3), w("actor", "stoic", 2)]),
            [
              { who: "actor", text: "Good. Thank you. I never saw a thing.", mood: "calm" },
              { who: "leader", text: "Keep it that way.", mood: "cold" },
            ],
          ),
          t(
            o("{actor} won't be ordered. Before dawn, {a} knows.", [
              fx.affair("tell-wronged"),
              fx.trust("actor", -6),
              fx.nerve("a", -5),
              fx.bond("a", "b", -10),
              fx.bond("actor", "a", 5),
              fx.note("a", "Was told by {actor} that {b} had strayed."),
              fx.scene("rel-confrontation", 0.5, true),
            ], 1, [w("actor", "pious", 2), w("actor", "hothead", 2), w("actor", "kind", 1)]),
            [
              { who: "actor", text: "No. {a}'s my friend. I'm telling.", mood: "angry", alt: { pious: "I won't lie for anyone. Not even you." } },
              { who: "leader", text: "Then it's on your head.", mood: "cold" },
            ],
          ),
          t(
            o("{actor} agrees to silence, then mentions how heavy it is to carry. You hand over a ration.", [
              fx.affair("cover"),
              fx.res("rations", -1),
              fx.trust("actor", 1),
              fx.note("actor", "Was paid by {leader} to keep {b}'s secret."),
            ], 0, [w("actor", "greedy", 3)]),
            [
              { who: "actor", text: "Silence is hungry work, {leader}.", mood: "sly" },
              { who: "leader", text: "Take it. And choke on it quietly.", mood: "cold" },
            ],
          ),
        ],
      },
    },
    {
      id: "wait",
      label: "Watch them yourself first. Say nothing yet.",
      hint: "Slower. Surer. It goes on meanwhile.",
      results: {
        any: [
          t(
            o("{actor} nods, glad of a plan. You start watching {b}, and it is all there to see.", [fx.affair("keep"), fx.trust("actor", 2), fx.nerve("leader", -1)], 3),
            [
              { who: "leader", text: "Let me see it for myself before anyone acts.", mood: "calm" },
              { who: "actor", text: "Fair. Don't wait too long.", mood: "calm", alt: { paranoid: "Watch close. They're careful. Mostly." } },
            ],
          ),
          t(
            o("{actor} thinks you're stalling. Maybe you are.", [fx.affair("keep"), fx.trust("actor", -3)], 2, [w("actor", "hothead", 2), w("actor", "pious", 1)]),
            [{ who: "actor", text: "Watch? While {a} makes {b}'s bed every night?", mood: "angry" }],
          ),
          t(
            o("While you wait, {a} starts sleeping badly and asking questions nobody answers.", [fx.affair("keep"), fx.nerve("a", -2)], 1),
            [{ who: "a", text: "Everyone's looking at me strange. Why?", mood: "afraid", alt: { paranoid: "You all know something. Don't you." } }],
          ),
        ],
      },
    },
    {
      id: "dismiss",
      label: "Tell {actor} it's none of their business",
      hint: "Now you know. {actor} is left holding it.",
      results: {
        any: [
          t(
            o("{actor} flushes and goes back to bed. {actor} won't bring you anything again.", [fx.affair("keep"), fx.trust("actor", -5)], 3),
            [
              { who: "leader", text: "Grown folk. Their business. Not yours.", mood: "cold", alt: { veteran: "Not your fight. Leave it." } },
              { who: "actor", text: "Right. My mistake, coming to you.", mood: "cold", gesture: "turn-away" },
            ],
          ),
          t(
            o("{actor} takes it elsewhere. By noon, half the camp is whispering.", [fx.affair("keep"), fx.trust("actor", -3), fx.scene("rel-whispers", 0.6, true)], 1, [
              w("actor", "charming", 2),
              w("actor", "hothead", 1),
              w("actor", "paranoid", 1),
            ]),
            [{ who: "actor", text: "Somebody should know. If not you, then everybody.", mood: "sly" }],
          ),
          t(
            o("{actor} tells {a} on their own that same night.", [
              fx.affair("tell-wronged"),
              fx.trust("actor", -4),
              fx.bond("actor", "a", 5),
              fx.nerve("a", -5),
              fx.bond("a", "b", -10),
              fx.note("a", "Was told by {actor} that {b} had strayed."),
              fx.scene("rel-confrontation", 0.5, true),
            ], 1, [w("actor", "kind", 2), w("actor", "pious", 2)]),
            [{ who: "actor", text: "Then I'll do it myself.", mood: "cold", alt: { pious: "Then I'll answer to God, not you." } }],
          ),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// 4. The wronged partner confronts the culprit in front of everyone
// ---------------------------------------------------------------------------

const CONFRONTATION: SceneDef = {
  id: "rel-confrontation",
  kind: "crisis",
  weight: 0,
  bound: true,
  secret: "public",
  title: "In front of everyone",
  intro: ["At the evening meal, {a} stands, sets the plate down, and says it for the whole train to hear."],
  talk: [
    {
      who: "a",
      text: "{b}. Tell them where you go at second watch.",
      mood: "cold",
      alt: {
        hothead: "Stand up, {b}. Tell them all what you've done!",
        stoic: "{b}. I know. Everyone may as well.",
        coward: "I know about {other}. I know, {b}.",
        kind: "I didn't want it here. You left me nowhere else.",
        paranoid: "Did you think I wouldn't notice? I notice everything.",
        pious: "Before God and this train: you broke your word.",
        haunted: "I heard you both. Out there, in the red.",
      },
    },
    {
      who: "b",
      text: "Not here. Please, not here.",
      mood: "pleading",
      alt: {
        charming: "Sit down, love. You're tired. It's the fog talking.",
        hothead: "You want this in front of everyone? Fine!",
        greedy: "What's it matter? We'll all be fog by winter.",
        coward: "I... I don't know what you mean.",
        stoic: "...Yes. It's true.",
      },
    },
    {
      who: "other",
      text: "{a}, I never meant for you to...",
      mood: "afraid",
      alt: { coward: "I'm going. I'm just going to go.", hothead: "Say it to me, then. Not them.", charming: "This isn't the time or the place." },
    },
    { who: "a", text: "Don't. Don't you dare speak to me.", mood: "angry", alt: { stoic: "Quiet, {other}.", kind: "Not you. I can't hear you right now." } },
  ],
  options: [
    {
      id: "back-a",
      label: "Stand with {a}",
      hint: "The truth is out. Make {b} answer it.",
      results: {
        any: [
          t(
            o("With every eye on {b}, it comes out: all of it. {b} says it's finished. It is.", [
              fx.affair("end"),
              fx.bond("a", "b", -8),
              fx.trust("a", 4),
              fx.trust("b", -5),
              fx.nerve("b", -4),
              fx.nerve("a", -3),
              fx.bond("b", "other", -8),
              fx.note("b", "Confessed to the whole train about {other}."),
              fx.note("a", "Made {b} confess before the train."),
            ], 3, [w("b", "pious", 2), w("b", "stoic", 1)]),
            [
              { who: "leader", text: "{a} asked you a question, {b}.", mood: "cold", alt: { kind: "Tell the truth, {b}. It's the only way through." } },
              { who: "b", text: "It's true. It's over. I'm sorry.", mood: "grieving", alt: { stoic: "True. Finished. That's all.", coward: "I'm sorry. I'm sorry. Don't look at me." } },
              { who: "a", text: "Sorry. You're sorry.", mood: "cold" },
            ],
          ),
          t(
            o("{a} takes the ring off, sets it down by the fire, and walks to another wagon. That's the end of them.", [
              fx.rel("a", "b", "estranged"),
              fx.affair("end"),
              fx.nerve("a", -5),
              fx.nerve("b", -4),
              fx.trust("a", 3),
              fx.note("a", "Left {b} over {other}, in front of the train."),
            ], 0, [coupled(2), w("a", "stoic", 1), w("a", "pious", 1)]),
            [
              { who: "a", text: "Keep it. Give it to {other}.", mood: "cold", gesture: "turn-away", alt: { kind: "I loved you. I don't know what I do now." } },
              { who: "b", text: "{a}, please. {a}!", mood: "pleading" },
            ],
          ),
          t(
            o("{b} denies it to the last, and turns the fury on you for siding against them.", [fx.trust("b", -7), fx.bond("a", "b", -6), fx.nerve("a", -3), fx.bond("b", "other", 2)], 2, [
              w("b", "hothead", 2),
              w("b", "charming", 1),
            ]),
            [
              { who: "b", text: "You've had it in for me since the fen!", mood: "angry", gesture: "point" },
              { who: "leader", text: "Everyone here has eyes, {b}.", mood: "cold" },
            ],
          ),
        ],
      },
    },
    {
      id: "back-b",
      label: "Stand with {b}: this isn't the train's business",
      hint: "Keep the peace. {a} will not forget it.",
      results: {
        any: [
          t(
            o("{a} is left standing alone in front of everyone. After a moment, {a} sits back down.", [
              fx.trust("a", -8),
              fx.nerve("a", -5),
              fx.bond("a", "b", -6),
              fx.note("a", "Was shamed at the fire when {leader} took {b}'s side."),
            ], 3),
            [
              { who: "leader", text: "Not at the fire. Settle it in private.", mood: "cold", alt: { stoic: "Sit down, {a}. Not here." } },
              { who: "a", text: "Of course. Of course you would.", mood: "grieving", alt: { hothead: "You'd take a cheat's side? Remember that, all of you." } },
            ],
          ),
          t(
            o("{b} is grateful, and bolder for it. The whole train sees {b} walk out with {other} that night.", [
              fx.trust("b", 5),
              fx.trust("a", -6),
              fx.bond("b", "other", 5),
              fx.nerve("a", -4),
            ], 2, [w("b", "charming", 1), w("b", "greedy", 1)]),
            [
              { who: "b", text: "Thank you. I won't forget it.", mood: "calm" },
              { who: "a", text: "Neither will I.", mood: "cold" },
            ],
          ),
          t(
            o("{a} walks out past the pickets into the red. At dawn {a} comes back, frost-grey and hollow.", [fx.nerve("a", -6), fx.hp("a", -2), fx.trust("a", -5)], 1, [w("a", "haunted", 1)]),
            [
              { who: "a", text: "It sang to me out there. It was kinder.", mood: "grieving", alt: { stoic: "I walked. I came back. Leave it." } },
              { who: "leader", text: "Get by the fire. Now.", mood: "afraid" },
            ],
          ),
          t(
            o("{a} walks out past the pickets into the red, and the red takes {a}. Nobody sleeps.", [
              fx.nerve("all", -3),
              fx.note("b", "Lost {a} to the Haze the night the affair came out."),
              fx.leave("a", "walked into the Haze the night the affair came out"),
            ], 0.2, [w("a", "haunted", 0.4)]),
            [
              { who: "b", text: "{a}! {a}, come back!", mood: "afraid" },
              { who: "role:guard", text: "Gone. Gone past the lamps.", mood: "grieving" },
            ],
          ),
        ],
      },
    },
    {
      id: "mediate",
      label: "Sit all three of them down",
      hint: "Takes someone steady. Could mend it, could end it.",
      hours: 2,
      check: { kind: "calm", dc: 12, exclude: ["a", "b", "other"] },
      results: {
        any: [
          t(
            o("It takes two hours and every word hurts. {b} ends it with {other}. {a} doesn't leave.", [
              fx.affair("end"),
              fx.bond("a", "b", 4),
              fx.bond("b", "other", -8),
              fx.nerve("a", -2),
              fx.nerve("b", -2),
              fx.trust("a", 2),
              fx.note("b", "Ended it with {other}, with the train watching."),
            ], 3, MEDIATOR),
            [
              { who: "by", text: "Sit. All three. Nobody leaves till it's said.", mood: "calm", alt: { pious: "Sit. We'll say it plain, like at meeting.", veteran: "Sit down. I've seen trains die of less." } },
              { who: "b", text: "I don't want to lose you, {a}.", mood: "pleading" },
              { who: "a", text: "Then stop. That's all. Stop.", mood: "grieving" },
            ],
            "success",
          ),
          t(
            o("By the end of it they agree to part without blood. {b} and {a} are done.", [
              fx.rel("a", "b", "estranged"),
              fx.affair("end"),
              fx.nerve("a", -3),
              fx.nerve("b", -2),
              fx.note("a", "Parted from {b}, calmly, after the affair came out."),
            ], 0, [coupled(2)]),
            [
              { who: "by", text: "Nobody here has to hate anybody.", mood: "calm", alt: { kind: "You can end it and still be kind." } },
              { who: "a", text: "Then we're done. Just done.", mood: "grieving" },
            ],
            "success",
          ),
          t(
            o("{b} chooses, out loud. It isn't {a}. {b} and {other} stop hiding.", [
              fx.rel("a", "b", "estranged"),
              fx.rel("b", "other", "courting"),
              fx.affair("end"),
              fx.nerve("a", -6),
              fx.note("a", "Watched {b} choose {other} over them."),
            ], 0, [coupled(1), w("b", "charming", 1)]),
            [
              { who: "b", text: "I'm sorry, {a}. It's {other}. It's been {other}.", mood: "grieving" },
              { who: "a", text: "Then go to {other}.", mood: "cold", gesture: "turn-away" },
            ],
            "success",
          ),
          t(
            o("{a} shouts the mediator down and it all gets worse. Somebody swings.", [
              fx.bond("a", "b", -8),
              fx.nerve("a", -3),
              fx.trust("a", -2),
              fx.scene("fistfight", 0.4, true),
            ], 2, [w("a", "hothead", 2)]),
            [
              { who: "by", text: "Just listen to each other, please.", mood: "pleading" },
              { who: "a", text: "Listen? I've listened to lies for weeks!", mood: "angry", gesture: "point" },
            ],
            "fail",
          ),
          t(
            o("Nobody listens. {b} and {other} walk off into the dark together, in front of everyone.", [fx.bond("a", "b", -8), fx.nerve("a", -4), fx.bond("b", "other", 3)], 2),
            [
              { who: "b", text: "We're done talking.", mood: "cold", gesture: "turn-away" },
              { who: "a", text: "Go, then. Go!", mood: "angry" },
            ],
            "fail",
          ),
        ],
      },
    },
    {
      id: "separate",
      label: "Hold them apart until morning",
      hint: "Put it off. Tempers cool. Or they don't.",
      hours: 1,
      results: {
        any: [
          t(
            o("By dawn, cold heads. {a} is stone. It isn't mended, only put away.", [fx.nerve("a", -3), fx.bond("a", "b", -4), fx.trust("a", -2), fx.trust("b", 1)], 3),
            [
              { who: "leader", text: "Different wagons. Tonight. Talk in daylight.", mood: "cold", alt: { kind: "Sleep on it. Please. Nothing good gets said in the dark." } },
              { who: "a", text: "Daylight won't change it.", mood: "cold" },
            ],
          ),
          t(
            o("In the small hours {a} goes to {other}'s bedroll with a knife. You get there first, and bleed for it.", [
              fx.hp("leader", -3),
              fx.nerve("a", -4),
              fx.bond("a", "other", -10),
              fx.nerve("other", -4),
              fx.note("a", "Went for {other} with a knife in the night."),
            ], 1, [w("a", "hothead", 2), w("a", "paranoid", 1)]),
            [
              { who: "leader", text: "Drop it. {a}, drop it!", mood: "afraid", gesture: "raise-hands" },
              { who: "a", text: "Just once. I only wanted to once.", mood: "grieving" },
            ],
          ),
          t(
            o("Morning comes. {b} walks over to {other} and ends it quietly, where {a} can see.", [
              fx.affair("end"),
              fx.bond("b", "other", -8),
              fx.nerve("other", -4),
              fx.nerve("a", -2),
              fx.note("other", "Was left by {b} the morning after it came out."),
            ], 2, [w("b", "pious", 1), w("b", "kind", 1)]),
            [
              { who: "b", text: "It's over. I'm sorry. It's over.", mood: "grieving" },
              { who: "other", text: "I know. I heard it all last night.", mood: "cold" },
            ],
          ),
        ],
      },
    },
    {
      id: "blame-lover",
      label: "Turn it on {other}: they came between you",
      hint: "Hand the train someone to blame. Unfair, maybe useful.",
      results: {
        any: [
          t(
            o("The train rounds on {other}. {a} and {b} close ranks, and it looks almost like mending.", [
              fx.affair("end"),
              fx.bond("a", "b", 5),
              fx.bond("a", "other", -12),
              fx.bond("b", "other", -8),
              fx.nerve("other", -6),
              fx.trust("other", -8),
              fx.note("other", "Was blamed by the whole train for {b}'s affair."),
            ], 3),
            [
              { who: "leader", text: "{other}. You knew what {b} was to {a}.", mood: "cold" },
              { who: "other", text: "It takes two. It always takes two!", mood: "angry", alt: { coward: "I'm sorry. I'm sorry. I'll keep away.", stoic: "Say what you like." } },
              { who: "a", text: "Stay away from us, {other}. Far away.", mood: "cold" },
            ],
          ),
          t(
            o("{b} steps in front of {other}. That is its own answer, and {a} hears it.", [
              fx.rel("a", "b", "estranged"),
              fx.rel("b", "other", "courting"),
              fx.affair("end"),
              fx.trust("b", -5),
              fx.nerve("a", -6),
              fx.note("a", "Saw {b} stand with {other} against them."),
            ], 0, [coupled(2), w("b", "hothead", 1), w("b", "kind", 1)]),
            [
              { who: "b", text: "Leave {other} alone. It was me.", mood: "angry", gesture: "raise-hands" },
              { who: "a", text: "There it is. There it is.", mood: "grieving" },
            ],
          ),
          t(
            o("{other} says nothing more. In the morning {other}'s bedroll is gone, and so is {other}.", [
              fx.affair("end"),
              fx.nerve("b", -5),
              fx.note("b", "Lost {other}, who left the train in shame."),
              fx.leave("other", "left the train in shame after an affair came out"),
            ], 0.3, [w("other", "coward", 0.5)]),
            [
              { who: "other", text: "I'll not stay where I'm spat on.", mood: "cold", gesture: "turn-away" },
              { who: "b", text: "{other}. Don't. It's the Haze out there.", mood: "afraid" },
            ],
          ),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// 5. Caught in the act
// ---------------------------------------------------------------------------

const CAUGHT: SceneDef = {
  id: "rel-caught-in-act",
  kind: "crisis",
  weight: 0,
  bound: true,
  secret: "public",
  title: "Behind the stock wagon",
  intro: ["A lantern swings behind the stock wagon. {a} is holding it. {b} and {other} are in its light.", "The shouting wakes the whole camp."],
  talk: [
    {
      who: "a",
      text: "{b}.",
      mood: "cold",
      alt: {
        hothead: "I'll kill you. I'll kill you both!",
        coward: "No. No, no, no.",
        stoic: "So.",
        haunted: "I dreamed this. I dreamed the lantern.",
        pious: "In the sight of God, {b}. In His sight.",
        kind: "{b}? What... what is this?",
        paranoid: "I knew. I knew and they all said I was mad.",
      },
    },
    {
      who: "b",
      text: "{a}, wait. Put the lantern down.",
      mood: "afraid",
      gesture: "raise-hands",
      alt: { charming: "{a}. Love. Listen to me. Just listen.", coward: "It's not... I can explain, I can...", hothead: "Don't you come at me with that!" },
    },
    {
      who: "other",
      text: "I'm going. I'm going.",
      mood: "afraid",
      gesture: "raise-hands",
      alt: { hothead: "Put that down or I'll take it off you.", stoic: "Easy, {a}. Easy.", charming: "{a}, this isn't what it... it's exactly what it looks like." },
    },
    { who: "leader", text: "Everyone stay where you are!", vary: ["Nobody move!", "Easy. Everyone, easy."], mood: "afraid", alt: { veteran: "Hands where I can see them. All of you." } },
    { who: "a", text: "Stay back, {leader}. This is mine.", mood: "angry", gesture: "draw-weapon", alt: { coward: "Don't look at me. Nobody look at me.", kind: "Go away. Please. All of you, go away." } },
  ],
  options: [
    {
      id: "step-between",
      label: "Step between them",
      hint: "There's a blade in {a}'s hand.",
      results: {
        any: [
          t(
            o("The blade opens your forearm before {a} sees who it is. Then it drops in the mud.", [
              fx.hp("leader", -4),
              fx.nerve("a", -4),
              fx.trust("a", -2),
              fx.bond("a", "b", -10),
              fx.note("a", "Cut {leader} in the fury of catching {b} with {other}."),
            ], 2),
            [
              { who: "leader", text: "Ah! It's me, {a}. It's me.", mood: "afraid", gesture: "clutch" },
              { who: "a", text: "I didn't... Oh God. Oh God, your arm.", mood: "afraid" },
              { who: "role:medic", text: "Sit. Press on it. Don't look.", mood: "calm" },
            ],
          ),
          t(
            o("{a} lets you take the knife, then folds up in the mud and weeps like a child.", [fx.nerve("a", -6), fx.bond("a", "b", -10), fx.trust("a", 3), fx.bond("leader", "a", 4)], 3, [
              w("a", "kind", 2),
              w("a", "coward", 1),
            ]),
            [
              { who: "leader", text: "Give it here. There. There.", mood: "calm", gesture: "offer" },
              { who: "a", text: "What did I do wrong? What did I do?", mood: "grieving" },
            ],
          ),
          t(
            o("With you standing between them, {b} tells {other} to go, and means it. It's over.", [
              fx.affair("end"),
              fx.bond("b", "other", -10),
              fx.nerve("other", -5),
              fx.nerve("a", -4),
              fx.bond("a", "b", -6),
              fx.note("other", "Was sent away by {b} the night {a} caught them."),
            ], 2, [w("b", "pious", 1), w("b", "kind", 1)]),
            [
              { who: "b", text: "Go, {other}. It's finished. Go.", mood: "grieving" },
              { who: "other", text: "...Right. Right.", mood: "grieving", gesture: "turn-away", alt: { hothead: "Coward. You're a coward, {b}." } },
            ],
          ),
        ],
      },
    },
    {
      id: "let-say",
      label: "Let {a} have their say. Keep a hand near your gun.",
      hint: "Words can do more damage than the knife.",
      results: {
        any: [
          t(
            o("{a} says everything. The whole camp hears it. Nobody who hears it will forget.", [fx.nerve("a", -3), fx.nerve("b", -5), fx.nerve("other", -5), fx.bond("a", "b", -12), fx.bond("a", "other", -8)], 3),
            [
              { who: "a", text: "Every night I waited up for you.", mood: "grieving", alt: { hothead: "I'd have walked into the Haze for you!", stoic: "I trusted you. That's all. I trusted you." } },
              { who: "b", text: "I know. I know you did.", mood: "grieving" },
            ],
          ),
          t(
            o("When it is all said, {a} is finished with {b}. Everyone can see it.", [
              fx.rel("a", "b", "estranged"),
              fx.affair("end"),
              fx.nerve("a", -5),
              fx.nerve("b", -5),
              fx.note("a", "Caught {b} with {other} and ended it there."),
            ], 0, [coupled(2), w("a", "stoic", 1), w("a", "pious", 1)]),
            [
              { who: "a", text: "We're done. Don't come near my wagon.", mood: "cold", gesture: "turn-away" },
              { who: "b", text: "{a}. {a}, please.", mood: "pleading" },
            ],
          ),
          t(
            o("{a} is done with words. {a} goes for {other}.", [fx.scene("rel-triangle-brawl", 1, true)], 1, [w("a", "hothead", 3)]),
            [{ who: "a", text: "You. You did this.", mood: "angry", gesture: "point" }],
          ),
          t(
            o("{a} speaks only to {other}, and it is worse for being quiet.", [fx.bond("a", "other", -14), fx.nerve("other", -6), fx.note("other", "Was cursed by {a} before the camp.")], 2),
            [
              { who: "a", text: "I shared my food with you. I nursed you.", mood: "cold" },
              { who: "other", text: "I know. I'm sorry.", mood: "grieving", alt: { hothead: "Nobody made you.", greedy: "And I'd have paid it back." } },
            ],
          ),
        ],
      },
    },
    {
      id: "drag-lover",
      label: "Drag {other} out of the light",
      hint: "Take one of them out of it.",
      results: {
        any: [
          t(
            o("{other} comes quietly. Behind you, {a} and {b} are left alone with the lantern.", [fx.bond("a", "b", -8), fx.nerve("other", -4), fx.trust("other", -2), fx.scene("rel-confrontation", 0.3, true)], 3),
            [
              { who: "leader", text: "You. With me. Now.", mood: "cold", gesture: "beckon" },
              { who: "other", text: "Don't let {a} hurt {b}.", mood: "afraid", alt: { greedy: "Don't let {a} near my things." } },
            ],
          ),
          t(
            o("{other} fights you off. You both go down in the mud and come up bleeding.", [fx.hp("leader", -3), fx.hp("other", -2), fx.trust("other", -5)], 1, [w("other", "hothead", 3)]),
            [
              { who: "other", text: "Get your hands off me!", mood: "angry" },
              { who: "leader", text: "Stay down. Stay down, damn you.", mood: "angry" },
            ],
          ),
          t(
            o("{b} follows {other} out into the dark, and doesn't look back once.", [
              fx.rel("a", "b", "estranged"),
              fx.rel("b", "other", "courting"),
              fx.affair("end"),
              fx.nerve("a", -6),
              fx.note("a", "Watched {b} follow {other} into the dark."),
            ], 0, [coupled(1), w("b", "charming", 1), w("b", "hothead", 1)]),
            [
              { who: "b", text: "{other}. Wait for me.", mood: "pleading" },
              { who: "a", text: "Go on, then. Go on!", mood: "angry" },
            ],
          ),
        ],
      },
    },
    {
      id: "fire-shot",
      label: "Fire a shot in the air",
      hint: "Costs 1 powder & shot. Loud enough to stop anything.",
      cost: { ammo: 1 },
      results: {
        any: [
          t(
            o("The crack rolls off into the fog. Everyone freezes. The blade drops.", [fx.nerve("all", -2), fx.trust("a", -2), fx.bond("a", "b", -8)], 3),
            [
              { who: "leader", text: "Next one isn't in the air. Drop it.", mood: "cold", gesture: "draw-weapon" },
              { who: "a", text: "...All right. All right.", mood: "afraid", gesture: "raise-hands" },
            ],
          ),
          t(
            o("Something in the fog answers the shot: a long, low sound. Everyone runs for the fire, together.", [fx.nerve("all", -3), fx.bond("a", "b", -6)], 2),
            [
              { who: "role:guard", text: "What was that? What answered?", mood: "afraid" },
              { who: "leader", text: "Inside the wagons. Now. All of you.", mood: "afraid" },
            ],
          ),
          t(
            o("{a} drops the knife and walks away into the dark without a word.", [fx.nerve("a", -5), fx.bond("a", "b", -8), fx.trust("a", -3)], 1),
            [{ who: "leader", text: "{a}! Stay in the lamplight!", mood: "afraid" }],
          ),
        ],
      },
    },
    {
      id: "shame",
      label: "Shame them all: wake the whole camp",
      hint: "No more secrets. Nobody comes out of it clean.",
      results: {
        any: [
          t(
            o("The camp gathers in nightclothes and stares. {b} and {other} stand in it. It is over.", [
              fx.affair("end"),
              fx.nerve("b", -5),
              fx.nerve("other", -5),
              fx.trust("b", -6),
              fx.trust("other", -6),
              fx.nerve("a", -3),
              fx.note("b", "Was shamed before the whole camp with {other}."),
              fx.note("other", "Was shamed before the whole camp with {b}."),
            ], 3),
            [
              { who: "leader", text: "Up! Everyone up! Come and look at this.", mood: "angry", gesture: "beckon" },
              { who: "b", text: "Don't do this. Don't.", mood: "pleading" },
              { who: "other", text: "...", mood: "grieving", gesture: "turn-away" },
            ],
          ),
          t(
            o("The camp takes {a}'s side, then goes cold on you for making a show of it.", [fx.affair("end"), fx.trust("all", -2), fx.nerve("a", -4), fx.bond("b", "other", -6)], 2),
            [
              { who: "role:speaker", text: "Was that needed? In front of all of us?", mood: "cold" },
              { who: "a", text: "Nobody asked you to do that.", mood: "cold" },
            ],
          ),
          t(
            o("It breaks {a}, not them. {a} can't bear being looked at.", [fx.nerve("a", -7), fx.trust("a", -6), fx.note("a", "Was shamed along with {b} when {leader} woke the camp.")], 1, [
              w("a", "coward", 2),
              w("a", "haunted", 1),
            ]),
            [{ who: "a", text: "Stop looking at me. Stop it!", mood: "afraid", gesture: "clutch" }],
          ),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// 6. The culprit confesses to the wagon-master
// ---------------------------------------------------------------------------

const CONFESSION: SceneDef = {
  id: "rel-confession",
  kind: "crisis",
  weight: 0,
  bound: true,
  secret: "player",
  title: "Before dawn at the water barrel",
  intro: ["{b} finds you at the water barrel before dawn and cannot get the first words out."],
  talk: [
    {
      who: "b",
      text: "I've done something. With {other}.",
      mood: "grieving",
      alt: {
        pious: "I have sinned. I can't carry it any further.",
        stoic: "I'll say it once. {other} and I.",
        coward: "Don't be angry. Please. It's {other}. Me and {other}.",
        charming: "You'll think less of me. You should.",
        kind: "{a} doesn't deserve this. I know that.",
        haunted: "The fog whispers it. So I'm telling you first.",
        hothead: "Don't lecture me. Just listen.",
      },
    },
    { who: "b", text: "{a} doesn't know. I can't look at {a} anymore.", vary: ["{a} still smiles at me. I can't stand it.", "{a} thinks I'm tired. Just tired."], mood: "grieving" },
    { who: "leader", text: "How long?", vary: ["Since when?", "Does {other} know you're here?"], mood: "cold", alt: { kind: "Sit down. How long?", hothead: "You damned fool. How long?" } },
    { who: "b", text: "Since the fen. Tell me what to do.", vary: ["Long enough. What do I do?", "Too long. Tell me what to do."], mood: "pleading" },
  ],
  options: [
    {
      id: "tell-a",
      label: "Tell {a} yourself. Tonight.",
      hint: "The hardest way through. Maybe the only one.",
      results: {
        any: [
          t(
            o("{b} tells {a} in the dark of their wagon. In the morning they're still side by side, barely.", [
              fx.affair("tell-wronged"),
              fx.affair("end"),
              fx.bond("a", "b", -6),
              fx.nerve("a", -4),
              fx.nerve("b", 2),
              fx.trust("b", 3),
              fx.note("a", "Heard {b} confess to an affair with {other}, and stayed."),
              fx.note("b", "Confessed to {a}, and was not left."),
            ], 2, [w("a", "kind", 2), w("a", "pious", 2)]),
            [
              { who: "leader", text: "Tell {a}. Then it's the two of you, not three.", mood: "calm" },
              { who: "b", text: "And if {a} leaves me?", mood: "afraid" },
              { who: "leader", text: "Then at least it's the truth leaving.", mood: "calm", alt: { pious: "Then you'll have done right anyway." } },
            ],
          ),
          t(
            o("{b} tells {a}, and {a} is gone to another wagon before sunrise.", [
              fx.affair("tell-wronged"),
              fx.rel("a", "b", "estranged"),
              fx.affair("end"),
              fx.nerve("a", -5),
              fx.nerve("b", -3),
              fx.note("a", "Left {b} after {b} confessed to the affair."),
            ], 0, [coupled(2), w("a", "hothead", 1), w("a", "stoic", 1)]),
            [
              { who: "b", text: "I told {a}. {a} packed a bedroll.", mood: "grieving" },
              { who: "leader", text: "You did the right thing. It still costs.", mood: "calm" },
            ],
          ),
          t(
            o("{b} can't do it quietly. It comes out at breakfast, in front of everyone.", [
              fx.affair("reveal"),
              fx.nerve("b", -3),
              fx.nerve("a", -4),
              fx.note("b", "Confessed the affair with {other} at breakfast."),
              fx.scene("rel-confrontation", 0.7, true),
            ], 1),
            [
              { who: "b", text: "{a}. Everyone. I have to say something.", mood: "pleading" },
              { who: "a", text: "What is it? {b}, what?", mood: "afraid" },
            ],
          ),
          t(
            o("{b} goes to their wagon, sits by the sleeping {a} until dawn, and says nothing at all.", [fx.affair("keep"), fx.nerve("b", -4)], 1, [w("b", "coward", 3)]),
            [{ who: "b", text: "I couldn't. I sat there all night. I couldn't.", mood: "grieving" }],
          ),
        ],
      },
    },
    {
      id: "end-it",
      label: "End it with {other}, and never say a word to {a}",
      hint: "Bury it. It may not stay buried.",
      results: {
        any: [
          t(
            o("{b} ends it that afternoon. {other} takes it badly and in silence.", [
              fx.affair("keep"),
              fx.affair("end"),
              fx.bond("b", "other", -10),
              fx.nerve("other", -5),
              fx.nerve("b", -2),
              fx.note("other", "Was left by {b}, who went back to {a}."),
              fx.note("b", "Ended it with {other} and told {a} nothing."),
            ], 3),
            [
              { who: "leader", text: "End it. Carry the rest yourself.", mood: "cold", alt: { kind: "End it. Be good to {a}. That's the penance." } },
              { who: "b", text: "Yes. Yes. I can do that.", mood: "calm" },
            ],
          ),
          t(
            o("{b} tries. {other} won't hear it, not like this.", [fx.affair("keep"), fx.nerve("b", -3), fx.scene("rel-affair-ends", 1, true)], 2, [w("other", "hothead", 1)]),
            [
              { who: "b", text: "I'll try. {other} won't make it easy.", mood: "afraid" },
              { who: "leader", text: "It isn't meant to be easy.", mood: "cold" },
            ],
          ),
          t(
            o("It's ended. But {a} can feel the change in {b}, and doesn't know what it means.", [
              fx.affair("keep"),
              fx.affair("end"),
              fx.nerve("a", -2),
              fx.bond("a", "b", -3),
              fx.bond("b", "other", -8),
            ], 2),
            [{ who: "a", text: "You've been far away, {b}. Where do you go?", mood: "afraid", alt: { paranoid: "Something's changed. Tell me what's changed." } }],
          ),
        ],
      },
    },
    {
      id: "swear-silence",
      label: "Leave {other} be, and get {other} to swear silence",
      hint: "Tie it off so nobody ever has to know.",
      hours: 1,
      results: {
        any: [
          t(
            o("{other} agrees, coldly, and swears it never happened.", [
              fx.affair("cover"),
              fx.affair("end"),
              fx.bond("b", "other", -6),
              fx.trust("other", -3),
              fx.note("other", "Swore to {leader} never to speak of {b}."),
            ], 3),
            [
              { who: "other", text: "It never happened. Happy?", mood: "cold", alt: { kind: "I'd never hurt {a}. I'll never say.", greedy: "Silence. Fine. Remember I gave it." } },
              { who: "leader", text: "No. But it'll do.", mood: "cold" },
            ],
          ),
          t(
            o("{other} refuses to be tidied away. It is not over for {other}.", [fx.affair("keep"), fx.bond("b", "other", -10), fx.nerve("other", -3), fx.trust("other", -4)], 2, [
              w("other", "hothead", 2),
              w("other", "charming", 1),
            ]),
            [{ who: "other", text: "You don't get to decide when it's over.", mood: "angry", alt: { charming: "You'd have me swear off my own heart?" } }],
          ),
          t(
            o("{other} goes straight to {a} out of spite, and tells it all.", [
              fx.affair("tell-wronged"),
              fx.bond("a", "b", -10),
              fx.nerve("a", -5),
              fx.bond("b", "other", -12),
              fx.note("a", "Was told by {other} about the affair with {b}."),
              fx.scene("rel-confrontation", 0.6, true),
            ], 1, [w("other", "hothead", 2), w("other", "greedy", 1)]),
            [
              { who: "other", text: "Silence? I'll give {a} the truth instead.", mood: "angry" },
              { who: "b", text: "{other}, no!", mood: "afraid" },
            ],
          ),
        ],
      },
    },
    {
      id: "condemn",
      label: "Condemn it. {b} made this bed.",
      hint: "Honest. Cold. {b} came to you for help.",
      results: {
        any: [
          t(
            o("{b} takes it, head down, and goes to end it the same night.", [
              fx.affair("keep"),
              fx.affair("end"),
              fx.trust("b", -5),
              fx.nerve("b", -5),
              fx.bond("b", "other", -8),
              fx.note("b", "Was condemned by {leader}, and ended the affair."),
            ], 2, [w("b", "pious", 2)]),
            [
              { who: "leader", text: "You lied to {a} every night. Own it.", mood: "cold", alt: { pious: "You broke a vow. Mend what you can." } },
              { who: "b", text: "I know what I am.", mood: "grieving" },
            ],
          ),
          t(
            o("{b} bristles and goes back to {other}, as if to prove something.", [fx.affair("keep"), fx.trust("b", -7), fx.bond("b", "other", 4)], 2, [w("b", "hothead", 2), w("b", "greedy", 1)]),
            [{ who: "b", text: "Then I'll not come to you again.", mood: "angry", gesture: "turn-away", alt: { charming: "Well. I tried being honest." } }],
          ),
          t(
            o("The shame drives {b} straight to {a}, to tell it all.", [
              fx.affair("tell-wronged"),
              fx.nerve("b", -4),
              fx.nerve("a", -5),
              fx.bond("a", "b", -8),
              fx.note("a", "Heard {b} confess to an affair with {other}."),
              fx.scene("rel-confrontation", 0.5, true),
            ], 1),
            [{ who: "b", text: "You're right. {a} should hear it from me.", mood: "grieving" }],
          ),
        ],
      },
    },
    {
      id: "comfort",
      label: "Sit with {b}. Nobody's all one thing.",
      hint: "Kindness might steady {b}. Or excuse it.",
      results: {
        any: [
          t(
            o("{b} steadies. Before the sun is up, {b} has decided: it ends.", [
              fx.affair("keep"),
              fx.affair("end"),
              fx.nerve("b", 3),
              fx.trust("b", 5),
              fx.bond("b", "other", -6),
              fx.note("b", "Was comforted by {leader}, and ended it with {other}."),
            ], 3, [w("b", "kind", 1), w("b", "pious", 1)]),
            [
              { who: "leader", text: "You're not the worst thing on this road.", mood: "calm", alt: { haunted: "The fog's made worse of better people." } },
              { who: "b", text: "Thank you. I'll end it. I will.", mood: "calm" },
            ],
          ),
          t(
            o("{b} feels better for talking. That night, {b} goes back out to {other}.", [fx.affair("keep"), fx.nerve("b", 2), fx.trust("b", 3), fx.nerve("leader", -1)], 2),
            [{ who: "b", text: "It helps, saying it. It really helps.", mood: "calm" }],
          ),
          t(
            o("Talking, {b} understands something: it's {other}. It was always going to be. {b} tells {a} so.", [
              fx.affair("tell-wronged"),
              fx.rel("a", "b", "estranged"),
              fx.rel("b", "other", "courting"),
              fx.affair("end"),
              fx.nerve("a", -6),
              fx.note("a", "Was left by {b} for {other}."),
            ], 0, [coupled(1), w("b", "charming", 1)]),
            [
              { who: "b", text: "I love {other}. I have to tell {a}.", mood: "grieving" },
              { who: "leader", text: "Then tell it straight, and gently.", mood: "calm" },
            ],
          ),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// 7. Blackmail
// ---------------------------------------------------------------------------

const BLACKMAIL: SceneDef = {
  id: "rel-blackmail",
  kind: "crisis",
  weight: 0,
  bound: true,
  secret: "player",
  title: "The price of quiet",
  intro: ["You catch {b} slipping a ration bundle into {actor}'s pack. {b} sees you see."],
  talk: [
    {
      who: "actor",
      text: "Fair trade. Quiet costs, same as anything.",
      mood: "sly",
      alt: {
        hothead: "Walk on. This isn't yours.",
        paranoid: "Everyone pays for something out here.",
        charming: "Just a little arrangement between friends.",
        coward: "It's... it's owed. Ask {b}.",
      },
    },
    { who: "b", text: "It's nothing. It's a debt.", mood: "afraid", alt: { coward: "Please. Please just walk on.", stoic: "Leave it.", pious: "I deserve it. Let it be.", hothead: "Stay out of it." } },
    {
      who: "b",
      text: "{actor} saw me with {other}. Now it's rations, watches, anything.",
      vary: ["{actor} knows about {other}. Every week the price goes up.", "My rations. My watches. My boots, next. For {other}."],
      mood: "grieving",
    },
    {
      who: "actor",
      text: "I kept my mouth shut. That's worth bread.",
      vary: ["Silence is scarce out here. Scarcer than salt pork.", "I could've told {a}. I didn't. You're welcome."],
      mood: "sly",
    },
  ],
  options: [
    {
      id: "expose",
      label: "Expose {actor} to the camp",
      hint: "The camp will ask what {actor} was paid to hide.",
      results: {
        any: [
          t(
            o("The camp rounds on {actor}, and then asks why. Everything comes out.", [
              fx.affair("silence"),
              fx.affair("reveal"),
              fx.trust("actor", -6),
              fx.nerve("actor", -5),
              fx.bond("actor", "b", -10),
              fx.nerve("b", -4),
              fx.note("actor", "Was exposed as a blackmailer by {leader}."),
              fx.scene("rel-confrontation", 0.5, true),
            ], 3),
            [
              { who: "leader", text: "{actor}'s been bleeding {b} dry. For silence.", mood: "cold" },
              { who: "actor", text: "Silence about what? Ask {b}. Ask {other}!", mood: "angry", gesture: "point" },
              { who: "a", text: "{b}? What's {actor} talking about?", mood: "afraid" },
            ],
          ),
          t(
            o("You tell the camp what {actor} did, and nothing of why. It holds, barely.", [
              fx.affair("silence"),
              fx.trust("actor", -6),
              fx.nerve("actor", -4),
              fx.trust("b", 3),
              fx.note("actor", "Was exposed as a blackmailer by {leader}."),
            ], 2, [{ if: { role: "speaker" }, add: 1 }, { if: { trait: "charming" }, add: 1 }]),
            [
              { who: "leader", text: "{actor} has been taking {b}'s food. That ends now.", mood: "cold" },
              { who: "actor", text: "You'll regret protecting {b}.", mood: "cold", alt: { coward: "I'm sorry. I'll give it back. All of it." } },
            ],
          ),
          t(
            o("{actor}, cornered, spits out the reason to the whole camp.", [
              fx.affair("silence"),
              fx.affair("reveal"),
              fx.trust("actor", -8),
              fx.bond("a", "b", -10),
              fx.nerve("a", -5),
              fx.note("a", "Learned of {b}'s affair when {actor} shouted it out."),
            ], 1, [w("actor", "hothead", 2)]),
            [
              { who: "actor", text: "Want to know why? {b}'s been with {other}!", mood: "angry", gesture: "point" },
              { who: "a", text: "...What?", mood: "afraid" },
            ],
          ),
        ],
      },
    },
    {
      id: "pay",
      label: "Pay {actor} off from the stores",
      hint: "Costs 2 rations. Buys quiet. Maybe.",
      cost: { rations: 2 },
      results: {
        any: [
          t(
            o("{actor} weighs the sack and nods. It's finished, for now.", [fx.affair("silence"), fx.trust("actor", 2), fx.trust("b", 4), fx.nerve("leader", -1), fx.note("b", "{leader} paid {actor} to keep quiet.")], 3),
            [
              { who: "leader", text: "Take it. That's the last of it. Ever.", mood: "cold" },
              { who: "actor", text: "Pleasure doing business.", mood: "sly" },
            ],
          ),
          t(
            o("{actor} takes it, smiles, and says you'll talk again in a week.", [fx.affair("keep"), fx.trust("b", 2), fx.nerve("b", -2)], 2, [w("actor", "hothead", 1), w("actor", "paranoid", 1)]),
            [
              { who: "actor", text: "Good start. We'll talk again next week.", mood: "sly" },
              { who: "leader", text: "No. We won't.", mood: "cold" },
            ],
          ),
          t(
            o("Taking it from your hands, not {b}'s, shames {actor}. {actor} gives half back.", [fx.affair("silence"), fx.res("rations", 1), fx.trust("actor", 3), fx.nerve("actor", -2)], 1, [
              w("actor", "kind", 2),
              w("actor", "pious", 2),
            ]),
            [{ who: "actor", text: "Keep half. I... keep half.", mood: "grieving", gesture: "offer" }],
          ),
        ],
      },
    },
    {
      id: "make-confess",
      label: "Make {b} confess. No secret, no leverage.",
      hint: "Ends the squeeze. Starts something else.",
      results: {
        any: [
          t(
            o("{b} goes to {a} and tells it. {actor}'s leverage is gone, and so is a great deal else.", [
              fx.affair("tell-wronged"),
              fx.affair("silence"),
              fx.bond("a", "b", -10),
              fx.nerve("a", -5),
              fx.nerve("b", -3),
              fx.bond("actor", "b", -4),
              fx.note("a", "Heard {b} confess to an affair with {other}."),
              fx.scene("rel-confrontation", 0.5, true),
            ], 3),
            [
              { who: "leader", text: "Tell {a}. Then {actor} has nothing to sell.", mood: "cold" },
              { who: "b", text: "All right. All right. Come with me?", mood: "afraid" },
            ],
          ),
          t(
            o("{b} refuses, and begs you to let it be. {actor} goes on collecting.", [fx.affair("keep"), fx.trust("b", -5), fx.nerve("b", -4)], 2, [w("b", "coward", 2)]),
            [{ who: "b", text: "I can't. I'd rather starve. Let {actor} have it.", mood: "pleading" }],
          ),
          t(
            o("{b} goes further: stands up at the fire and tells everyone at once.", [
              fx.affair("reveal"),
              fx.affair("silence"),
              fx.nerve("b", -5),
              fx.nerve("a", -5),
              fx.trust("actor", -4),
              fx.note("b", "Confessed the affair to the whole train to break {actor}'s hold."),
              fx.scene("rel-confrontation", 0.5, true),
            ], 1, [w("b", "hothead", 1), w("b", "pious", 1)]),
            [{ who: "b", text: "Everyone. {actor} has been bleeding me. Here's why.", mood: "angry" }],
          ),
        ],
      },
    },
    {
      id: "threaten",
      label: "Lean on {actor}. Hard.",
      hint: "Someone has to make {actor} believe it.",
      check: { kind: "talk-down", dc: 12, exclude: ["actor", "b", "other"] },
      results: {
        any: [
          t(
            o("{actor} believes it. The squeeze stops, and {actor} stays well clear of you.", [
              fx.affair("silence"),
              fx.trust("actor", -4),
              fx.nerve("actor", -4),
              fx.trust("b", 4),
              fx.note("actor", "Was made to stop blackmailing {b}."),
            ], 3),
            [
              { who: "by", text: "One more ration, and you walk from here.", mood: "cold", alt: { veteran: "I've buried better than you. Stop.", hothead: "Take another crumb and I'll break your hand." } },
              { who: "actor", text: "Fine. Fine! It was only bread.", mood: "afraid" },
            ],
            "success",
          ),
          t(
            o("{actor} backs down, and blames {b} for it with every look.", [fx.affair("silence"), fx.trust("actor", -7), fx.bond("actor", "b", -8)], 2),
            [
              { who: "by", text: "It stops. Tonight.", mood: "cold" },
              { who: "actor", text: "It stops. Don't think I'll forget, {b}.", mood: "cold" },
            ],
            "success",
          ),
          t(
            o("{actor} laughs. The price goes up, and {b} pays it.", [fx.affair("keep"), fx.trust("actor", -3), fx.res("rations", -1), fx.nerve("b", -3)], 2),
            [
              { who: "by", text: "You'll stop. Or else.", mood: "cold", alt: { coward: "Please. Just stop. It isn't right." } },
              { who: "actor", text: "Or else what? You'll tell {a}? Go on.", mood: "sly" },
            ],
            "fail",
          ),
          t(
            o("{actor} goes to {a} out of spite. The leverage is spent, and so is {a}'s peace.", [
              fx.affair("tell-wronged"),
              fx.affair("silence"),
              fx.nerve("a", -5),
              fx.bond("a", "b", -10),
              fx.bond("actor", "b", -8),
              fx.note("a", "Was told by {actor} about {b} and {other}."),
              fx.scene("rel-confrontation", 0.4, true),
            ], 1, [w("actor", "hothead", 2)]),
            [
              { who: "actor", text: "Threaten me? Then I've nothing left to sell.", mood: "angry" },
              { who: "b", text: "No. {actor}, no. Don't!", mood: "afraid" },
            ],
            "fail",
          ),
        ],
      },
    },
    {
      id: "let-lie",
      label: "Let it lie. {b} made this bargain.",
      hint: "Not your stores. Not your sin.",
      results: {
        any: [
          t(
            o("{b} keeps paying. {b} is thinner by the week, and angrier at you.", [fx.affair("keep"), fx.nerve("b", -4), fx.trust("b", -5), fx.hp("b", -2)], 3),
            [{ who: "b", text: "You saw, and you did nothing.", mood: "cold", alt: { stoic: "Fine. My bargain.", coward: "I understand. I do." } }],
          ),
          t(
            o("{b} snaps and goes for {actor} behind the cook wagon. The payments stop.", [
              fx.affair("silence"),
              fx.hp("actor", -3),
              fx.hp("b", -2),
              fx.bond("actor", "b", -12),
              fx.nerve("actor", -3),
              fx.note("b", "Beat {actor} to stop the blackmail."),
            ], 1, [w("b", "hothead", 3)]),
            [
              { who: "b", text: "Not another crumb. Not one!", mood: "angry" },
              { who: "actor", text: "Get off! You'll pay for this, {b}!", mood: "afraid" },
            ],
          ),
          t(
            o("{actor} gets careless. Others notice the extra bread, and start asking why.", [fx.affair("keep"), fx.nerve("b", -2), fx.scene("rel-whispers", 0.5, true)], 1),
            [
              { who: "role:guard", text: "{actor}'s eating well lately. Wonder why.", mood: "sly" },
              { who: "b", text: "Now they're all counting. Thanks for nothing.", mood: "cold" },
            ],
          ),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// 8. Rumour
// ---------------------------------------------------------------------------

const WHISPERS: SceneDef = {
  id: "rel-whispers",
  kind: "crisis",
  weight: 0,
  bound: true,
  secret: "player",
  title: "Talk at the wash barrel",
  intro: ["Behind the cook wagon, {actor} is talking low to anyone who'll lean in. You hear {b}'s name. Then {other}'s."],
  talk: [
    {
      who: "actor",
      text: "...and {other} came back with straw in their hair.",
      vary: ["...twice now. Same hour. Same way back.", "...you should've seen {b}'s face at breakfast."],
      mood: "sly",
      alt: {
        charming: "Oh, it's the sweetest thing. And the saddest.",
        hothead: "I'm only saying what everyone's thinking.",
        paranoid: "I'm not saying. I'm just saying watch them.",
        pious: "It's a shame on the whole train, is what it is.",
        haunted: "The fog sees them. Now I do too.",
      },
    },
    {
      who: "actor",
      text: "Poor {a}. Last to know, always.",
      mood: "sly",
      alt: {
        kind: "Poor {a}. Someone ought to say. Not me.",
        greedy: "Bet a biscuit {a} finds out by the river.",
        coward: "Don't say you heard it from me.",
        stoic: "Not my business. Just saying.",
      },
    },
    {
      who: "leader",
      text: "That's how it starts. Then it's everywhere.",
      vary: ["Once it's talk, it's weather. Nobody stops weather.", "By tomorrow the oxen will know."],
      mood: "cold",
      alt: { hothead: "Damn gossips. Damn them.", pious: "Loose tongues. Lord, give me patience." },
    },
  ],
  options: [
    {
      id: "shut-down",
      label: "Shut it down, right now",
      hint: "Takes a voice people listen to.",
      check: { kind: "talk-down", dc: 11, exclude: ["actor", "b", "other"] },
      results: {
        any: [
          t(
            o("The circle breaks up. {actor} goes red and finds something to scrub.", [fx.affair("keep"), fx.trust("actor", -3), fx.nerve("actor", -2)], 3),
            [
              { who: "by", text: "Enough. You've a wagon to grease. Go.", mood: "cold", alt: { charming: "Lovely story. Save it for the Haze. Off you go." } },
              { who: "actor", text: "Only talk. Only talking.", mood: "afraid" },
            ],
            "success",
          ),
          t(
            o("{actor} is ashamed, and says so. It won't come from {actor} again.", [fx.affair("keep"), fx.trust("actor", 1), fx.nerve("actor", -1)], 2, [w("actor", "kind", 2), w("actor", "pious", 1)]),
            [
              { who: "by", text: "Would you want it said of you?", mood: "calm" },
              { who: "actor", text: "No. I'm sorry. I'll leave it.", mood: "grieving" },
            ],
            "success",
          ),
          t(
            o("{actor} shrugs you off. The whispering only moves somewhere you can't hear it.", [fx.affair("keep"), fx.trust("actor", -4)], 3),
            [
              { who: "by", text: "Stop it. Now.", mood: "cold" },
              { who: "actor", text: "Everyone knows already. Ask anyone.", mood: "sly" },
            ],
            "fail",
          ),
          t(
            o("Too late: the talk has already reached {a}, who is standing at the wash barrel, very still.", [
              fx.affair("reveal"),
              fx.nerve("a", -5),
              fx.bond("a", "b", -10),
              fx.note("a", "Heard the camp's whispers about {b} and {other}."),
              fx.scene("rel-confrontation", 0.5, true),
            ], 1),
            [
              { who: "a", text: "Say it again. Louder. So I can hear.", mood: "cold" },
              { who: "actor", text: "{a}. I didn't see you there.", mood: "afraid" },
            ],
            "fail",
          ),
        ],
      },
    },
    {
      id: "ask",
      label: "Take {actor} aside: what did they actually see?",
      hint: "Rumour or truth. You'll know which.",
      results: {
        any: [
          t(
            o("{actor} saw it plainly, and describes it plainly. There's no mistaking it.", [fx.affair("keep"), fx.trust("actor", 2)], 3),
            [
              { who: "leader", text: "What did you see? Exactly.", mood: "cold" },
              { who: "actor", text: "Enough to be sure. More than I wanted.", mood: "cold", alt: { charming: "Everything, darling. Twice." } },
            ],
          ),
          t(
            o("{actor} admits it's half guesses. The half that isn't is enough.", [fx.affair("keep"), fx.nerve("actor", -1)], 2),
            [{ who: "actor", text: "Well. I saw them come back. Together. Twice.", mood: "afraid" }],
          ),
          t(
            o("{actor} asks what it's worth to you. You don't pay. {actor} tells you anyway, smiling.", [fx.affair("keep"), fx.trust("actor", -2)], 1, [w("actor", "greedy", 3)]),
            [{ who: "actor", text: "What's it worth? ...Oh, fine. Here it is, free.", mood: "sly" }],
          ),
        ],
      },
    },
    {
      id: "warn",
      label: "Warn {b} and {other}: the camp is talking",
      hint: "They'll know you know.",
      results: {
        any: [
          t(
            o("Frightened, they end it the same hour.", [
              fx.affair("end"),
              fx.nerve("b", -3),
              fx.nerve("other", -3),
              fx.bond("b", "other", -6),
              fx.trust("b", 3),
              fx.note("b", "Ended it with {other} once the camp began to talk."),
            ], 2, [w("b", "coward", 2), w("b", "pious", 1)]),
            [
              { who: "leader", text: "The whole camp's talking. End it, or own it.", mood: "cold" },
              { who: "b", text: "Then it's over. It has to be.", mood: "afraid" },
            ],
          ),
          t(
            o("They thank you, and get more careful. It'll be harder to catch now.", [fx.affair("cover"), fx.trust("b", 4), fx.trust("other", 3)], 3),
            [
              { who: "other", text: "Thank you. We'll be careful.", mood: "calm", alt: { greedy: "Useful to know. Thanks." } },
              { who: "leader", text: "That's not what I meant.", mood: "cold" },
            ],
          ),
          t(
            o("{b} blames {other} for being careless. They quarrel in whispers.", [fx.affair("keep"), fx.bond("b", "other", -10), fx.nerve("other", -3)], 1, [w("b", "hothead", 2), w("b", "paranoid", 2)]),
            [
              { who: "b", text: "You told someone. You must have.", mood: "angry" },
              { who: "other", text: "I told nobody! You were seen!", mood: "angry" },
            ],
          ),
        ],
      },
    },
    {
      id: "tell-a",
      label: "Tell {a} yourself, before the camp does",
      hint: "Better from you than from the wash barrel.",
      results: {
        any: [
          t(
            o("{a} is grateful it came from you. It doesn't make it hurt less.", [
              fx.affair("tell-wronged"),
              fx.nerve("a", -5),
              fx.trust("a", 4),
              fx.bond("a", "b", -10),
              fx.note("a", "Learned from {leader} that {b} had been unfaithful."),
              fx.scene("rel-confrontation", 0.5, true),
            ], 3),
            [
              { who: "leader", text: "Better you hear it from me. It's {b}. And {other}.", mood: "grieving" },
              { who: "a", text: "Thank you. I think I knew.", mood: "grieving", alt: { hothead: "Where are they?", coward: "No. No, I don't want this." } },
            ],
          ),
          t(
            o("{a} had already heard the whispers, and can't forgive you for waiting.", [
              fx.affair("tell-wronged"),
              fx.trust("a", -4),
              fx.nerve("a", -4),
              fx.bond("a", "b", -8),
              fx.note("a", "Learned about {b} and {other} from camp gossip first."),
            ], 2),
            [{ who: "a", text: "You knew. Everyone knew. I was last.", mood: "cold" }],
          ),
          t(
            o("{a} hears it out, then goes looking for {other}.", [fx.affair("tell-wronged"), fx.nerve("a", -4), fx.scene("rel-triangle-brawl", 1, true)], 1, [w("a", "hothead", 3)]),
            [{ who: "a", text: "Where's {other}? Where?", mood: "angry" }],
          ),
        ],
      },
    },
    {
      id: "let-run",
      label: "Let it run. The truth will out on its own.",
      hint: "Not your fire. It will burn someone.",
      results: {
        any: [
          t(
            o("Two days later it reaches {a}, the way these things do: sideways, and cruel.", [
              fx.affair("reveal"),
              fx.nerve("a", -5),
              fx.trust("a", -3),
              fx.note("a", "Heard about {b} and {other} from the whole camp at once."),
              fx.scene("rel-confrontation", 0.6, true),
            ], 1),
            [{ who: "a", text: "Everyone knew? Everyone?", mood: "grieving" }],
          ),
          t(
            o("It burns itself out. Nobody quite believes it. {b} walks a little stiffer.", [fx.affair("keep"), fx.nerve("b", -2)], 3),
            [{ who: "b", text: "Why's everyone looking at me?", mood: "afraid", alt: { hothead: "Something to say? Say it." } }],
          ),
          t(
            o("The camp turns sour and petty. People count each other's rations, and each other's nights.", [fx.affair("keep"), fx.bondAll(-1), fx.nerve("b", -3), fx.nerve("other", -3)], 2),
            [{ who: "actor", text: "Keep your eyes open. That's all I'm saying.", mood: "sly" }],
          ),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// 9. The culprit ends it
// ---------------------------------------------------------------------------

const ENDS: SceneDef = {
  id: "rel-affair-ends",
  kind: "crisis",
  weight: 0,
  bound: true,
  secret: "player",
  title: "Over",
  intro: ["Out by the picket line, {b} is ending it. {other} stands very still, the fog red over their shoulder."],
  talk: [
    {
      who: "b",
      text: "It's done, {other}. It has to be.",
      mood: "grieving",
      alt: {
        pious: "I can't. Not anymore. God help me, I can't.",
        hothead: "Don't make this harder. It's finished.",
        charming: "You'll be all right. You're better than me.",
        coward: "Please don't make a scene. Please.",
        stoic: "We end it tonight.",
        kind: "I'm sorry. I'm so sorry. It's {a}. It was always {a}.",
      },
    },
    {
      who: "other",
      text: "Just like that.",
      mood: "cold",
      alt: {
        hothead: "You don't get to just walk away from me.",
        stoic: "Fine.",
        coward: "...All right. All right.",
        paranoid: "Who told? Somebody told. Who?",
        haunted: "I knew. The fog showed me this.",
        greedy: "And what do I get for my trouble?",
        kind: "If it's what you need.",
      },
    },
    { who: "b", text: "{a} can never know. Swear it.", vary: ["Not a word to {a}. Ever.", "{a} can't find out. Promise me."], mood: "pleading" },
    { who: "other", text: "Go on back to {a}, then.", mood: "cold", gesture: "turn-away", alt: { coward: "I swear. I swear. Go.", charming: "Give {a} my regards." } },
  ],
  options: [
    {
      id: "comfort-other",
      label: "Go to {other} once {b} has gone",
      hint: "Somebody should.",
      hours: 1,
      results: {
        any: [
          t(
            o("You sit with {other} until the fire's out. Nothing gets said. It helps anyway.", [
              fx.affair("end"),
              fx.nerve("other", 2),
              fx.trust("other", 5),
              fx.note("other", "Was left by {b}; {leader} sat up with them."),
            ], 3, [w("other", "kind", 1), w("other", "haunted", 1)]),
            [
              { who: "leader", text: "Come and sit. You needn't talk.", mood: "calm", gesture: "beckon" },
              { who: "other", text: "Thank you. I didn't think anyone would.", mood: "grieving" },
            ],
          ),
          t(
            o("{other} wants no comfort, least of all yours.", [fx.affair("end"), fx.trust("other", -2), fx.nerve("other", -4), fx.note("other", "Was left by {b}.")], 2, [
              w("other", "stoic", 2),
              w("other", "hothead", 1),
            ]),
            [{ who: "other", text: "Don't. I don't want to be seen.", mood: "cold", gesture: "turn-away", alt: { hothead: "Go and comfort {b}, you're so fond of cheats." } }],
          ),
          t(
            o("{other} breaks down at the picket line, too close to the fog. You pull them back, shaking.", [fx.affair("end"), fx.nerve("other", -5), fx.hp("other", -2), fx.nerve("leader", -1)], 1),
            [
              { who: "other", text: "It's warm out there. It doesn't leave.", mood: "grieving" },
              { who: "leader", text: "Back. Back from the line. Come on.", mood: "afraid" },
            ],
          ),
        ],
      },
    },
    {
      id: "separate",
      label: "Put them on different watches, different wagons",
      hint: "Distance helps. It also looks like punishment.",
      results: {
        any: [
          t(
            o("New rota, new wagons. {b} is grateful. {other} is not.", [fx.affair("end"), fx.nerve("b", 2), fx.nerve("other", -3), fx.trust("other", -3), fx.trust("b", 3)], 3),
            [
              { who: "leader", text: "{other}, you're with the scout's wagon now.", mood: "cold" },
              { who: "other", text: "Of course. Out of sight.", mood: "cold" },
            ],
          ),
          t(
            o("{other} takes the new wagon like an exile, and lets everyone see it.", [fx.affair("end"), fx.trust("other", -5), fx.bond("b", "other", -8)], 2, [w("other", "hothead", 1), w("other", "paranoid", 1)]),
            [{ who: "other", text: "Moved like a sick ox. Thank you, {leader}.", mood: "angry" }],
          ),
          t(
            o("Different wagons, same water barrel. Two nights later, they're out past the pickets again.", [fx.affair("keep"), fx.nerve("leader", -1), fx.bond("b", "other", 4)], 1, [w("b", "charming", 1)]),
            [{ who: "b", text: "I tried. I did try.", mood: "grieving" }],
          ),
        ],
      },
    },
    {
      id: "truth",
      label: "Tell {b}: ending it isn't enough. {a} deserves the truth.",
      hint: "Honesty after the fact. It will still hurt.",
      results: {
        any: [
          t(
            o("{b} tells {a} that night. It's over with {other}. Whether {a} stays is {a}'s to decide.", [
              fx.affair("tell-wronged"),
              fx.affair("end"),
              fx.nerve("a", -5),
              fx.bond("a", "b", -8),
              fx.trust("b", -2),
              fx.note("a", "Heard {b} confess to an ended affair with {other}."),
            ], 3),
            [
              { who: "leader", text: "Tell {a}. Or you'll carry it for the rest of the road.", mood: "cold" },
              { who: "b", text: "Then I'll tell {a}. Tonight.", mood: "grieving" },
            ],
          ),
          t(
            o("{b} refuses. It's over; that's enough. {b} won't meet your eye for days.", [fx.affair("end"), fx.trust("b", -4)], 2),
            [{ who: "b", text: "It's over. What good does the truth do {a} now?", mood: "cold" }],
          ),
          t(
            o("{other} overhears, and gets to {a} first. It's told cruelly.", [
              fx.affair("tell-wronged"),
              fx.affair("end"),
              fx.bond("b", "other", -10),
              fx.nerve("a", -6),
              fx.note("a", "Was told by {other} about the affair with {b}."),
            ], 1, [w("other", "hothead", 2), w("other", "greedy", 1)]),
            [{ who: "other", text: "{a}! Do you want to know where {b}'s been?", mood: "angry" }],
          ),
        ],
      },
    },
    {
      id: "leave",
      label: "Leave them to it. Walk away.",
      hint: "It's theirs to finish.",
      results: {
        any: [
          t(o("It ends. {other} sits alone by the pickets for a long while.", [fx.affair("end"), fx.nerve("other", -5), fx.bond("b", "other", -10), fx.note("other", "Was left by {b}.")], 3), [
            { who: "other", text: "Well. That's that, then.", mood: "grieving", alt: { stoic: "Right." } },
          ]),
          t(
            o("{other} stands at the picket line until dawn, staring into the red. In the morning {other} is grey and quiet.", [
              fx.affair("end"),
              fx.nerve("other", -6),
              fx.hp("other", -2),
              fx.note("other", "Stood all night at the pickets after {b} ended it."),
            ], 2),
            [
              { who: "role:guard", text: "{other}'s been there all night. Won't move.", mood: "afraid" },
              { who: "other", text: "Leave me be. I'm just looking.", mood: "grieving" },
            ],
          ),
          t(
            o("At dawn, the pickets are empty. {other}'s footprints go out into the red and do not come back.", [
              fx.affair("end"),
              fx.nerve("b", -6),
              fx.note("b", "Lost {other} to the Haze the night they parted."),
              fx.leave("other", "walked into the Haze the night a love affair ended"),
            ], 0.25, [w("other", "haunted", 0.4)]),
            [
              { who: "role:guard", text: "Footprints. Going out. None coming back.", mood: "afraid" },
              { who: "b", text: "No. No, I didn't mean... no.", mood: "grieving" },
            ],
          ),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// 10. The wronged partner goes for the lover
// ---------------------------------------------------------------------------

const BRAWL: SceneDef = {
  id: "rel-triangle-brawl",
  kind: "crisis",
  weight: 0,
  bound: true,
  secret: "public",
  title: "Blood at the fire",
  intro: ["{a} crosses the camp without a word and hits {other} full in the face. Then they're both on the ground."],
  talk: [
    {
      who: "a",
      text: "You knew! You knew {b} was mine!",
      mood: "angry",
      alt: {
        stoic: "Get up. Get up and take it.",
        coward: "I'm sorry... no. No, I'm not.",
        kind: "Why? Why would you do this to me?",
        pious: "Thou shalt not. Thou shalt not!",
        haunted: "The fog told me your name. Over and over.",
        paranoid: "I saw every look. Every single one.",
      },
    },
    {
      who: "other",
      text: "Get off me! {b}, get them off!",
      mood: "afraid",
      alt: { hothead: "Come on, then! You want it? Come on!", charming: "{a}, stop, you'll kill someone!", veteran: "Last warning, {a}. Last one.", stoic: "Enough. Let go." },
    },
    { who: "b", text: "Stop it! Both of you, stop!", mood: "afraid", alt: { coward: "Somebody do something!", hothead: "{a}, let go of them!", kind: "Please. It's my fault. Hit me." } },
    { who: "leader", text: "Knife! {a}'s got a knife!", vary: ["Blade out! Watch the blade!", "Steel! Somebody's drawn steel!"], mood: "afraid" },
  ],
  options: [
    {
      id: "pull-apart",
      label: "Wade in and pull them apart",
      hint: "You'll get hurt. They might not.",
      hours: 1,
      results: {
        any: [
          t(
            o("An elbow splits your lip, but you get an arm round {a} and haul. It stops.", [fx.hp("leader", -3), fx.bond("a", "other", -10), fx.nerve("a", -3), fx.trust("a", -2)], 3),
            [
              { who: "leader", text: "Enough! It's done! It's done!", mood: "angry" },
              { who: "a", text: "Let go! Let go of me!", mood: "angry", alt: { coward: "Don't let go. I'll kill them.", kind: "I'm sorry. I'm sorry. Let go." } },
            ],
          ),
          t(
            o("The knife meant for {other} goes into your arm instead. The fight is over.", [fx.hp("leader", -7), fx.wound("leader"), fx.nerve("a", -5), fx.bond("a", "other", -8), fx.note("a", "Stabbed {leader} by mistake, fighting {other}.")], 1),
            [
              { who: "a", text: "No. No, not you, I didn't...", mood: "afraid" },
              { who: "role:medic", text: "Sit. Pressure. Somebody boil water.", mood: "calm" },
            ],
          ),
          t(
            o("You get {a} clear. {a} goes limp in your arms and sobs.", [fx.hp("leader", -1), fx.nerve("a", -5), fx.trust("a", 3), fx.bond("a", "other", -8)], 2, [w("a", "kind", 1), w("a", "coward", 1)]),
            [
              { who: "a", text: "What's wrong with me? What's wrong with me?", mood: "grieving" },
              { who: "leader", text: "Nothing. Nothing. Breathe.", mood: "calm" },
            ],
          ),
        ],
      },
    },
    {
      id: "shoot-air",
      label: "Fire a shot in the air",
      hint: "Costs 1 powder & shot.",
      cost: { ammo: 1 },
      results: {
        any: [
          t(
            o("The shot rolls off the hills. Both of them freeze in the dirt.", [fx.nerve("all", -2), fx.trust("a", -2), fx.trust("other", -2), fx.bond("a", "other", -8)], 3),
            [
              { who: "leader", text: "Next one won't be in the air.", mood: "cold", gesture: "draw-weapon" },
              { who: "other", text: "Get {a} off me. Please.", mood: "afraid" },
            ],
          ),
          t(
            o("{a} doesn't even hear it. The knife goes in once before anyone reaches them.", [fx.hp("other", -6), fx.wound("other"), fx.nerve("a", -4), fx.nerve("all", -2), fx.bond("a", "other", -12), fx.note("other", "Was stabbed by {a} over {b}.")], 1, [
              w("a", "hothead", 1),
            ]),
            [
              { who: "other", text: "I'm cut. I'm cut!", mood: "afraid", gesture: "clutch" },
              { who: "role:medic", text: "Hold it closed. Don't let go.", mood: "calm" },
            ],
          ),
        ],
      },
    },
    {
      id: "let-fight",
      label: "Let them fight it out",
      hint: "Some things only end one way. That way can be bad.",
      results: {
        any: [
          t(
            o("Bloody noses, torn shirts. Then it's over, and something is settled.", [fx.hp("other", -4), fx.hp("a", -3), fx.bond("a", "other", -6), fx.nerve("a", 2)], 3),
            [
              { who: "a", text: "That's for every night. Every night.", mood: "cold" },
              { who: "other", text: "We're square, then.", mood: "cold", alt: { hothead: "We're not square. Not close." } },
            ],
          ),
          t(
            o("{other} is the better fighter. {a} ends up in the mud, beaten and humiliated.", [fx.hp("a", -6), fx.nerve("a", -4), fx.bond("a", "other", -8)], 2, [w("other", "veteran", 2), w("other", "hothead", 1)]),
            [{ who: "a", text: "Get off. Get off me.", mood: "grieving" }],
          ),
          t(
            o("The knife goes in. {other} goes down hard. {a} stands there with red hands.", [fx.hp("other", -10), fx.nerve("a", -5), fx.nerve("all", -3), fx.note("a", "Put a knife in {other} over {b}.")], 1, [w("a", "hothead", 1)]),
            [
              { who: "leader", text: "Medic! Get the medic!", mood: "afraid" },
              { who: "a", text: "I only... I only meant to...", mood: "afraid" },
            ],
          ),
          t(
            o("One blow too many. {other} doesn't get up. Nobody on this train will look at {a} the same way.", [
              fx.nerve("a", -8),
              fx.nerve("all", -4),
              fx.note("a", "Killed {other} in a fight over {b}."),
              fx.kill("other", "killed in a fight over an affair"),
            ], 0.15, [w("a", "hothead", 0.2)]),
            [
              { who: "b", text: "{other}? {other}!", mood: "grieving", gesture: "kneel" },
              { who: "a", text: "Get up. Get up. Why won't you get up?", mood: "afraid" },
            ],
          ),
        ],
      },
    },
    {
      id: "send-out",
      label: "Drag {a} off and send them out on watch alone",
      hint: "Cool off in the dark. The dark is not empty.",
      hours: 1,
      results: {
        any: [
          t(
            o("{a} walks the pickets all night. At dawn {a} comes back hollow, but calm.", [fx.nerve("a", -3), fx.bond("a", "other", -6), fx.bond("a", "b", -4)], 3),
            [
              { who: "a", text: "I've decided some things. Out there.", mood: "cold", alt: { haunted: "The fog and I had a talk." } },
              { who: "leader", text: "Keep them to yourself for a while.", mood: "cold" },
            ],
          ),
          t(
            o("Out there alone, {a} decides. At dawn {a} moves their bedroll away from {b} for good.", [
              fx.rel("a", "b", "estranged"),
              fx.affair("end"),
              fx.nerve("a", -4),
              fx.nerve("b", -4),
              fx.note("a", "Left {b} after a night alone on watch."),
            ], 0, [coupled(2), w("a", "stoic", 1)]),
            [{ who: "a", text: "I'm done, {b}. I'm moving my things.", mood: "cold", gesture: "turn-away" }],
          ),
          t(
            o("Something in the fog walks the pickets alongside {a} all night. {a} comes back touched by it.", [fx.nerve("a", -6), fx.fog("a")], 1, [w("a", "haunted", 1)]),
            [{ who: "a", text: "It kept pace with me. All night.", mood: "afraid" }],
          ),
          t(
            o("{a} doesn't come back from the watch. There is a lantern at the edge of the red, still lit.", [
              fx.nerve("b", -6),
              fx.nerve("all", -2),
              fx.note("b", "Lost {a} to the Haze after the fight over {other}."),
              fx.leave("a", "went out on watch after the fight and never came back"),
            ], 0.15, [w("a", "haunted", 0.2)]),
            [
              { who: "role:guard", text: "{a}'s lantern. Out past the line. Nobody near it.", mood: "afraid" },
              { who: "b", text: "{a}! {a}, answer me!", mood: "afraid" },
            ],
          ),
        ],
      },
    },
    {
      id: "make-choose",
      label: "Make {b} choose, here and now",
      hint: "End it one way or the other.",
      results: {
        any: [
          t(
            o("{b} goes to {a}'s side and stays there. {other} picks up what's left of their pride.", [
              fx.affair("end"),
              fx.bond("a", "b", 4),
              fx.bond("b", "other", -12),
              fx.nerve("other", -6),
              fx.nerve("a", 2),
              fx.note("other", "Was cast off by {b} in front of the camp."),
              fx.note("a", "Was chosen by {b} over {other}."),
            ], 3, [coupled(1), { if: { aff: { a: "a", b: "b", min: 20 } }, add: 2 }]),
            [
              { who: "leader", text: "{b}. Pick. Right now, in front of everyone.", mood: "cold" },
              { who: "b", text: "{a}. It's {a}. It was always {a}.", mood: "pleading", gesture: "kneel" },
              { who: "other", text: "Of course it was.", mood: "cold", gesture: "turn-away" },
            ],
          ),
          t(
            o("{b} goes to {other}, and helps {other} up. That's the answer.", [
              fx.rel("a", "b", "estranged"),
              fx.rel("b", "other", "courting"),
              fx.affair("end"),
              fx.nerve("a", -7),
              fx.note("a", "Watched {b} choose {other} over them."),
            ], 0, [coupled(2), { if: { aff: { a: "b", b: "other", min: 40 } }, add: 1 }]),
            [
              { who: "b", text: "I'm sorry, {a}. It's {other}.", mood: "grieving" },
              { who: "a", text: "Then take {other} and get out of my sight.", mood: "cold" },
            ],
          ),
          t(
            o("{b} can't choose, and walks off alone. Nobody follows. Nothing is settled.", [fx.nerve("b", -5), fx.bond("a", "b", -6), fx.bond("b", "other", -4), fx.trust("b", -3)], 2),
            [{ who: "b", text: "I can't. I can't do this. Leave me alone.", mood: "grieving", gesture: "turn-away" }],
          ),
        ],
      },
    },
  ],
};

export const AFFAIR_SCENES: SceneDef[] = [GLIMPSE, EVIDENCE, CONFIDANT, CONFRONTATION, CAUGHT, CONFESSION, BLACKMAIL, WHISPERS, ENDS, BRAWL];
