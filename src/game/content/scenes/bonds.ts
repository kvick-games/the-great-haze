// Scenes the relationship engine (../../relationships.ts) leans on: grief for a
// lover or a close friend, the night vigil at a sickbed, a lover who wants to
// follow someone who left, a hurt friend who draws someone into a risk, and two
// dispute scenes for people who cannot stand each other.
//
// Bound scenes are queued by the engine with their people already chosen:
//   rel-grief-lover, rel-grief-friend: actor = the mourner, lost = the dead.
//   rel-lover-follows: actor = the one left behind, lost = the one who went.
//   rel-vigil, rel-loyalty-rescue: a = actor = the carer, b = other = the dying or hurt.
//   rel-widow-rite: queued from rel-grief-lover with the same actor and lost.
// The dead and the departed never speak; {lost} only names them.

import type { Cond, SceneDef, Trait, Who } from "../../types.ts";
import { fx, o, t } from "../fx.ts";

/** A bound person has a trait. */
const has = (who: Who, trait: Trait): Cond => ({ ofWho: who, has: trait });
/** The carer and the dying are a couple. */
const COUPLE: Cond = { relKind: { a: "actor", b: "other", kinds: ["spouses", "lovers", "courting"] } };

const GONE_INTO_HAZE = "walked into the Haze after the one they loved";
const WENT_AFTER = "went back down the road after the one they loved";

// ---------------------------------------------------------------------------
// Grief
// ---------------------------------------------------------------------------

const GRIEF_LOVER: SceneDef = {
  id: "rel-grief-lover",
  kind: "crisis",
  weight: 0,
  bound: true,
  title: "{actor} and {lost}",
  intro: ["{lost} lies wrapped in a wagon sheet by the road. {actor} has not let go of the hand."],
  talk: [
    {
      who: "actor",
      text: "{lost} was warm an hour ago. An hour.",
      mood: "grieving",
      gesture: "clutch",
      vary: ["I keep waiting for {lost} to sit up and laugh.", "We were going to see the sea. We promised."],
      alt: {
        stoic: "Leave me be a while. That's all I ask.",
        haunted: "I heard {lost} breathing. Just now. I swear I did.",
        pious: "The Lord gave. I can't say the rest of it.",
        coward: "I can't do this without {lost}. I can't.",
        hothead: "Don't you tell me it's God's will. Don't you dare.",
        greedy: "{lost} was the only thing on this road worth keeping.",
      },
    },
    {
      who: "leader",
      text: "{actor}. I'm so sorry.",
      mood: "grieving",
      alt: { kind: "I'm here. Take all the time you need.", stoic: "I'm sorry. Truly.", veteran: "I know. I've knelt where you are." },
    },
    {
      who: "actor",
      text: "What do I do now? Tell me what I do.",
      mood: "pleading",
      vary: ["Everyone keeps looking at me. What do they want?"],
      alt: {
        stoic: "Tell me what needs doing. I'll do it.",
        haunted: "The fog has a voice like {lost}'s tonight.",
        paranoid: "Somebody should have seen it coming. Somebody.",
        kind: "Did {lost} know? That I... did {lost} know?",
      },
    },
  ],
  options: [
    {
      id: "vigil",
      label: "Sit the night with {actor}",
      hint: "You lose sleep and hours. It may be what they need.",
      hours: 2,
      results: {
        any: [
          t(
            o("You sit until the stars go. Near dawn, {actor} sleeps against your shoulder.", [fx.nerve("actor", 5), fx.trust("actor", 6), fx.nerve("leader", -2), fx.note("actor", "Sat all night by {lost} with the wagon-master.")], 4, [
              { if: { trait: "kind" }, add: 1 },
              { if: has("actor", "pious"), add: 1 },
            ]),
            [
              { who: "actor", text: "{lost} hated the cold. Stole every blanket I owned.", mood: "grieving", vary: ["{lost} used to hum. Terribly. I'd give anything..."] },
              { who: "leader", text: "Then keep one warm for {lost} tonight.", mood: "calm", alt: { stoic: "Keep the blanket. I'll keep the fire." } },
            ],
          ),
          t(o("{actor} talks for hours, all of it about {lost}. The worst of it comes out as laughter.", [fx.nerve("actor", 3), fx.trust("actor", 4), fx.nerve("leader", -1)], 3), [
            { who: "actor", text: "{lost} snored like a sawmill. I used to kick them.", mood: "grieving", alt: { hothead: "I shouted at {lost} this morning. Over a kettle." } },
            { who: "leader", text: "Tell me another one.", mood: "calm" },
          ]),
          t(
            o("Near midnight {actor} goes rigid. Out in the red, something says their name in {lost}'s voice.", [fx.nerve("actor", -4), fx.nerve("leader", -3), fx.trust("actor", 3), fx.note("actor", "Heard {lost}'s voice in the Haze the night they died.")], 2, [
              { if: has("actor", "haunted"), add: 2 },
            ]),
            [
              { who: "actor", text: "Did you hear that? That was {lost}.", mood: "afraid", gesture: "point" },
              { who: "leader", text: "It wasn't. Look at me. Only at me.", mood: "pleading", gesture: "clutch" },
              { who: "actor", text: "It knew my pet name. Only {lost} knew that.", mood: "afraid" },
            ],
          ),
          t(o("It does not help. {actor} stares at nothing all night, and at dawn is still staring.", [fx.nerve("actor", -3), fx.trust("actor", 2), fx.nerve("leader", -1)], 1, [{ if: has("actor", "coward"), add: 1 }]), [
            { who: "actor", text: "Go to bed. You can't fix this.", mood: "cold", alt: { kind: "Thank you. It doesn't help. But thank you." } },
          ]),
        ],
      },
    },
    {
      id: "work",
      label: "Give {actor} work to do",
      hint: "Some grief wants a task. Some grief wants blood.",
      results: {
        any: [
          t(
            o("{actor} greases every axle in the train and does not stop till dark. It holds them together.", [fx.nerve("actor", 4), fx.trust("actor", 2), fx.repair(3), fx.note("actor", "Worked till dark the day {lost} died.")], 3, [
              { if: has("actor", "stoic"), add: 3 },
              { if: has("actor", "veteran"), add: 2 },
            ]),
            [
              { who: "leader", text: "The axles need grease. Can you?", mood: "calm", alt: { kind: "Would it help to keep your hands busy?" } },
              { who: "actor", text: "Yes. God, yes. Give me something to do.", mood: "grieving", alt: { stoic: "Good. Something that needs doing." } },
            ],
          ),
          t(o("They work, badly, with their face shut. Nobody dares speak to them all day.", [fx.nerve("actor", -2), fx.trust("actor", -3)], 3), [
            { who: "actor", text: "Fine. I'll work. That's all we're for, isn't it.", mood: "cold", gesture: "turn-away", alt: { greedy: "Work. Sure. And who pays {lost}'s share now?" } },
          ]),
          t(o("{actor} throws the wrench down at your feet, hard enough to bounce.", [fx.trust("actor", -6), fx.nerve("actor", -3)], 2, [{ if: has("actor", "hothead"), add: 3 }]), [
            { who: "actor", text: "{lost} isn't cold yet and you want axles greased?", mood: "angry", gesture: "point", alt: { hothead: "You want grease? I'll grease the road with you." } },
            { who: "leader", text: "I'm sorry. I didn't mean it like that.", mood: "grieving", alt: { stoic: "I did. And I'm sorry for it." } },
          ]),
          t(
            o("At dusk the tools lie in the mud. You find {actor} kneeling at the fog's edge, hands in the red.", [fx.fog("actor"), fx.nerve("actor", -5), fx.trust("actor", -2), fx.note("actor", "Knelt at the edge of the Haze the day {lost} died.")], 1, [
              { if: has("actor", "haunted"), add: 1 },
              { if: has("actor", "coward"), add: 0.5 },
            ]),
            [
              { who: "leader", text: "{actor}! Come back from there. Now.", mood: "afraid" },
              { who: "actor", text: "It's warm. Warm like {lost}'s hand was.", mood: "calm" },
            ],
          ),
        ],
      },
    },
    {
      id: "bury",
      label: "Let {actor} bury {lost} their own way",
      hint: "Costs an hour. The Haze does not wait for graves.",
      hours: 1,
      results: {
        any: [
          t(
            o("{actor} digs alone and carves {lost}'s name into a wagon slat. The whole train stands bareheaded.", [fx.nerve("actor", 5), fx.trust("actor", 5), fx.note("actor", "Buried {lost} with their own hands."), fx.scene("rel-widow-rite", 0.3, true)], 4, [
              { if: has("actor", "pious"), add: 3 },
            ]),
            [
              { who: "actor", text: "Here lies {lost}. Who was good to me.", mood: "grieving", alt: { pious: "Keep {lost} warm, Lord. I can't anymore.", stoic: "{lost}. Good hand. Good heart. That's all." } },
              { who: "leader", text: "Rest easy, {lost}.", mood: "grieving", alt: { pious: "Into Thy hands. Rest easy, {lost}." } },
            ],
          ),
          t(o("{actor} wants {lost} laid facing east, toward home. It takes the whole hour to get it right.", [fx.nerve("actor", 3), fx.trust("actor", 3), fx.scene("rel-widow-rite", 0.3, true)], 2), [
            { who: "actor", text: "No. East. {lost} always wanted to go home.", mood: "pleading" },
            { who: "leader", text: "East it is. Take your time.", mood: "calm" },
          ]),
          t(o("As the last shovel lands, the fog breathes out over the grave. {actor} will not look away from it.", [fx.nerve("actor", -3), fx.nerve("all", -2)], 2, [{ if: has("actor", "haunted"), add: 2 }]), [
            { who: "actor", text: "It breathed. The ground breathed. Did you see?", mood: "afraid" },
            { who: "role:guard", text: "Come away now, {actor}. Come away.", mood: "calm" },
          ]),
          t(o("{actor} buries a bundle with {lost}: their own share of the food. Nobody argues.", [fx.res("rations", -1), fx.nerve("actor", 4)], 1, [{ if: has("actor", "kind"), add: 1 }]), [
            { who: "actor", text: "{lost} never once had enough. Not on this road.", mood: "grieving" },
          ]),
        ],
      },
    },
    {
      id: "alone",
      label: "Leave {actor} alone with {lost}",
      hint: "Some people want no one near them. Some only say so.",
      results: {
        any: [
          t(o("By morning {actor} has done their crying where nobody saw. They thank you, stiffly.", [fx.nerve("actor", 3), fx.trust("actor", 3)], 3, [{ if: has("actor", "stoic"), add: 3 }]), [
            { who: "actor", text: "Thank you for not hovering.", mood: "calm", alt: { stoic: "Obliged." } },
            { who: "leader", text: "We're here when you want us.", mood: "calm" },
          ]),
          t(o("They sit apart all night. In the morning nothing is said about it, and nothing is better.", [fx.nerve("actor", -2)], 3), [
            { who: "actor", text: "I'm fine.", mood: "cold", vary: ["Don't ask me that.", "Leave it."] },
            { who: "leader", text: "You're not. But all right.", mood: "calm" },
          ]),
          t(o("In the night {actor} takes a lamp and a bottle out past the wagons. The guard drags them back, bleeding.", [fx.nerve("actor", -5), fx.trust("actor", -4), fx.hp("actor", -2)], 2, [
            { if: has("actor", "coward"), add: 2 },
            { if: has("actor", "haunted"), add: 1 },
          ]), [
            { who: "actor", text: "You left me alone with it. All night.", mood: "angry", alt: { coward: "I was so scared. Nobody came. Nobody." } },
            { who: "leader", text: "I thought that's what you wanted.", mood: "grieving" },
          ]),
          t(o("At dawn {actor}'s bedroll is cold. Their tracks lead back to {lost}'s grave, and past it, into the red.", [fx.leave("actor", GONE_INTO_HAZE), fx.nerve("all", -5)], 0.4, [
            { if: has("actor", "haunted"), add: 0.5 },
          ]), [
            { who: "role:scout", text: "Tracks go back. To the grave, and past it.", mood: "afraid", gesture: "point" },
            { who: "leader", text: "Nobody follows. Nobody. Hitch the teams.", mood: "cold", alt: { kind: "God keep you both. Hitch the teams." } },
          ]),
        ],
      },
    },
    {
      id: "impulse",
      label: "Take the lantern off {actor}: they mean to follow {lost}",
      hint: "They keep looking at the red. You have seen that look before.",
      check: { kind: "talk-down", dc: 12, exclude: ["actor"] },
      results: {
        any: [
          t(o("{actor} breaks at last and weeps like a child. Then they sleep, and they stay.", [fx.nerve("actor", 6), fx.trust("actor", 5), fx.note("actor", "Nearly followed {lost} into the Haze. {by} talked them back.")], 4), [
            { who: "by", text: "{lost} wouldn't want you in there. You know that.", mood: "calm", alt: { pious: "{lost} went to God, not into that fog.", veteran: "You don't follow the dead. You carry them.", kind: "Stay with us. Please. We can't lose you too." } },
            { who: "actor", text: "I wasn't going to. I wasn't.", mood: "grieving" },
            { who: "actor", text: "...I was.", mood: "grieving", gesture: "kneel" },
          ], "success"),
          t(o("{actor} hands over the lantern they packed an hour ago. The wick is already trimmed.", [fx.nerve("actor", 3), fx.trust("actor", 3), fx.bond("actor", "by", 8)], 2), [
            { who: "actor", text: "I trimmed it. I was really going.", mood: "afraid", gesture: "offer" },
            { who: "by", text: "Then give it here. We'll keep it lit for you.", mood: "calm" },
          ], "success"),
          t(o("The words land wrong. {actor} goes quiet and hard, and watches the red all night.", [fx.nerve("actor", -4), fx.trust("actor", -4)], 3), [
            { who: "by", text: "You can't just walk into it, {actor}.", mood: "pleading" },
            { who: "actor", text: "Then watch me all night. See if I don't.", mood: "cold", alt: { hothead: "Who asked you? Who asked any of you?" } },
          ], "fail"),
          t(o("{actor} bolts for the fog. You catch them at its edge, and both of you breathe it.", [fx.fog("actor"), fx.fog("leader"), fx.nerve("actor", -3), fx.hp("leader", -2)], 1, [
            { if: has("actor", "haunted"), add: 1 },
            { if: has("actor", "coward"), add: 0.5 },
          ]), [
            { who: "leader", text: "Grab them! Grab their coat!", mood: "afraid" },
            { who: "actor", text: "Let go! {lost} is in there!", mood: "pleading" },
          ], "fail"),
          t(o("{actor} walks into the red without hurrying. The lantern glows a while, then doesn't.", [fx.leave("actor", GONE_INTO_HAZE), fx.nerve("all", -6)], 0.4), [
            { who: "by", text: "{actor}, no! Come back!", mood: "afraid" },
            { who: "leader", text: "Let them go. God help us. Let them go.", mood: "grieving" },
          ], "fail"),
        ],
      },
    },
  ],
};

