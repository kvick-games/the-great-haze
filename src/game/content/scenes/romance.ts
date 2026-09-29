// Romance on the trail: sparks, lovers, proposals, weddings, jealousy, rival
// suitors, break-ups, reconciliations, quarrels and friendships. The relationship
// engine (relationships.ts) queues these by id with the people already chosen:
// a and b are the pair, actor is whoever moved first, and other is the third
// person when there is one. Relationship changes go through fx.rel, which already
// records "began courting", "married" and so on in each person's history; fx.note
// adds the moments that are more than a change of kind.

import type { Cond, SceneDef, Trait } from "../../types.ts";
import { fx, o, t } from "../fx.ts";

const hasOf = (who: "a" | "b" | "other", trait: Trait): Cond => ({ ofWho: who, has: trait });
const aHas = (trait: Trait): Cond => hasOf("a", trait);
const bHas = (trait: Trait): Cond => hasOf("b", trait);
const otherHas = (trait: Trait): Cond => hasOf("other", trait);
const affAB = (min?: number, max?: number): Cond => ({ aff: { a: "a", b: "b", min, max } });

// ---------------------------------------------------------------------------
// 1. A courtship begins
// ---------------------------------------------------------------------------

const COURTSHIP_SPARK: SceneDef = {
  id: "rel-courtship-spark",
  kind: "crisis",
  weight: 0,
  bound: true,
  title: "A Seat by the Fire",
  intro: [
    "{a} has found reasons to walk beside {b}'s wagon all day.",
    "Tonight at the fire, {a} finally says something that isn't about the road.",
  ],
  talk: [
    {
      who: "a",
      text: "I kept you a seat. Nearest the fire.",
      vary: ["Sit here. I kept it warm for you.", "There's room by me. There's always room."],
      mood: "calm",
      gesture: "beckon",
      alt: {
        charming: "Warmest seat on the whole trail. I kept it for you.",
        coward: "There's room. If you want. You don't have to.",
        hothead: "Sit by me. Unless you'd rather freeze out of pride.",
        stoic: "Seat's here, if you want it.",
        pious: "Sit with me? I prayed you would, if I'm honest.",
        haunted: "Sit with me. The dark is quieter when you're near.",
        greedy: "Best spot at the fire. I had to fight for it.",
        veteran: "Sit. I learned to say things before morning comes.",
      },
    },
    {
      who: "b",
      text: "You kept it all evening?",
      vary: ["All evening? For me?"],
      mood: "calm",
      alt: {
        paranoid: "Why? What is it you want from me?",
        kind: "That's sweet of you, {a}. Truly.",
        coward: "Me? Are you sure you mean me?",
        stoic: "...All right.",
        charming: "Took you long enough to ask.",
        haunted: "Nobody's kept anything for me in a long time.",
      },
    },
    {
      who: "a",
      text: "I'd keep it every night, if you'd let me.",
      mood: "pleading",
      alt: { hothead: "Every night. Say yes before I lose my temper with myself.", stoic: "Every night. If that suits you." },
    },
    {
      who: "b",
      text: "Ask me again tomorrow. If we're both still here.",
      mood: "calm",
      alt: { charming: "Ask me every night, then. I'll say yes every night.", haunted: "Tomorrow. If the red lets us have one." },
    },
  ],
  options: [
    {
      id: "encourage",
      label: "Tell them the road is better with something to walk toward",
      results: {
        any: [
          t(o("They sit close enough that their shoulders touch. The whole fire seems warmer for it.", [fx.bond("a", "b", 6), fx.nerve("a", 3), fx.nerve("b", 3), fx.trust("a", 2)], 3, [{ if: affAB(45), add: 2 }]), [
            { who: "leader", text: "Go on. Somebody on this train should have something good.", mood: "calm", alt: { stoic: "Sit. Both of you. That's an order.", kind: "Go on. You two deserve a little good." } },
            { who: "b", text: "Well. If the wagon-master says so.", mood: "calm", gesture: "shrug", alt: { coward: "If you think it's all right... then yes." } },
            { who: "a", text: "They say so. I say so. Sit.", mood: "calm", gesture: "beckon" },
          ]),
          t(o("{b} sits, blushing to the ears, and nobody knows where to look for a while.", [fx.bond("a", "b", 3), fx.nerve("b", -1), fx.nerve("a", 2)], 2), [
            { who: "leader", text: "Don't mind us. We're all looking at the fire.", mood: "sly" },
            { who: "b", text: "Everyone is not looking at the fire.", mood: "afraid", alt: { hothead: "Stop grinning, the lot of you.", charming: "Let them look. I'd look too." } },
          ]),
          t(o("{b} smiles, but stays standing. Not yet, the smile says. {a} takes it well, mostly.", [fx.bond("a", "b", -2), fx.nerve("a", -3), fx.note("a", "Was asked by {b} to slow down.")], 1, [{ if: bHas("coward"), add: 1 }, { if: bHas("paranoid"), add: 1 }, { if: affAB(undefined, 38), add: 1 }]), [
            { who: "b", text: "I like you, {a}. I'm just not ready.", mood: "pleading", alt: { stoic: "Not yet. Don't ask why.", haunted: "Everyone I sit beside ends up gone. Not yet." } },
            { who: "a", text: "Then I'll keep the seat anyway.", mood: "grieving", alt: { hothead: "Fine. Fine. It's only a seat.", greedy: "Suit yourself. It's a good seat." } },
          ]),
        ],
      },
    },
    {
      id: "tease",
      label: "Rib them in front of the whole fire",
      hint: "A laugh is worth a lot out here. So is dignity.",
      results: {
        any: [
          t(o("The fire roars with laughter. {b} laughs hardest, and sits down on {a}'s coat.", [fx.nerve("all", 2), fx.bond("a", "b", 4)], 3, [{ if: bHas("charming"), add: 2 }]), [
            { who: "leader", text: "Careful, {b}. That seat comes with a lifetime of snoring.", mood: "sly" },
            { who: "b", text: "I'll risk it. I've heard worse in the fog.", mood: "sly", alt: { kind: "I'll risk it. I snore too.", haunted: "Snoring's a comfort. It means breathing." } },
          ]),
          t(o("{a} flushes red, and not with pleasure. The joke lands on the wrong person.", [fx.trust("a", -3), fx.nerve("a", -2), fx.nerve("all", 1)], 2, [{ if: aHas("hothead"), add: 2 }, { if: aHas("paranoid"), add: 1 }]), [
            { who: "leader", text: "Look at that, {a}'s gone the colour of the sky.", mood: "sly" },
            { who: "a", text: "Thanks for that. Really. Thanks.", mood: "cold", gesture: "turn-away", alt: { hothead: "Say one more word. Just one.", coward: "I... I'll go check the horses." } },
          ]),
          t(o("{b} laughs, then says yes out loud, just to spite you. The camp cheers.", [fx.bond("a", "b", 6), fx.nerve("a", 3), fx.nerve("b", 2), fx.nerve("all", 1)], 1), [
            { who: "b", text: "Yes, {a}. Yes. Now the whole train knows.", mood: "sly", gesture: "point" },
            { who: "a", text: "Did you just... say yes to spite them?", mood: "calm" },
            { who: "b", text: "Partly.", mood: "sly", alt: { stoic: "Mostly not.", kind: "Only a little. Mostly because I wanted to." } },
          ]),
        ],
      },
    },
    {
      id: "warn",
      label: "Warn them: the road does not forgive a distracted mind",
      results: {
        any: [
          t(o("They take it seriously. They sit together anyway, but with their boots on.", [fx.bond("a", "b", 3), fx.trust("a", 2), fx.trust("b", 2), fx.nerve("a", -1)], 3, [{ if: aHas("veteran"), add: 1 }, { if: aHas("stoic"), add: 1 }]), [
            { who: "leader", text: "Keep one eye on each other and one on the dark.", mood: "calm", alt: { veteran: "I've buried men who were thinking of someone else." } },
            { who: "a", text: "Understood. Both eyes, when it counts.", mood: "calm", alt: { hothead: "I know what's out there. I'm not a child." } },
          ]),
          t(o("{a} hears a lecture where you meant a kindness. The evening sours.", [fx.trust("a", -4), fx.nerve("a", -2)], 2, [{ if: aHas("hothead"), add: 2 }]), [
            { who: "leader", text: "The Haze doesn't care who's in love.", mood: "cold" },
            { who: "a", text: "Neither do you, apparently.", mood: "angry", gesture: "turn-away", alt: { coward: "Right. Sorry. I'll... sorry.", greedy: "Noted. Anything else you'd like to take?" } },
          ]),
          t(o("{b} takes the warning to heart and steps back. Friends, then. For now.", [fx.rel("a", "b", "friend"), fx.nerve("a", -4), fx.note("a", "Lost {b} to a warning about the road."), fx.note("b", "Stepped back from {a}, afraid of the road.")], 1, [{ if: bHas("coward"), add: 2 }, { if: bHas("haunted"), add: 1 }]), [
            { who: "b", text: "They're right. I can't lose anyone else. Not like that.", mood: "grieving" },
            { who: "a", text: "You won't lose me.", mood: "pleading" },
            { who: "b", text: "Everyone says that out here.", mood: "grieving", gesture: "turn-away" },
          ]),
        ],
      },
    },
    {
      id: "watch",
      label: "Put them on the same night watch",
      hint: "Time alone together. The dark will be watching too.",
      results: {
        any: [
          t(o("They talk the whole watch through, and the fire never dies. They come in at dawn, glowing.", [fx.bond("a", "b", 8), fx.nerve("a", 3), fx.nerve("b", 3), fx.res("torches", -1)], 3), [
            { who: "a", text: "We kept it burning. The whole night.", mood: "calm" },
            { who: "b", text: "We didn't notice the cold once.", mood: "calm", alt: { stoic: "It was a good watch.", haunted: "Nothing called. First night in weeks." } },
          ]),
          t(o("Somewhere past midnight the red comes close to their fire.", [fx.bond("a", "b", 3), fx.scene("rel-watch-together", 1, true)], 2), [
            { who: "leader", text: "Second watch is yours. Together.", mood: "calm" },
            { who: "b", text: "Together. All right.", mood: "calm", alt: { coward: "The whole second watch? In the dark?" } },
          ]),
          t(o("They watch each other instead of the dark. By dawn a wheel is scored with red handprints.", [fx.bond("a", "b", 5), fx.nerve("all", -2), fx.trust("a", -2)], 1), [
            { who: "leader", text: "Whose watch was it? Whose?", mood: "angry", gesture: "point" },
            { who: "a", text: "Ours. We... we didn't see anything.", mood: "afraid" },
          ]),
        ],
      },
    },
    {
      id: "quiet",
      label: "Say nothing. Let them find their own way",
      results: {
        any: [
          t(o("You keep your eyes on your coffee. Later you see two shapes sharing one blanket.", [fx.bond("a", "b", 4), fx.nerve("a", 2)], 3), [
            { who: "b", text: "Just the seat, mind. Just tonight.", mood: "sly" },
            { who: "a", text: "Just the seat.", mood: "calm", alt: { charming: "Just the seat. And maybe the blanket.", hothead: "Just the seat. I'm not pushing." } },
          ]),
          t(o("The camp gossips while you say nothing. {a} hears every word of it.", [fx.nerve("a", -2), fx.bond("a", "b", 2)], 2, [{ if: aHas("paranoid"), add: 2 }]), [
            { who: "a", text: "They're all talking about us.", mood: "afraid", alt: { paranoid: "Everyone's watching. Everyone's always watching.", hothead: "Let them talk. I'll give them something to talk about." } },
            { who: "b", text: "Let them. It's better than talking about the fog.", mood: "calm" },
          ]),
          t(o("{b} makes an excuse and goes to bed early. The seat stays empty.", [fx.bond("a", "b", -2), fx.nerve("a", -3), fx.note("a", "Kept a seat by the fire that {b} never took.")], 1, [{ if: bHas("stoic"), add: 1 }, { if: bHas("coward"), add: 1 }]), [
            { who: "b", text: "I'm tired, {a}. Goodnight.", mood: "calm", gesture: "turn-away" },
            { who: "a", text: "Goodnight.", mood: "grieving" },
          ]),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// (extra) A shared watch, queued by the courtship and by lovers
// ---------------------------------------------------------------------------

const SHARED_WATCH: SceneDef = {
  id: "rel-watch-together",
  kind: "crisis",
  weight: 0,
  bound: true,
  title: "Two on Watch",
  intro: [
    "Past midnight. {a} and {b} share the watch with one blanket and one lantern.",
    "The red on the ridge has come down the slope while they talked.",
  ],
  talk: [
    { who: "b", text: "Did you hear that? It said my name.", mood: "afraid", alt: { stoic: "Something out there just said my name.", paranoid: "It knows my name. How does it know my name?" } },
    { who: "a", text: "It said it in my voice. Didn't it.", mood: "afraid", alt: { veteran: "Don't answer it. Whatever it says. Don't answer.", hothead: "Let it come. I'll put a torch in its mouth." } },
    { who: "b", text: "Don't let go of my hand.", mood: "pleading", gesture: "clutch", alt: { stoic: "Hold on to me.", charming: "Keep hold of me. I mean it this time." } },
  ],
  options: [
    {
      id: "stoke",
      label: "Go out, build the fire up, and sit the watch with them",
      cost: { torches: 1 },
      hours: 1,
      results: {
        any: [
          t(o("The fire climbs and the voice goes quiet. The three of you watch until the red draws back.", [fx.nerve("a", 3), fx.nerve("b", 3), fx.bond("a", "b", 4), fx.nerve("leader", -2), fx.trust("a", 2), fx.trust("b", 2)], 3), [
            { who: "leader", text: "Shift over. There's room for three on that log.", mood: "calm" },
            { who: "a", text: "Thank God. Thank God it's you.", mood: "grieving", alt: { stoic: "Good. Sit.", hothead: "About time somebody else heard it." } },
          ]),
          t(o("The voice keeps talking under the crackle, now in your voice. Nobody sleeps.", [fx.nerve("a", -2), fx.nerve("b", -2), fx.nerve("leader", -3), fx.bond("a", "b", 5)], 1), [
            { who: "b", text: "Now it's you. It's using you now.", mood: "afraid" },
            { who: "leader", text: "Then don't listen to me. Listen to {a}.", mood: "calm" },
          ]),
        ],
      },
    },
    {
      id: "wake",
      label: "Wake the whole camp",
      results: {
        any: [
          t(o("Everyone is up with torches. The red withdraws from so many lights. Tomorrow will be a tired day.", [fx.nerve("all", -1), fx.bond("a", "b", 3), fx.trust("a", 1)], 2), [
            { who: "leader", text: "Up! Everyone up, torches out!", mood: "afraid" },
            { who: "b", text: "It's going. Look. It's going back.", mood: "afraid", gesture: "point" },
          ]),
          t(o("By the time the camp is up there is nothing there. Someone grumbles about lovers seeing ghosts.", [fx.trust("a", -2), fx.nerve("b", -2), fx.nerve("a", -1)], 2, [{ if: aHas("paranoid"), add: 1 }]), [
            { who: "a", text: "It was there. We both heard it.", mood: "pleading", alt: { hothead: "It was THERE. Don't look at me like that." } },
            { who: "b", text: "Maybe we just wanted an excuse to hold on.", mood: "grieving" },
          ]),
        ],
      },
    },
    {
      id: "trust",
      label: "Let them hold it together. It's their watch",
      results: {
        any: [
          t(o("They hold hands till dawn and sing badly at the dark. It never comes closer.", [fx.bond("a", "b", 8), fx.nerve("a", 2), fx.nerve("b", 2)], 3, [{ if: affAB(55), add: 1 }]), [
            { who: "a", text: "Sing something. Anything. Drown it out.", mood: "afraid" },
            { who: "b", text: "I only know hymns and filthy songs.", mood: "sly", alt: { pious: "I only know hymns. They'll have to do.", stoic: "I don't sing." } },
            { who: "a", text: "Both. Alternate them.", mood: "calm" },
          ]),
          t(o("{a} stands and takes three steps toward the voice before {b} drags them back by the collar.", [fx.bond("a", "b", 10), fx.nerve("a", -5), fx.nerve("b", -4), fx.note("b", "Pulled {a} back from the Haze on a night watch.")], 1, [{ if: aHas("haunted"), add: 1 }]), [
            { who: "a", text: "It was my mother. It sounded just like her.", mood: "grieving" },
            { who: "b", text: "Your mother's dead, {a}. I'm not. Stay.", mood: "angry", gesture: "clutch" },
          ]),
          t(o("{b} breaks, sobbing, and {a} spends the watch holding them. The dark goes unwatched.", [fx.nerve("b", -4), fx.bond("a", "b", 5), fx.gap(-2)], 1, [{ if: bHas("coward"), add: 2 }]), [
            { who: "b", text: "I can't. I can't sit out here.", mood: "afraid" },
            { who: "a", text: "Then sit in here. With me.", mood: "calm", gesture: "clutch" },
          ]),
        ],
      },
    },
    {
      id: "relieve",
      label: "Send them to bed and take the rest of the watch yourself",
      hours: 2,
      results: {
        any: [
          t(o("They go without arguing. You sit alone with the voice until dawn. It knows your name too.", [fx.nerve("leader", -4), fx.nerve("a", 2), fx.nerve("b", 2), fx.trust("a", 2), fx.trust("b", 2)], 3), [
            { who: "leader", text: "Bed. Both of you. I've got it.", mood: "cold" },
            { who: "b", text: "Are you sure? It's... it's saying things.", mood: "afraid" },
            { who: "leader", text: "I know. Go.", mood: "calm", gesture: "turn-away" },
          ]),
          t(o("{a} will not leave {b}'s side, and {b} will not leave {a}'s. Three of you keep the watch.", [fx.nerve("leader", -2), fx.bond("a", "b", 4), fx.trust("a", 1)], 1, [{ if: affAB(55), add: 1 }]), [
            { who: "a", text: "Not without {b}.", mood: "cold", alt: { kind: "We'll stay with you. Nobody sits out here alone." } },
            { who: "b", text: "Not without {a}.", mood: "cold" },
          ]),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// 2. Lovers
// ---------------------------------------------------------------------------

const LOVERS_MOMENT: SceneDef = {
  id: "rel-lovers-moment",
  kind: "crisis",
  weight: 0,
  bound: true,
  title: "Behind the Supply Wagon",
  intro: [
    "Checking the tethers by lantern, you come round the supply wagon and find {a} and {b} under one blanket.",
    "They spring apart. Then {a} steadies, and asks you for something.",
  ],
  talk: [
    { who: "b", text: "Oh. It's you.", mood: "afraid", alt: { coward: "Oh God. We weren't... we were only...", charming: "Evening, wagon-master. Lovely night for tethers.", stoic: "Wagon-master." } },
    {
      who: "a",
      text: "We want to share a wagon. From tonight.",
      vary: ["We'd like to bunk together. From tonight on.", "We want a wagon. The two of us."],
      mood: "pleading",
      alt: {
        hothead: "We're sharing a wagon. I'm telling you, not asking.",
        pious: "We'd share a wagon, if it isn't a sin to ask.",
        coward: "Could we... would it be all right to share a wagon?",
        greedy: "We want the dry wagon. The one with the good canvas.",
        veteran: "Request a shared billet. The two of us.",
      },
    },
    { who: "a", text: "Or an hour. One hour where nobody needs us.", mood: "pleading", alt: { stoic: "Or an hour. That's all.", haunted: "One hour where the red isn't the only thing I see." } },
    { who: "b", text: "We know what's behind us. That's why.", mood: "grieving", alt: { charming: "Life's short. Shorter out here. Be a sport." } },
  ],
  options: [
    {
      id: "wagon",
      label: "Give them a wagon of their own",
      hint: "Everyone else sleeps tighter.",
      results: {
        any: [
          t(o("They move their bedrolls before you finish the sentence. The rest of the train squeezes up, grumbling kindly.", [fx.bond("a", "b", 6), fx.trust("a", 4), fx.trust("b", 3), fx.nerve("a", 3), fx.nerve("b", 3)], 3), [
            { who: "leader", text: "The tail wagon. Mind the leak on the left side.", mood: "calm" },
            { who: "a", text: "We'll sleep on the right, then.", mood: "sly", alt: { stoic: "Thank you. We won't forget it.", kind: "Thank you. Truly. We'll make it up to everyone." } },
          ]),
          t(o("The others are packed four to a wagon now. Someone says it out loud at breakfast.", [fx.bond("a", "b", 5), fx.trust("a", 3), fx.trust("b", 3), fx.nerve("random", -3)], 2), [
            { who: "leader", text: "They get the tail wagon. Squeeze up.", mood: "cold" },
            { who: "b", text: "We didn't mean to put anyone out.", mood: "pleading", alt: { greedy: "They'll live. We asked first.", hothead: "If anyone's got a complaint, they can bring it to me." } },
          ]),
          t(o("Alone in the dark wagon, {b} hears the fog brush the canvas all night. {a} holds on.", [fx.bond("a", "b", 7), fx.nerve("b", -3), fx.trust("a", 2)], 1, [{ if: bHas("haunted"), add: 2 }, { if: bHas("coward"), add: 1 }]), [
            { who: "b", text: "It's louder in here. Without the others.", mood: "afraid" },
            { who: "a", text: "Then listen to me instead. I'll keep talking.", mood: "calm", alt: { stoic: "I'm here. That's all. I'm here." } },
          ]),
        ],
      },
    },
    {
      id: "hour",
      label: "Take their watch yourself and give them the hour",
      hours: 1,
      results: {
        any: [
          t(o("You stand their watch. When they come back they are quiet and easy with each other.", [fx.nerve("a", 5), fx.nerve("b", 5), fx.bond("a", "b", 5), fx.nerve("leader", -2), fx.trust("a", 2), fx.trust("b", 2)], 3), [
            { who: "leader", text: "One hour. I'll be on the ridge.", mood: "calm" },
            { who: "a", text: "We owe you.", mood: "calm", alt: { charming: "We owe you a very large drink.", greedy: "We'll pay you back. Somehow. Eventually." } },
          ]),
          t(o("Forty minutes in, something moves at the treeline. You shout, and they come running half-dressed.", [fx.nerve("all", -2), fx.bond("a", "b", 3), fx.nerve("leader", -2)], 1), [
            { who: "leader", text: "Up! Everyone! Treeline!", mood: "afraid", gesture: "point" },
            { who: "b", text: "We had forty minutes. Forty. It's something.", mood: "grieving", alt: { hothead: "Of course. Of course it came now." } },
          ]),
        ],
      },
    },
    {
      id: "feast",
      label: "Open a ration tin for a small feast between the two of them",
      cost: { rations: 1 },
      results: {
        any: [
          t(o("Peaches, by lantern light. {a} feeds {b} the last slice with a fork bent from a nail.", [fx.bond("a", "b", 6), fx.nerve("a", 4), fx.nerve("b", 4), fx.trust("a", 2)], 3), [
            { who: "b", text: "Peaches. Where on earth did you find peaches?", mood: "calm" },
            { who: "leader", text: "Don't tell anyone. And don't ask.", mood: "sly" },
          ]),
          t(o("They share it. The smell carries, and in the morning somebody counts the tins twice.", [fx.bond("a", "b", 5), fx.nerve("a", 3), fx.nerve("b", 3), fx.trust("random", -3)], 2), [
            { who: "a", text: "Everyone's going to know, aren't they.", mood: "sly" },
            { who: "leader", text: "Eat it fast, then. Evidence goes in the fire.", mood: "sly", alt: { stoic: "Eat. I'll answer for it." } },
          ]),
        ],
      },
    },
    {
      id: "duty",
      label: "Duty first. Back to your posts",
      hint: "The Haze doesn't give anyone a night off.",
      results: {
        any: [
          t(o("They go back to their posts without a word. There is no anger in it. Just tiredness.", [fx.trust("a", -1), fx.trust("b", -1), fx.bond("a", "b", 2), fx.nerve("a", -1)], 2, [{ if: aHas("veteran"), add: 2 }, { if: aHas("stoic"), add: 2 }]), [
            { who: "leader", text: "Not tonight. Posts. Both of you.", mood: "cold" },
            { who: "a", text: "Understood.", mood: "cold", alt: { veteran: "Fair. I'd have said the same, once.", kind: "You're right. I'm sorry. Posts." } },
          ]),
          t(o("They obey. They also stop meeting your eyes, both of them, for days.", [fx.trust("a", -5), fx.trust("b", -4), fx.nerve("a", -2), fx.nerve("b", -2)], 2, [{ if: aHas("hothead"), add: 2 }]), [
            { who: "a", text: "Posts. Right. Everything's posts.", mood: "angry", gesture: "turn-away", alt: { hothead: "One hour. One. You'd begrudge us that?" } },
            { who: "b", text: "Come on, {a}. Don't.", mood: "grieving" },
          ]),
          t(o("An hour later you find their posts empty, and the two of them back under the supply wagon.", [fx.trust("a", -2), fx.trust("b", -2), fx.bond("a", "b", 5), fx.nerve("a", 2), fx.nerve("b", 2)], 1, [{ if: bHas("charming"), add: 1 }]), [
            { who: "b", text: "We were very quick about it. Honestly.", mood: "sly" },
            { who: "leader", text: "Posts. Now. Before I lose my temper.", mood: "angry", alt: { kind: "Go on. Posts. I didn't see you." } },
          ]),
        ],
      },
    },
    {
      id: "saw-nothing",
      label: "Tell them you saw nothing, and walk on",
      results: {
        any: [
          t(o("You walk on with your lantern. Behind you, someone laughs softly into a blanket.", [fx.bond("a", "b", 4), fx.trust("a", 2), fx.trust("b", 2), fx.nerve("a", 1)], 3), [
            { who: "leader", text: "Tethers are fine. I saw tethers. Goodnight.", mood: "sly", gesture: "turn-away" },
            { who: "b", text: "Goodnight, wagon-master.", mood: "sly", alt: { coward: "Thank you. Oh, thank you.", kind: "Goodnight. And thank you." } },
          ]),
          t(o("Someone else did see. By breakfast the whole train is smirking at {a} and {b}.", [fx.bond("a", "b", 2), fx.nerve("a", -2), fx.nerve("b", -2), fx.note("b", "Was the talk of the train after a night behind the supply wagon.")], 1, [{ if: bHas("paranoid"), add: 1 }]), [
            { who: "b", text: "Who told? Somebody told.", mood: "angry", alt: { paranoid: "Someone's been watching us. I knew it.", charming: "Well. At least they're smiling at something." } },
            { who: "a", text: "Nobody told. Everyone just knows everything out here.", mood: "calm", gesture: "shrug" },
          ]),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// 3. A proposal
// ---------------------------------------------------------------------------

/** Mods that make {b} more likely to say no or ask to wait. */
const NO_MODS = [
  { if: bHas("coward"), add: 2 },
  { if: bHas("stoic"), add: 1 },
  { if: affAB(undefined, 70), add: 2 },
];
const WAIT_MODS = [
  { if: bHas("haunted"), add: 1 },
  { if: bHas("paranoid"), add: 1 },
  { if: bHas("pious"), add: 1 },
];
const YES_MODS = [
  { if: affAB(80), add: 2 },
  { if: bHas("charming"), add: 1 },
  { if: bHas("kind"), add: 1 },
];

const PROPOSAL: SceneDef = {
  id: "rel-proposal",
  kind: "crisis",
  weight: 0,
  bound: true,
  title: "A Question at Dusk",
  intro: [
    "{a} finds you at the lead wagon, turning something small and bright over and over in their fingers.",
    "It is a linchpin, hammered into a ring.",
  ],
  talk: [
    {
      who: "a",
      text: "I'm going to ask {b} to marry me. Tonight.",
      vary: ["Tonight I'm asking {b}. To marry me.", "I want to marry {b}. I'm asking tonight."],
      mood: "afraid",
      alt: {
        hothead: "I'm marrying {b}. Tonight. Don't try to talk me out of it.",
        coward: "I think I want to ask {b}... to marry me. Tonight. Maybe.",
        charming: "I'm going to ask {b} a very important question.",
        stoic: "I'm asking {b} to marry me.",
        pious: "I want to marry {b}. Properly. Before God, such as He is out here.",
        veteran: "Seen too many wait for a better day. I'm asking {b} tonight.",
        greedy: "Made the ring myself. Cost me a good linchpin.",
      },
    },
    { who: "a", text: "I want you to say the words over us.", mood: "pleading", alt: { stoic: "You'd say the words. If {b} says yes.", haunted: "Somebody should say the words while there's time." } },
    {
      who: "leader",
      text: "Out here? With the Haze three days behind us?",
      vary: ["Now? With the red at our heels?"],
      mood: "calm",
      alt: { kind: "Out here? Oh, {a}.", veteran: "Out here. With the red at our backs." },
    },
    { who: "a", text: "Out here is all we've got.", mood: "calm", alt: { hothead: "Out here is the only place there is." } },
  ],
  options: [
    {
      id: "officiate",
      label: "Stand up in front of everyone and marry them yourself",
      hint: "An hour, and a little from the stores.",
      hours: 1,
      cost: { rations: 1 },
      results: {
        any: [
          t(o("{b} says yes before {a} finishes the question. You say the words as fast as you can remember them.", [fx.rel("a", "b", "spouses"), fx.bond("a", "b", 8), fx.nerve("all", 2), fx.trust("a", 4), fx.trust("b", 3), fx.scene("rel-wedding", 1, true)], 3, YES_MODS), [
            { who: "a", text: "{b}. Will you...", mood: "afraid", gesture: "kneel" },
            { who: "b", text: "Yes. Yes, you fool. Get up.", mood: "calm", alt: { stoic: "Yes.", charming: "Took you long enough. Yes.", pious: "Yes. Before God and all of you, yes." } },
            { who: "leader", text: "Then let's do it properly. Everyone, gather round.", mood: "calm", gesture: "beckon" },
          ]),
          t(o("{b} says yes, and they want it plain. Four sentences, a handshake, and back to the wagons.", [fx.rel("a", "b", "spouses"), fx.bond("a", "b", 8), fx.nerve("all", 2), fx.trust("a", 3), fx.trust("b", 3), fx.note("a", "Was married to {b} in four sentences at dusk.")], 2, [{ if: bHas("stoic"), add: 1 }]), [
            { who: "b", text: "Yes. But keep it short. The light's going.", mood: "calm" },
            { who: "leader", text: "By the power of nobody at all, you're married.", mood: "sly", alt: { pious: "Before God and this train, you're married. Amen." } },
          ]),
          t(o("{b} looks at the ring, then at the red sky, and says no. In front of everyone.", [fx.bond("a", "b", -8), fx.nerve("a", -6), fx.nerve("b", -3), fx.trust("a", -2), fx.note("a", "Asked {b} to marry, in front of the train. {b} said no."), fx.note("b", "Refused {a}'s proposal in front of everyone.")], 1, NO_MODS), [
            { who: "b", text: "No. I'm sorry. Not like this. Not out here.", mood: "grieving", alt: { coward: "I can't. What if I... what if you... I can't.", stoic: "No." } },
            { who: "a", text: "Right. Of course. Everyone, back to... whatever.", mood: "grieving", gesture: "turn-away" },
          ]),
          t(o("{b} closes {a}'s hand over the ring. Ask again past the Threshold, {b} says.", [fx.bond("a", "b", 2), fx.nerve("a", -2), fx.note("a", "Was asked by {b} to ask again past the Threshold.")], 1, WAIT_MODS), [
            { who: "b", text: "Keep it. Ask me again when we're through.", mood: "pleading", alt: { haunted: "Ask me where the sky is blue again. Not here." } },
            { who: "a", text: "That's not a no.", mood: "calm" },
            { who: "b", text: "It's not a no.", mood: "calm" },
          ]),
        ],
      },
    },
    {
      id: "bless",
      label: "Give your blessing, and let {a} ask in private",
      results: {
        any: [
          t(o("An hour later {a} and {b} walk back into the firelight with their hands locked tight.", [fx.rel("a", "b", "spouses"), fx.bond("a", "b", 6), fx.nerve("a", 3), fx.nerve("b", 3), fx.trust("a", 2), fx.scene("rel-wedding", 1, true)], 2, YES_MODS), [
            { who: "leader", text: "You don't need my say-so. But you have it.", mood: "calm" },
            { who: "a", text: "{b} said yes. {b} said yes.", mood: "calm", alt: { stoic: "Yes. {b} said yes.", hothead: "Yes! Did everyone hear? Yes!" } },
          ]),
          t(o("{b} says yes quietly, under the wagon, and they tell nobody until morning.", [fx.rel("a", "b", "spouses"), fx.bond("a", "b", 6), fx.nerve("a", 3), fx.nerve("b", 2), fx.note("b", "Said yes to {a}, quietly, under a wagon.")], 2), [
            { who: "b", text: "We didn't want a fuss. We wanted each other.", mood: "calm" },
            { who: "a", text: "It was yes. It was always going to be yes.", mood: "calm" },
          ]),
          t(o("{a} comes back alone, the ring still in their fist, and sits a long time without speaking.", [fx.bond("a", "b", -5), fx.nerve("a", -5), fx.note("a", "Proposed to {b} in private, and was refused.")], 1, NO_MODS), [
            { who: "a", text: "Not now, {b} said. Maybe not ever.", mood: "grieving" },
            { who: "leader", text: "Out here, not now means everything and nothing.", mood: "calm", alt: { kind: "I'm sorry, {a}. I'm so sorry." } },
          ]),
        ],
      },
    },
    {
      id: "coach",
      label: "Help {a} find the right words first",
      hint: "Someone who knows how to talk walks {a} through it.",
      check: { kind: "persuade", dc: 11, exclude: ["a", "b"] },
      results: {
        any: [
          t(o("{a} says it plainly and well. {b} weeps a little and says yes.", [fx.rel("a", "b", "spouses"), fx.bond("a", "b", 10), fx.nerve("a", 4), fx.nerve("b", 3), fx.bond("a", "by", 4), fx.scene("rel-wedding", 1, true)], 2), [
            { who: "by", text: "Don't make a speech. Tell {b} one true thing.", mood: "calm", alt: { charming: "Say it like you'd say it to the fire. Just once.", pious: "Say what you'd say if it were your last night." } },
            { who: "a", text: "{b}. You're the reason I get up.", mood: "pleading", gesture: "kneel" },
            { who: "b", text: "Oh, you idiot. Yes.", mood: "grieving", alt: { stoic: "...Yes.", charming: "That's the best thing anyone's said to me. Yes." } },
          ], "success"),
          t(o("The words come out right. {b} says yes, and asks to be married where nobody is watching.", [fx.rel("a", "b", "spouses"), fx.bond("a", "b", 8), fx.nerve("a", 3), fx.nerve("b", 2)], 1), [
            { who: "by", text: "Slow. Breathe. Say {b}'s name first.", mood: "calm" },
            { who: "b", text: "Yes. Just us, though. Please.", mood: "calm" },
          ], "success"),
          t(o("{a} rehearses too hard and it comes out stiff as a contract. {b} laughs, then says not yet.", [fx.nerve("a", -3), fx.bond("a", "b", 1), fx.nerve("by", -1)], 2, WAIT_MODS), [
            { who: "a", text: "I hereby... I mean, I would like to propose...", mood: "afraid" },
            { who: "b", text: "Ask me again when you sound like yourself.", mood: "sly" },
          ], "fail"),
          t(o("{a} loses the thread, panics, and blurts it out. {b} goes very still, and says no.", [fx.nerve("a", -5), fx.bond("a", "b", -6), fx.note("a", "Botched a proposal to {b}, and was refused.")], 1, NO_MODS), [
            { who: "a", text: "Marry me. Or don't. I mean do. Please.", mood: "pleading", alt: { hothead: "Marry me! Why are you looking at me like that?" } },
            { who: "b", text: "I can't, {a}. I'm sorry.", mood: "grieving", gesture: "turn-away" },
          ], "fail"),
        ],
      },
    },
    {
      id: "wait",
      label: "Urge {a} to wait until the Haze is behind us",
      results: {
        any: [
          t(o("{a} pockets the ring. It will ride in a coat all the way to the Threshold, if they get there.", [fx.nerve("a", -2), fx.trust("a", 1), fx.bond("a", "b", 2), fx.note("a", "Promised to wait until the Haze was behind them before asking {b}.")], 2, [{ if: aHas("stoic"), add: 1 }, { if: aHas("veteran"), add: 1 }]), [
            { who: "leader", text: "Ask on the far side. Give {b} a future to say yes to.", mood: "calm" },
            { who: "a", text: "And if there isn't a far side?", mood: "grieving" },
            { who: "leader", text: "Then it won't matter what I told you.", mood: "grieving" },
          ]),
          t(o("{a} nods, and asks {b} that very night anyway. {b} says yes, and {a} avoids your eye.", [fx.rel("a", "b", "spouses"), fx.bond("a", "b", 6), fx.trust("a", -3), fx.nerve("a", 2)], 2, [{ if: aHas("hothead"), add: 2 }, { if: aHas("charming"), add: 1 }]), [
            { who: "a", text: "I heard you. I just didn't agree.", mood: "sly", alt: { hothead: "You don't get a say in this. Sorry." } },
            { who: "b", text: "Don't be angry. Be happy for us.", mood: "pleading" },
          ]),
          t(o("{a} takes it as a no from you, and it sours. The ring goes into the bottom of a trunk.", [fx.trust("a", -5), fx.nerve("a", -3)], 1, [{ if: aHas("paranoid"), add: 2 }]), [
            { who: "a", text: "Fine. We'll wait until we're dead, then.", mood: "angry", gesture: "turn-away", alt: { coward: "You're right. You're always right. Never mind." } },
          ]),
        ],
      },
    },
    {
      id: "forbid",
      label: "Forbid it. Not on this road, not under your command",
      hint: "People remember being told no.",
      results: {
        any: [
          t(o("They obey. They also look at you differently now, and so does the rest of the train.", [fx.trust("a", -7), fx.trust("b", -5), fx.nerve("a", -4), fx.nerve("b", -2), fx.bond("a", "b", 3)], 2), [
            { who: "leader", text: "No weddings. Not while the red is on us.", mood: "cold" },
            { who: "a", text: "You can't stop us wanting to.", mood: "cold", alt: { hothead: "You don't own us. You just lead the wagons.", stoic: "As you say." } },
          ]),
          t(o("They marry anyway, at night, with only a stranger's lantern for witness. You find out at breakfast.", [fx.rel("a", "b", "spouses"), fx.bond("a", "b", 8), fx.trust("a", -8), fx.trust("b", -6), fx.note("a", "Married {b} in secret, against the wagon-master's word.")], 2, [{ if: aHas("hothead"), add: 2 }, { if: affAB(80), add: 1 }]), [
            { who: "b", text: "We're married. You can shout now, if you like.", mood: "cold", alt: { charming: "Congratulate us. You'll feel better." } },
            { who: "leader", text: "...", mood: "cold", gesture: "turn-away" },
          ]),
          t(o("{b} looks almost relieved. {a} sees it, and something between them cracks.", [fx.bond("a", "b", -6), fx.trust("a", -5), fx.nerve("a", -4), fx.note("a", "Saw relief in {b}'s face when the wedding was forbidden.")], 1, [{ if: bHas("coward"), add: 2 }, { if: affAB(undefined, 70), add: 1 }]), [
            { who: "b", text: "Maybe the wagon-master's right. Maybe it's too soon.", mood: "afraid" },
            { who: "a", text: "You're glad. You're actually glad.", mood: "grieving" },
          ]),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// 4. A wedding
// ---------------------------------------------------------------------------

const MARRY = fx.rel("a", "b", "spouses");

const WEDDING: SceneDef = {
  id: "rel-wedding",
  kind: "crisis",
  weight: 0,
  bound: true,
  title: "The Linchpin Ring",
  intro: [
    "The train halts early. {a} and {b} stand between two wagons while the red sky dims behind them.",
    "Someone has scrubbed the axle grease off a hammered linchpin ring.",
  ],
  talk: [
    { who: "leader", text: "We haven't got a church. We've got a fire and each other.", mood: "calm", alt: { pious: "God's out here too. He'll have to do without a steeple." } },
    {
      who: "a",
      text: "{b}. I'll walk the rest of it with you.",
      vary: ["{b}. Whatever road is left, I'll walk it with you."],
      mood: "calm",
      alt: {
        hothead: "{b}. Anything that comes for you comes through me.",
        coward: "{b}. I'm scared of everything. Except this.",
        charming: "{b}. You're the best thing I found on this whole road.",
        stoic: "{b}. I'm yours. That's all.",
        haunted: "{b}. When I dream now, I dream of you.",
        veteran: "{b}. I've made promises under fire before. This one I'll keep.",
        greedy: "{b}. Everything I own is yours. It isn't much.",
      },
    },
    {
      who: "b",
      text: "All of it. However long it is.",
      mood: "calm",
      alt: {
        haunted: "However long it is. It won't be long enough.",
        kind: "All of it. And I'll carry you when you can't walk.",
        stoic: "All of it.",
        pious: "Till death. And past it, if He lets me.",
        charming: "All of it. You're not getting rid of me now.",
      },
    },
    { who: "leader", text: "Then it's done. Someone find the whiskey.", mood: "calm", alt: { stoic: "Then it's done.", kind: "Then it's done. Kiss, you two, before I cry." } },
  ],
  options: [
    {
      id: "feast",
      label: "Open the stores for a proper wedding supper",
      hours: 1,
      cost: { rations: 2 },
      results: {
        any: [
          t(o("Hot biscuits, tinned ham, a whole pot of coffee. For one night the train eats like people.", [MARRY, fx.nerve("all", 4), fx.bond("a", "b", 6), fx.bondAll(1), fx.note("a", "Married {b} with a linchpin ring and a supper for the whole train."), fx.note("b", "Married {a} with a linchpin ring and a supper for the whole train.")], 3), [
            { who: "b", text: "Ham. There's actual ham.", mood: "calm", alt: { greedy: "Is that ham? Is there more ham?" } },
            { who: "a", text: "To the wagon-master. And to getting there.", mood: "calm", gesture: "offer" },
          ]),
          t(o("Someone starts a song and everyone joins. Out in the dark, faintly, something joins in too.", [MARRY, fx.nerve("all", 2), fx.nerve("random", -3), fx.bond("a", "b", 6)], 1), [
            { who: "b", text: "Is someone out there singing?", mood: "afraid" },
            { who: "leader", text: "Sing louder. All of you. Louder.", mood: "cold" },
          ]),
        ],
      },
    },
    {
      id: "vigil",
      label: "Ring them with torches for a vigil through the first watch",
      hours: 1,
      cost: { torches: 1 },
      results: {
        any: [
          t(o("The torches hold the red at bay and {a} and {b} dance badly inside the ring of light.", [MARRY, fx.nerve("all", 3), fx.bond("a", "b", 7), fx.nerve("a", 2), fx.nerve("b", 2)], 3), [
            { who: "a", text: "I can't dance. I warned you I can't dance.", mood: "sly", alt: { charming: "I can dance. Watch this.", stoic: "I'll try. Don't laugh." } },
            { who: "b", text: "Nobody can. Out here, nobody minds.", mood: "calm" },
          ]),
          t(o("The fog comes right to the edge of the torchlight and waits there, watching the whole service.", [MARRY, fx.nerve("all", 1), fx.nerve("a", -2), fx.nerve("b", -2), fx.bond("a", "b", 9), fx.note("b", "Was married with the Haze watching from the edge of the torchlight.")], 1), [
            { who: "b", text: "It came to watch. Why did it come to watch?", mood: "afraid" },
            { who: "a", text: "Let it. Let it see what it can't have.", mood: "cold", alt: { coward: "Don't look at it. Look at me. Just me." } },
          ]),
        ],
      },
    },
    {
      id: "brief",
      label: "Brief and quiet. Words, a ring, back to the wagons",
      results: {
        any: [
          t(o("It takes a minute. They seem to prefer it that way. The ring fits.", [MARRY, fx.nerve("all", 1), fx.nerve("a", 3), fx.nerve("b", 3), fx.bond("a", "b", 4)], 3, [{ if: aHas("stoic"), add: 2 }, { if: bHas("stoic"), add: 1 }]), [
            { who: "leader", text: "Married. Mind your feet going back, it's dark.", mood: "calm" },
            { who: "b", text: "It fits. How did you know my size?", mood: "calm" },
            { who: "a", text: "I measured your glove while you slept.", mood: "sly" },
          ]),
          t(o("It's over before anyone can sit down. {a} wanted more than this, and doesn't say so.", [MARRY, fx.nerve("all", 1), fx.nerve("a", 1), fx.trust("a", -2), fx.bond("a", "b", 3)], 1, [{ if: aHas("charming"), add: 1 }, { if: aHas("pious"), add: 1 }]), [
            { who: "a", text: "That's it? That's all of it?", mood: "grieving" },
            { who: "b", text: "It's enough. I promise it's enough.", mood: "calm", gesture: "clutch" },
          ]),
        ],
      },
    },
    {
      id: "warn",
      label: "Remind them, gently, what the Haze does to the one left behind",
      hint: "True. Maybe not today.",
      results: {
        any: [
          t(o("They listen. Then they make a promise between them that you are not supposed to hear.", [MARRY, fx.bond("a", "b", 8), fx.nerve("all", -1), fx.nerve("a", 1), fx.note("a", "Vowed to {b} that neither would follow the other into the red.")], 2), [
            { who: "leader", text: "If one of you goes into the red, the other doesn't follow.", mood: "grieving" },
            { who: "b", text: "We know. We've talked about it.", mood: "calm" },
            { who: "a", text: "We won't follow. We'll just miss.", mood: "grieving", alt: { haunted: "I'd hear you calling. I'd try not to listen." } },
          ]),
          t(o("You meant it kindly. It lands like a shovel of earth on the celebration.", [MARRY, fx.nerve("all", -2), fx.trust("a", -3), fx.trust("b", -3), fx.bond("a", "b", 4)], 2, [{ if: aHas("hothead"), add: 1 }]), [
            { who: "a", text: "Today? You had to say that today?", mood: "angry", alt: { kind: "We know, wagon-master. Let us have tonight." } },
            { who: "leader", text: "Better today than the day it happens.", mood: "cold" },
          ]),
          t(o("{b} goes pale, and for a moment looks at the fog as though it is already calling.", [MARRY, fx.nerve("b", -4), fx.bond("a", "b", 6), fx.nerve("all", -1)], 1, [{ if: bHas("haunted"), add: 2 }, { if: bHas("coward"), add: 1 }]), [
            { who: "b", text: "I'd hear it in your voice, wouldn't I.", mood: "afraid" },
            { who: "a", text: "Then I'll never stop talking. Never.", mood: "pleading", gesture: "clutch" },
          ]),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// 5. Jealousy
// ---------------------------------------------------------------------------

const JEALOUS_SPAT: SceneDef = {
  id: "rel-jealous-spat",
  kind: "crisis",
  weight: 0,
  bound: true,
  title: "One Tin Cup",
  intro: [
    "{b} and {other} have been laughing over the same tin cup all evening.",
    "{a} has been watching every sip. Now {a} is at your elbow, voice low and tight.",
  ],
  talk: [
    {
      who: "a",
      text: "You see how {other} looks at {b}?",
      vary: ["Look at them. Look at how {other} looks at {b}."],
      mood: "cold",
      alt: {
        paranoid: "They think I don't see it. I see everything.",
        hothead: "One more laugh and I'll knock {other}'s teeth in.",
        coward: "It's nothing, isn't it? Tell me it's nothing.",
        kind: "I don't want to be like this. But look at them.",
        stoic: "Watch them. Tell me I'm wrong.",
        haunted: "I lost everyone once. I won't lose {b} too.",
        greedy: "{other} wants what's mine. Always has.",
      },
    },
    { who: "leader", text: "They're sharing coffee. That's all I see.", mood: "calm", alt: { paranoid: "Maybe. Maybe not. What do you want done?" } },
    { who: "a", text: "That's how it starts. Coffee.", mood: "cold", alt: { hothead: "Coffee. Then it's the blanket. I know how it goes." } },
    { who: "b", text: "{a}? Come and sit with us. {other}'s telling the mule story.", mood: "calm", gesture: "beckon" },
  ],
  options: [
    {
      id: "reassure",
      label: "Talk {a} down before this goes anywhere",
      check: { kind: "calm", dc: 11, exclude: ["a", "b", "other"] },
      results: {
        any: [
          t(o("{a} breathes out, laughs at themselves a little, and goes to sit down beside {b}.", [fx.nerve("a", 3), fx.bond("a", "b", 4), fx.trust("a", 2)], 3), [
            { who: "by", text: "{b} called you over. Not {other}. You.", mood: "calm", alt: { veteran: "If {b} wanted to hide it, they'd not call you over.", kind: "Go and sit with them. You'll see." } },
            { who: "a", text: "...They did, didn't they.", mood: "calm" },
          ], "success"),
          t(o("{a} settles, but keeps an eye on {other} all night. Calm on top, a splinter underneath.", [fx.nerve("a", 1), fx.bond("a", "other", -3)], 1), [
            { who: "by", text: "It's a cup of coffee. Let it be a cup of coffee.", mood: "calm" },
            { who: "a", text: "Fine. For tonight.", mood: "cold" },
          ], "success"),
          t(o("The more you say, the surer {a} becomes. Reassurance sounds like a cover story.", [fx.nerve("a", -3), fx.bond("a", "other", -6), fx.bond("a", "b", -3)], 2, [{ if: aHas("paranoid"), add: 2 }]), [
            { who: "by", text: "Honestly, it's nothing. You're imagining it.", mood: "pleading" },
            { who: "a", text: "Why are you defending them? What do you know?", mood: "angry", alt: { paranoid: "So you're in on it too. Of course you are." } },
          ], "fail"),
          t(o("{a} pushes past, grabs {other}'s cup and throws it into the fire.", [fx.bond("a", "other", -10), fx.bond("a", "b", -4), fx.nerve("all", -2), fx.note("other", "Had a cup thrown in the fire by a jealous {a}.")], 1, [{ if: aHas("hothead"), add: 2 }]), [
            { who: "a", text: "Get your own cup, {other}.", mood: "angry", gesture: "point" },
            { who: "other", text: "What the hell was that?", mood: "angry", alt: { coward: "I didn't... I wasn't doing anything!", kind: "{a}, it was just coffee. I swear it was." } },
          ], "fail"),
        ],
      },
    },
    {
      id: "aside-b",
      label: "Take {b} aside quietly and tell them how it looks",
      results: {
        any: [
          t(o("{b} goes straight to {a}, sits in their lap, and stays there all evening.", [fx.bond("a", "b", 6), fx.nerve("a", 3), fx.trust("b", 1)], 3, [{ if: bHas("kind"), add: 2 }, { if: affAB(55), add: 1 }]), [
            { who: "leader", text: "{a}'s watching you and {other}. Just so you know.", mood: "calm" },
            { who: "b", text: "Oh, {a}. Oh, for heaven's sake.", mood: "calm", alt: { charming: "Watching me? Then I'll give them something to watch." } },
          ]),
          t(o("{b} bristles at being managed. The laughter at the fire stops, and doesn't start again.", [fx.trust("b", -4), fx.bond("a", "b", -4), fx.nerve("b", -2)], 2, [{ if: bHas("hothead"), add: 2 }, { if: bHas("paranoid"), add: 1 }]), [
            { who: "b", text: "Did {a} send you? To spy on me?", mood: "angry", alt: { hothead: "I'll laugh with whoever I like. Tell {a} that." } },
            { who: "leader", text: "Nobody sent me. I'm keeping the peace.", mood: "cold" },
          ]),
          t(o("{b} is quiet a long time. Then admits there might be something. Might.", [fx.bond("a", "b", -6), fx.bond("b", "other", 4), fx.nerve("b", -3), fx.note("b", "Admitted to the wagon-master a spark with {other}.")], 1, [{ if: affAB(undefined, 40), add: 2 }, { if: bHas("charming"), add: 1 }]), [
            { who: "b", text: "I don't know. I don't know what it is.", mood: "grieving" },
            { who: "leader", text: "Then find out before {a} does.", mood: "cold" },
          ]),
        ],
      },
    },
    {
      id: "confront-other",
      label: "Tell {other} to give {b} some room",
      results: {
        any: [
          t(o("{other} flushes and apologises, and makes a point of sitting across the fire after that.", [fx.bond("a", "other", 3), fx.nerve("a", 2), fx.trust("other", -2)], 2, [{ if: otherHas("kind"), add: 2 }, { if: otherHas("coward"), add: 1 }]), [
            { who: "leader", text: "Sit somewhere else tonight, {other}. Humour me.", mood: "calm" },
            { who: "other", text: "Oh. Oh, I didn't think. I'm sorry.", mood: "afraid", alt: { stoic: "Understood.", charming: "Didn't mean to cause trouble. I'll behave." } },
          ]),
          t(o("{other} is stung, and says so. Now {b} feels accused too, and {a} feels proven right.", [fx.trust("other", -4), fx.trust("b", -2), fx.bond("a", "other", -5), fx.nerve("other", -2)], 2, [{ if: otherHas("hothead"), add: 2 }, { if: otherHas("paranoid"), add: 1 }]), [
            { who: "other", text: "Room? I was telling a story about a mule.", mood: "angry", alt: { hothead: "Tell {a} to say it to my face." } },
            { who: "b", text: "What is this? What's going on?", mood: "angry" },
          ]),
          t(o("{other} laughs it off, and {a} lunges across the fire. It takes three people to pull them apart.", [fx.bond("a", "other", -12), fx.hp("other", -3), fx.nerve("all", -2), fx.trust("a", -3), fx.note("a", "Went for {other} across the fire over {b}."), fx.note("other", "Was attacked by {a} over nothing but a laugh.")], 1, [{ if: aHas("hothead"), add: 3 }]), [
            { who: "other", text: "Room? {b}'s a grown adult, last I checked.", mood: "sly", gesture: "shrug" },
            { who: "a", text: "Say that again. Say it again!", mood: "angry", gesture: "point" },
          ]),
        ],
      },
    },
    {
      id: "seat-three",
      label: "Sit all three of them at your fire and tell a long story",
      hint: "Let {a} see what's there, and what isn't.",
      hours: 1,
      results: {
        any: [
          t(o("By the end of the story {a} is laughing too. There was only ever a cup of coffee.", [fx.nerve("a", 2), fx.bond("a", "other", 5), fx.bond("a", "b", 3), fx.nerve("leader", -1)], 3), [
            { who: "leader", text: "Sit. All of you. I'll tell you about the bear.", mood: "calm", gesture: "beckon" },
            { who: "other", text: "Not the bear again.", mood: "sly" },
            { who: "a", text: "...I like the bear story.", mood: "calm", alt: { hothead: "Fine. Tell the bear story. I'm listening." } },
          ]),
          t(o("{a} watches {b} watch {other} all through your story. {a} leaves before you finish.", [fx.nerve("a", -3), fx.bond("a", "b", -4), fx.scene("rel-lovers-quarrel", 0.5, true)], 1, [{ if: aHas("paranoid"), add: 2 }, { if: affAB(undefined, 40), add: 1 }]), [
            { who: "a", text: "I've heard it. I'm going to bed.", mood: "cold", gesture: "turn-away" },
            { who: "b", text: "{a}? What did I do?", mood: "afraid" },
          ]),
          t(o("{other} catches on halfway through, excuses themselves, and sleeps at the far wagon.", [fx.nerve("a", 2), fx.bond("b", "other", -2), fx.trust("other", 1)], 1, [{ if: otherHas("kind"), add: 1 }, { if: otherHas("stoic"), add: 1 }]), [
            { who: "other", text: "I'll leave you three to it. Goodnight.", mood: "calm" },
            { who: "a", text: "Goodnight, {other}.", mood: "calm", alt: { kind: "Goodnight. Sorry. It's not you." } },
          ]),
        ],
      },
    },
    {
      id: "dismiss",
      label: "Tell {a} it's nothing and to go to bed",
      results: {
        any: [
          t(o("{a} goes to bed. In the morning it seems to have blown over.", [fx.nerve("a", -1)], 2, [{ if: aHas("stoic"), add: 2 }, { if: aHas("kind"), add: 1 }]), [
            { who: "leader", text: "It's nothing. Go to bed. You're tired.", mood: "cold" },
            { who: "a", text: "Maybe I am.", mood: "grieving", alt: { stoic: "Maybe." } },
          ]),
          t(o("{a} goes to bed, but doesn't sleep. By morning it has grown into something with teeth.", [fx.nerve("a", -4), fx.bond("a", "b", -5), fx.trust("a", -2), fx.scene("rel-lovers-quarrel", 0.6, true)], 2, [{ if: aHas("paranoid"), add: 2 }, { if: aHas("haunted"), add: 1 }]), [
            { who: "a", text: "Nothing. Right. Nothing.", mood: "cold", gesture: "turn-away", alt: { paranoid: "Nothing. That's what everyone says, right before." } },
          ]),
          t(o("{a} doesn't go to bed. {a} goes to the fire and says something to {other} nobody can take back.", [fx.bond("a", "other", -10), fx.nerve("other", -3), fx.trust("a", -2), fx.nerve("all", -1), fx.note("other", "Was called names by {a} in front of the fire.")], 1, [{ if: aHas("hothead"), add: 3 }]), [
            { who: "a", text: "Everyone knows what you are, {other}.", mood: "angry", gesture: "point" },
            { who: "other", text: "...Right. Good to know.", mood: "cold", gesture: "turn-away", alt: { hothead: "Say that again when you've got the nerve." } },
          ]),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// 6. A rival suitor
// ---------------------------------------------------------------------------

const OTHER_CHOOSES_B = [fx.rel("a", "other", "estranged"), fx.rel("b", "other", "courting"), fx.nerve("a", -6), fx.note("a", "Lost {other} to {b}."), fx.note("other", "Left {a} for {b}.")];

const TRIANGLE_STANDOFF: SceneDef = {
  id: "rel-triangle-standoff",
  kind: "crisis",
  weight: 0,
  bound: true,
  title: "A Warm Stone",
  intro: [
    "{b} has heated a stone in the fire and wrapped it in a rag for {other}'s bedroll. {a} has noticed.",
    "The three of them are standing at the fire, and nobody sits down.",
  ],
  talk: [
    {
      who: "a",
      text: "That's kind of you, {b}. Kinder than it needs to be.",
      mood: "cold",
      alt: {
        hothead: "Take your stone and go, {b}. Now.",
        paranoid: "What's the stone for, {b}? What's it really for?",
        stoic: "{other}'s warm enough.",
        coward: "That's... nice. That's very nice of you.",
        charming: "A stone. How romantic. I'll get {other} a boulder.",
        veteran: "Seen this before. Doesn't end well for anyone.",
      },
    },
    {
      who: "b",
      text: "It's a cold night. I'd do it for anyone.",
      mood: "calm",
      alt: {
        charming: "Somebody ought to keep {other} warm. You've been busy.",
        hothead: "I'll do what I like with my own stone.",
        kind: "It's only a stone, {a}. It's freezing.",
        greedy: "Stones are free. Unlike some things around here.",
      },
    },
    { who: "a", text: "You wouldn't.", mood: "cold" },
    {
      who: "other",
      text: "Both of you. Stop it.",
      mood: "pleading",
      gesture: "raise-hands",
      alt: { coward: "Please don't do this. Not here. Not in front of everyone.", stoic: "Enough.", hothead: "I'm not a sack of flour to be fought over!" },
    },
  ],
  options: [
    {
      id: "let-play",
      label: "Let the three of them sort it out",
      results: {
        any: [
          t(o("It burns down to muttering. {b} keeps the stone. {other} goes to bed with {a}.", [fx.bond("a", "b", -4), fx.nerve("b", -2), fx.bond("a", "other", 2)], 3), [
            { who: "other", text: "I'm going to bed. {a}, come on.", mood: "cold" },
            { who: "b", text: "Goodnight, {other}.", mood: "grieving", alt: { hothead: "Sleep well. If you can.", charming: "Goodnight. Stone's here if you want it." } },
          ]),
          t(o("It does not burn down. It catches.", [fx.bond("a", "b", -8), fx.scene("fistfight", 1, true)], 1, [{ if: aHas("hothead"), add: 2 }, { if: bHas("hothead"), add: 2 }]), [
            { who: "a", text: "Put it down, {b}. Put it down or I'll make you.", mood: "angry", gesture: "point" },
            { who: "b", text: "Make me, then.", mood: "angry" },
          ]),
          t(o("{other} takes the stone from {b}, very gently. {a} understands before anyone says a word.", [...OTHER_CHOOSES_B], 1, [{ if: { aff: { a: "a", b: "other", max: 30 } }, add: 2 }]), [
            { who: "other", text: "I'm sorry, {a}. I've been sorry for a while.", mood: "grieving" },
            { who: "a", text: "How long is a while?", mood: "cold", alt: { hothead: "A while. A WHILE?", coward: "...I knew. I think I knew." } },
          ]),
        ],
      },
    },
    {
      id: "warn-b",
      label: "Stand with {a}. Warn {b} off, plainly",
      results: {
        any: [
          t(o("{b} drops the stone in the fire and walks away. {a} nods at you once.", [fx.trust("b", -3), fx.trust("a", 3), fx.bond("a", "other", 3), fx.nerve("b", -2)], 3, [{ if: bHas("coward"), add: 2 }, { if: bHas("stoic"), add: 1 }]), [
            { who: "leader", text: "{other}'s spoken for, {b}. Leave it.", mood: "cold" },
            { who: "b", text: "Fine. Keep your stone, then.", mood: "cold", gesture: "turn-away", alt: { coward: "I didn't mean anything. I'm going." } },
          ]),
          t(o("{b} backs off in front of you. Behind your back is another matter, and everyone knows it.", [fx.trust("b", -6), fx.bond("b", "other", 4), fx.bond("a", "b", -4)], 2, [{ if: bHas("charming"), add: 2 }, { if: bHas("greedy"), add: 1 }]), [
            { who: "b", text: "Of course, wagon-master. Whatever you say.", mood: "sly" },
            { who: "a", text: "You see how they said that?", mood: "cold", alt: { paranoid: "They're laughing at us. Both of them." } },
          ]),
          t(o("{other} is furious at being spoken for. Now nobody at the fire is speaking to you.", [fx.trust("other", -5), fx.trust("b", -3), fx.bond("a", "other", -3)], 1, [{ if: otherHas("hothead"), add: 2 }]), [
            { who: "other", text: "Spoken for? I'm not a wagon, to be claimed.", mood: "angry", alt: { stoic: "I'll decide who I'm spoken for by." } },
          ]),
        ],
      },
    },
    {
      id: "ask-other",
      label: "Ask {other} to choose, here and now",
      hint: "Clean, maybe. Not kind.",
      results: {
        any: [
          t(o("{other} takes {a}'s hand without hesitating. {b} is left holding a warm stone.", [fx.bond("a", "other", 6), fx.nerve("b", -5), fx.bond("b", "other", -4), fx.note("b", "Was turned down by {other} in front of the fire.")], 3, [{ if: { aff: { a: "a", b: "other", min: 50 } }, add: 2 }]), [
            { who: "other", text: "{a}. It's always been {a}.", mood: "calm" },
            { who: "b", text: "Right. Well. I hope it stays warm for you.", mood: "grieving", gesture: "turn-away", alt: { hothead: "Fine. You'll regret it on the next cold night." } },
          ]),
          t(o("{other} looks at them both a long time, and chooses {b}.", [...OTHER_CHOOSES_B, fx.nerve("all", -1)], 1, [{ if: { aff: { a: "a", b: "other", max: 30 } }, add: 3 }]), [
            { who: "other", text: "I'm sorry, {a}. It's {b}.", mood: "grieving" },
            { who: "a", text: "...Then take the stone. It's cold.", mood: "grieving", gesture: "turn-away", alt: { hothead: "Then you're welcome to each other!" } },
          ]),
          t(o("{other} won't choose on command, and walks off into the dark alone. Neither of them follows.", [fx.nerve("other", -4), fx.trust("other", -4), fx.bond("a", "other", -3)], 2, [{ if: otherHas("stoic"), add: 1 }, { if: otherHas("hothead"), add: 2 }]), [
            { who: "other", text: "I'm not a prize at a county fair.", mood: "angry", gesture: "turn-away" },
            { who: "leader", text: "Not too far! Stay where the fire can see you!", mood: "afraid" },
          ]),
        ],
      },
    },
    {
      id: "separate",
      label: "Rework the watches so {b} and {other} never share a shift",
      hours: 1,
      results: {
        any: [
          t(o("The new roster holds. {b} cools off, and {a} sleeps easier.", [fx.trust("a", 2), fx.trust("b", -2), fx.bond("b", "other", -3), fx.bond("a", "other", 2)], 3), [
            { who: "leader", text: "New watches. {b}, you're first. {other}, third.", mood: "cold" },
            { who: "b", text: "Subtle, wagon-master. Very subtle.", mood: "sly", alt: { stoic: "Fine.", kind: "All right. I understand." } },
          ]),
          t(o("They find each other at the water barrel, at the latrine, at dawn. Paper can't stop that.", [fx.bond("b", "other", 5), fx.nerve("a", -3), fx.trust("a", -2)], 2, [{ if: bHas("charming"), add: 1 }]), [
            { who: "a", text: "They were at the water barrel again. Together.", mood: "cold", alt: { paranoid: "Every time I turn around. Every single time." } },
            { who: "leader", text: "I can arrange the watch. Not the rest.", mood: "grieving" },
          ]),
          t(o("{other} sees the roster and knows exactly why. Being managed stings worse than the stone.", [fx.trust("other", -4), fx.bond("a", "other", -2)], 1, [{ if: otherHas("hothead"), add: 1 }]), [
            { who: "other", text: "Did {a} ask you to do this?", mood: "angry" },
            { who: "leader", text: "Nobody asked me anything. It's the watch.", mood: "cold" },
          ]),
        ],
      },
    },
    {
      id: "back-b",
      label: "Tell {a} that {other} gets to choose, and {b} may ask",
      hint: "Fair, and {a} won't forget it.",
      results: {
        any: [
          t(o("{other} chooses {a}, and says so gently. {b} took the chance and lost it, and can live with that.", [fx.bond("a", "other", 4), fx.trust("a", -3), fx.trust("b", 3), fx.nerve("b", -2)], 2), [
            { who: "leader", text: "Nobody owns anybody on this train. {other} decides.", mood: "calm" },
            { who: "other", text: "Then I decide {a}. Thank you, {b}. Really.", mood: "calm" },
          ]),
          t(o("{other} chooses {b}. {a} looks at you like you pushed them off a cliff.", [...OTHER_CHOOSES_B, fx.trust("a", -6)], 2, [{ if: { aff: { a: "a", b: "other", max: 35 } }, add: 2 }]), [
            { who: "other", text: "If it's my choice... then {b}.", mood: "grieving" },
            { who: "a", text: "You did this. You.", mood: "angry", gesture: "point", alt: { stoic: "I won't forget this.", coward: "Why would you... why?" } },
          ]),
          t(o("{a} will not hear it. Words fly, and then fists.", [fx.trust("a", -5), fx.scene("fistfight", 1, true)], 1, [{ if: aHas("hothead"), add: 3 }]), [
            { who: "a", text: "Ask? Over my dead body, {b}.", mood: "angry", gesture: "draw-weapon" },
            { who: "b", text: "That can be arranged.", mood: "angry" },
          ]),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// 7. A break-up (the pair is already estranged when this runs)
// ---------------------------------------------------------------------------

const BREAKUP: SceneDef = {
  id: "rel-breakup",
  kind: "crisis",
  weight: 0,
  bound: true,
  title: "Dividing the Blankets",
  intro: [
    "{a} and {b} are finished. The whole train knows it by the wagon-length they keep between them.",
    "Somebody has to say who sleeps where, and who keeps which watch.",
  ],
  talk: [
    {
      who: "a",
      text: "I'm not sharing a wagon with {b}. Not one more night.",
      mood: "cold",
      alt: {
        stoic: "I'll need a different wagon.",
        kind: "I can't sleep beside {b}. I'm sorry. I just can't.",
        hothead: "Put me with the mules. Anywhere. Not with {b}.",
        coward: "Please. Anywhere else. I'll sleep under the wagon.",
        haunted: "I can't lie next to someone who's already a ghost to me.",
      },
    },
    {
      who: "b",
      text: "Suits me. Take the leaking one.",
      mood: "cold",
      alt: {
        greedy: "Fine. But the good blanket's mine. I traded for it.",
        kind: "That's fair. Take the dry wagon. I don't mind.",
        hothead: "Take whatever you want. You always did.",
        stoic: "Fine.",
        charming: "Please. I was going to ask for a better wagon anyway.",
      },
    },
    { who: "a", text: "And tell {b} the watch is theirs tonight.", mood: "cold" },
    { who: "b", text: "Tell {a} to tell me themselves.", mood: "angry", alt: { coward: "I'm right here. I can hear you.", stoic: "I heard." } },
  ],
  options: [
    {
      id: "mediate",
      label: "Sit them both down and settle it like adults",
      check: { kind: "calm", dc: 12, exclude: ["a", "b"] },
      hours: 1,
      results: {
        any: [
          t(o("An hour of hard, quiet talk. They come away civil. Not friends. Civil.", [fx.bond("a", "b", 5), fx.nerve("a", 2), fx.nerve("b", 2), fx.trust("a", 1), fx.trust("b", 1)], 3), [
            { who: "by", text: "You don't have to love each other. Just work the same road.", mood: "calm", alt: { veteran: "I've served beside men I hated. It's doable." } },
            { who: "a", text: "I can do civil.", mood: "cold" },
            { who: "b", text: "So can I.", mood: "cold", alt: { kind: "I never wanted you hurt, {a}. You know that." } },
          ], "success"),
          t(o("They split the blankets fairly, and {b} even carries {a}'s trunk. It's a start.", [fx.bond("a", "b", 7), fx.nerve("a", 2), fx.nerve("b", 2), fx.note("b", "Carried {a}'s trunk to the other wagon, after it ended.")], 1), [
            { who: "b", text: "Here. It's heavy. Let me.", mood: "calm", gesture: "offer" },
            { who: "a", text: "...Thank you.", mood: "grieving" },
          ], "success"),
          t(o("Twenty minutes in, old wounds tear open. They say everything they swore they wouldn't.", [fx.bond("a", "b", -6), fx.nerve("all", -2), fx.nerve("by", -2)], 2), [
            { who: "by", text: "Just the wagons. We're only talking about wagons.", mood: "pleading" },
            { who: "a", text: "It was never about wagons, and {b} knows it.", mood: "angry", gesture: "point" },
            { who: "b", text: "Here it comes. Here it all comes.", mood: "angry" },
          ], "fail"),
          t(o("Nobody shouts. Nobody agrees on anything either. They sleep on opposite sides of the fire.", [fx.nerve("a", -2), fx.nerve("b", -2)], 1), [
            { who: "by", text: "We'll try again tomorrow.", mood: "calm", alt: { coward: "Maybe tomorrow would be better. For everyone." } },
            { who: "b", text: "There's no again. That's the point.", mood: "cold" },
          ], "fail"),
        ],
      },
    },
    {
      id: "split",
      label: "Split everything down the middle yourself: wagons, watches, tools",
      hours: 1,
      results: {
        any: [
          t(o("Your list is fair and final. They accept it because it isn't theirs to argue.", [fx.trust("a", 2), fx.trust("b", 2), fx.nerve("a", -1), fx.nerve("b", -1)], 3), [
            { who: "leader", text: "{a}, tail wagon, first watch. {b}, lead wagon, third.", mood: "cold" },
            { who: "a", text: "Fine.", mood: "cold", alt: { kind: "That's fair. Thank you." } },
            { who: "b", text: "Fine.", mood: "cold" },
          ]),
          t(o("They fight over every item on your list. Half a morning goes to a skillet.", [fx.bond("a", "b", -4), fx.trust("a", -1), fx.trust("b", -1), fx.hours(1), fx.note("a", "Fought {b} over a skillet after they parted.")], 2, [{ if: bHas("greedy"), add: 2 }, { if: aHas("greedy"), add: 2 }]), [
            { who: "b", text: "That skillet was my mother's.", mood: "angry", alt: { greedy: "That skillet's worth two blankets. I want it." } },
            { who: "a", text: "Your mother never saw that skillet.", mood: "angry" },
          ]),
          t(o("It works. Neither of them has anyone to talk to at night now, and it shows.", [fx.nerve("a", -3), fx.nerve("b", -3), fx.trust("a", 1)], 1, [{ if: aHas("haunted"), add: 1 }]), [
            { who: "a", text: "It's quiet in the tail wagon.", mood: "grieving" },
            { who: "leader", text: "It'll get easier.", mood: "calm", alt: { stoic: "Quiet is fine." } },
          ]),
        ],
      },
    },
    {
      id: "work-through",
      label: "Put them on the same watch. They'll work it out, or they won't",
      hint: "Grown people. Long night.",
      results: {
        any: [
          t(o("Somewhere around three in the morning they start talking. By dawn there's grudging respect.", [fx.bond("a", "b", 6), fx.nerve("a", 1), fx.nerve("b", 1)], 2, [{ if: aHas("stoic"), add: 1 }, { if: aHas("veteran"), add: 1 }]), [
            { who: "b", text: "You were right about some of it.", mood: "grieving" },
            { who: "a", text: "Only some?", mood: "sly" },
            { who: "b", text: "Don't push it.", mood: "sly" },
          ]),
          t(o("A shouting match at three in the morning wakes the whole camp. The Haze hears it too.", [fx.bond("a", "b", -6), fx.nerve("all", -2), fx.gap(-2), fx.trust("a", -2)], 2, [{ if: aHas("hothead"), add: 2 }, { if: bHas("hothead"), add: 2 }]), [
            { who: "a", text: "You never once asked what I wanted!", mood: "angry" },
            { who: "b", text: "Keep your voice down! It can hear you!", mood: "afraid", gesture: "raise-hands" },
          ]),
          t(o("They sit six feet apart and say nothing all night. The fire goes out and nobody feeds it.", [fx.nerve("a", -2), fx.nerve("b", -2), fx.res("torches", -1)], 1), [
            { who: "leader", text: "Who let the fire die?", mood: "angry" },
            { who: "b", text: "Ask {a}.", mood: "cold" },
          ]),
        ],
      },
    },
    {
      id: "ignore",
      label: "Stay out of it. It's not the wagon-master's business",
      results: {
        any: [
          t(o("They manage it themselves, coldly and correctly, like strangers on a stagecoach.", [fx.nerve("a", -1), fx.nerve("b", -1)], 2, [{ if: aHas("stoic"), add: 2 }, { if: bHas("stoic"), add: 1 }]), [
            { who: "a", text: "Morning, {b}.", mood: "cold" },
            { who: "b", text: "Morning.", mood: "cold" },
          ]),
          t(o("It festers. The others start picking sides, and meals go quiet.", [fx.bond("a", "b", -4), fx.nerve("all", -1), fx.trust("a", -2), fx.trust("b", -2)], 2), [
            { who: "a", text: "You could have said something. Anything.", mood: "cold", alt: { kind: "I thought you'd help. I thought someone would." } },
            { who: "leader", text: "It wasn't mine to say.", mood: "cold" },
          ]),
          t(o("{b} takes the good blanket in the night. {a} wakes shivering and says nothing, which is worse.", [fx.bond("a", "b", -5), fx.hp("a", -2), fx.nerve("a", -3), fx.note("a", "Woke shivering after {b} took the good blanket.")], 1, [{ if: bHas("greedy"), add: 3 }]), [
            { who: "a", text: "It's fine. I didn't need it.", mood: "cold", gesture: "turn-away", alt: { hothead: "Keep it. I hope it itches." } },
          ]),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// 8. Trying again
// ---------------------------------------------------------------------------

const RECONCILE: SceneDef = {
  id: "rel-reconcile",
  kind: "crisis",
  weight: 0,
  bound: true,
  title: "Two Cups of Coffee",
  intro: ["{a} has poured two cups of coffee and has been standing with them, not quite walking toward {b}, for some time."],
  talk: [
    {
      who: "a",
      text: "Do you think {b} would drink it? From me?",
      vary: ["Would {b} take a cup from me, do you think?"],
      mood: "pleading",
      alt: {
        stoic: "Coffee's going cold.",
        hothead: "I'm not begging. It's just coffee.",
        coward: "What if {b} throws it at me? I'd deserve it.",
        charming: "I've apologised to generals. Why is this harder?",
        pious: "I've prayed on it. Now I have to actually walk.",
        haunted: "I keep thinking of the last thing I said to {b}.",
      },
    },
    { who: "leader", text: "Only one way to find out.", mood: "calm", alt: { kind: "It's a cup of coffee, {a}. Go." } },
    { who: "a", text: "Last time I walked over there, I said terrible things.", mood: "grieving", alt: { stoic: "Last time went badly." } },
    {
      who: "b",
      text: "Are you going to stand there all night, {a}?",
      mood: "calm",
      alt: { hothead: "If that's for me, bring it before it's cold.", stoic: "Is that for me?", kind: "Come and sit down, {a}. Please." },
    },
  ],
  options: [
    {
      id: "nudge",
      label: "Walk over with {a} and help them say it",
      check: { kind: "persuade", dc: 11, exclude: ["a", "b"] },
      results: {
        any: [
          t(o("The coffee goes down. So do the walls. Later they are seen walking together.", [fx.rel("a", "b", "courting"), fx.bond("a", "b", 8), fx.nerve("a", 3), fx.nerve("b", 3), fx.note("a", "Brought {b} a cup of coffee, and started again.")], 3), [
            { who: "by", text: "{a} has something to say. Hear it out.", mood: "calm", alt: { charming: "Two cups of coffee. One of them's yours. Listen." } },
            { who: "a", text: "I was wrong. And I was cruel. I'm sorry.", mood: "pleading" },
            { who: "b", text: "Sit down, you idiot. Drink your coffee.", mood: "calm", alt: { stoic: "...Sit.", kind: "I missed you. Sit." } },
          ], "success"),
          t(o("They pick up as though nothing ever broke. By midnight they're sharing a blanket again.", [fx.rel("a", "b", "lovers"), fx.bond("a", "b", 10), fx.nerve("a", 4), fx.nerve("b", 4)], 1, [{ if: affAB(25), add: 2 }]), [
            { who: "b", text: "I kept your side of the wagon empty.", mood: "grieving" },
            { who: "a", text: "I kept waking up reaching for you.", mood: "grieving" },
          ], "success"),
          t(o("{b} takes the cup, and the apology, and offers friendship. Only friendship.", [fx.rel("a", "b", "friend"), fx.bond("a", "b", 5), fx.nerve("a", -1), fx.nerve("b", 2), fx.note("a", "Made peace with {b}, as friends.")], 2), [
            { who: "b", text: "I forgive you. I don't want to go back, though.", mood: "calm" },
            { who: "a", text: "Friends, then. I'll take friends.", mood: "grieving", alt: { hothead: "Friends. Fine. Better than nothing." } },
          ], "fail"),
          t(o("{by} says the wrong thing, and {a} says a worse one. The coffee ends up in the dirt.", [fx.bond("a", "b", -6), fx.nerve("a", -3), fx.nerve("b", -2), fx.bond("a", "by", -3)], 2, [{ if: bHas("hothead"), add: 1 }, { if: aHas("hothead"), add: 1 }]), [
            { who: "by", text: "Come on, {b}. {a}'s trying. Meet them halfway.", mood: "pleading" },
            { who: "b", text: "Halfway? I walked the whole way last time!", mood: "angry" },
            { who: "a", text: "Forget it. Forget I came.", mood: "angry", gesture: "turn-away" },
          ], "fail"),
        ],
      },
    },
    {
      id: "task",
      label: "Give them a cracked wheel to fix together",
      hint: "Hands busy. Mouths less so.",
      hours: 1,
      results: {
        any: [
          t(o("By the time the wheel is sound they are laughing about the mule that kicked them both.", [fx.rel("a", "b", "friend"), fx.bond("a", "b", 6), fx.repair(3), fx.nerve("a", 2), fx.nerve("b", 2)], 3), [
            { who: "a", text: "Hold it steady. No, steady.", mood: "calm" },
            { who: "b", text: "It is steady. You're the one wobbling.", mood: "sly" },
          ]),
          t(o("Somewhere between the spokes and the grease, they find their way back to each other.", [fx.rel("a", "b", "courting"), fx.bond("a", "b", 8), fx.repair(2), fx.note("b", "Found {a} again over a broken wheel.")], 2, [{ if: affAB(20), add: 2 }]), [
            { who: "b", text: "You've got grease on your nose.", mood: "sly" },
            { who: "a", text: "Leave it there. You're looking at it.", mood: "sly", alt: { stoic: "Leave it.", coward: "Oh no. Where? Get it off." } },
          ]),
          t(o("A dropped hammer, an old accusation. The wheel gets fixed in furious silence.", [fx.bond("a", "b", -5), fx.repair(3), fx.nerve("a", -2), fx.nerve("b", -2)], 1, [{ if: aHas("hothead"), add: 2 }, { if: bHas("hothead"), add: 1 }]), [
            { who: "b", text: "Just like before. You never listen.", mood: "angry" },
            { who: "a", text: "Hand me the pin. The pin, {b}.", mood: "cold" },
          ]),
        ],
      },
    },
    {
      id: "leave",
      label: "Leave them to it",
      results: {
        any: [
          t(o("{a} walks over. You don't watch. Later, you hear them both laugh once, quietly.", [fx.rel("a", "b", "friend"), fx.bond("a", "b", 4), fx.nerve("a", 2)], 3), [
            { who: "a", text: "Coffee. It's terrible. I made it.", mood: "calm", gesture: "offer" },
            { who: "b", text: "It is terrible. Thank you.", mood: "calm" },
          ]),
          t(o("The two of them sit up by the fire until it is nothing but coals. They go to the same wagon.", [fx.rel("a", "b", "courting"), fx.bond("a", "b", 6), fx.nerve("a", 2), fx.nerve("b", 2)], 1, [{ if: affAB(25), add: 2 }]), [
            { who: "b", text: "I thought you'd never come.", mood: "grieving" },
            { who: "a", text: "I nearly didn't.", mood: "grieving" },
          ]),
          t(o("{a} loses their nerve halfway, sets both cups on a wheel hub, and walks away. Nobody drinks them.", [fx.nerve("a", -3), fx.bond("a", "b", -1)], 2, [{ if: aHas("coward"), add: 2 }]), [
            { who: "a", text: "Not tonight. Maybe not ever.", mood: "grieving", gesture: "turn-away" },
          ]),
        ],
      },
    },
    {
      id: "warn",
      label: "Warn {a}: it ended badly once already",
      results: {
        any: [
          t(o("{a} pours {b}'s cup into their own. Quietly, a door closes.", [fx.nerve("a", -2), fx.trust("a", 1), fx.bond("a", "b", -1)], 2, [{ if: aHas("stoic"), add: 1 }, { if: aHas("coward"), add: 1 }]), [
            { who: "leader", text: "Some things break the same way twice.", mood: "calm" },
            { who: "a", text: "You're probably right. I hate that.", mood: "grieving" },
          ]),
          t(o("{a} goes anyway. It works, and {a} looks back at you with something like pity.", [fx.rel("a", "b", "courting"), fx.bond("a", "b", 6), fx.trust("a", -3)], 2, [{ if: aHas("hothead"), add: 1 }, { if: affAB(20), add: 1 }]), [
            { who: "a", text: "Some things mend stronger. Watch.", mood: "sly", alt: { pious: "Everyone deserves a second chance. Even me." } },
          ]),
          t(o("{a} goes anyway, and you were right. It takes four minutes to fall apart again.", [fx.bond("a", "b", -6), fx.nerve("a", -4), fx.nerve("b", -2), fx.note("a", "Tried again with {b}, and it broke the same way.")], 1), [
            { who: "b", text: "Same words. Same face. Nothing's changed.", mood: "cold" },
            { who: "a", text: "Then why did you let me sit down?", mood: "grieving" },
          ]),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// 9. A lovers' quarrel in front of everyone
// ---------------------------------------------------------------------------

const LOVERS_QUARREL: SceneDef = {
  id: "rel-lovers-quarrel",
  kind: "crisis",
  weight: 0,
  bound: true,
  title: "Half a Tin of Peaches",
  intro: [
    "It starts over half a tin of peaches and ends with {a} and {b} shouting across the whole camp.",
    "Everyone else has gone very quiet, pretending not to listen.",
  ],
  talk: [
    {
      who: "a",
      text: "You'd leave me behind. Don't pretend you wouldn't.",
      mood: "angry",
      gesture: "point",
      alt: {
        paranoid: "I've seen you eyeing the fastest wagon. I've seen it.",
        coward: "If the red came tonight you'd run. I know you would.",
        hothead: "You'd leave me for the fog and not look back!",
        haunted: "I dreamt you left. I dream it every night.",
        greedy: "Half a tin! You gave half a tin to strangers!",
      },
    },
    {
      who: "b",
      text: "I gave you half my rations for a week!",
      mood: "angry",
      alt: { stoic: "I've carried you since the river. Say that again.", kind: "I'd never leave you. How can you even think it?", charming: "Oh yes, very convincing. Say it louder, they missed it." },
    },
    { who: "a", text: "You never once asked if I was scared.", mood: "grieving", alt: { stoic: "You never asked. Not once." } },
    { who: "b", text: "Everyone's scared, {a}! Everyone!", mood: "angry", gesture: "raise-hands", alt: { coward: "I'm scared all the time! All the time!" } },
  ],
  options: [
    {
      id: "mediate",
      label: "Step between them and bring it down",
      check: { kind: "calm", dc: 12, exclude: ["a", "b"] },
      results: {
        any: [
          t(o("The shouting drains out of them. {a} and {b} end up leaning on each other, too tired to stand.", [fx.bond("a", "b", 6), fx.nerve("a", 3), fx.nerve("b", 3), fx.bond("a", "by", 2)], 3), [
            { who: "by", text: "Neither of you is leaving. Nobody is leaving.", mood: "calm", alt: { pious: "You made promises. Keep them. That's all this is.", veteran: "Fear talking. I've heard it in trenches. Sit." } },
            { who: "a", text: "I am scared. That's all it is.", mood: "grieving" },
            { who: "b", text: "I know. I know. Me too.", mood: "grieving", gesture: "clutch" },
          ], "success"),
          t(o("It stops. It isn't fixed. They agree to talk tomorrow, somewhere without an audience.", [fx.bond("a", "b", 2), fx.nerve("a", 1), fx.nerve("b", 1)], 1), [
            { who: "by", text: "Tomorrow. Just the two of you. Not here.", mood: "calm" },
            { who: "b", text: "Tomorrow.", mood: "cold" },
          ], "success"),
          t(o("They both turn on {by} for interfering, then on each other harder than before.", [fx.bond("a", "b", -6), fx.nerve("all", -2), fx.nerve("by", -2)], 2), [
            { who: "by", text: "Please. Just lower your voices.", mood: "pleading" },
            { who: "a", text: "Stay out of it! This isn't yours!", mood: "angry", gesture: "point" },
          ], "fail"),
          t(o("{b} takes off the linchpin ring, or the ribbon, or whatever it was, and drops it in the fire.", [fx.rel("a", "b", "estranged"), fx.bond("a", "b", -10), fx.nerve("a", -5), fx.nerve("b", -4), fx.note("b", "Threw {a}'s token in the fire in front of everyone."), fx.note("a", "Watched {b} throw their token into the fire.")], 1, [{ if: affAB(undefined, 15), add: 2 }, { if: bHas("hothead"), add: 1 }]), [
            { who: "b", text: "There. Now you don't have to wonder.", mood: "cold" },
            { who: "a", text: "{b}. {b}, don't.", mood: "pleading" },
          ], "fail"),
        ],
      },
    },
    {
      id: "side-a",
      label: "Take {a}'s side: {b} should have asked",
      results: {
        any: [
          t(o("{b} hears it from you and deflates. Later, {b} does ask. It helps more than you'd guess.", [fx.bond("a", "b", 4), fx.trust("a", 3), fx.trust("b", -3), fx.nerve("a", 2)], 2, [{ if: bHas("kind"), add: 2 }]), [
            { who: "leader", text: "{b}, ask {a} how they are. Right now.", mood: "cold" },
            { who: "b", text: "...How are you, {a}?", mood: "grieving" },
            { who: "a", text: "Terrified. Thank you for asking.", mood: "grieving" },
          ]),
          t(o("{b} feels ganged up on, and walks off into the wagons alone.", [fx.trust("b", -5), fx.nerve("b", -3), fx.bond("a", "b", -3)], 2, [{ if: bHas("hothead"), add: 1 }, { if: bHas("paranoid"), add: 1 }]), [
            { who: "b", text: "Of course. Two against one. Wonderful.", mood: "angry", gesture: "turn-away", alt: { stoic: "Noted.", coward: "Fine. I'm always the one who's wrong." } },
          ]),
        ],
      },
    },
    {
      id: "side-b",
      label: "Take {b}'s side: everyone is scared, {a}",
      results: {
        any: [
          t(o("{a} flinches, then nods. The anger turns to shame, and then, slowly, to an apology.", [fx.bond("a", "b", 4), fx.trust("b", 3), fx.trust("a", -2), fx.nerve("a", -1)], 2, [{ if: aHas("kind"), add: 2 }, { if: aHas("stoic"), add: 1 }]), [
            { who: "leader", text: "{b} gave you half their food, {a}. Think.", mood: "cold" },
            { who: "a", text: "...I know. I'm sorry, {b}.", mood: "grieving" },
          ]),
          t(o("{a} feels abandoned by both of you, and sleeps under the wagon in the cold.", [fx.trust("a", -5), fx.nerve("a", -4), fx.bond("a", "b", -3), fx.note("a", "Slept alone under a wagon after a fight with {b}.")], 2, [{ if: aHas("paranoid"), add: 2 }, { if: aHas("haunted"), add: 1 }]), [
            { who: "a", text: "Right. So I'm the only coward here.", mood: "cold", alt: { hothead: "Fine! Everyone's against me. As usual!" } },
          ]),
        ],
      },
    },
    {
      id: "apart",
      label: "Send them apart: {a} out with the scouts, {b} on the wagons",
      hours: 1,
      results: {
        any: [
          t(o("A few hours apart and they both come back wrung out, and gentler.", [fx.bond("a", "b", 3), fx.nerve("a", 1), fx.nerve("b", 1)], 3), [
            { who: "a", text: "I kept looking back for you.", mood: "grieving" },
            { who: "b", text: "I kept looking for you to come back.", mood: "grieving" },
          ]),
          t(o("Distance only gives them time to rehearse. The second round is worse than the first.", [fx.bond("a", "b", -4), fx.nerve("all", -1)], 1, [{ if: aHas("hothead"), add: 1 }]), [
            { who: "a", text: "I thought of more things to say.", mood: "angry" },
            { who: "b", text: "So did I.", mood: "angry" },
          ]),
          t(o("{a} comes back from scouting grey-faced, having seen something in the red. The quarrel is forgotten.", [fx.bond("a", "b", 6), fx.nerve("a", -4), fx.nerve("b", -1)], 1, [{ if: aHas("haunted"), add: 1 }]), [
            { who: "a", text: "I saw someone out there. Wearing your coat.", mood: "afraid" },
            { who: "b", text: "I'm here. Feel. I'm here.", mood: "calm", gesture: "clutch" },
          ]),
        ],
      },
    },
    {
      id: "shout",
      label: "Shout them both down. The whole camp is listening",
      results: {
        any: [
          t(o("Silence, sudden and total. They go to separate wagons, ashamed. By morning they've made up.", [fx.bond("a", "b", 2), fx.trust("a", -2), fx.trust("b", -2), fx.nerve("all", 1)], 2), [
            { who: "leader", text: "ENOUGH. The red can hear you. Enough!", mood: "angry", alt: { stoic: "Quiet. Now." } },
            { who: "b", text: "...Sorry. Sorry, everyone.", mood: "grieving" },
          ]),
          t(o("They turn on you together, and in defending each other they remember they're on the same side.", [fx.bond("a", "b", 6), fx.trust("a", -4), fx.trust("b", -4)], 2), [
            { who: "a", text: "Don't you shout at {b}. Don't you dare.", mood: "angry", gesture: "point" },
            { who: "b", text: "We'll quarrel if we like, thank you.", mood: "cold" },
          ]),
          t(o("{a} takes it badly. The shouting stops, but the look {a} gives you stays for days.", [fx.trust("a", -6), fx.nerve("a", -2)], 1, [{ if: aHas("hothead"), add: 2 }, { if: aHas("paranoid"), add: 1 }]), [
            { who: "a", text: "Nobody talks to me like that. Nobody.", mood: "cold", alt: { coward: "I'm sorry. I'm sorry. I'll be quiet." } },
          ]),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// 10. Friends
// ---------------------------------------------------------------------------

const FRIENDS_BOND: SceneDef = {
  id: "rel-friends-bond",
  kind: "crisis",
  weight: 0,
  bound: true,
  title: "The Pact at the Tailgate",
  intro: [
    "{a} and {b} are sharing a pipe on the tailgate, talking low, the way people do once they trust each other.",
    "You hear your name. {a} waves you over.",
  ],
  talk: [
    {
      who: "a",
      text: "We made a deal, {b} and me.",
      mood: "calm",
      alt: {
        veteran: "We've sworn something. Old soldiers' custom.",
        charming: "We've come to an arrangement, {b} and I.",
        stoic: "We've agreed something.",
        pious: "We made a promise. Before God, near enough.",
        greedy: "We've struck a bargain. Best one I ever made.",
      },
    },
    {
      who: "b",
      text: "If one of us goes into the red, the other doesn't follow.",
      mood: "grieving",
      alt: { haunted: "When the red takes one of us, the other lets it.", kind: "If one of us goes, the other keeps walking. For both." },
    },
    { who: "a", text: "And carries the other's name the rest of the way.", mood: "calm" },
    { who: "b", text: "We wanted you to hear it. So it counts.", mood: "calm", alt: { hothead: "Wanted a witness. So neither of us can weasel out." } },
  ],
  options: [
    {
      id: "same-watch",
      label: "Put them on the same watch from now on",
      results: {
        any: [
          t(o("They're sharper together than apart. Nothing gets near the fire on their shift.", [fx.bond("a", "b", 6), fx.nerve("a", 2), fx.nerve("b", 2), fx.trust("a", 1)], 3), [
            { who: "leader", text: "Second watch is yours. Both of you. From now on.", mood: "calm" },
            { who: "b", text: "Good. {a}'s the only one who stays awake.", mood: "sly", alt: { stoic: "Good." } },
          ]),
          t(o("They talk the whole watch through and the fire burns low. One torch fewer by dawn.", [fx.bond("a", "b", 7), fx.nerve("a", 2), fx.nerve("b", 2), fx.res("torches", -1)], 1), [
            { who: "a", text: "Sorry. We got talking about home.", mood: "sly" },
            { who: "leader", text: "Talk quieter. And feed the fire.", mood: "cold" },
          ]),
          t(o("Two friends on one watch means both are tired at once. The next day drags.", [fx.bond("a", "b", 5), fx.hp("a", -1), fx.hp("b", -1)], 1, [{ if: aHas("sickly"), add: 1 }]), [
            { who: "b", text: "Worth it. Don't tell me it wasn't worth it.", mood: "calm" },
          ]),
        ],
      },
    },
    {
      id: "treat",
      label: "Break out something sweet to seal it",
      cost: { rations: 1 },
      results: {
        any: [
          t(o("A twist of sugar, split three ways. They taste it like sacrament.", [fx.bond("a", "b", 6), fx.nerve("a", 4), fx.nerve("b", 4), fx.trust("a", 2), fx.trust("b", 2)], 3), [
            { who: "leader", text: "To the pact. And to never needing it.", mood: "calm", gesture: "offer" },
            { who: "a", text: "To never needing it.", mood: "calm", alt: { haunted: "To needing it as late as possible." } },
          ]),
          t(o("The others smell the sugar and drift over. Soon the whole train is swearing pacts.", [fx.bond("a", "b", 4), fx.bondAll(1), fx.nerve("all", 1)], 1), [
            { who: "b", text: "Now look. Everyone wants in on our pact.", mood: "sly" },
            { who: "a", text: "Let them. The more names carried, the better.", mood: "calm" },
          ]),
        ],
      },
    },
    {
      id: "warn",
      label: "Tell them straight: closeness costs, when one of you goes",
      results: {
        any: [
          t(o("They agree, grimly. That's why they made the pact, they say.", [fx.bond("a", "b", 4), fx.nerve("a", -1), fx.nerve("b", -1), fx.trust("a", 2)], 2), [
            { who: "leader", text: "It'll hurt worse, when it comes. You know that.", mood: "grieving" },
            { who: "a", text: "Everything out here hurts. This is worth it.", mood: "calm", alt: { veteran: "Always does. Still the only thing that's worth it." } },
          ]),
          t(o("It lands wrong. They wanted a witness, not a warning.", [fx.trust("a", -3), fx.trust("b", -3), fx.bond("a", "b", 3)], 2, [{ if: aHas("hothead"), add: 1 }]), [
            { who: "b", text: "We asked you to witness it. Not bury us.", mood: "cold", alt: { kind: "We know. We just wanted you to be glad." } },
          ]),
          t(o("{b} goes quiet, looking at the red on the horizon, and {a} puts an arm round them.", [fx.nerve("b", -3), fx.bond("a", "b", 6)], 1, [{ if: bHas("haunted"), add: 2 }]), [
            { who: "b", text: "It's close tonight, isn't it.", mood: "afraid" },
            { who: "a", text: "Not close enough to have us. Not yet.", mood: "calm", gesture: "clutch" },
          ]),
        ],
      },
    },
    {
      id: "swear",
      label: "Swear it with them. Carry their names too",
      hint: "A wagon-master's promise weighs more.",
      results: {
        any: [
          t(o("Three hands on the tailgate. It feels like more than words, out here.", [fx.trust("a", 4), fx.trust("b", 4), fx.bond("a", "b", 4), fx.nerve("leader", -2), fx.note("a", "Swore a pact with {b} and the wagon-master to carry each other's names.")], 3), [
            { who: "leader", text: "If you go, I'll carry your names. Both of you.", mood: "grieving" },
            { who: "a", text: "And we'll carry yours.", mood: "calm" },
            { who: "b", text: "Whoever's left.", mood: "grieving", alt: { pious: "Whoever He leaves standing.", charming: "Whoever's left gets the pipe." } },
          ]),
          t(o("You swear it. Later, alone, you wonder how many names you are carrying already.", [fx.trust("a", 3), fx.trust("b", 3), fx.bond("a", "b", 3), fx.nerve("leader", -4)], 1), [
            { who: "leader", text: "I'll carry you. I've room for two more.", mood: "grieving" },
            { who: "b", text: "How many are you carrying now?", mood: "calm" },
            { who: "leader", text: "Enough.", mood: "grieving", gesture: "turn-away" },
          ]),
        ],
      },
    },
  ],
};

export const ROMANCE_SCENES: SceneDef[] = [
  COURTSHIP_SPARK,
  SHARED_WATCH,
  LOVERS_MOMENT,
  PROPOSAL,
  WEDDING,
  JEALOUS_SPAT,
  TRIANGLE_STANDOFF,
  BREAKUP,
  RECONCILE,
  LOVERS_QUARREL,
  FRIENDS_BOND,
];
