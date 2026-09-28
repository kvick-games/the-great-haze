// Scenes about the named companions in ../npcs.ts: where they are met, when they
// come back, and the complication each brings once aboard.
//
// Complications are crises queued with `actor` bound to the companion, so
// "actor" and "npc:<id>" are the same person there. Meetings and returns are
// ordinary strangers: the setup talk is truth-neutral, the tells decide.

import type { Effect, Line, Look, Outcome, SceneDef } from "../../types.ts";
import { fx, o } from "../fx.ts";
import { npcById } from "../npcs.ts";

/** An outcome with spoken lines, optionally gated on the option's check. */
function r(text: string, effects: Effect[], talk: Line[], weight = 1, needs?: "success" | "fail"): Outcome {
  const out: Outcome = { ...o(text, effects, weight), talk };
  if (needs) out.needs = needs;
  return out;
}

const lookOf = (id: string): Look => npcById(id)!.look;

/** The same person, some miles and some bad days later. */
function changed(id: string, marks: string[], summary: string): Look {
  return { ...lookOf(id), marks, summary };
}

// ---------------------------------------------------------------------------
// Complications: one per companion, some days after they join
// ---------------------------------------------------------------------------

const COMPLICATIONS: SceneDef[] = [
  {
    id: "npc-mattie-freezes",
    kind: "crisis",
    weight: 0,
    once: true,
    when: [{ aboard: "mattie" }],
    title: "{actor} freezes",
    intro: ["An axe slips at the woodpile. Blood, and screaming. {actor} has the bag open and does not move."],
    talk: [
      { who: "leader", text: "{actor}! Now!", mood: "angry", gesture: "point", alt: { kind: "{actor}. Look at me. You can do this.", hothead: "Move, damn you, or I will!" } },
      { who: "npc:mattie", text: "I can't. The noise. Make it stop, make it stop.", mood: "afraid", gesture: "clutch" },
      { who: "role:scout", text: "He's bleeding out while she stands there.", mood: "cold", alt: { kind: "Give her a breath. Just one breath.", coward: "I can't look. Somebody help him." } },
    ],
    options: [
      {
        id: "shout",
        label: "Shout her into it",
        hint: "It might work. She will remember it.",
        results: {
          any: [
            r("She works through the tears. The bleeding stops.", [fx.nerve("actor", -5), fx.trust("actor", -4)], [
              { who: "npc:mattie", text: "Don't. Don't ever shout at me again.", mood: "angry", gesture: "turn-away" },
            ], 3),
            r("She drops the needle twice. The stitches hold, badly.", [fx.hp("weakest", [-6, -3]), fx.nerve("actor", -8)], [
              { who: "npc:mattie", text: "I'm sorry. I told you. I told you I wasn't brave.", mood: "grieving", gesture: "clutch" },
            ], 2),
          ],
        },
      },
      {
        id: "calm",
        label: "Talk her down, softly",
        hint: "Slower. If it works, it works for good.",
        hours: 0.5,
        check: { kind: "calm", dc: 12, target: "Mattie", exclude: ["actor"] },
        results: {
          any: [
            r("{by} takes her wrists. She breathes. Her hands find the work.", [fx.nerve("actor", 8), fx.bond("actor", "by", 6), fx.hp("weakest", 4)], [
              { who: "by", text: "Breathe with me. Just the next stitch. Only that.", mood: "calm", gesture: "kneel", alt: { stoic: "One stitch. Then the next. Nothing else exists." } },
              { who: "npc:mattie", text: "Needle. Thread. Hold him still. There.", mood: "calm" },
            ], 1, "success"),
            r("Too slow. The wound bleeds a long while before she moves.", [fx.hp("weakest", [-8, -4]), fx.nerve("actor", -3)], [
              { who: "by", text: "Please, Mattie. He needs you. Please.", mood: "pleading", alt: { hothead: "Talking's done. Move your hands!" } },
              { who: "npc:mattie", text: "Stop talking. Stop. I'm trying.", mood: "afraid" },
            ], 1, "fail"),
          ],
        },
      },
      {
        id: "self",
        label: "Take the bag and do it yourself",
        cost: { medicine: 1 },
        results: {
          any: [
            r("Clumsy work, but it holds. {actor} holds the lamp and says nothing.", [fx.hp("weakest", 3), fx.nerve("actor", -6), fx.trust("actor", -2)], [
              { who: "leader", text: "Hold the lamp, then. Can you do that?", mood: "cold", alt: { kind: "Hold the lamp for me. That helps. Truly." } },
              { who: "npc:mattie", text: "Yes. I can hold a lamp.", mood: "grieving", gesture: "turn-away" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "npc-juniper-names",
    kind: "crisis",
    weight: 0,
    once: true,
    when: [{ aboard: "juniper" }],
    title: "{actor} hears a name",
    intro: ["Past midnight. {actor} sits up in her coat, facing the red glow, lips moving."],
    talk: [
      { who: "npc:juniper", text: "It's saying names again. The ones it wants.", mood: "afraid", gesture: "clutch" },
      { who: "leader", text: "Whose names, Juniper?", mood: "calm", alt: { paranoid: "Who told you to say that?", coward: "Don't. Don't tell me." } },
      { who: "npc:juniper", text: "Yours. Since Tuesday. It says it very nicely.", mood: "grieving", gesture: "point" },
    ],
    options: [
      {
        id: "sit",
        label: "Sit with her until dawn",
        hint: "You lose your own sleep.",
        hours: 1,
        results: {
          any: [
            r("You sit together until the glow fades. She sleeps against your arm.", [fx.nerve("actor", 8), fx.trust("actor", 6), fx.nerve("leader", -4)], [
              { who: "npc:juniper", text: "It stopped when you came. It doesn't like you listening.", mood: "calm" },
              { who: "leader", text: "Then I'll keep listening.", mood: "calm", alt: { haunted: "I think I hear it too. Faintly." } },
            ], 3),
            r("Near dawn you hear it as well. Your name, in a voice you knew.", [fx.nerve("leader", -8), fx.bond("actor", "leader", 5)], [
              { who: "leader", text: "...", mood: "grieving", gesture: "turn-away" },
              { who: "npc:juniper", text: "Now you know. I'm sorry. I'm sorry.", mood: "grieving", gesture: "offer" },
            ], 1),
          ],
        },
      },
      {
        id: "hush",
        label: "Tell her it's only the wind",
        results: {
          any: [
            r("She lies down. She does not believe you, and stops telling you things.", [fx.trust("actor", -6), fx.nerve("actor", -3)], [
              { who: "leader", text: "It's the wind. Go to sleep.", mood: "cold", alt: { kind: "It's only wind, love. I promise." } },
              { who: "npc:juniper", text: "Yes. The wind. All right.", mood: "cold", gesture: "turn-away" },
            ]),
          ],
        },
      },
      {
        id: "ask",
        label: "Ask what else it says",
        hint: "She may know things. You may not want them.",
        hours: 0.5,
        results: {
          any: [
            r("She tells you where it runs thickest. You swing wide of it.", [fx.gap([3, 6]), fx.nerve("actor", -4)], [
              { who: "npc:juniper", text: "It's hungry north of the road. South is quieter.", mood: "calm", gesture: "point" },
            ], 2),
            r("She tells you what it promises. Nobody sleeps after that.", [fx.nerve("all", -4)], [
              { who: "npc:juniper", text: "It says it will be warm. That it won't hurt.", mood: "afraid" },
              { who: "role:guard", text: "Enough. Nobody listens to that. Nobody.", mood: "angry", alt: { pious: "Pray over her. Now. All of us." } },
            ], 2),
          ],
        },
      },
      {
        id: "sing",
        label: "Have someone sing her down",
        hours: 1,
        check: { kind: "calm", dc: 11, target: "Juniper", exclude: ["actor"] },
        results: {
          any: [
            r("{by} sings until she sleeps. No names after that.", [fx.nerve("actor", 6), fx.nerve("all", 2), fx.bond("actor", "by", 5)], [
              { who: "by", text: "Hush now. Only us out here. Only us.", mood: "calm", gesture: "kneel", alt: { pious: "Abide with me. Fast falls the eventide. Hush." } },
            ], 1, "success"),
            r("The song falters. She covers her ears and rocks.", [fx.nerve("actor", -4), fx.nerve("by", -3)], [
              { who: "by", text: "I... I lost the tune.", mood: "afraid" },
              { who: "npc:juniper", text: "It's singing along. Can't you hear it?", mood: "afraid", gesture: "clutch" },
            ], 1, "fail"),
          ],
        },
      },
    ],
  },
  {
    id: "npc-thaddeus-rider",
    kind: "crisis",
    weight: 0,
    once: true,
    when: [{ aboard: "thaddeus" }],
    title: "A Company rider",
    intro: ["A rider in Company grey-green reins in at the head of the train. He looks straight at {actor}."],
    stranger: {
      name: "The Company rider",
      look: {
        build: "lean",
        height: "tall",
        age: 36,
        skin: "pale, windburnt",
        hair: { style: "cropped", color: "sandy", facial: "moustache" },
        clothing: ["a Company rider's grey-green coat, badge polished", "a flat-brimmed hat", "a carbine in a saddle boot"],
        palette: ["Company grey-green", "polished brass", "saddle brown"],
        prop: { id: "warrant-satchel", desc: "a leather satchel of printed warrants, one corner folded down" },
        marks: ["a waxed moustache", "a gold tooth when he smiles"],
        summary: "A lean Company rider in grey-green with a polished badge, a satchel of warrants at his hip, smiling with a gold tooth.",
      },
    },
    talk: [
      { who: "stranger", text: "Moreau. I'd know that face at a hundred yards.", mood: "cold", gesture: "point" },
      { who: "npc:thaddeus", text: "Then you know I will not run.", mood: "cold" },
      { who: "stranger", text: "Hand him over. Company pays twenty-five for deserters.", mood: "sly", gesture: "offer" },
      { who: "leader", text: "He's one of ours now.", mood: "cold", alt: { greedy: "Twenty-five scrip. That's... a lot of scrip.", coward: "We don't want trouble with the Company." } },
    ],
    options: [
      {
        id: "hand-over",
        label: "Hand him over",
        hint: "25 scrip. He will go quietly.",
        results: {
          any: [
            r("{actor} walks to the horse himself. He does not look back.", [fx.scrip(25), fx.leave("actor", "handed to the Company for desertion"), fx.nerve("all", -4), fx.trust({ trait: "pious" }, -5)], [
              { who: "npc:thaddeus", text: "I said I would not run. I meant it.", mood: "calm" },
              { who: "stranger", text: "Smart. The Company remembers its friends.", mood: "sly", gesture: "offer" },
            ]),
          ],
        },
      },
      {
        id: "refuse",
        label: "Refuse him",
        results: {
          any: [
            r("The rider spits and turns back east. He will tell someone.", [fx.trust("actor", 8), fx.bond("actor", "leader", 6), fx.nerve("all", -2)], [
              { who: "stranger", text: "You're on the Company road. Remember that.", mood: "cold", gesture: "turn-away" },
              { who: "npc:thaddeus", text: "Thank you. I will not forget it.", mood: "calm" },
            ], 3),
            r("He fires once as he goes. Wide, but not by much.", [fx.hp("random", [-6, -2]), fx.trust("actor", 8), fx.nerve("all", -3)], [
              { who: "stranger", text: "Next time I won't miss. Tell him that.", mood: "angry", gesture: "draw-weapon" },
            ], 1),
          ],
        },
      },
      {
        id: "talk-down",
        label: "Tell him he has the wrong man",
        hint: "Someone has to sell it.",
        check: { kind: "talk-down", dc: 13, target: "the rider", exclude: ["actor"] },
        results: {
          any: [
            r("{by} talks until the rider decides he never saw anyone.", [fx.trust("actor", 5), fx.nerve("all", 2)], [
              { who: "by", text: "Deserter? That's our preacher. Look at the cross on him.", mood: "calm", gesture: "point" },
              { who: "stranger", text: "Maybe I'm wrong. Maybe the light's bad.", mood: "sly", gesture: "shrug" },
            ], 1, "success"),
            r("The rider laughs at {by}, draws, and clips {actor} before he rides off.", [fx.hp("actor", [-6, -2]), fx.nerve("all", -3)], [
              { who: "stranger", text: "Preacher. Right. And I'm the Queen of Sheba.", mood: "sly", gesture: "draw-weapon" },
            ], 1, "fail"),
          ],
        },
      },
      {
        id: "pay",
        label: "Pay him to forget",
        cost: { scrip: 20 },
        results: {
          any: [
            r("He counts it twice and rides away whistling.", [fx.trust("actor", 4), fx.nerve("actor", 3)], [
              { who: "stranger", text: "Pleasure. I never saw a thing.", mood: "sly", gesture: "offer" },
              { who: "npc:thaddeus", text: "You paid for my sin. I owe you.", mood: "grieving" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "npc-birdie-cough",
    kind: "crisis",
    weight: 0,
    once: true,
    when: [{ aboard: "birdie" }],
    title: "{actor}'s handkerchief",
    intro: ["{actor} coughs into her handkerchief and shoves it away fast. It came back red."],
    talk: [
      { who: "leader", text: "Birdie. Let me see that.", mood: "calm", alt: { paranoid: "Is that the Haze? Tell me that isn't the Haze.", kind: "Birdie. Sit down. Let me see." } },
      { who: "npc:birdie", text: "See what? Road dust. Leave off.", mood: "sly", gesture: "turn-away" },
      { who: "npc:birdie", text: "I've a wheel to true before dark.", mood: "cold" },
    ],
    options: [
      {
        id: "physic",
        label: "Make her take physic",
        cost: { medicine: 2 },
        hours: 1,
        results: {
          any: [
            r("She takes it, grumbling. The cough quiets, for now.", [fx.hp("actor", 10), fx.nerve("actor", 3), fx.trust("actor", 2)], [
              { who: "npc:birdie", text: "Waste of good physic on an old woman.", mood: "sly", gesture: "shrug" },
              { who: "leader", text: "Then be worth it. Fix my wheels.", mood: "calm", alt: { kind: "You're worth more than a bottle, Birdie." } },
            ]),
          ],
        },
      },
      {
        id: "rest",
        label: "Put her flat in the wagon for the day",
        hours: 4,
        results: {
          any: [
            r("She sleeps half the day and is furious about it.", [fx.hp("actor", 8), fx.nerve("actor", -2), fx.trust("actor", 3)], [
              { who: "npc:birdie", text: "Four hours on my back. I'll never forgive you.", mood: "angry" },
            ]),
          ],
        },
      },
      {
        id: "medic",
        label: "Get her to let someone look",
        hours: 0.5,
        check: { kind: "persuade", dc: 11, target: "Birdie", exclude: ["actor"] },
        results: {
          any: [
            r("She lets {by} look. It's bad, but it can be slowed.", [fx.res("medicine", -1), fx.hp("actor", 12), fx.bond("actor", "by", 6), fx.trust("actor", 3)], [
              { who: "by", text: "No lying to me, Birdie. How long?", mood: "calm", gesture: "kneel" },
              { who: "npc:birdie", text: "Since the mule died. A month. Maybe more.", mood: "grieving" },
            ], 1, "success"),
            r("She snaps at {by} and limps off to her wheel.", [fx.trust("actor", -4), fx.hp("actor", -4)], [
              { who: "npc:birdie", text: "I said leave off! I'm nobody's patient.", mood: "angry", gesture: "turn-away" },
            ], 1, "fail"),
          ],
        },
      },
      {
        id: "let-be",
        label: "Let her keep her secret",
        results: {
          any: [
            r("She works on, coughing. Nobody mentions it.", [fx.hp("actor", [-10, -5]), fx.trust("actor", 3)], [
              { who: "npc:birdie", text: "Thank you. For not fussing.", mood: "calm" },
            ], 2),
            r("She goes down at the tailboard that night.", [fx.hp("actor", -14), fx.sick("actor"), fx.nerve("all", -3)], [
              { who: "npc:birdie", text: "Fine. I'm fine. Just help me up.", mood: "afraid", gesture: "raise-hands" },
              { who: "leader", text: "Somebody get the physic chest.", mood: "afraid", alt: { stoic: "Lift her. Gently. Into the wagon." } },
            ], 1),
          ],
        },
      },
    ],
  },
  {
    id: "npc-ambrose-confession",
    kind: "crisis",
    weight: 0,
    once: true,
    when: [{ aboard: "ambrose" }],
    title: "{actor} confesses",
    intro: ["At the fire, {actor} unwraps his bell and sets it in his lap. He wants to talk."],
    talk: [
      { who: "npc:ambrose", text: "The first night of the fog, forty people came to our door.", mood: "grieving" },
      { who: "npc:ambrose", text: "We barred it. We sang so we would not hear them.", mood: "grieving", gesture: "clutch" },
      { who: "leader", text: "Why tell me now?", mood: "cold", alt: { pious: "God forgive you. Why now?", kind: "Go on, Ambrose. I'm listening." } },
      { who: "npc:ambrose", text: "Because I hear them singing back. Every night, a little closer.", mood: "afraid" },
    ],
    options: [
      {
        id: "absolve",
        label: "Tell him he is forgiven",
        results: {
          any: [
            r("He weeps without a sound, and sleeps for the first time in days.", [fx.nerve("actor", 10), fx.trust("actor", 6)], [
              { who: "leader", text: "You were afraid. So were we all.", mood: "calm", alt: { hothead: "You barred a door. Don't ever bar ours." } },
              { who: "npc:ambrose", text: "That is kinder than I deserve. Thank you.", mood: "grieving", gesture: "kneel" },
            ]),
          ],
        },
      },
      {
        id: "tell-all",
        label: "Make him tell everyone",
        hours: 1,
        results: {
          any: [
            r("He tells it all. Some cannot look at him. Some can.", [fx.nerve("all", -3), fx.trust("actor", -3), fx.nerve("actor", 4)], [
              { who: "npc:ambrose", text: "I barred the door. I sang. Judge me.", mood: "cold" },
              { who: "role:guard", text: "At least he says it to our faces.", mood: "calm", alt: { paranoid: "And what doors will he bar on us?" } },
            ], 2),
            r("Someone throws his bell into the fire.", [fx.nerve("actor", -8), fx.bond("actor", "random", -6)], [
              { who: "npc:ambrose", text: "Leave it. Let it melt. It never rang true.", mood: "grieving", gesture: "turn-away" },
            ], 1),
          ],
        },
      },
      {
        id: "cast-out",
        label: "Send him away at dawn",
        hint: "Some things you cannot carry.",
        results: {
          any: [
            r("{actor} leaves before first light, the bell muffled.", [fx.leave("actor", "sent away for what the mission did"), fx.nerve("all", -3), fx.trust({ trait: "pious" }, -5)], [
              { who: "npc:ambrose", text: "That is just. I would have done the same.", mood: "calm", gesture: "turn-away" },
            ]),
          ],
        },
      },
      {
        id: "vigil",
        label: "Have someone keep vigil with him",
        hours: 2,
        check: { kind: "calm", dc: 12, target: "Brother Ambrose", exclude: ["actor"] },
        results: {
          any: [
            r("{by} prays with him until the singing stops.", [fx.nerve("actor", 12), fx.bond("actor", "by", 8)], [
              { who: "by", text: "Say their names. We'll say them with you.", mood: "calm", gesture: "kneel", alt: { pious: "Say their names. God will hear them this time." } },
              { who: "npc:ambrose", text: "Ada. Tomas. The Reyes children. Ada...", mood: "grieving" },
            ], 1, "success"),
            r("The vigil breaks when {by} hears the singing too.", [fx.nerve("by", -8), fx.nerve("actor", -2)], [
              { who: "by", text: "Stop. Stop. I hear them. I hear them.", mood: "afraid", gesture: "raise-hands" },
              { who: "npc:ambrose", text: "Now you know why I told you.", mood: "grieving" },
            ], 1, "fail"),
          ],
        },
      },
    ],
  },
  {
    id: "npc-rue-herd",
    kind: "crisis",
    weight: 0,
    once: true,
    when: [{ aboard: "rue" }],
    title: "{actor} wants to go back",
    intro: ["{actor} has ridden at the tail all morning, staring east, letting the wagons pull ahead."],
    talk: [
      { who: "npc:rue", text: "Forty head. Maybe ten still standing out there.", mood: "angry", gesture: "point" },
      { who: "npc:rue", text: "Give me half a day. I'll bring meat for everyone.", mood: "sly", gesture: "offer" },
      { who: "leader", text: "The Haze is back there, Rue.", mood: "cold", alt: { greedy: "Ten head. That's a lot of meat.", coward: "No. Nobody goes back. Nobody." } },
      { who: "npc:rue", text: "So's everything I own.", mood: "angry", gesture: "clutch" },
    ],
    options: [
      {
        id: "let-go",
        label: "Let her go, and wait for her",
        hint: "Half a day, and she may not come back.",
        hours: 6,
        results: {
          any: [
            r("She rides in at dusk, dragging two steers.", [fx.res("rations", [10, 18]), fx.trust("actor", 8), fx.nerve("actor", 6)], [
              { who: "npc:rue", text: "Told you. Two. The rest were gone.", mood: "grieving" },
            ], 3),
            r("She comes back empty-handed and white as chalk.", [fx.nerve("actor", -6), fx.trust("actor", 4)], [
              { who: "npc:rue", text: "They were in the fog. Standing. Waiting for me.", mood: "afraid" },
            ], 2),
            r("She does not come back.", [fx.leave("actor", "rode back east for her herd"), fx.nerve("all", -4)], [
              { who: "leader", text: "Give her one more hour.", mood: "grieving", alt: { stoic: "She made her choice. We move." } },
            ], 1),
          ],
        },
      },
      {
        id: "forbid",
        label: "Forbid it",
        results: {
          any: [
            r("She stays. She makes sure everyone knows she didn't want to.", [fx.trust("actor", -8), fx.nerve("actor", -5), fx.bond("actor", "leader", -4)], [
              { who: "npc:rue", text: "Fine. Your train. Your herd now, I guess.", mood: "angry", gesture: "turn-away" },
            ]),
          ],
        },
      },
      {
        id: "talk-down",
        label: "Have someone talk her out of it",
        check: { kind: "talk-down", dc: 12, target: "Rue", exclude: ["actor"] },
        results: {
          any: [
            r("{by} talks her off it. She turns in early, and sleeps hard.", [fx.nerve("actor", 5), fx.bond("actor", "by", 6)], [
              { who: "by", text: "They're gone, Rue. You'd be the last head out there.", mood: "calm" },
              { who: "npc:rue", text: "...Damn you. You're right. Damn you.", mood: "grieving" },
            ], 1, "success"),
            r("Talk only digs her in. She sulks at the tail and slows the train all day.", [fx.hours(3), fx.trust("actor", -5)], [
              { who: "npc:rue", text: "Don't you dare tell me what's gone.", mood: "angry", gesture: "point" },
            ], 1, "fail"),
          ],
        },
      },
    ],
  },
  {
    id: "npc-orin-ledger",
    kind: "crisis",
    weight: 0,
    once: true,
    when: [{ aboard: "orin" }],
    title: "Someone wants the ledger",
    intro: ["Two riders in clerk's black trail the train at a mile, then close. {actor} goes white."],
    stranger: {
      name: "The Company clerk",
      look: {
        build: "heavy",
        height: "average",
        age: 50,
        skin: "pink, sweating",
        hair: { style: "bald", color: "none, a shining scalp", facial: "beard" },
        clothing: ["a clerk's black frock coat, dusty to the waist", "a bowler hat", "sleeve garters"],
        palette: ["clerk black", "ink blue", "road dust"],
        prop: { id: "receipt-book", desc: "a receipt book with a pencil tied to it on a string" },
        marks: ["ink on his lower lip where he licks the pencil"],
        summary: "A heavy, sweating Company clerk in a black frock coat and bowler, a receipt book in one hand and a pencil on a string.",
      },
    },
    talk: [
      { who: "npc:orin", text: "That's them. I told you. I told you somebody was behind.", mood: "afraid", gesture: "clutch" },
      { who: "stranger", text: "Company property, friend. A ledger. We'd like it back.", mood: "sly", gesture: "raise-hands" },
      { who: "leader", text: "What's in it, Orin?", mood: "cold", alt: { paranoid: "What did you steal, Orin? Tell me true." } },
      { who: "npc:orin", text: "Men they pay as dead. Some of them aren't.", mood: "afraid" },
    ],
    options: [
      {
        id: "give",
        label: "Give them the ledger",
        results: {
          any: [
            r("The clerk tips his hat and pays for your trouble. {actor} does not speak for a day.", [fx.scrip([5, 10]), fx.nerve("actor", -10), fx.trust("actor", -8)], [
              { who: "stranger", text: "Very sensible. The Company thanks you.", mood: "sly", gesture: "offer" },
              { who: "npc:orin", text: "You don't know what you just did.", mood: "grieving", gesture: "turn-away" },
            ]),
          ],
        },
      },
      {
        id: "burn",
        label: "Burn it in front of them",
        results: {
          any: [
            r("The clerks watch it burn, then ride off without a word.", [fx.nerve("actor", -4), fx.trust("actor", 4), fx.nerve("all", -2)], [
              { who: "stranger", text: "Well. That's one way to close the books.", mood: "cold" },
              { who: "npc:orin", text: "It's gone. They'll stop now. Won't they?", mood: "afraid" },
            ]),
          ],
        },
      },
      {
        id: "lie",
        label: "Swear it burned with his wagon",
        check: { kind: "talk-down", dc: 13, target: "the clerk", exclude: ["actor"] },
        results: {
          any: [
            r("The clerks believe {by}, or pretend to, and turn back.", [fx.nerve("actor", 6), fx.trust("actor", 6)], [
              { who: "by", text: "Burned with the wagon. You saw the wagon.", mood: "calm", gesture: "shrug" },
              { who: "stranger", text: "Shame. Good day, then.", mood: "cold", gesture: "turn-away" },
            ], 1, "success"),
            r("The clerk sees through {by}. His partner cuts the strap and takes it.", [fx.nerve("actor", -10), fx.trust("actor", -4), fx.hp("actor", [-5, -2])], [
              { who: "stranger", text: "Liars always look at the thing they're hiding.", mood: "sly", gesture: "point" },
              { who: "npc:orin", text: "No! No, give it back!", mood: "pleading", gesture: "raise-hands" },
            ], 1, "fail"),
          ],
        },
      },
      {
        id: "keep",
        label: "Tell them no, and keep it",
        results: {
          any: [
            r("They leave. They'll be back, and they know your wagons now.", [fx.trust("actor", 8), fx.nerve("all", -3)], [
              { who: "stranger", text: "Your choice. A poor one.", mood: "cold", gesture: "turn-away" },
              { who: "npc:orin", text: "Nobody's ever said no for me before.", mood: "grieving" },
            ], 2),
            r("They leave. That night, shots from the dark.", [fx.hp("random", -6), fx.trust("actor", 8), fx.nerve("all", -4)], [
              { who: "leader", text: "Down! Everybody down!", mood: "afraid", alt: { veteran: "Douse the fire. Low and quiet. Wait." } },
            ], 1),
          ],
        },
      },
    ],
  },
  {
    id: "npc-hollis-rifle",
    kind: "crisis",
    weight: 0,
    once: true,
    when: [{ aboard: "hollis" }],
    title: "The rifle's owner",
    intro: ["A woman on a mule blocks the road. Her eyes go to {actor}'s rifle and stay there."],
    stranger: {
      name: "Ida Vance",
      look: {
        build: "sturdy",
        height: "tall",
        age: 49,
        skin: "brown, river-weathered",
        hair: { style: "braided", color: "black going grey", facial: "none" },
        clothing: ["a man's oilskin coat, too long in the sleeve", "a black mourning band on one arm", "a ferry-hand's cap"],
        palette: ["river grey", "mourning black", "mule brown"],
        prop: { id: "navy-pistol", desc: "an old navy pistol worn in a sash, grip wrapped in cord" },
        marks: ["red-rimmed eyes", "rope calluses on both palms"],
        summary: "A tall grey-braided woman on a mule, a mourning band on her arm, staring hard at a rifle she knows.",
      },
    },
    talk: [
      { who: "stranger", text: "I.V. in the stock. My husband carved that himself.", mood: "angry", gesture: "point" },
      { who: "npc:hollis", text: "He was dead when I found him. I needed a gun.", mood: "calm" },
      { who: "stranger", text: "Then give it back. Or tell me how he died.", mood: "grieving", gesture: "clutch" },
      { who: "leader", text: "Hollis?", mood: "calm", alt: { paranoid: "Hollis. Did you kill him for it?" } },
    ],
    options: [
      {
        id: "return",
        label: "Give her the rifle",
        results: {
          any: [
            r("Hollis hands it over, stock first. She gives you his powder pouch.", [fx.res("ammo", [3, 6]), fx.nerve("actor", -4), fx.trust("actor", 3), fx.nerve("all", 2)], [
              { who: "npc:hollis", text: "It was his. It was always his.", mood: "calm", gesture: "offer" },
              { who: "stranger", text: "Thank you. He'd have liked you, I think.", mood: "grieving", gesture: "clutch" },
            ]),
          ],
        },
      },
      {
        id: "keep",
        label: "Keep it. You need every gun.",
        results: {
          any: [
            r("She rides off cursing you all.", [fx.nerve("actor", -5), fx.trust("actor", 3), fx.nerve("all", -2)], [
              { who: "stranger", text: "Thieves. The whole lot of you. Thieves.", mood: "angry", gesture: "turn-away" },
              { who: "npc:hollis", text: "She's right. That's the worst of it.", mood: "grieving" },
            ], 2),
            r("She comes back that night and fires into the camp.", [fx.hp("random", [-6, -2]), fx.nerve("all", -3)], [
              { who: "stranger", text: "Give me back his rifle!", mood: "angry", gesture: "draw-weapon" },
            ], 1),
          ],
        },
      },
      {
        id: "tell",
        label: "Have someone tell her how it was",
        hours: 1,
        check: { kind: "persuade", dc: 11, target: "Ida Vance", exclude: ["actor"] },
        results: {
          any: [
            r("She listens to the end. Then she lets Hollis keep the rifle.", [fx.nerve("actor", 8), fx.bond("actor", "by", 5), fx.nerve("all", 2)], [
              { who: "by", text: "He buried your husband, ma'am. Properly. Said words.", mood: "calm", alt: { charming: "He dug the grave with his hands, ma'am. I watched." } },
              { who: "stranger", text: "Then keep it. Shoot straight with it.", mood: "grieving", gesture: "offer" },
            ], 1, "success"),
            r("She hears only that he took it. She takes it back at pistol point.", [fx.nerve("actor", -6), fx.nerve("all", -2)], [
              { who: "stranger", text: "Pretty words. The rifle. Now.", mood: "cold", gesture: "draw-weapon" },
            ], 1, "fail"),
          ],
        },
      },
      {
        id: "pay",
        label: "Pay her for it",
        cost: { scrip: 15 },
        results: {
          any: [
            r("She takes the scrip and does not count it.", [fx.nerve("actor", 3), fx.trust("actor", 4)], [
              { who: "stranger", text: "It's not enough. Nothing's enough. Keep it.", mood: "grieving", gesture: "turn-away" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "npc-nell-letter",
    kind: "crisis",
    weight: 0,
    once: true,
    when: [{ aboard: "nell" }],
    title: "A letter in {actor}'s sack",
    intro: ["{actor} sits apart, turning one envelope over and over in inky fingers."],
    talk: [
      { who: "npc:nell", text: "It's for {other}. It's been in my sack since Meridian.", mood: "afraid", gesture: "clutch" },
      { who: "npc:nell", text: "I read it. I read everything twice. I'm sorry.", mood: "grieving" },
      { who: "leader", text: "What does it say?", mood: "calm", alt: { paranoid: "Why hold it back? What else have you kept?" } },
      { who: "npc:nell", text: "Someone they love didn't get out.", mood: "grieving", gesture: "turn-away" },
    ],
    options: [
      {
        id: "deliver",
        label: "Have her deliver it now",
        hours: 0.5,
        results: {
          any: [
            r("{other} reads it twice, then sits with Nell until morning.", [fx.nerve("other", -6), fx.bond("actor", "other", 6), fx.trust("actor", 3)], [
              { who: "other", text: "You carried this all this way?", mood: "grieving" },
              { who: "npc:nell", text: "It was the only one with a name I knew.", mood: "grieving", gesture: "offer" },
            ], 3),
            r("{other} tears it up and won't speak to Nell again.", [fx.nerve("other", -6), fx.bond("actor", "other", -8)], [
              { who: "other", text: "You read it. You read my letter.", mood: "angry", gesture: "point" },
            ], 1),
          ],
        },
      },
      {
        id: "burn",
        label: "Burn it. Nobody needs that now.",
        results: {
          any: [
            r("Nell burns it and cries without a sound.", [fx.nerve("actor", -6), fx.trust("actor", -4)], [
              { who: "npc:nell", text: "A postmistress who burns letters. What am I now?", mood: "grieving", gesture: "turn-away" },
            ]),
          ],
        },
      },
      {
        id: "wait",
        label: "Let her wait for the right time",
        results: {
          any: [
            r("She keeps it. The sack gets heavier.", [fx.nerve("actor", -3)], [
              { who: "npc:nell", text: "Tomorrow, then. Or the day after.", mood: "afraid" },
            ], 2),
            r("{other} finds it in her sack that night.", [fx.bond("actor", "other", -10), fx.trust("actor", -4)], [
              { who: "other", text: "Were you ever going to give me this?", mood: "angry", gesture: "point" },
              { who: "npc:nell", text: "I was. I was. I swear it.", mood: "pleading", gesture: "raise-hands" },
            ], 1),
          ],
        },
      },
      {
        id: "gently",
        label: "Have someone break it gently with her",
        hours: 1,
        check: { kind: "calm", dc: 11, target: "Nell", exclude: ["actor"] },
        results: {
          any: [
            r("{by} and Nell tell {other} together, gently.", [fx.nerve("other", -2), fx.bond("actor", "other", 6), fx.nerve("actor", 5)], [
              { who: "by", text: "Sit down with us. There's a letter for you.", mood: "calm", gesture: "offer" },
              { who: "other", text: "Thank you. Both of you. Just... sit here.", mood: "grieving" },
            ], 1, "success"),
            r("{by} fumbles it. {other} takes the news like a blow.", [fx.nerve("other", -8), fx.bond("actor", "other", -4)], [
              { who: "by", text: "I'm sorry. I don't know how to say this.", mood: "afraid" },
              { who: "other", text: "Just give it to me. Give it here.", mood: "angry" },
            ], 1, "fail"),
          ],
        },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Meetings: the companions who have no older scene of their own
// ---------------------------------------------------------------------------

const MEETINGS: SceneDef[] = [
  {
    id: "birdie-dead-mule",
    kind: "stranger",
    regions: ["tallow", "fen"],
    minMile: 25,
    weight: 4,
    genuineOdds: 0.55,
    when: [{ recruitLeft: "birdie" }],
    title: "A woman and a dead mule",
    intro: ["A woman sits on a crate beside a dead mule. Her cart lies tipped in the ditch."],
    stranger: { name: "The woman with the crutch", look: lookOf("birdie") },
    talk: [
      { who: "stranger", text: "Mule dropped yesterday. Cart's no use without her.", mood: "grieving", gesture: "shrug" },
      { who: "stranger", text: "I fix things. Wheels, locks, rifles. Room for one more?", mood: "pleading", gesture: "offer" },
      { who: "leader", text: "What do you need from us?", mood: "calm", alt: { paranoid: "Who else is out here with you?", greedy: "What's left in the cart?" } },
      { who: "stranger", text: "A seat. Nothing else.", mood: "calm" },
    ],
    tells: [
      { text: "Her hands are black with axle grease to the wrist.", shows: "genuine", p: 0.6, severity: 2, say: "Grease to the wrist. She really does fix things." },
      { text: "She warns you your off-wheel is wobbling before asking anything.", shows: "genuine", p: 0.5, severity: 2, say: "She spotted our bad wheel before she asked for anything." },
      { text: "She hides a cough in a handkerchief, ashamed of it.", shows: "genuine", p: 0.45, severity: 1, say: "She's hiding a cough. Ashamed, not sly." },
      { text: "The tinker's cart in the ditch has no tools in it.", shows: "trap", p: 0.55, severity: 2, say: "A tinker's cart with no tools. Where'd they go?" },
      { text: "Fresh hoofprints lead from the mule into the brush.", shows: "trap", p: 0.5, severity: 2, say: "Fresh tracks behind her. Someone rode off. Recently." },
      { text: "She asks where you keep the spares. Twice.", shows: "trap", p: 0.4, severity: 3, say: "Second time she's asked where the spares are." },
      { text: "She talks to the dead mule as if it can hear.", shows: "noise", p: 0.4, severity: 1, say: "She's talking to the mule. Poor thing." },
    ],
    options: [
      {
        id: "take",
        label: "Give her a seat",
        hours: 1,
        tag: "help",
        results: {
          genuine: [
            r("Her name is Birdie. She trues your wheel before you've gone a mile.", [fx.recruit("birdie"), fx.repair(6), fx.nerve({ trait: "kind" }, 2)], [
              { who: "npc:birdie", text: "Birdie. Your off-wheel's singing. Give me ten minutes.", mood: "sly", gesture: "point" },
              { who: "leader", text: "Take twenty.", mood: "calm", alt: { greedy: "Ten. We're paying for the seat, remember." } },
            ]),
          ],
          trap: [
            r("Riders come out of the brush the moment you stop to lift her.", [fx.combat("raiders")], [
              { who: "stranger", text: "Sorry. They've got my boy.", mood: "afraid", gesture: "turn-away" },
            ], 6),
            r("By dusk she's gone, and so are the spares.", [fx.res("spares", [-2, -1]), fx.nerve("all", -3)], [
              { who: "leader", text: "The spares crate. Empty. Of course it is.", mood: "angry", alt: { kind: "She took them. She seemed so... Damn it." } },
            ], 3),
          ],
        },
      },
      {
        id: "wheels",
        label: "Pay her in rations to look at the wheels",
        hint: "2 rations. Then go on without her.",
        hours: 1,
        cost: { rations: 2 },
        tag: "help",
        results: {
          genuine: [
            r("She fixes two wheels, eats, and waves you off.", [fx.repair(4), fx.flag("met:birdie")], [
              { who: "stranger", text: "Go on. There'll be another train. Always is.", mood: "calm", gesture: "shrug" },
            ]),
          ],
          trap: [
            r("She tightens nothing and pockets a wrench.", [fx.res("spares", -1)], [
              { who: "stranger", text: "Safe road. Mind that wheel.", mood: "sly" },
            ]),
          ],
        },
      },
      {
        id: "ask",
        label: "Ask her straight who else is out here",
        hours: 0.5,
        tag: "help",
        check: { kind: "persuade", dc: 12, target: "the tinker" },
        results: {
          genuine: [
            r("She laughs. Nobody's with her. She climbs aboard.", [fx.recruit("birdie")], [
              { who: "by", text: "Just you? Nobody in that brush?", mood: "calm", alt: { paranoid: "Nobody in the brush? Swear it on something." } },
              { who: "npc:birdie", text: "Me and a dead mule. Help me up.", mood: "sly", gesture: "raise-hands" },
            ], 1, "success"),
            r("She takes offence and won't come.", [fx.flag("met:birdie"), fx.nerve({ trait: "kind" }, -2)], [
              { who: "stranger", text: "A thief now, am I? Drive on, then.", mood: "angry", gesture: "turn-away" },
            ], 1, "fail"),
          ],
          trap: [
            r("She breaks and warns you: men are waiting past the bridge.", [fx.nerve("all", 2), fx.hours(1)], [
              { who: "stranger", text: "They've got my boy. Go the long way round.", mood: "afraid", gesture: "kneel" },
            ], 1, "success"),
            r("She swears she's alone. The riders come at dusk.", [fx.combat("raiders")], [
              { who: "stranger", text: "Alone. I swear it. Nobody else.", mood: "pleading", gesture: "raise-hands" },
            ], 1, "fail"),
          ],
        },
      },
      {
        id: "pass",
        label: "Drive on",
        tag: "refuse",
        results: {
          genuine: [
            r("She lifts a hand as you pass. She doesn't call out.", [fx.nerve({ trait: "kind" }, -3), fx.flag("refusedGenuine"), fx.flag("met:birdie")], [
              { who: "stranger", text: "Mind that off-wheel. It's singing.", mood: "calm", gesture: "point" },
            ]),
          ],
          trap: [
            r("Behind you someone whistles in the brush. She whistles back.", [fx.nerve("all", -1)], [
              { who: "leader", text: "Hear that? Keep moving.", mood: "cold", alt: { coward: "Faster. Please, faster." } },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "hollis-at-the-ford",
    kind: "stranger",
    regions: ["fen", "flats"],
    minMile: 130,
    weight: 4,
    genuineOdds: 0.5,
    when: [{ recruitLeft: "hollis" }],
    title: "A man at the ford",
    intro: ["At a brown ford, a young man in an oilskin stands knee-deep, rifle held high and dry."],
    stranger: { name: "The young man at the ford", look: lookOf("hollis") },
    talk: [
      { who: "stranger", text: "Ford's shifted since the rains. I know where it holds.", mood: "calm", gesture: "point" },
      { who: "stranger", text: "I'll walk you across. After, I'd ride with you.", mood: "calm", gesture: "offer" },
      { who: "leader", text: "And if we cross alone?", mood: "cold", alt: { coward: "How deep is it? Is it deep?", kind: "You've stood in that water all day?" } },
      { who: "stranger", text: "Then mind the left bank. It takes wheels.", mood: "calm", gesture: "shrug" },
    ],
    tells: [
      { text: "His palms are rope-callused. Years of ferry rope.", shows: "genuine", p: 0.6, severity: 2, say: "Rope calluses. He's worked a ferry, sure enough." },
      { text: "He warns you about the left bank before asking for anything.", shows: "genuine", p: 0.5, severity: 2, say: "He warned us first. Asked second." },
      { text: "He says the rifle isn't his before anyone asks.", shows: "genuine", p: 0.4, severity: 1, say: "Told us the rifle's borrowed. Didn't have to." },
      { text: "Upstream, a marker rope hangs from a snag, freshly cut.", shows: "trap", p: 0.55, severity: 2, say: "That rope's fresh-cut. Someone moved the ford markers." },
      { text: "He wants your heaviest wagon to cross first.", shows: "trap", p: 0.45, severity: 3, say: "He wants our heaviest wagon first. Why?" },
      { text: "Smoke rises on the far bank, then stops, too quickly.", shows: "trap", p: 0.4, severity: 2, say: "Far bank. Smoke, then no smoke." },
      { text: "He stands so still a heron lands beside him.", shows: "noise", p: 0.4, severity: 1, say: "Heron's not bothered by him. Odd." },
    ],
    options: [
      {
        id: "guide",
        label: "Let him guide you across, and ride with you",
        hours: 1,
        tag: "help",
        results: {
          genuine: [
            r("He walks every wheel across himself. Hollis Grey, he says, and nothing more.", [fx.recruit("hollis"), fx.gap([2, 4])], [
              { who: "npc:hollis", text: "Hollis. I don't say much.", mood: "calm" },
              { who: "leader", text: "You don't need to.", mood: "calm", alt: { charming: "Then I'll talk for both of us." } },
            ]),
          ],
          trap: [
            r("Midstream, the far bank fills with men.", [fx.combat("raiders"), fx.repair(-6)], [
              { who: "stranger", text: "Sorry. They pay better than you would.", mood: "cold", gesture: "turn-away" },
            ], 6),
            r("He steers the first wagon into a sinkhole and is gone.", [fx.repair(-10), fx.res("rations", -4), fx.nerve("all", -3)], [
              { who: "leader", text: "Where is he? Where did he go?", mood: "angry", alt: { paranoid: "I knew it. I knew it at the bank." } },
            ], 3),
          ],
        },
      },
      {
        id: "hire",
        label: "Hire him for the crossing only",
        hint: "Haggle the price in rations.",
        hours: 1,
        tag: "help",
        check: { kind: "haggle", dc: 11, target: "the young man" },
        results: {
          genuine: [
            r("He guides you over for one ration and won't take more.", [fx.res("rations", -1), fx.gap([2, 4]), fx.flag("met:hollis")], [
              { who: "by", text: "One ration to walk us over. Fair?", mood: "calm", gesture: "offer" },
              { who: "stranger", text: "Fair. Mind the left bank after.", mood: "calm" },
            ], 1, "success"),
            r("He takes three rations, and earns them.", [fx.res("rations", -3), fx.gap([2, 4]), fx.flag("met:hollis")], [
              { who: "by", text: "Three? For a walk in a river?", mood: "angry", alt: { greedy: "Three rations. Robbery. Fine. Fine." } },
              { who: "stranger", text: "A walk you'd drown on. Three.", mood: "calm", gesture: "shrug" },
            ], 1, "fail"),
          ],
          trap: [
            r("{by} haggles him down until he gives up and slips away.", [], [
              { who: "stranger", text: "Never mind. Cross on your own.", mood: "cold", gesture: "turn-away" },
            ], 1, "success"),
            r("He takes the rations and walks you straight into the reeds.", [fx.res("rations", -3), fx.combat("raiders")], [
              { who: "stranger", text: "This way. Mind your feet.", mood: "sly", gesture: "beckon" },
            ], 1, "fail"),
          ],
        },
      },
      {
        id: "alone",
        label: "Thank him, and cross on your own",
        hours: 2,
        tag: "refuse",
        results: {
          genuine: [
            r("You mind the left bank. He watches you across, then walks off downstream.", [fx.flag("met:hollis")], [
              { who: "stranger", text: "Good crossing. Safe road.", mood: "calm", gesture: "raise-hands" },
            ]),
          ],
          trap: [
            r("You cross upstream of his markers. Men in the reeds watch you do it.", [fx.nerve("all", -1)], [
              { who: "leader", text: "Men in the reeds. Waiting. Keep going.", mood: "cold", alt: { coward: "Go, go, go. Don't look at them." } },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "rue-on-the-rise",
    kind: "stranger",
    regions: ["flats", "pines"],
    minMile: 260,
    weight: 4,
    genuineOdds: 0.5,
    when: [{ recruitLeft: "rue" }],
    title: "A drover without a herd",
    intro: ["A woman in a long duster sits her horse on a rise, a whip coiled on her hip. No cattle."],
    stranger: { name: "The drover", look: lookOf("rue") },
    talk: [
      { who: "stranger", text: "Lost forty head to the fog in three nights.", mood: "angry", gesture: "point" },
      { who: "stranger", text: "I can shoot. I can track. Nothing left to drive.", mood: "sly", gesture: "shrug" },
      { who: "leader", text: "Why us?", mood: "cold", alt: { hothead: "Get off that rise. Talk to us down here.", charming: "We could use a rider. Can you cook?" } },
      { who: "stranger", text: "You're the only ones heading anywhere.", mood: "calm" },
    ],
    tells: [
      { text: "Her horse is ribby and footsore, ridden hard for days.", shows: "genuine", p: 0.55, severity: 2, say: "That horse is half dead. She's been riding for days." },
      { text: "She asks how fast the Haze is moving before she asks for food.", shows: "genuine", p: 0.5, severity: 2, say: "She asked how fast it's moving. Not what we carry." },
      { text: "Old brown cattle blood on her duster.", shows: "genuine", p: 0.45, severity: 1, say: "Old blood on that coat. Cattle, by the smell." },
      { text: "Her saddlebags are full and her horse is fresh.", shows: "trap", p: 0.55, severity: 2, say: "Horse is fresh. Bags are full. Lost everything?" },
      { text: "She counts your rifles out loud, like a joke.", shows: "trap", p: 0.45, severity: 3, say: "She counted our rifles. Out loud." },
      { text: "A dozen sets of hoofprints go into the draw behind her.", shows: "trap", p: 0.4, severity: 2, say: "A dozen horses went into that draw. Not cattle." },
      { text: "She touches the whip whenever you speak.", shows: "noise", p: 0.4, severity: 1, say: "Hand on that whip every time we talk." },
    ],
    options: [
      {
        id: "take",
        label: "Take her on",
        hours: 0.5,
        tag: "help",
        results: {
          genuine: [
            r("Rue Delacroix. She rides ahead and comes back with a deer.", [fx.recruit("rue"), fx.res("rations", [4, 8])], [
              { who: "npc:rue", text: "Rue. Point me at something that needs killing.", mood: "sly", gesture: "point" },
              { who: "leader", text: "Supper would be a start.", mood: "calm", alt: { hothead: "Point at you, if you cross me." } },
            ]),
          ],
          trap: [
            r("She rides ahead to scout. Then the draw fills with riders.", [fx.combat("raiders")], [
              { who: "stranger", text: "Nothing personal. Everyone's got to eat.", mood: "sly", gesture: "draw-weapon" },
            ], 6),
            r("She's gone at dawn, and so is the rations sack.", [fx.res("rations", [-8, -4]), fx.nerve("all", -3)], [
              { who: "leader", text: "The picket's cut. The sack's gone.", mood: "angry", alt: { paranoid: "Told you. Counting our rifles. Told you." } },
            ], 3),
          ],
        },
      },
      {
        id: "hunt",
        label: "Hunt with her for the afternoon, then part",
        hours: 3,
        tag: "help",
        results: {
          genuine: [
            r("She shoots well, splits the meat fair, and rides off alone.", [fx.res("rations", [6, 10]), fx.flag("met:rue")], [
              { who: "stranger", text: "Half's yours. You were decent. That's rare now.", mood: "calm", gesture: "offer" },
            ]),
          ],
          trap: [
            r("She leads your hunters into the draw. They come back running.", [fx.hp("random", [-6, -3]), fx.nerve("all", -3)], [
              { who: "leader", text: "What happened out there?", mood: "afraid", alt: { veteran: "How many? Which way? Talk." } },
            ]),
          ],
        },
      },
      {
        id: "down",
        label: "Tell her to come down, hands clear",
        hours: 0.5,
        tag: "help",
        check: { kind: "talk-down", dc: 12, target: "the drover" },
        results: {
          genuine: [
            r("She comes down laughing, hands wide, and asks to join.", [fx.recruit("rue")], [
              { who: "by", text: "Down off the rise. Hands where we see them.", mood: "cold" },
              { who: "npc:rue", text: "Suspicious lot. Good. You'll live longer.", mood: "sly", gesture: "raise-hands" },
            ], 1, "success"),
            r("She takes it badly and rides off.", [fx.flag("met:rue"), fx.nerve({ trait: "kind" }, -2)], [
              { who: "stranger", text: "I'm not a dog to be called. Go to hell.", mood: "angry", gesture: "turn-away" },
            ], 1, "fail"),
          ],
          trap: [
            r("She won't come down. Shapes in the draw pull back.", [fx.nerve("all", 2)], [
              { who: "stranger", text: "Another time, then.", mood: "cold", gesture: "turn-away" },
            ], 1, "success"),
            r("She comes down smiling. So do her friends.", [fx.combat("raiders")], [
              { who: "stranger", text: "Hands clear. Just like you asked.", mood: "sly", gesture: "raise-hands" },
            ], 1, "fail"),
          ],
        },
      },
      {
        id: "pass",
        label: "Drive on",
        tag: "refuse",
        results: {
          genuine: [
            r("She watches you pass, then turns her horse east, toward the fog.", [fx.nerve({ trait: "kind" }, -3), fx.flag("refusedGenuine"), fx.flag("met:rue")], [
              { who: "stranger", text: "Fine. I'll go look for them myself.", mood: "angry" },
            ]),
          ],
          trap: [
            r("Somewhere behind her, a horse whinnies in the draw.", [fx.nerve("all", -1)], [
              { who: "leader", text: "Don't look back. Just drive.", mood: "cold", alt: { coward: "Is that them? Go. Just go." } },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "nell-mail-sack",
    kind: "stranger",
    regions: ["flats", "pines"],
    minMile: 250,
    weight: 4,
    genuineOdds: 0.5,
    when: [{ recruitLeft: "nell" }],
    title: "The postmistress",
    intro: ["A woman in a postal jacket walks the verge with a bulging sack, reading names off envelopes."],
    stranger: { name: "The woman with the mail sack", look: lookOf("nell") },
    talk: [
      { who: "stranger", text: "Any post for your train? Give me names.", mood: "calm", gesture: "offer" },
      { who: "stranger", text: "I carry what the Haze left behind. Somebody should.", mood: "grieving", gesture: "clutch" },
      { who: "leader", text: "What do you want?", mood: "cold", alt: { paranoid: "Why does she want our names?", kind: "You've carried those letters all this way?" } },
      { who: "stranger", text: "A ride west. I'll pay in news.", mood: "sly" },
    ],
    tells: [
      { text: "The letters are water-stained, postmarked months ago.", shows: "genuine", p: 0.55, severity: 2, say: "Postmarks are months old. Those letters are real." },
      { text: "She warns you the Meridian factor rigs his scales, unasked.", shows: "genuine", p: 0.5, severity: 2, say: "She warned us about the wayhouse scales. For nothing." },
      { text: "Her fingers are ink-black to the second knuckle.", shows: "genuine", p: 0.5, severity: 1, say: "Ink to the knuckle. She's done that job for years." },
      { text: "The envelopes in her hand are blank. No addresses at all.", shows: "trap", p: 0.45, severity: 3, say: "Those envelopes are blank. Every one." },
      { text: "She writes your names in a little book as you give them.", shows: "trap", p: 0.5, severity: 2, say: "She's writing our names down. And our wagons." },
      { text: "Her boots are new, Company issue.", shows: "trap", p: 0.4, severity: 1, say: "New Company boots on a postmistress." },
      { text: "She mutters street addresses under her breath.", shows: "noise", p: 0.4, severity: 1, say: "She keeps saying street names. Streets that burned." },
    ],
    options: [
      {
        id: "take",
        label: "Give her a ride",
        hours: 0.5,
        tag: "help",
        results: {
          genuine: [
            r("Nell Ashby reads you all the news she carries. Most of it is sad.", [fx.recruit("nell"), fx.nerve("all", 2)], [
              { who: "npc:nell", text: "Nell Ashby. Meridian post. Nobody else wanted the job.", mood: "calm", gesture: "clutch" },
              { who: "leader", text: "Well. You've got it now.", mood: "calm", alt: { paranoid: "Keep that book of yours where I can see it." } },
            ]),
          ],
          trap: [
            r("Two days on, riders know exactly how many guns you carry.", [fx.combat("raiders")], [
              { who: "stranger", text: "Sorry, dears. They pay by the name.", mood: "sly", gesture: "shrug" },
            ], 6),
            r("She's gone before dawn, with the scrip box.", [fx.scrip([-30, -15]), fx.nerve("all", -3)], [
              { who: "leader", text: "The scrip box. She knew where it was.", mood: "angry", alt: { greedy: "Every coin. Every last coin. That witch." } },
            ], 3),
          ],
        },
      },
      {
        id: "news",
        label: "Trade a ration for news of the road",
        hours: 0.5,
        cost: { rations: 1 },
        tag: "help",
        results: {
          genuine: [
            r("She tells you which wells are bad, then walks on.", [fx.gap([2, 5]), fx.flag("met:nell")], [
              { who: "stranger", text: "Skip the well at the dry fork. It's gone bad.", mood: "calm", gesture: "point" },
            ]),
          ],
          trap: [
            r("Her news is wrong. You lose hours hunting a road that isn't there.", [fx.hours(2), fx.nerve("all", -2)], [
              { who: "leader", text: "She lied. There's no road here.", mood: "angry", alt: { stoic: "Turn around. We've lost the morning." } },
            ]),
          ],
        },
      },
      {
        id: "pass",
        label: "Drive on",
        tag: "refuse",
        results: {
          genuine: [
            r("She stands on the verge reading a letter aloud to nobody.", [fx.nerve({ trait: "kind" }, -3), fx.flag("refusedGenuine"), fx.flag("met:nell")], [
              { who: "stranger", text: "'Dear Mother. We are well.' They were, once.", mood: "grieving" },
            ]),
          ],
          trap: [
            r("She writes something in her little book as you pass.", [fx.nerve("all", -1)], [
              { who: "leader", text: "What's she writing? Never mind. Drive.", mood: "cold", alt: { paranoid: "She's writing us down. Every wagon." } },
            ]),
          ],
        },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Returns: the ones you turned away, further down the road
// ---------------------------------------------------------------------------

const RETURNS: SceneDef[] = [
  {
    id: "npc-birdie-again",
    kind: "stranger",
    regions: ["fen", "flats"],
    minMile: 160,
    weight: 4,
    once: true,
    genuineOdds: 0.6,
    when: [{ flag: "met:birdie", min: 1 }, { recruitLeft: "birdie" }],
    title: "The tinker again",
    intro: ["The tinker from the dead-mule cart, on foot now, her crutch splinted with wire."],
    stranger: {
      name: "Birdie",
      look: changed(
        "birdie",
        ["a limp on the left, much worse", "a cough she no longer hides", "a cracked crutch splinted with wire"],
        "A short, grey-faced older woman in a patched green headscarf, coughing over a wire-splinted crutch, tools on her back.",
      ),
    },
    talk: [
      { who: "npc:birdie", text: "Well. That wheel still singing?", mood: "sly", gesture: "point" },
      { who: "npc:birdie", text: "Next train never came. Nobody came.", mood: "grieving", gesture: "shrug" },
      { who: "leader", text: "You look worse.", mood: "calm", alt: { kind: "Birdie. Sit down before you fall.", greedy: "Can you still work, sick like that?" } },
      { who: "npc:birdie", text: "Can still true a wheel. Can't walk to the Reach.", mood: "calm" },
    ],
    tells: [
      { text: "The cough brings up blood. She wipes it away fast, ashamed.", shows: "genuine", p: 0.6, severity: 2, say: "Blood in that cough. She's trying to hide it." },
      { text: "She sold her boots but still carries the tool roll.", shows: "genuine", p: 0.5, severity: 2, say: "Sold her boots. Kept the tools. That's a tinker." },
      { text: "The wire on her crutch is new Company wire.", shows: "trap", p: 0.5, severity: 2, say: "That's new Company wire. Who gave her that?" },
      { text: "She keeps glancing at the tree line.", shows: "trap", p: 0.55, severity: 2, say: "Keeps looking at the trees. Someone's there." },
      { text: "She laughs at nothing, then can't stop coughing.", shows: "noise", p: 0.4, severity: 1, say: "She laughed. Then couldn't stop coughing." },
    ],
    options: [
      {
        id: "take",
        label: "Take her aboard this time",
        hours: 1,
        tag: "help",
        results: {
          genuine: [
            r("She's asleep before the wagon moves. At dawn she's fixing things.", [fx.recruit("birdie"), fx.repair(6), fx.nerve({ trait: "kind" }, 3)], [
              { who: "npc:birdie", text: "Knew you'd come round. Everyone does, eventually.", mood: "sly" },
              { who: "leader", text: "Don't make me regret it.", mood: "calm", alt: { kind: "I should have the first time. I'm sorry." } },
            ]),
          ],
          trap: [
            r("The tree line empties. She's weeping as they come.", [fx.combat("raiders")], [
              { who: "npc:birdie", text: "They said they'd feed me. I'm sorry.", mood: "grieving", gesture: "turn-away" },
            ], 6),
            r("She's gone by dawn, with the physic chest.", [fx.res("medicine", [-3, -1]), fx.nerve("all", -3)], [
              { who: "leader", text: "Physic's gone. So is she.", mood: "angry", alt: { kind: "She needed it more. Maybe. God." } },
            ], 3),
          ],
        },
      },
      {
        id: "ask",
        label: "Ask her straight: who's in the trees?",
        hours: 0.5,
        tag: "help",
        check: { kind: "persuade", dc: 11, target: "Birdie" },
        results: {
          genuine: [
            r("Nobody. She's alone. {by} helps her up.", [fx.recruit("birdie")], [
              { who: "by", text: "Nobody in those trees, Birdie? Swear it.", mood: "calm" },
              { who: "npc:birdie", text: "Just crows. Help me up before I change my mind.", mood: "sly", gesture: "raise-hands" },
            ], 1, "success"),
            r("She's too proud to answer. She limps off.", [fx.nerve({ trait: "kind" }, -3)], [
              { who: "npc:birdie", text: "I don't beg twice. Go on.", mood: "angry", gesture: "turn-away" },
            ], 1, "fail"),
          ],
          trap: [
            r("She cries and tells you. You go round the trees.", [fx.nerve("all", 2), fx.hours(1)], [
              { who: "npc:birdie", text: "Four of them. They've got my tools. Go round.", mood: "afraid", gesture: "kneel" },
            ], 1, "success"),
            r("She swears it's nobody. The trees disagree.", [fx.combat("raiders")], [
              { who: "npc:birdie", text: "Nobody. Crows. Just crows.", mood: "pleading" },
            ], 1, "fail"),
          ],
        },
      },
      {
        id: "pass",
        label: "Drive on",
        tag: "refuse",
        results: {
          genuine: [
            r("She lifts the crutch as you pass. A wave, or not.", [fx.nerve({ trait: "kind" }, -4), fx.trust({ trait: "kind" }, -4), fx.flag("refusedGenuine")], [
              { who: "npc:birdie", text: "Twice. Well. Good luck to you.", mood: "grieving", gesture: "turn-away" },
            ]),
          ],
          trap: [
            r("Men step out of the trees behind her, too late.", [fx.nerve("all", -1)], [
              { who: "leader", text: "Don't stop. Don't stop now.", mood: "afraid", alt: { veteran: "Steady. Keep the pace. They're on foot." } },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "npc-hollis-again",
    kind: "stranger",
    regions: ["flats", "pines"],
    minMile: 260,
    weight: 4,
    once: true,
    genuineOdds: 0.6,
    when: [{ flag: "met:hollis", min: 1 }, { recruitLeft: "hollis" }],
    title: "The ferryman's son",
    intro: ["The young man from the ford kneels by fresh graves, his rifle across his knees."],
    stranger: {
      name: "Hollis",
      look: changed(
        "hollis",
        ["rope calluses across both palms", "a bandaged left hand", "he stands so still that birds forget him"],
        "A tall young man in a torn grey oilskin, kneeling by a row of fresh graves with a rifle across his knees.",
      ),
    },
    talk: [
      { who: "npc:hollis", text: "I buried the family I was riding with.", mood: "calm" },
      { who: "npc:hollis", text: "Fever. Three days. I dug for all of them.", mood: "grieving", gesture: "kneel" },
      { who: "leader", text: "I'm sorry.", mood: "grieving", alt: { stoic: "Can you still shoot?", pious: "Let us say words over them." } },
      { who: "npc:hollis", text: "I'd ride with you. If you'll have me now.", mood: "calm", gesture: "offer" },
    ],
    tells: [
      { text: "His hands are blistered from a shovel, not a rifle.", shows: "genuine", p: 0.6, severity: 2, say: "Shovel blisters. He dug those graves himself." },
      { text: "Five graves. One of them very small.", shows: "genuine", p: 0.5, severity: 2, say: "Five graves. One of them tiny." },
      { text: "The graves are mounded, but his coat has no dirt on it.", shows: "trap", p: 0.5, severity: 2, say: "Fresh graves, clean coat. Who dug them?" },
      { text: "Hoofprints all around the graves. Many horses.", shows: "trap", p: 0.45, severity: 3, say: "A lot of horses for one man and a grave." },
      { text: "A crow sits on a grave marker and won't leave.", shows: "noise", p: 0.4, severity: 1, say: "Crow on the marker. Won't budge." },
    ],
    options: [
      {
        id: "take",
        label: "Take him aboard",
        hours: 0.5,
        tag: "help",
        results: {
          genuine: [
            r("He shoulders the rifle and walks by the lead ox without a word.", [fx.recruit("hollis"), fx.nerve("all", 2)], [
              { who: "npc:hollis", text: "Thank you. I'll earn it.", mood: "calm" },
            ]),
          ],
          trap: [
            r("The graves are empty. The grass is not.", [fx.combat("raiders")], [
              { who: "npc:hollis", text: "I'm sorry. They'd have killed me.", mood: "afraid", gesture: "turn-away" },
            ], 6),
            r("He's gone at dawn, with a crate of cartridges.", [fx.res("ammo", [-8, -4]), fx.nerve("all", -3)], [
              { who: "leader", text: "Cartridges are gone. So is Hollis.", mood: "angry", alt: { kind: "He was so still. So sad. God." } },
            ], 3),
          ],
        },
      },
      {
        id: "sit",
        label: "Sit with him a while first",
        hours: 1,
        tag: "help",
        check: { kind: "calm", dc: 11, target: "Hollis" },
        results: {
          genuine: [
            r("He grieves, then stands up lighter, and comes.", [fx.recruit("hollis"), fx.nerve("all", 3)], [
              { who: "by", text: "Tell us their names. We'll remember them too.", mood: "calm", gesture: "kneel" },
              { who: "npc:hollis", text: "Amos. Ruth. Little Sam. The Pruitt girls.", mood: "grieving" },
            ], 1, "success"),
            r("He closes up. He'll ride with you, but he's gone somewhere far.", [fx.recruit("hollis"), fx.nerve("all", -2)], [
              { who: "by", text: "It wasn't your fault. None of it.", mood: "calm", alt: { hothead: "Up. Crying won't dig them out." } },
              { who: "npc:hollis", text: "...", mood: "grieving", gesture: "turn-away" },
            ], 1, "fail"),
          ],
          trap: [
            r("Sitting close, {by} reads him. He breaks and whispers a warning.", [fx.nerve("all", 2)], [
              { who: "npc:hollis", text: "They're in the grass. Go. Go now.", mood: "afraid" },
            ], 1, "success"),
            r("While you sit, the grass fills with men.", [fx.combat("raiders")], [
              { who: "npc:hollis", text: "I'm sorry. Keep your hands where they see them.", mood: "afraid", gesture: "raise-hands" },
            ], 1, "fail"),
          ],
        },
      },
      {
        id: "pass",
        label: "Drive on",
        tag: "refuse",
        results: {
          genuine: [
            r("He watches you go, then goes back to the graves.", [fx.nerve({ trait: "kind" }, -4), fx.trust({ trait: "kind" }, -3), fx.flag("refusedGenuine")], [
              { who: "npc:hollis", text: "All right. All right.", mood: "grieving", gesture: "turn-away" },
            ]),
          ],
          trap: [
            r("Riders rise from the grass behind you, too late.", [fx.nerve("all", -1)], [
              { who: "leader", text: "They were waiting. Drive. Drive!", mood: "afraid", alt: { veteran: "Keep the pace. They won't catch wagons now." } },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "npc-rue-again",
    kind: "stranger",
    regions: ["pines", "spine"],
    minMile: 380,
    weight: 4,
    once: true,
    genuineOdds: 0.55,
    when: [{ flag: "met:rue", min: 1 }, { recruitLeft: "rue" }],
    title: "The drover, on foot",
    intro: ["The drover from the rise. On foot now, hatless, a single steer's horn in her hand."],
    stranger: {
      name: "Rue",
      look: changed(
        "rue",
        ["a rope burn across the right palm", "a brand mark on her forearm: DL", "boots worn through at the sole"],
        "A lean, hatless woman in a torn brown duster, on foot, holding a single cattle horn like a weapon.",
      ),
    },
    talk: [
      { who: "npc:rue", text: "Horse went down two days back. I ate her.", mood: "angry", gesture: "turn-away" },
      { who: "npc:rue", text: "You want to say something? Say it.", mood: "angry", gesture: "point" },
      { who: "leader", text: "We've room.", mood: "calm", alt: { hothead: "Nothing to say. Get in.", paranoid: "Last time you had a horse. Friends too?" } },
      { who: "npc:rue", text: "I'm not asking twice. This is once more.", mood: "cold" },
    ],
    tells: [
      { text: "Her boot soles are gone. She has walked a long way.", shows: "genuine", p: 0.6, severity: 2, say: "Boot soles are gone. She's walked a hundred miles." },
      { text: "She asks for nothing. She just stands there, jaw tight.", shows: "genuine", p: 0.5, severity: 2, say: "Too proud to ask. That's real." },
      { text: "Her canteen is full, and there's been no water for miles.", shows: "trap", p: 0.5, severity: 2, say: "Full canteen. No water for miles. Who filled it?" },
      { text: "Two sets of bootprints came here. One went back.", shows: "trap", p: 0.45, severity: 3, say: "Two sets of prints came in. One went back." },
      { text: "She turns the horn over and over in her hands.", shows: "noise", p: 0.4, severity: 1, say: "She won't put that horn down." },
    ],
    options: [
      {
        id: "take",
        label: "Take her on",
        hours: 0.5,
        tag: "help",
        results: {
          genuine: [
            r("She climbs up without thanks and sleeps sitting upright.", [fx.recruit("rue")], [
              { who: "npc:rue", text: "Don't make a thing of it.", mood: "cold" },
            ]),
          ],
          trap: [
            r("Her friends are waiting where the road narrows.", [fx.combat("raiders")], [
              { who: "npc:rue", text: "Should've left me. Told you.", mood: "cold", gesture: "draw-weapon" },
            ], 6),
            r("She slips off at night with a sack of cartridges.", [fx.res("ammo", [-8, -4]), fx.nerve("all", -3)], [
              { who: "leader", text: "She took the cartridges. Of course she did.", mood: "angry", alt: { kind: "Maybe she needed them. Maybe." } },
            ], 3),
          ],
        },
      },
      {
        id: "talk",
        label: "Let someone take the edge off her first",
        hours: 0.5,
        tag: "help",
        check: { kind: "talk-down", dc: 12, target: "Rue" },
        results: {
          genuine: [
            r("{by} gets a grim laugh out of her. She climbs aboard.", [fx.recruit("rue"), fx.nerve("all", 2)], [
              { who: "by", text: "Horse for supper. Beats what we've been eating.", mood: "sly", alt: { kind: "I'm sorry about the horse. Truly. Come on." } },
              { who: "npc:rue", text: "Ha. It did, too. All right.", mood: "sly", gesture: "shrug" },
            ], 1, "success"),
            r("{by} says the wrong thing. She walks off into the trees.", [fx.nerve({ trait: "kind" }, -3)], [
              { who: "npc:rue", text: "Pity. I don't need pity. Keep driving.", mood: "angry", gesture: "turn-away" },
            ], 1, "fail"),
          ],
          trap: [
            r("She lets it slip: they're waiting at the narrows.", [fx.nerve("all", 2), fx.hours(1)], [
              { who: "npc:rue", text: "Take the high road. Don't ask me why.", mood: "cold", gesture: "point" },
            ], 1, "success"),
            r("She smiles at {by}'s joke. The narrows are full.", [fx.combat("raiders")], [
              { who: "npc:rue", text: "Funny. You're funny. Shame.", mood: "sly" },
            ], 1, "fail"),
          ],
        },
      },
      {
        id: "pass",
        label: "Drive on",
        tag: "refuse",
        results: {
          genuine: [
            r("She doesn't watch you go. She's already walking.", [fx.nerve({ trait: "kind" }, -3), fx.flag("refusedGenuine")], [
              { who: "npc:rue", text: "Twice. I won't forget it.", mood: "cold", gesture: "turn-away" },
            ]),
          ],
          trap: [
            r("At the narrows, a rider turns his horse and goes.", [fx.nerve("all", -1)], [
              { who: "leader", text: "Faster. Don't give them time.", mood: "cold", alt: { coward: "Were they waiting for us? Were they?" } },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "npc-nell-again",
    kind: "stranger",
    regions: ["pines", "spine"],
    minMile: 380,
    weight: 4,
    once: true,
    genuineOdds: 0.55,
    when: [{ flag: "met:nell", min: 1 }, { recruitLeft: "nell" }],
    title: "The postmistress, burning",
    intro: ["The postmistress sits by a small fire, feeding it letters one at a time."],
    stranger: {
      name: "Nell",
      look: changed(
        "nell",
        ["ink stains up to the wrist", "burn marks on her fingertips", "the mail sack half empty"],
        "A short grey-haired woman in a scorched black postal jacket, feeding letters one by one into a small fire.",
      ),
    },
    talk: [
      { who: "npc:nell", text: "Cold nights. Paper burns. Nobody writes back.", mood: "grieving" },
      { who: "npc:nell", text: "I kept one back. For the day I'd stop.", mood: "calm", gesture: "clutch" },
      { who: "leader", text: "Come with us.", mood: "calm", alt: { paranoid: "Why burn them? What's in them?", kind: "Nell. Stop. Come with us. Please." } },
      { who: "npc:nell", text: "Would you? After last time?", mood: "afraid" },
    ],
    tells: [
      { text: "She burns the letters unread. She can't bear to read them now.", shows: "genuine", p: 0.55, severity: 2, say: "She's not reading them. She just can't anymore." },
      { text: "One letter is tucked in her jacket, addressed to herself.", shows: "genuine", p: 0.5, severity: 2, say: "One letter she's keeping. Addressed to herself." },
      { text: "The sheets she burns are blank.", shows: "trap", p: 0.45, severity: 3, say: "Those are blank sheets. She's burning nothing." },
      { text: "The fire is too big for one woman. Smoke for miles.", shows: "trap", p: 0.5, severity: 2, say: "That fire's a signal. Anyone could see it for miles." },
      { text: "She whispers an address as each one catches.", shows: "noise", p: 0.4, severity: 1, say: "She says an address for every one." },
    ],
    options: [
      {
        id: "take",
        label: "Put out the fire and take her",
        hours: 0.5,
        tag: "help",
        results: {
          genuine: [
            r("She keeps the last letter in her jacket, and stops shaking by noon.", [fx.recruit("nell"), fx.nerve("all", 2)], [
              { who: "npc:nell", text: "Thank you. I'll read your post for you. Everyone's.", mood: "calm" },
            ]),
          ],
          trap: [
            r("Riders come to her smoke, as they were meant to.", [fx.combat("raiders")], [
              { who: "npc:nell", text: "I'm sorry. They said they'd leave me be.", mood: "afraid", gesture: "turn-away" },
            ], 6),
            r("She's gone before dawn, and so is the scrip box.", [fx.scrip([-30, -15]), fx.nerve("all", -3)], [
              { who: "leader", text: "Scrip box is gone. She knew where it was.", mood: "angry", alt: { greedy: "Every coin. She took every coin." } },
            ], 3),
          ],
        },
      },
      {
        id: "sit",
        label: "Have someone sit with her by the fire",
        hours: 1,
        tag: "help",
        check: { kind: "calm", dc: 11, target: "Nell" },
        results: {
          genuine: [
            r("{by} helps her burn the rest, gently. Then she comes.", [fx.recruit("nell"), fx.nerve("all", 2)], [
              { who: "by", text: "We'll burn them together. Say the names.", mood: "calm", gesture: "kneel", alt: { pious: "We'll burn them together. Each one gets a prayer." } },
              { who: "npc:nell", text: "Mrs. Orla Pike. Eleven Tanner Row.", mood: "grieving" },
            ], 1, "success"),
            r("She clutches the sack and won't be moved.", [fx.nerve({ trait: "kind" }, -3)], [
              { who: "npc:nell", text: "No. No. I'd only fail you too.", mood: "afraid", gesture: "clutch" },
            ], 1, "fail"),
          ],
          trap: [
            r("Sitting close, {by} sees the book of names. Nell breaks.", [fx.nerve("all", 2)], [
              { who: "npc:nell", text: "Go. They're watching the smoke. Go.", mood: "afraid", gesture: "point" },
            ], 1, "success"),
            r("{by} sits too long. Riders come to the smoke.", [fx.combat("raiders")], [
              { who: "npc:nell", text: "Stay. Stay a little longer. Please.", mood: "pleading" },
            ], 1, "fail"),
          ],
        },
      },
      {
        id: "pass",
        label: "Drive on",
        tag: "refuse",
        results: {
          genuine: [
            r("Behind you, the fire flares as the whole sack goes in.", [fx.nerve({ trait: "kind" }, -4), fx.flag("refusedGenuine")], [
              { who: "npc:nell", text: "Then there's no one left to deliver to.", mood: "grieving", gesture: "turn-away" },
            ]),
          ],
          trap: [
            r("On the ridge, riders sit their horses, watching the smoke.", [fx.nerve("all", -1)], [
              { who: "leader", text: "Look. The ridge. Keep moving.", mood: "cold", alt: { coward: "They're watching us. Please, faster." } },
            ]),
          ],
        },
      },
    ],
  },
];

export const COMPANION_SCENES: SceneDef[] = [...COMPLICATIONS, ...MEETINGS, ...RETURNS];