const WIDOW_RITE: SceneDef = {
  id: "rel-widow-rite",
  kind: "crisis",
  weight: 0,
  bound: true,
  title: "A rite for {lost}",
  intro: ["The teams are hitched. {actor} stands at the grave and asks the train to wait one minute more."],
  talk: [
    { who: "actor", text: "Somebody say something for {lost}. I can't.", mood: "pleading", alt: { stoic: "One minute. Someone say something for {lost}.", pious: "Will you pray with me? For {lost}?" } },
    { who: "leader", text: "The Haze is close, {actor}.", mood: "calm", vary: ["We're losing the light, {actor}."] },
    { who: "actor", text: "It's always close. {lost} was only here once.", mood: "grieving" },
  ],
  options: [
    {
      id: "words",
      label: "Say a few words over {lost}",
      hint: "Half an hour, and everyone stands still for it.",
      hours: 0.5,
      results: {
        any: [
          t(o("You say what you knew of {lost}. It isn't much, but it's true, and {actor} nods at every line.", [fx.nerve("actor", 4), fx.trust("actor", 4), fx.nerve("all", 1), fx.note("actor", "Heard the wagon-master speak over {lost}'s grave.")], 3), [
            { who: "leader", text: "{lost} pulled their weight and never complained. Much.", mood: "grieving", alt: { pious: "{lost} was a good soul. Keep them, Lord.", kind: "{lost} made this train kinder. We'll miss that." } },
            { who: "actor", text: "Much. Yes. That's {lost}.", mood: "grieving" },
          ]),
          t(o("One by one, the others add a line. Some are funny. Nobody hurries.", [fx.nerve("actor", 5), fx.bondAll(1), fx.hours(0.5)], 2, [{ if: { trait: "charming" }, add: 1 }]), [
            { who: "role:guard", text: "{lost} owed me two biscuits. Consider it square.", mood: "calm" },
            { who: "actor", text: "Thank you. All of you.", mood: "grieving" },
          ]),
          t(o("Halfway through, the wind turns and brings the smell of clean linen. You finish quickly.", [fx.nerve("actor", 1), fx.nerve("all", -1)], 1), [
            { who: "leader", text: "Amen. Wagons. Now.", mood: "afraid" },
            { who: "actor", text: "It wants {lost} too. It can't have them.", mood: "angry" },
          ]),
        ],
      },
    },
    {
      id: "keepsake",
      label: "Let {actor} keep something of {lost}'s",
      hint: "A button, a lock of hair. It costs nothing but the minute.",
      results: {
        any: [
          t(o("{actor} cuts a button from {lost}'s coat and sews it inside their own collar.", [fx.nerve("actor", 3), fx.note("actor", "Wears a button from {lost}'s coat.")], 3), [
            { who: "actor", text: "So {lost} rides with me. The rest of the way.", mood: "calm" },
          ]),
          t(o("{actor} takes {lost}'s hat. By noon they are wearing it, and nobody says a word.", [fx.nerve("actor", 2), fx.trust("actor", 2)], 2), [
            { who: "actor", text: "Does it look stupid? Don't answer that.", mood: "grieving", alt: { stoic: "It's a good hat. Shame to bury it." } },
          ]),
          t(o("The keepsake is a lock of hair. At night {actor} holds it and faces the fog, not the fire.", [fx.nerve("actor", -2), fx.note("actor", "Holds a lock of {lost}'s hair toward the Haze at night.")], 1, [{ if: has("actor", "haunted"), add: 2 }]), [
            { who: "actor", text: "It's warmer this way. Toward the red.", mood: "calm" },
          ]),
        ],
      },
    },
    {
      id: "roll",
      label: "No more time. Roll out.",
      hint: "The living come first. Not everyone agrees.",
      results: {
        any: [
          t(o("{actor} climbs up without a word and does not look back once.", [fx.trust("actor", -4), fx.nerve("actor", -2)], 3), [
            { who: "leader", text: "I'm sorry. We can't stay.", mood: "grieving", alt: { stoic: "We roll. I'm sorry." } },
            { who: "actor", text: "No. Of course we can't.", mood: "cold", gesture: "turn-away" },
          ]),
          t(o("{actor} nods. They understand. It is almost worse that they do.", [fx.trust("actor", -1), fx.nerve("actor", -1)], 2, [{ if: has("actor", "stoic"), add: 2 }, { if: has("actor", "veteran"), add: 2 }]), [
            { who: "actor", text: "{lost} would have said the same. Roll out.", mood: "calm" },
          ]),
          t(o("{actor} runs back once, to the grave, and has to be called three times.", [fx.trust("actor", -3), fx.nerve("actor", -3), fx.hours(0.5)], 1), [
            { who: "actor", text: "I forgot to say goodbye. I forgot!", mood: "pleading" },
          ]),
        ],
      },
    },
  ],
};

const GRIEF_FRIEND: SceneDef = {
  id: "rel-grief-friend",
  kind: "crisis",
  weight: 0,
  bound: true,
  title: "Missing {lost}",
  intro: ["{actor} sits in {lost}'s old place at the fire, with {lost}'s tin cup beside them, full and going cold."],
  talk: [
    {
      who: "actor",
      text: "{lost} owed me a dollar. Isn't that stupid? A dollar.",
      mood: "grieving",
      vary: ["{lost} always sat right here. Right here.", "I keep saving {lost} a biscuit. Habit, I suppose."],
      alt: {
        stoic: "{lost} was a good hand. That's all there is.",
        haunted: "{lost}'s still here. The ground's warm where they sat.",
        pious: "I prayed for {lost} every night. It didn't take.",
        hothead: "{lost} should've let me go instead. Should've been me.",
      },
    },
    { who: "leader", text: "You two were close.", mood: "calm", vary: ["You and {lost} were thick as thieves.", "I know what {lost} was to you."] },
    {
      who: "actor",
      text: "Close. Yes. We were close.",
      mood: "grieving",
      gesture: "turn-away",
      vary: ["Friends. Good friends. That's all.", "Don't. Don't say what we were."],
      alt: { stoic: "Aye.", hothead: "What would you know about it?", charming: "Closer than anyone on this road. Leave it there." },
    },
  ],
  options: [
    {
      id: "comfort",
      label: "Put an arm around {actor}",
      results: {
        any: [
          t(o("{actor} leans into it for a moment, then straightens and wipes their face.", [fx.nerve("actor", 4), fx.trust("actor", 3)], 4, [{ if: { trait: "kind" }, add: 1 }]), [
            { who: "actor", text: "Thanks. I'm all right.", mood: "grieving", alt: { stoic: "That'll do. Thank you." } },
            { who: "leader", text: "You're not. That's allowed.", mood: "calm" },
          ]),
          t(o("{actor} shrugs it off. Whatever they need, it isn't an arm around them.", [fx.nerve("actor", -1)], 2, [{ if: has("actor", "paranoid"), add: 2 }]), [
            { who: "actor", text: "Don't. Please. I'll come apart.", mood: "pleading", gesture: "raise-hands" },
          ]),
          t(o("{actor} holds on too long and too hard, and says {lost}'s name into your coat like a confession.", [fx.nerve("actor", 3), fx.trust("actor", 4), fx.note("actor", "Wept for {lost} harder than anyone understood.")], 2), [
            { who: "actor", text: "It wasn't just... I can't. Forget I said it.", mood: "grieving", vary: ["Nobody knew. Nobody's going to know now."] },
            { who: "leader", text: "I'm not asking.", mood: "calm" },
          ]),
        ],
      },
    },
    {
      id: "task",
      label: "Give {actor} {lost}'s duties",
      hint: "Someone has to take up the work {lost} did.",
      results: {
        any: [
          t(o("{actor} takes on {lost}'s work without a word and does it well. It seems to help.", [fx.nerve("actor", 3), fx.trust("actor", 2), fx.note("actor", "Took up {lost}'s duties.")], 3, [
            { if: has("actor", "stoic"), add: 2 },
            { if: has("actor", "veteran"), add: 1 },
          ]), [
            { who: "actor", text: "I know how {lost} did it. I'll do it the same.", mood: "calm" },
          ]),
          t(o("{actor} does {lost}'s jobs exactly as {lost} did, knot for knot. It is hard to watch.", [fx.nerve("actor", -1), fx.trust("actor", 1)], 2), [
            { who: "leader", text: "That's {lost}'s knot.", mood: "calm" },
            { who: "actor", text: "{lost} taught me. It's what I've got left.", mood: "grieving", vary: ["{lost} taught me that one. Nights on watch."] },
          ]),
          t(o("{actor} refuses. It would feel, they say, like robbing a grave.", [fx.trust("actor", -3), fx.nerve("actor", -2)], 2, [
            { if: has("actor", "hothead"), add: 1 },
            { if: has("actor", "haunted"), add: 1 },
          ]), [
            { who: "actor", text: "Those were {lost}'s. Get somebody else.", mood: "angry", gesture: "turn-away", alt: { haunted: "{lost} still does them. At night. I hear it." } },
          ]),
        ],
      },
    },
    {
      id: "memory",
      label: "Tell a story about {lost}",
      hint: "Remembering out loud can go either way.",
      results: {
        any: [
          t(o("You tell the one about {lost} and the mule at the ford. {actor} laughs, then cries, then laughs.", [fx.nerve("actor", 5), fx.trust("actor", 3), fx.note("actor", "Laughed about {lost} and the mule, the night after.")], 4, [{ if: { trait: "charming" }, add: 1 }]), [
            { who: "leader", text: "Remember {lost} and that mule at the ford?", mood: "calm" },
            { who: "actor", text: "Oh God. The mule. {lost} was soaked to the neck.", mood: "grieving", alt: { stoic: "The mule. Aye. I remember." } },
          ]),
          t(o("{actor} tells one back, one you never heard, from a night the two of them spent on watch. They stop halfway.", [fx.nerve("actor", 2), fx.trust("actor", 2)], 2), [
            { who: "actor", text: "One night on watch, {lost} and I... never mind.", mood: "grieving" },
            { who: "leader", text: "Go on.", mood: "calm" },
            { who: "actor", text: "No. That one's mine.", mood: "cold", vary: ["No. I'll keep that one."] },
          ]),
          t(o("You get a detail wrong. {actor} corrects you sharply, then apologises.", [fx.nerve("actor", -2), fx.trust("actor", -2)], 2), [
            { who: "actor", text: "Blue. {lost}'s coat was blue. Not brown.", mood: "angry", alt: { kind: "It was blue, actually. Sorry. It matters." } },
            { who: "leader", text: "Blue. I'm sorry.", mood: "grieving" },
          ]),
        ],
      },
    },
    {
      id: "tell",
      label: "Tell the train how hard {actor} is taking it",
      hint: "The others might rally round. Or {actor} might hate being seen.",
      results: {
        any: [
          t(o("The others come by one at a time, with coffee, with nothing to say. It is enough.", [fx.nerve("actor", 4), fx.trust("actor", 2), fx.bond("actor", "others", 2)], 3), [
            { who: "role:medic", text: "Drink this. It's only coffee, but drink it.", mood: "calm" },
            { who: "actor", text: "Thank you. All of you.", mood: "grieving" },
          ]),
          t(o("{actor} feels paraded. They take their blanket to the far wagon and speak to no one.", [fx.trust("actor", -5), fx.nerve("actor", -2)], 2, [
            { if: has("actor", "paranoid"), add: 2 },
            { if: has("actor", "stoic"), add: 1 },
          ]), [
            { who: "actor", text: "You had no right. That was mine to tell.", mood: "angry" },
          ]),
          t(o("Someone says {actor} grieves like a widow. It is meant kindly. {actor} goes white.", [fx.nerve("actor", -3), fx.trust("actor", -1)], 1), [
            { who: "actor", text: "Like a what? Who said that?", mood: "afraid" },
            { who: "leader", text: "Nobody meant anything by it.", mood: "calm" },
          ]),
        ],
      },
    },
    {
      id: "let-be",
      label: "Say nothing. Let it be.",
      results: {
        any: [
          t(o("{actor} grieves quietly and is back on the line by morning.", [fx.nerve("actor", -1)], 3, [{ if: has("actor", "stoic"), add: 3 }]), [
            { who: "actor", text: "Give me a day. I'll be all right.", mood: "calm" },
          ]),
          t(o("Days on, {actor} still sets out two cups at supper, and pours one on the ground.", [fx.nerve("actor", -3), fx.note("actor", "Pours out a cup for {lost} every night.")], 2), [
            { who: "actor", text: "That one's for {lost}. Don't mind me.", mood: "grieving" },
          ]),
          t(o("{actor} is found at the rear wagon, talking softly to the fog as though it answers.", [fx.nerve("actor", -4), fx.nerve("leader", -1)], 1, [{ if: has("actor", "haunted"), add: 1.5 }]), [
            { who: "actor", text: "{lost} says it isn't so bad in there.", mood: "calm" },
            { who: "leader", text: "{actor}. Come away from there.", mood: "afraid" },
          ]),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// The vigil
// ---------------------------------------------------------------------------

const VIGIL: SceneDef = {
  id: "rel-vigil",
  kind: "crisis",
  weight: 0,
  bound: true,
  title: "{actor} will not leave {other}",
  intro: ["{other} is fevered and failing. {actor} has dragged a crate beside the pallet and will not be moved."],
  talk: [
    {
      who: "actor",
      text: "I'm staying. Don't ask me to go.",
      mood: "pleading",
      alt: {
        hothead: "Try and move me. Go on. Try.",
        coward: "Please don't make me go. Please.",
        stoic: "I'll sit. Someone should.",
        pious: "I'll sit. And pray, if nobody minds it.",
        paranoid: "I'm not leaving {other} alone with any of you.",
      },
    },
    {
      who: "other",
      text: "You smell of woodsmoke. You always smell of woodsmoke.",
      mood: "calm",
      vary: ["Is it night already? It's so hard to tell.", "Stop looking at me like that. I'm fine."],
      alt: { stoic: "Go to bed, {actor}. I'm not going anywhere.", haunted: "There are people at the foot of the bed. Who are they?" },
    },
    { who: "leader", text: "How long has {other} been like this?", mood: "calm" },
    { who: "actor", text: "Since noon. Worse every hour.", mood: "afraid", alt: { paranoid: "Since noon. And nobody noticed. Nobody but me." } },
  ],
  options: [
    {
      id: "sit",
      label: "Let {actor} sit with {other}",
      hint: "They'll be worn out tomorrow. It may steady them.",
      results: {
        any: [
          t(o("{actor} holds {other}'s hand all night and talks about nothing. Toward dawn, {other} sleeps easier.", [fx.nerve("actor", 4), fx.bond("actor", "other", 6), fx.note("actor", "Sat all night beside {other}.")], 4, [{ if: COUPLE, add: 1 }]), [
            { who: "actor", text: "Remember the dance at Tallow? You trod on my feet.", mood: "calm", vary: ["Remember the river? You swore it was shallow."] },
            { who: "other", text: "You trod on mine. I was being polite.", mood: "calm" },
          ]),
          t(o("Near midnight {other} wakes clear-eyed and says something only {actor} can hear.", [fx.nerve("actor", 2), fx.bond("actor", "other", 8), fx.note("actor", "Made {other} a promise by lamplight.")], 3), [
            { who: "other", text: "Listen. If I go, you keep walking. Promise.", mood: "pleading", alt: { hothead: "If I go, don't you dare do anything stupid." } },
            { who: "actor", text: "Don't talk like that.", mood: "grieving" },
            { who: "other", text: "Promise me.", mood: "pleading", gesture: "clutch" },
          ]),
          t(o("{actor} doesn't close their eyes once. By morning their hands are shaking.", [fx.nerve("actor", -3), fx.hp("actor", -2), fx.bond("actor", "other", 5)], 2), [
            { who: "actor", text: "I'm fine. Don't you send me to bed.", mood: "cold" },
          ]),
          t(
            o("At the darkest hour {actor} slips out toward the red for a cure the fog promised. They come back grey-lipped and empty-handed.", [fx.fog("actor"), fx.hp("actor", -3), fx.nerve("actor", -2), fx.bond("actor", "other", 6), fx.note("actor", "Went into the Haze for a cure for {other}.")], 1, [
              { if: has("actor", "haunted"), add: 1.5 },
            ]),
            [
              { who: "actor", text: "There's something in the red that heals. It told me.", mood: "calm" },
              { who: "leader", text: "You're exhausted. Sit down.", mood: "afraid" },
              { who: "actor", text: "It lied. It smelled like clean sheets and it lied.", mood: "grieving" },
            ],
          ),
        ],
      },
    },
    {
      id: "sleep",
      label: "Order {actor} to bed",
      hint: "Someone has to be fit to drive tomorrow.",
      results: {
        any: [
          t(o("{actor} goes, stiff with anger. They sleep like the dead, and hate that they did.", [fx.trust("actor", -4), fx.nerve("actor", 2)], 3, [
            { if: has("actor", "stoic"), add: 2 },
            { if: has("actor", "veteran"), add: 1 },
          ]), [
            { who: "leader", text: "Bed. I'll wake you if anything changes.", mood: "calm", alt: { kind: "Sleep. I'll sit with {other}. I promise." } },
            { who: "actor", text: "You'd better. You'd better.", mood: "cold" },
          ]),
          t(o("{actor} lies down and does not sleep. You can hear them listening to {other} breathe.", [fx.trust("actor", -3), fx.nerve("actor", -2)], 3), [
            { who: "actor", text: "I can hear every breath from here. Every one.", mood: "afraid" },
          ]),
          t(o("{actor} refuses outright, in front of everyone. It costs you something to let it stand.", [fx.trust("actor", -6), fx.trust("others", -1)], 2, [{ if: has("actor", "hothead"), add: 3 }]), [
            { who: "actor", text: "No. You'll have to drag me.", mood: "angry", alt: { hothead: "Lay a hand on me and see what happens." } },
            { who: "leader", text: "...Fine. Stay.", mood: "cold" },
          ]),
          t(o("{actor} goes. At dawn they swear {other} called for them in the night, and no one came.", [fx.nerve("actor", -5), fx.note("actor", "Was sent to bed the night {other} called for them.")], 1, [
            { if: has("actor", "coward"), add: 1 },
            { if: has("actor", "haunted"), add: 1 },
          ]), [
            { who: "actor", text: "{other} called my name. I heard it. I was asleep.", mood: "grieving" },
          ]),
        ],
      },
    },
    {
      id: "physic",
      label: "Spend a dose of physic here, tonight",
      hint: "Eases the night. It is not the treatment; that still needs doing.",
      cost: { medicine: 1 },
      results: {
        any: [
          t(o("The draught loosens {other}'s breathing. {actor} weeps quietly with relief.", [fx.nerve("actor", 5), fx.trust("actor", 6), fx.hp("other", 4), fx.note("actor", "Wept with relief when the physic took for {other}.")], 4, [{ if: { role: "medic" }, add: 2 }]), [
            { who: "actor", text: "Thank you. I won't forget it. Ever.", mood: "grieving", alt: { greedy: "That's a dose off the stores. For {other}. I'll remember.", stoic: "Thank you. I owe you." } },
            { who: "other", text: "Oh. That's better. That's much better.", mood: "calm" },
          ]),
          t(o("The dose takes the pain, and {other}'s wits with it. They talk to people who aren't there.", [fx.nerve("actor", 1), fx.trust("actor", 4), fx.hp("other", 2)], 2), [
            { who: "other", text: "Mama? Is the kettle on?", mood: "calm" },
            { who: "actor", text: "It's on. Go to sleep, love.", mood: "grieving", alt: { stoic: "Kettle's on. Sleep now." } },
          ]),
          t(o("{other} fights the spoon, then swallows. The night goes quieter, and {actor} is grateful.", [fx.nerve("actor", 3), fx.trust("actor", 5), fx.hp("other", 3)], 2), [
            { who: "other", text: "Don't waste it on me.", mood: "pleading", alt: { stoic: "Save it for someone who'll live." } },
            { who: "actor", text: "Shut up and swallow. Please.", mood: "pleading" },
          ]),
        ],
      },
    },
    {
      id: "goodbye",
      label: "Give them the night alone together",
      hint: "No one comes near. Whatever needs saying gets said.",
      results: {
        any: [
          t(o("By morning {actor}'s face is swollen, calm, and very old.", [fx.nerve("actor", 3), fx.bond("actor", "other", 10), fx.note("actor", "Said everything to {other}, in case.")], 3), [
            { who: "actor", text: "We said it all. Everything. In case.", mood: "grieving" },
            { who: "leader", text: "Good. That's good.", mood: "calm" },
          ]),
          t(o("Through the canvas, {other} laughs once. It is the best sound in the camp for a week.", [fx.nerve("actor", 4), fx.nerve("others", 1), fx.bond("actor", "other", 6)], 2), [
            { who: "other", text: "You're a terrible singer. Keep going.", mood: "calm" },
            { who: "actor", text: "I know. I will.", mood: "grieving" },
          ]),
          t(o("Low voices, then a long silence. {actor} comes out at dawn and will not say what was said.", [fx.bond("actor", "other", 6), fx.nerve("actor", -1)], 2), [
            { who: "actor", text: "Don't ask. That's between us.", mood: "cold", vary: ["{other} told me something. It stays with me."] },
          ]),
          t(
            o("Before dawn {actor} goes an hour into the red after moss the old wives swear by. They come back coughing, clutching a grey fistful.", [fx.fog("actor"), fx.hp("actor", -2), fx.trust("actor", -2), fx.bond("actor", "other", 6)], 1, [
              { if: has("actor", "haunted"), add: 1 },
              { if: has("actor", "pious"), add: -0.5 },
            ]),
            [
              { who: "actor", text: "Red moss. It grows in the fog. It cures fevers.", mood: "pleading" },
              { who: "leader", text: "That's a story, {actor}.", mood: "afraid" },
              { who: "actor", text: "Then let it be a story that works.", mood: "cold" },
            ],
          ),
        ],
      },
    },
    {
      id: "quarantine",
      label: "Keep the others back: it may be catching",
      hint: "Protects the train. {actor} is left alone with it.",
      results: {
        any: [
          t(o("Nobody goes near the pallet but {actor}. The train sleeps easier. {actor} does not.", [fx.nerve("actor", -2), fx.trust("actor", -2), fx.bond("actor", "other", 4)], 3), [
            { who: "role:medic", text: "Nobody near {other}. Could be catching.", mood: "cold" },
            { who: "actor", text: "It isn't catching. It's just {other}.", mood: "angry" },
          ]),
          t(o("The others take it as leave to fear {other}. Someone moves their bedroll upwind.", [fx.nerve("actor", -3), fx.trust("actor", -3), fx.bond("actor", "others", -3)], 2, [{ if: { trait: "paranoid" }, add: 2 }]), [
            { who: "actor", text: "Look at them. Like {other}'s a leper.", mood: "angry", gesture: "point" },
          ]),
          t(o("Alone together, the two of them talk all night. It was, {actor} says later, a gift.", [fx.nerve("actor", 3), fx.trust("actor", 3), fx.bond("actor", "other", 8)], 2), [
            { who: "actor", text: "Thank you for keeping them off. We needed it.", mood: "calm" },
            { who: "other", text: "Tell them it's not catching. Only dying.", mood: "calm", alt: { hothead: "Tell them I'll bite if they come near." } },
          ]),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// A lover who wants to follow
// ---------------------------------------------------------------------------

const LOVER_FOLLOWS: SceneDef = {
  id: "rel-lover-follows",
  kind: "crisis",
  weight: 0,
  bound: true,
  title: "{actor} wants to go after {lost}",
  intro: ["{lost}'s bedroll is gone, and {lost} with it. {actor} is packing their own with shaking hands."],
  talk: [
    {
      who: "actor",
      text: "I'm going after {lost}. Don't try to stop me.",
      mood: "pleading",
      alt: {
        coward: "I have to go after {lost}. Don't I? Don't I?",
        stoic: "{lost} went. I'm going too. That's all.",
        hothead: "Get out of my way. I'm going after {lost}.",
        pious: "Whither {lost} goes, I go. That was the vow.",
        paranoid: "Somebody drove {lost} off. I'll find out who.",
      },
    },
    { who: "leader", text: "Out there? At night? With the Haze behind us?", mood: "afraid" },
    {
      who: "actor",
      text: "{lost} is alone out there. Every hour, further.",
      mood: "grieving",
      vary: ["{lost} didn't even say goodbye. Why not say goodbye?", "{lost} left me half the blanket. Half. Like that helps."],
    },
  ],
  options: [
    {
      id: "forbid",
      label: "Forbid it. Nobody leaves.",
      results: {
        any: [
          t(o("{actor} unpacks, one thing at a time, and does not look at you for two days.", [fx.trust("actor", -6), fx.nerve("actor", -4), fx.note("actor", "Was forbidden to follow {lost}.")], 3, [
            { if: has("actor", "stoic"), add: 1 },
            { if: has("actor", "veteran"), add: 1 },
          ]), [
            { who: "leader", text: "No one leaves this train. Not tonight.", mood: "cold" },
            { who: "actor", text: "Then I hope you sleep well.", mood: "cold", alt: { coward: "All right. All right. I'm sorry." } },
          ]),
          t(o("{actor} obeys. Something goes out of them, though, and does not come back.", [fx.nerve("actor", -7), fx.trust("actor", -3), fx.note("actor", "Stayed when {lost} left. Never quite the same.")], 2), [
            { who: "actor", text: "Fine. {lost} made a choice. So did I, I suppose.", mood: "grieving" },
          ]),
          t(o("In the night {actor} goes anyway, with a lamp and a share of the food.", [fx.leave("actor", WENT_AFTER, { rations: 2 }), fx.nerve("all", -3)], 1, [{ if: has("actor", "hothead"), add: 1.5 }]), [
            { who: "role:guard", text: "{actor}'s gone. Took a lamp and rations.", mood: "afraid" },
            { who: "leader", text: "Of course they did.", mood: "grieving" },
          ]),
        ],
      },
    },
    {
      id: "let-go",
      label: "Let {actor} go, with a share of the stores",
      hint: "They take two days of rations. You lose a pair of hands.",
      results: {
        any: [
          t(o("{actor} hugs you hard, then walks down the back road with a lamp, calling {lost}'s name.", [fx.leave("actor", WENT_AFTER, { rations: 2 }), fx.nerve("others", -2)], 3), [
            { who: "actor", text: "Thank you. Tell them I wasn't a coward.", mood: "grieving", alt: { coward: "Tell them I went. That I actually went." } },
            { who: "leader", text: "Go on. Find {lost}.", mood: "grieving" },
          ]),
          t(o("At the last moment {actor} can't do it. They stand at the edge of the light a long while, then come back.", [fx.nerve("actor", -5), fx.trust("actor", 3), fx.note("actor", "Nearly followed {lost}, and could not.")], 1, [
            { if: has("actor", "coward"), add: 2 },
            { if: has("actor", "stoic"), add: 1 },
          ]), [
            { who: "actor", text: "I can't. I'm not brave enough. God forgive me.", mood: "grieving", alt: { stoic: "No. We'd both be dead by morning. I know it." } },
          ]),
          t(o("They go. An hour later, far back down the road, a lamp goes out in the red.", [fx.leave("actor", WENT_AFTER, { rations: 2 }), fx.nerve("all", -4)], 1), [
            { who: "role:scout", text: "Lamp's gone. Back there, in the red.", mood: "afraid", gesture: "point" },
            { who: "leader", text: "Don't say it. Don't.", mood: "grieving" },
          ]),
        ],
      },
    },
    {
      id: "persuade",
      label: "Talk {actor} into staying",
      hint: "Somebody who knows them has to find the words.",
      check: { kind: "persuade", dc: 12, exclude: ["actor"] },
      results: {
        any: [
          t(o("{actor} sits down on the pack and cries. They stay.", [fx.nerve("actor", 2), fx.trust("actor", 4), fx.bond("actor", "by", 6), fx.note("actor", "Stayed with the train when {lost} left.")], 4), [
            { who: "by", text: "{lost} chose to go. You didn't. You're still ours.", mood: "calm", alt: { kind: "We need you here. I need you here.", pious: "Your vow was till death. This isn't death.", charming: "Stay. Who else will laugh at my stories?" } },
            { who: "actor", text: "Why didn't {lost} ask me? Why not ask?", mood: "grieving" },
          ], "success"),
          t(o("{actor} stays, and gives you something of {lost}'s to keep so they won't have to look at it.", [fx.trust("actor", 6), fx.nerve("actor", -1)], 2), [
            { who: "actor", text: "Keep this. {lost}'s knife. I can't look at it.", mood: "grieving", gesture: "offer" },
          ], "success"),
          t(o("{actor} hears {by} out politely, then shoulders the pack.", [fx.leave("actor", WENT_AFTER, { rations: 2 }), fx.nerve("by", -2)], 3), [
            { who: "by", text: "Please. Think about it till morning.", mood: "pleading" },
            { who: "actor", text: "I've thought. Every mile, I've thought.", mood: "calm", gesture: "turn-away" },
          ], "fail"),
          t(o("{actor} stays. But they stay like a stone, and the whole train feels it.", [fx.nerve("actor", -6), fx.trust("actor", -4), fx.nerve("others", -1)], 2), [
            { who: "actor", text: "I'll stay. Don't expect me to thank you.", mood: "cold" },
          ], "fail"),
        ],
      },
    },
    {
      id: "search",
      label: "Go back with {actor} and look",
      hint: "Hours spent walking toward the Haze. {lost} may not want finding.",
      hours: 3,
      results: {
        any: [
          t(o("You find tracks, and a strip of cloth on a thorn, and then only fog. {actor} lets you lead them home.", [fx.nerve("actor", -3), fx.trust("actor", 6), fx.note("actor", "Searched the back road for {lost} with the wagon-master.")], 3), [
            { who: "actor", text: "That's {lost}'s. From {lost}'s coat.", mood: "grieving", gesture: "clutch" },
            { who: "leader", text: "We've gone as far as we can.", mood: "grieving" },
          ]),
          t(o("You find {lost} a mile back, sitting on a rock. {lost} won't come. {actor} won't leave {lost} again.", [fx.leave("actor", "stayed behind on the road with the one they loved", { rations: 2 }), fx.nerve("all", -2)], 2), [
            { who: "leader", text: "{lost}. Come back with us. Please.", mood: "pleading" },
            { who: "actor", text: "{lost} won't. So I won't either. Goodbye.", mood: "calm" },
          ]),
          t(o("The fog comes down the road to meet you. You both run, and {actor} breathes it.", [fx.fog("actor"), fx.nerve("actor", -3), fx.trust("actor", 3)], 1, [{ if: { gapBelow: 25 }, add: 1 }]), [
            { who: "leader", text: "Run! Back to the wagons!", mood: "afraid" },
            { who: "actor", text: "{lost}! {lost}, please!", mood: "pleading" },
          ]),
        ],
      },
    },
    {
      id: "farewell",
      label: "Help {actor} say goodbye",
      hint: "Nobody follows. But something is still owed.",
      results: {
        any: [
          t(o("{actor} ties a strip of {lost}'s shirt to the last tailgate. It flutters back toward the road.", [fx.nerve("actor", 3), fx.trust("actor", 3), fx.note("actor", "Tied a strip of {lost}'s shirt to the tailgate.")], 3, [{ if: has("actor", "pious"), add: 2 }]), [
            { who: "actor", text: "So {lost} can find us. If {lost} wants to.", mood: "grieving" },
            { who: "leader", text: "It'll stay there. I'll see to it.", mood: "calm" },
          ]),
          t(o("{actor} shouts {lost}'s name into the dark, once, as loud as they can. Nothing answers.", [fx.nerve("actor", -2), fx.trust("actor", 2)], 2), [
            { who: "actor", text: "{lost}! I'd have come! I'd have come with you!", mood: "pleading" },
          ]),
          t(o("Something answers, in {lost}'s voice, from the wrong direction entirely.", [fx.nerve("actor", -5), fx.nerve("all", -2)], 1, [{ if: has("actor", "haunted"), add: 1 }]), [
            { who: "actor", text: "That's {lost}! That's...", mood: "afraid" },
            { who: "leader", text: "That came from the Haze. Stay here.", mood: "afraid", gesture: "clutch" },
          ]),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// A hurt friend, and someone who would go back for them
// ---------------------------------------------------------------------------

const LOYALTY_RESCUE: SceneDef = {
  id: "rel-loyalty-rescue",
  kind: "crisis",
  weight: 0,
  bound: true,
  title: "{actor} wants to go back",
  intro: ["Dusk. {other}'s wound is going bad, and {actor} is lacing their boots to go back down the road."],
  talk: [
    {
      who: "actor",
      text: "{other}'s pack is back at the crossing. The salve's in it.",
      mood: "pleading",
      vary: ["There was willow bark by the creek. A mile back. I saw it.", "{other} dropped the pack when we ran. It's all they own."],
      alt: { coward: "I have to go back. I don't want to. I have to." },
    },
    { who: "other", text: "Don't. It isn't worth it. I'm fine.", mood: "pleading", alt: { stoic: "Leave it. I'll mend.", hothead: "I'll go myself. Hand me my boots.", pious: "Don't you dare get hurt on my account." } },
    { who: "leader", text: "A mile back is a mile nearer the Haze.", mood: "cold", vary: ["It's nearly dark. You know what walks the road at dark."] },
    { who: "actor", text: "It's an hour. Less if I run.", mood: "calm", alt: { hothead: "I'm going. You can come or not.", paranoid: "Nobody else will. So I will." } },
  ],
  options: [
    {
      id: "alone",
      label: "Let {actor} go alone",
      hint: "Quick, and nobody else at risk. {actor} is.",
      results: {
        any: [
          t(o("{actor} is back within the hour, muddy to the waist, holding the pack high.", [fx.res("medicine", 1), fx.bond("actor", "other", 8), fx.nerve("actor", 3), fx.note("actor", "Went back alone at dusk for {other}'s pack.")], 3, [
            { if: has("actor", "veteran"), add: 1 },
          ]), [
            { who: "actor", text: "Got it! Salve, and your letters too.", mood: "calm", gesture: "offer" },
            { who: "other", text: "You idiot. Thank you. You idiot.", mood: "grieving" },
          ]),
          t(o("{actor} comes back empty-handed and grey. There were things on the road that walked like men.", [fx.nerve("actor", -6), fx.bond("actor", "other", 4)], 2, [{ if: has("actor", "coward"), add: 1 }]), [
            { who: "actor", text: "It's gone. And there's something on the road.", mood: "afraid" },
            { who: "other", text: "You came back. That's all I wanted.", mood: "grieving" },
          ]),
          t(o("{actor} comes back limping, with half the pack and a gash to the bone.", [fx.wound("actor"), fx.hp("actor", -6), fx.res("medicine", 1), fx.bond("actor", "other", 8)], 2), [
            { who: "other", text: "Look at you. Look what you did.", mood: "grieving" },
            { who: "actor", text: "Scratch. Lie down, will you.", mood: "calm", alt: { stoic: "Salve's there. Use it." } },
          ]),
          t(o("{actor} comes back long after dark, with the pack, smelling of clean linen. They don't remember the last half mile.", [fx.fog("actor"), fx.res("medicine", 1), fx.bond("actor", "other", 6), fx.note("actor", "Lost half an hour in the red, fetching {other}'s pack.")], 0.6), [
            { who: "actor", text: "Did I get it? I got it. Didn't I?", mood: "afraid" },
          ]),
        ],
      },
    },
    {
      id: "together",
      label: "Go with {actor}",
      hint: "Two lamps are safer. The train waits for you.",
      hours: 2,
      results: {
        any: [
          t(o("Together you find it in an hour, half in the creek. On the way back {actor} doesn't stop talking.", [fx.res("medicine", 1), fx.bond("actor", "other", 6), fx.trust("actor", 6), fx.note("actor", "Went back with the wagon-master for {other}'s pack.")], 4), [
            { who: "actor", text: "I'd have gone without you. Glad I didn't have to.", mood: "calm", alt: { stoic: "Obliged. I mean that." } },
          ]),
          t(o("You find nothing but a torn strap. The walk back is long, and darker than it should be.", [fx.trust("actor", 4), fx.nerve("actor", -2), fx.nerve("leader", -2)], 2), [
            { who: "actor", text: "Just the strap. That's all that's left.", mood: "grieving" },
            { who: "leader", text: "We tried. Walk faster.", mood: "afraid" },
          ]),
          t(o("Something follows you back. You keep the lamp high and don't run, and at the wagons it stops.", [fx.res("medicine", 1), fx.nerve("actor", -3), fx.nerve("leader", -3), fx.trust("actor", 5)], 1, [{ if: { gapBelow: 25 }, add: 1 }]), [
            { who: "leader", text: "Don't run. Don't run. Walk.", mood: "afraid" },
            { who: "actor", text: "Is it still there?", mood: "afraid" },
            { who: "leader", text: "Don't look.", mood: "cold" },
          ]),
        ],
      },
    },
    {
      id: "send",
      label: "Send someone steadier in {actor}'s place",
      hint: "{actor} stays by {other}. Somebody else walks the road.",
      check: { kind: "persuade", dc: 12, exclude: ["actor", "other"] },
      results: {
        any: [
          t(o("{by} goes, grumbling, and is back before full dark with the pack.", [fx.res("medicine", 1), fx.bond("by", "other", 5), fx.trust("actor", 3), fx.nerve("actor", 2), fx.note("by", "Fetched {other}'s pack from the road at dusk.")], 3), [
            { who: "by", text: "Fine. But you owe me, {actor}.", mood: "cold", alt: { kind: "Stay with {other}. I'll be quick.", greedy: "Fine. You owe me a day's rations." } },
            { who: "actor", text: "Thank you. I mean it.", mood: "grieving" },
          ], "success"),
          t(o("{by} brings it back, and a bite on the forearm that nobody can name.", [fx.res("medicine", 1), fx.hp("by", -4), fx.nerve("by", -3), fx.bond("by", "actor", 4)], 1), [
            { who: "by", text: "Don't ask what did it. I didn't look.", mood: "afraid" },
          ], "success"),
          t(o("{by} won't go. Now {actor} won't either, and resents the pair of you.", [fx.trust("actor", -4), fx.bond("actor", "by", -5)], 3), [
            { who: "by", text: "Your friend. Your walk.", mood: "cold", alt: { coward: "Not in the dark. Not for anything." } },
            { who: "actor", text: "I'll remember that.", mood: "cold" },
          ], "fail"),
          t(o("{by} refuses, and {actor} goes anyway, alone and in a temper. They come back late with nothing.", [fx.nerve("actor", -4), fx.trust("actor", -3), fx.bond("actor", "by", -3)], 1), [
            { who: "actor", text: "Nothing. Thanks for all the help.", mood: "angry" },
          ], "fail"),
        ],
      },
    },
    {
      id: "forbid",
      label: "Forbid it",
      results: {
        any: [
          t(o("{actor} sits down beside {other} and does not speak to you all evening.", [fx.trust("actor", -5), fx.nerve("actor", -2)], 3), [
            { who: "actor", text: "If {other} gets worse, that's on you.", mood: "cold", alt: { coward: "...Thank you. I didn't want to go.", kind: "All right. I'll sit with {other}, then." } },
          ]),
          t(o("{actor} nods. They know you're right. They hate it.", [fx.trust("actor", -2)], 2, [{ if: has("actor", "stoic"), add: 2 }]), [
            { who: "actor", text: "Right. Of course. Right.", mood: "grieving" },
          ]),
          t(o("{actor} goes anyway, after the lamps are down, and comes back bloodied with the salve.", [fx.wound("actor"), fx.res("medicine", 1), fx.trust("actor", -6), fx.bond("actor", "other", 6)], 1, [{ if: has("actor", "hothead"), add: 2 }]), [
            { who: "actor", text: "Punish me if you like. {other} has the salve.", mood: "cold" },
          ]),
        ],
      },
    },
    {
      id: "light",
      label: "Send {actor} with a torch and a rocket",
      hint: "Light keeps things off the road. For a while.",
      cost: { torches: 1, rockets: 1 },
      results: {
        any: [
          t(o("The rocket goes up over the crossing. In its red glare {actor} snatches the pack and runs back laughing.", [fx.res("medicine", 1), fx.bond("actor", "other", 8), fx.nerve("actor", 4), fx.trust("actor", 3)], 4), [
            { who: "actor", text: "Did you see? Lit up like noon!", mood: "calm" },
            { who: "other", text: "I saw. Idiot. Thank you.", mood: "grieving" },
          ]),
          t(o("The torch keeps the dark off. {actor} finds the pack torn open, and saves what's left.", [fx.res("medicine", 1), fx.bond("actor", "other", 6)], 2), [
            { who: "actor", text: "Something chewed it. Most of the salve's fine.", mood: "calm" },
          ]),
          t(o("The rocket shows the road crowded with pale shapes, all facing the train. {actor} comes back fast, with nothing.", [fx.nerve("all", -3), fx.nerve("actor", -3)], 1), [
            { who: "actor", text: "Don't fire another. Don't ever fire another.", mood: "afraid" },
          ]),
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Rivals: ordinary disputes picked by the dispute picker
// ---------------------------------------------------------------------------

const RIVAL_BRAWL: SceneDef = {
  id: "rel-rival-brawl",
  kind: "dispute",
  weight: 4,
  pairWeight: (_a, _b, bond) => (bond <= -35 ? -bond / 8 : 0),
  title: "Bad blood",
  intro: ["{a} and {b} have circled each other for days. Tonight it is the watch roster that sets them off."],
  talk: [
    {
      who: "a",
      text: "You skipped your watch again, {b}. Third night running.",
      mood: "angry",
      gesture: "point",
      vary: ["I pull twice the weight you do, {b}. Everyone sees it.", "Still telling that story about me, {b}?"],
      alt: { paranoid: "You've been talking about me. Don't think I can't hear.", greedy: "You eat like two and work like half, {b}." },
    },
    { who: "b", text: "Say it louder, {a}. Let them all hear.", mood: "angry", alt: { coward: "Leave me alone, {a}. Please. Just leave it.", stoic: "You've said your piece. Now go.", hothead: "Say it again and I'll break your jaw." } },
    { who: "a", text: "Happily. You're dead weight, and we all carry you.", mood: "cold", alt: { kind: "I'm tired of carrying you, {b}. That's all.", hothead: "Dead weight! Hear that, everyone? Dead weight!" } },
  ],
  options: [
    {
      id: "side-a",
      label: "Back {a}",
      results: {
        any: [
          t(o("{b} takes it in silence. It will come out later, somewhere worse.", [fx.trust("a", 4), fx.trust("b", -6), fx.bond("a", "b", -5), fx.nerve("b", -3)], 3), [
            { who: "leader", text: "{a}'s right. Stand your watches, {b}.", mood: "cold", alt: { kind: "I'm sorry, {b}. But {a}'s right." } },
            { who: "b", text: "Noted. Everything's noted.", mood: "cold", gesture: "turn-away", alt: { coward: "Yes. Sorry. Yes." } },
          ]),
          t(o("{b} doesn't take it. They go for {a} with both hands.", [fx.trust("b", -4), fx.scene("fistfight", 1, true)], 2, [{ if: has("b", "hothead"), add: 2 }]), [
            { who: "b", text: "Two against one, is it? Fine!", mood: "angry" },
          ]),
          t(o("{a} gloats. By morning half the train is quietly on {b}'s side.", [fx.trust("a", 2), fx.trust("b", -4), fx.trust("others", -1), fx.bond("a", "b", -4)], 1), [
            { who: "a", text: "Hear that, {b}? Even the boss says so.", mood: "sly" },
          ]),
        ],
      },
    },
    {
      id: "break",
      label: "Step between them and talk it down",
      hint: "An hour of hard words. Someone level has to do the talking.",
      hours: 1,
      check: { kind: "calm", dc: 12, exclude: ["a", "b"] },
      results: {
        any: [
          t(o("An hour of hard words in low voices. They don't shake hands, but they stop.", [fx.bond("a", "b", 6), fx.nerve("a", 2), fx.nerve("b", 2)], 3, [{ if: { role: "speaker" }, add: 1 }]), [
            { who: "by", text: "You two fight, and we all pay for it.", mood: "calm", alt: { veteran: "I've seen trains die of less. Sit down.", pious: "Both of you. Pray or be quiet." } },
            { who: "a", text: "I'm just tired. Tired of carrying everything.", mood: "grieving" },
            { who: "b", text: "Me too. You think I'm not?", mood: "grieving" },
          ], "success"),
          t(o("Somewhere in the second cup of coffee, they both start laughing at the same thing.", [fx.bond("a", "b", 10), fx.nerve("a", 3), fx.nerve("b", 3), fx.note("a", "Laughed with {b}, for once.")], 1), [
            { who: "a", text: "You do snore, though. Like a boar.", mood: "calm" },
            { who: "b", text: "Better than talking in my sleep. Like you.", mood: "calm" },
          ], "success"),
          t(o("{by} gets shoved for their trouble. It ends, but only just.", [fx.bond("a", "b", -3), fx.hp("by", -2), fx.nerve("by", -2)], 3), [
            { who: "by", text: "All right! All right! I'm going.", mood: "afraid", gesture: "raise-hands" },
          ], "fail"),
          t(o("It goes past words.", [fx.scene("fistfight", 1, true)], 1, [{ if: { trait: "hothead" }, add: 1 }]), [
            { who: "a", text: "Get out of the way, {by}!", mood: "angry" },
          ], "fail"),
        ],
      },
    },
    {
      id: "contest",
      label: "Settle it: a race to mend the loose wheel",
      hint: "Costs a spare. The loser keeps quiet for good.",
      cost: { spares: 1 },
      results: {
        any: [
          t(o("{a} wins by a single peg. {b} admits it, grudgingly. The wheel runs true.", [fx.repair(5), fx.bond("a", "b", 4), fx.trust("a", 2)], 3), [
            { who: "a", text: "Done! Beat you.", mood: "calm" },
            { who: "b", text: "By a peg. One peg.", mood: "cold", alt: { stoic: "Fair's fair. You won." } },
          ]),
          t(o("{b} wins going away, and {a} has to eat every word. The wagon is better for it.", [fx.repair(5), fx.bond("a", "b", 2), fx.nerve("a", -2), fx.trust("b", 2)], 3), [
            { who: "b", text: "Dead weight, was it?", mood: "sly" },
            { who: "a", text: "...Fine. Fine.", mood: "cold", alt: { kind: "Fair. I was wrong. I'm sorry." } },
          ]),
          t(o("Neither will give an inch. They lean on the same spoke and snap it clean.", [fx.repair(-3), fx.bond("a", "b", -4), fx.trust("a", -2), fx.trust("b", -2)], 2, [{ if: { trait: "hothead" }, add: 1 }]), [
            { who: "a", text: "That was you!", mood: "angry" },
            { who: "b", text: "That was you!", mood: "angry" },
          ]),
          t(o("Halfway through they are working together without noticing. When they notice, they both stop.", [fx.repair(4), fx.bond("a", "b", 8)], 1), [
            { who: "b", text: "Hand me the... thanks.", mood: "calm" },
            { who: "a", text: "Don't mention it. Really. Don't.", mood: "calm" },
          ]),
        ],
      },
    },
    {
      id: "separate",
      label: "Split them: point wagon and drag",
      hint: "Keeps the peace. Fixes nothing.",
      results: {
        any: [
          t(o("Front wagon and rear wagon. It works, mostly.", [fx.bond("a", "b", -1), fx.trust("a", -1), fx.trust("b", -1)], 4), [
            { who: "leader", text: "{a} rides point. {b} rides drag. Nobody talks.", mood: "cold" },
            { who: "a", text: "Suits me.", mood: "cold" },
          ]),
          t(o("The train splits along the grudge. People start choosing whose wagon to ride with.", [fx.bondAll(-1), fx.bond("a", "b", -3)], 2), [
            { who: "b", text: "Everyone's riding with {a} now. Wonderful.", mood: "cold", alt: { paranoid: "See? They've all been turned against me." } },
          ]),
          t(o("Riding drag in the dust all day, {b} cools off. By supper it's nearly forgotten.", [fx.bond("a", "b", 3), fx.nerve("b", -1)], 2), [
            { who: "b", text: "I ate a pound of {a}'s dust today. We're even.", mood: "calm" },
          ]),
        ],
      },
    },
    {
      id: "let",
      label: "Let them have it out",
      results: {
        any: [
          t(o("It goes to fists within a minute.", [fx.scene("fistfight", 1, true)], 3, [{ if: { trait: "hothead" }, add: 2 }]), [
            { who: "a", text: "Right. Come on, then.", mood: "angry" },
            { who: "b", text: "Been waiting weeks for this.", mood: "angry", alt: { coward: "No, wait, I didn't mean..." } },
          ]),
          t(o("They shout themselves hoarse and stamp off. Nothing solved, nothing broken.", [fx.bond("a", "b", -2)], 2), [
            { who: "a", text: "Forget it. You're not worth it.", mood: "cold", gesture: "turn-away" },
          ]),
          t(o("{b} says the one thing that can't be unsaid. {a} goes very still.", [fx.bond("a", "b", -8), fx.nerve("a", -3), fx.rel("a", "b", "rival"), fx.note("a", "Heard {b} say the unforgivable thing.")], 1), [
            { who: "b", text: "No wonder your own people sent you west.", mood: "cold" },
            { who: "a", text: "I'll remember that, {b}. All the way.", mood: "cold" },
          ]),
        ],
      },
    },
  ],
};

const SHARED_WATCH: SceneDef = {
  id: "rel-shared-watch",
  kind: "dispute",
  weight: 3,
  pairWeight: (_a, _b, bond) => (bond <= -25 ? -bond / 10 : 0),
  title: "The long watch",
  intro: ["The roster puts {a} and {b} on the dead watch together, two till dawn. Neither has said a word about it."],
  talk: [
    { who: "a", text: "Change the roster. I'm not sitting four hours with {b}.", mood: "angry", alt: { coward: "Please. Not with {b}. Anyone else.", paranoid: "{b} would let it take me. You know that.", stoic: "I'd rather not stand it with {b}." } },
    { who: "b", text: "Suits me. I'd sooner sit with the Haze.", mood: "cold", alt: { stoic: "It's four hours. I'll manage.", hothead: "Scared I'll push you in, {a}?", kind: "I'll behave if {a} will." } },
    { who: "leader", text: "Somebody has to stand it.", mood: "calm", vary: ["The roster's the roster. Unless you give me a reason."] },
  ],
  options: [
    {
      id: "keep",
      label: "Keep them paired. They'll manage.",
      hint: "Four hours in the dark together. It could go either way.",
      results: {
        any: [
          t(o("At dawn they come in together, not talking, but not quite not-talking. Something has eased.", [fx.bond("a", "b", 8), fx.nerve("a", 1), fx.nerve("b", 1), fx.note("a", "Stood the dead watch with {b}. Nobody died.")], 3), [
            { who: "a", text: "{b} kept the fire up. Didn't have to.", mood: "calm" },
            { who: "b", text: "{a} saw it first. Said so. Credit where due.", mood: "calm" },
          ]),
          t(o("They sit back to back for four hours. By dawn it's worse: something was said in the dark.", [fx.bond("a", "b", -8), fx.nerve("a", -2), fx.nerve("b", -2)], 3, [{ if: { trait: "hothead" }, add: 1 }]), [
            { who: "a", text: "Never again. Never with {b}.", mood: "cold" },
            { who: "b", text: "Agreed. First thing we've agreed on.", mood: "cold" },
          ]),
          t(o("Near three, a shape walks out of the red and stands at the edge of the light. They face it together until it goes.", [fx.bond("a", "b", 12), fx.nerve("a", -4), fx.nerve("b", -4), fx.note("a", "Faced something in the fog beside {b}."), fx.note("b", "Faced something in the fog beside {a}.")], 2, [{ if: { gapBelow: 30 }, add: 1 }]), [
            { who: "a", text: "You saw it too. Tell me you saw it.", mood: "afraid" },
            { who: "b", text: "I saw it. I held your arm. Don't tell anyone.", mood: "afraid" },
          ]),
          t(o("A crash in the dark and a shot at a shadow. {a} comes in with a split lip, swearing {b} shoved them toward the fog.", [fx.bond("a", "b", -10), fx.hp("a", -3), fx.res("ammo", -1), fx.nerve("all", -2)], 1, [{ if: has("a", "paranoid"), add: 1 }]), [
            { who: "a", text: "{b} pushed me. Toward it. I felt hands.", mood: "afraid", gesture: "point" },
            { who: "b", text: "You tripped! Over your own feet!", mood: "angry", gesture: "raise-hands" },
          ]),
        ],
      },
    },
    {
      id: "split",
      label: "Split them. Change the roster.",
      hint: "Somebody else loses sleep for it.",
      results: {
        any: [
          t(o("You move {b}'s shift to someone who grumbles about it all the next day.", [fx.trust("a", 3), fx.nerve("leader", -1)], 4), [
            { who: "role:guard", text: "Double watch again? Wonderful.", mood: "cold" },
            { who: "leader", text: "Sorry. Needs must.", mood: "calm" },
          ]),
          t(o("{b} takes it as an insult. They wanted to prove they could stand it.", [fx.trust("b", -4), fx.bond("a", "b", -3)], 2, [{ if: has("b", "hothead"), add: 1 }]), [
            { who: "b", text: "So I'm the problem. Good to know.", mood: "angry" },
          ]),
          t(o("It works. Neither notices the other all day, which is almost a truce.", [fx.bond("a", "b", 2), fx.trust("a", 1), fx.trust("b", 1)], 2), [
            { who: "a", text: "Thanks. I mean it.", mood: "calm" },
          ]),
        ],
      },
    },
    {
      id: "sit",
      label: "Sit the watch with them yourself",
      hint: "Costs you your sleep. The safest choice.",
      hours: 2,
      results: {
        any: [
          t(o("You sit between them. By the second hour all three of you are trading stories.", [fx.bond("a", "b", 6), fx.trust("a", 2), fx.trust("b", 2), fx.nerve("leader", -1)], 4), [
            { who: "leader", text: "Who's got a story? Anybody.", mood: "calm" },
            { who: "a", text: "There was this mule at Tallow...", mood: "calm" },
            { who: "b", text: "Not the mule. God, not the mule again.", mood: "calm" },
          ]),
          t(o("Nothing happens. Nothing changes. You are very tired.", [fx.bond("a", "b", 1), fx.nerve("leader", -2)], 3), [
            { who: "a", text: "Long night.", mood: "cold" },
            { who: "b", text: "Long night.", mood: "cold" },
          ]),
          t(o("Near dawn something moves in the red. The three of you stand shoulder to shoulder until it passes.", [fx.bond("a", "b", 8), fx.nerve("a", -2), fx.nerve("b", -2), fx.nerve("leader", -2)], 1), [
            { who: "b", text: "What was that?", mood: "afraid" },
            { who: "leader", text: "Nothing. Nothing we'll talk about.", mood: "cold" },
          ]),
        ],
      },
    },
    {
      id: "swap",
      label: "Put a friend of both between them",
      hint: "Someone they both like. If that someone will do it.",
      check: { kind: "calm", dc: 11, exclude: ["a", "b"] },
      results: {
        any: [
          t(o("{by} sits between them and talks for four hours. By dawn {a} and {b} are both laughing at {by}.", [fx.bond("a", "b", 7), fx.bond("by", "a", 3), fx.bond("by", "b", 3)], 3), [
            { who: "by", text: "Right. Nobody sleeps, nobody sulks. I'll talk.", mood: "calm", alt: { charming: "Right, children. Story time. Nobody sulks.", stoic: "I'll sit. You two keep your mouths shut." } },
            { who: "a", text: "{by} never stops talking.", mood: "calm" },
            { who: "b", text: "Never. It's almost nice.", mood: "calm" },
          ], "success"),
          t(o("Past three, {by} dozes off. {a} and {b} keep the watch between them, and talk, and keep on talking.", [fx.bond("a", "b", 18), fx.rel("a", "b", "friend"), fx.note("a", "Became friends with {b} on a long watch."), fx.note("b", "Became friends with {a} on a long watch.")], 0.8), [
            { who: "a", text: "Don't wake {by}. We've got it.", mood: "calm" },
            { who: "b", text: "We've got it.", mood: "calm" },
          ], "success"),
          t(o("{by} tries, and ends up the rope in a tug of war. All three come in sour.", [fx.bond("by", "a", -3), fx.bond("by", "b", -3), fx.bond("a", "b", -2), fx.nerve("by", -2)], 3), [
            { who: "by", text: "Never ask me that again. Either of you.", mood: "angry" },
          ], "fail"),
          t(o("{by} steps out past the wagons to relieve themselves and comes back white. They won't say what they saw.", [fx.nerve("by", -4), fx.nerve("a", -2), fx.nerve("b", -2), fx.bond("a", "b", 4)], 1), [
            { who: "by", text: "Nothing. I saw nothing. Keep the fire high.", mood: "afraid" },
            { who: "a", text: "{b}. Build it up. Now.", mood: "afraid" },
          ], "fail"),
        ],
      },
    },
  ],
};

export const BOND_SCENES: SceneDef[] = [GRIEF_LOVER, WIDOW_RITE, GRIEF_FRIEND, VIGIL, LOVER_FOLLOWS, LOYALTY_RESCUE, RIVAL_BRAWL, SHARED_WATCH];
