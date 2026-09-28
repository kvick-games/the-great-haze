// Strangers: each carries a hidden truth (genuine need or a trap). The player
// gets probabilistic tells, never certainty. Tells are consistent across scenes
// so an attentive player can learn the road's grammar:
//   traps    -> too clean, too eager, asks about your supplies first, hidden cover,
//               stories with a hole, the oxen dislike them
//   genuine  -> ask for less than they need, old real wounds, shame, warn you
//               of something before they ask for anything
//
// Setup `talk` is shown before anyone knows the truth, so it is identical in
// both truths. Only the outcome talk differs.

import type { Line, Outcome, SceneDef } from "../../types.ts";
import { fx, o } from "../fx.ts";
import { npcById } from "../npcs.ts";

/** Attach spoken lines (and, for check options, which way the check went) to an outcome. */
function say(out: Outcome, talk: Line[], needs?: "success" | "fail"): Outcome {
  return needs ? { ...out, talk, needs } : { ...out, talk };
}

export const STRANGERS: SceneDef[] = [
  {
    id: "wounded-traveler",
    kind: "stranger",
    weight: 6,
    genuineOdds: 0.5,
    title: "A man on the roadside",
    intro: ["A man slumped against a milestone, his leg bound in a bloody coat. He lifts one hand."],
    stranger: {
      name: "The wounded man",
      look: {
        build: "lean",
        height: "average",
        age: 35,
        skin: "sunburnt, grey underneath",
        hair: { style: "shaggy", color: "dark brown, matted with sweat", facial: "stubble" },
        clothing: ["a linen shirt stiff with dried blood", "a wool coat knotted round his left leg", "brown riding boots"],
        palette: ["dried-blood brown", "dust", "faded linen"],
        prop: { id: "bloody-coat", desc: "a wool coat tied round his thigh as a bandage, soaked dark" },
        marks: ["a split lower lip", "a raised hand that will not stop shaking"],
        summary: "A stubbled man slumped against a stone milestone, one leg bound in a bloodied coat, one hand raised.",
      },
    },
    talk: [
      { who: "stranger", text: "Please. Anything. I've been here since morning.", mood: "pleading", gesture: "raise-hands" },
      { who: "observer", text: "Hold back a second. Let me look at him.", mood: "calm" },
      {
        who: "actor",
        text: "We can't stop for everyone.",
        mood: "cold",
        alt: { kind: "We can't just leave him there.", paranoid: "Count the trees behind him first.", coward: "Please. Let's just keep moving." },
      },
      { who: "leader", text: "Easy. Nobody's leaving yet.", mood: "calm", gesture: "raise-hands" },
    ],
    tells: [
      { text: "The wound is days old. Someone dressed it with care, then could not.", shows: "genuine", p: 0.6, severity: 2, say: "Wound's days old. Somebody dressed it well, once." },
      { text: "He will not meet your eyes when you offer water. Shame, not scheming.", shows: "genuine", p: 0.5, severity: 1, say: "He won't look at me. That's shame, not scheming." },
      { text: "He asks for water first. Not food, not physic, not a ride.", shows: "genuine", p: 0.45, severity: 2, say: "He asked for water. Just water." },
      { text: "His boots are clean. Wherever he limped from, it was not far.", shows: "trap", p: 0.6, severity: 2, say: "His boots are clean. He didn't walk far." },
      { text: "Fresh wheel ruts lead off the road into the trees behind him.", shows: "trap", p: 0.5, severity: 2, say: "Fresh ruts. Going into those trees." },
      { text: "His eyes are not on the wagons. They are on your rifles.", shows: "trap", p: 0.55, severity: 2, say: "He's not looking at us. He's looking at the rifles." },
      { text: "He keeps glancing at the Haze, then away.", shows: "noise", p: 0.4, severity: 1, say: "He keeps looking at the Haze." },
    ],
    options: [
      {
        id: "tend",
        label: "Tend his leg and take him aboard",
        hours: 3,
        hoursMod: { if: { role: "medic" }, mult: 0.6 },
        cost: { medicine: 1 },
        tag: "help",
        results: {
          genuine: [
            say(o("A Company runner, cut down by wolves. He weeps, then tells you a faster road.", [fx.gap([4, 8]), fx.nerve({ trait: "kind" }, 3), fx.recruit(undefined, 0.35), fx.trust("all", 2)], 5), [
              { who: "stranger", text: "Wolves. Three nights back. I thought nobody'd come.", mood: "grieving", gesture: "clutch" },
              { who: "stranger", text: "There's a cut past the creek. Saves you hours.", mood: "calm", gesture: "point" },
              { who: "actor", text: "Rest. We've got you.", alt: { paranoid: "Fine. But I'm keeping his knife." } },
            ]),
            say(o("He dies in the night, pressing a Company cache token into your hand.", [fx.res("rations", [5, 10]), fx.nerve({ trait: "kind" }, 2)], 2), [
              { who: "stranger", text: "The cache at the crossing. Take it. Take it.", mood: "pleading", gesture: "offer" },
              { who: "actor", text: "...", mood: "grieving", gesture: "turn-away" },
            ]),
          ],
          trap: [
            say(o("You are bent over his leg when the first shot comes from the trees.", [fx.hp("actor", [-9, -4]), fx.combat("raiders")], 6), [
              { who: "stranger", text: "Sorry, friend. Truly.", mood: "sly", gesture: "turn-away" },
              { who: "actor", text: "Down! Get down!", mood: "afraid" },
            ]),
            say(o("His leg isn't hurt. Neither are his friends.", [fx.res("ammo", [-6, -3]), fx.res("rations", [-8, -3]), fx.nerve("all", -3)], 3), [
              { who: "stranger", text: "Guns and grub. Slow, now.", mood: "cold", gesture: "draw-weapon" },
              { who: "leader", text: "Give it to them. Nobody dies for flour.", mood: "cold", alt: { hothead: "Let me at least break his nose." } },
            ]),
          ],
        },
      },
      {
        id: "water",
        label: "Leave water and a ration, then go",
        hint: "Not nothing. Not everything.",
        hours: 0.5,
        cost: { rations: 1 },
        tag: "help",
        results: {
          genuine: [
            say(o("He grips {actor}'s hand. It is all he has to give.", [fx.nerve({ trait: "kind" }, 2)], 1), [
              { who: "stranger", text: "God keep you. God keep you.", mood: "grieving", gesture: "clutch" },
              { who: "actor", text: "Drink slow. Someone'll come.", alt: { kind: "I'm sorry. I'm so sorry we can't stay." } },
            ]),
          ],
          trap: [
            say(o("He takes the food without thanks, and watches you to the bend.", [], 1), [
              { who: "stranger", text: "That's it? That's all?", mood: "cold" },
              { who: "observer", text: "Don't turn your back till the bend.", mood: "cold" },
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
            say(o("You drive on. Behind you, he keeps his hand raised.", [fx.nerve({ trait: "kind" }, -5), fx.trust({ trait: "kind" }, -4), fx.flag("refusedGenuine")], 1), [
              { who: "stranger", text: "Please!", mood: "pleading", gesture: "raise-hands" },
              { who: "actor", text: "Don't look back. Don't.", mood: "grieving", alt: { kind: "We left him. We just left him." } },
            ]),
          ],
          trap: [
            say(o("A rifle shot cracks behind you, hits nothing, and does not come again.", [], 1), [
              { who: "observer", text: "Told you. Keep driving.", mood: "cold", alt: { paranoid: "Knew it. Knew it the second I saw him." } },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "mother-and-child",
    kind: "stranger",
    weight: 5,
    genuineOdds: 0.55,
    title: "A woman with a child",
    intro: ["A woman stands in the road holding a bundle. She does not wave. She lifts the blanket."],
    stranger: {
      name: "The woman in the road",
      look: {
        build: "slight",
        height: "average",
        age: 29,
        skin: "sun-reddened and chapped",
        hair: { style: "long", color: "black, loose and tangled", facial: "none" },
        clothing: ["a grey homespun dress torn at the hem", "a madder-red shawl", "bare feet"],
        palette: ["homespun grey", "faded madder red", "dust"],
        prop: { id: "swaddled-child", desc: "a small child wrapped tight in a red-brown blanket, held up to the wagons" },
        marks: ["cracked lips"],
        summary: "A barefoot young woman standing still in the road, holding a blanket-wrapped child up toward the wagons.",
      },
    },
    talk: [
      { who: "stranger", text: "He's burning up. Please. I don't know what to do.", mood: "pleading", gesture: "offer" },
      { who: "stranger", text: "He was fine yesterday. He was fine.", mood: "afraid", gesture: "clutch" },
      { who: "role:medic", text: "Let me see him. Just let me see.", mood: "calm", gesture: "beckon" },
      {
        who: "actor",
        text: "Careful. Don't get too close.",
        alt: { kind: "Oh God. He's so small.", paranoid: "Why is she alone out here?" },
      },
    ],
    tells: [
      { text: "The child's breathing is quick and shallow. His forehead is dry and hot.", shows: "genuine", p: 0.6, severity: 2, say: "He's breathing fast. That's a real fever." },
      { text: "She asks for water and cloth, not medicine. She does not know the word.", shows: "genuine", p: 0.5, severity: 1, say: "She wants water and cloth. Doesn't know to ask for physic." },
      { text: "Her hands are cracked and raw, shaking too hard to hold the blanket up.", shows: "genuine", p: 0.5, severity: 2, say: "Her hands are raw. She can barely hold him." },
      { text: "The child has not moved once. The blanket does not rise and fall.", shows: "trap", p: 0.6, severity: 3, say: "The blanket isn't moving. He isn't breathing." },
      { text: "She hums four notes over and over, and never stops to breathe.", shows: "trap", p: 0.55, severity: 2, say: "Same four notes. She hasn't stopped for breath." },
      { text: "Her feet are bare, and clean. Not a mark on them after all these miles.", shows: "trap", p: 0.5, severity: 2, say: "Bare feet, and not a mark on them." },
      { text: "She keeps looking behind you, not at the child.", shows: "noise", p: 0.35, severity: 1, say: "She keeps looking past us. Down the road." },
    ],
    options: [
      {
        id: "physic",
        label: "Give physic and tend the child",
        hint: "This is what physic is for.",
        hours: 1,
        hoursMod: { if: { role: "medic" }, mult: 0.5 },
        cost: { medicine: 1 },
        tag: "help",
        results: {
          genuine: [
            say(o("By dusk his fever breaks. She presses coins and flour on you and will not take no.", [fx.res("rations", [5, 9]), fx.scrip([15, 45]), fx.nerve("all", 4), fx.trust({ trait: "kind" }, 3)], 6), [
              { who: "stranger", text: "Take it. Take it, please. He's sleeping.", mood: "grieving", gesture: "offer" },
              { who: "role:medic", text: "Keep him cool tonight. Water, little and often.", mood: "calm" },
            ]),
            say(o("Too late. She sits in the road with him, and you sit with her.", [fx.nerve("all", -4)], 2), [
              { who: "stranger", text: "He was warm this morning. He was warm.", mood: "grieving", gesture: "kneel" },
              { who: "actor", text: "I'm sorry. I'm so sorry.", mood: "grieving", alt: { stoic: "Sit with her. That's all there is now." } },
            ]),
          ],
          trap: [
            say(o("The child opens its eyes. They are the colour of the sky.", [fx.hp("actor", [-10, -6]), fx.fog("actor"), fx.combat("hollowed-single")], 7), [
              { who: "stranger", text: "Shh. Shh. He likes you.", mood: "sly" },
              { who: "actor", text: "Get it off me! Get it off!", mood: "afraid" },
            ]),
            say(o("You reach for the blanket, and something beneath it takes your hand.", [fx.fog("actor"), fx.combat("hollowed-single")], 3), [
              { who: "stranger", text: "Hold him. Hold him close.", mood: "sly", gesture: "offer" },
              { who: "actor", text: "It's cold. God, its hand is cold.", mood: "afraid" },
            ]),
          ],
        },
      },
      {
        id: "food",
        label: "Give food and blankets, no physic",
        hint: "A middle way.",
        hours: 0.5,
        cost: { rations: 4 },
        tag: "help",
        results: {
          genuine: [
            say(o("She takes them with both hands. It isn't what he needs, and she knows it.", [fx.nerve({ trait: "kind" }, 1)], 1), [
              { who: "stranger", text: "Thank you. It's something. It's something.", mood: "grieving", gesture: "clutch" },
              { who: "actor", text: "I wish it was more.", alt: { greedy: "It's more than most would give her." } },
            ]),
          ],
          trap: [
            say(o("She takes them. Her smile never changes.", [fx.nerve("all", -2)], 1), [
              { who: "stranger", text: "You're kind. He'll remember you're kind.", mood: "sly" },
              { who: "observer", text: "Road bends soon. Eyes on the road.", mood: "cold" },
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
            say(o("You drive past. She does not shout. That is worse.", [fx.nerve("all", -3), fx.nerve({ trait: "kind" }, -4), fx.trust({ trait: "kind" }, -5), fx.flag("refusedGenuine")], 1), [
              { who: "stranger", text: "...", mood: "grieving", gesture: "turn-away" },
              { who: "actor", text: "She didn't even shout.", mood: "grieving", alt: { kind: "We could have stopped. We could have." } },
            ]),
          ],
          trap: [
            say(o("She turns her head to watch you go. Further than a neck should.", [fx.nerve("all", -2)], 1), [
              { who: "actor", text: "Did you see her neck? Did you see it?", mood: "afraid" },
              { who: "observer", text: "Don't look. Just drive.", mood: "cold" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "lost-child",
    kind: "stranger",
    weight: 4,
    when: [{ recruitLeft: "juniper" }],
    genuineOdds: 0.5,
    title: "A girl on the road, alone",
    intro: ["A small girl walks down the middle of the road, carrying one shoe. She stops, and waits."],
    stranger: { name: "The girl with one shoe", look: npcById("juniper")!.look },
    talk: [
      { who: "npc:juniper", text: "Are you going west?", mood: "calm", gesture: "none" },
      { who: "npc:juniper", text: "I can walk. I don't need carrying.", mood: "afraid", gesture: "clutch" },
      { who: "observer", text: "Where are her people? Where's anybody?", mood: "afraid" },
      {
        who: "actor",
        text: "She's just a child.",
        alt: { paranoid: "Out here? Alone? No. Something's wrong.", kind: "Come here, sweetheart. Come on." },
      },
    ],
    tells: [
      { text: "She is filthy, scabbed and starving. Tear tracks run through the grime.", shows: "genuine", p: 0.6, severity: 2, say: "Starving. Look at her wrists. She's been crying." },
      { text: "She flinches from raised hands, and checks the oxen before she looks at you.", shows: "genuine", p: 0.5, severity: 2, say: "She flinched at my hand. Checked the oxen first." },
      { text: "She is hoarding the shoe, not the food you offer her.", shows: "genuine", p: 0.4, severity: 1, say: "She won't let go of that shoe. Not for bread." },
      { text: "She is very clean. Her hair is braided. Someone braided it today.", shows: "trap", p: 0.6, severity: 2, say: "Her hair's braided. Someone braided it today." },
      { text: "The lead ox lowers its head and backs away from her, shivering.", shows: "trap", p: 0.6, severity: 3, say: "The lead ox is shaking. It won't go near her." },
      { text: "She says your name before you say hers.", shows: "trap", p: 0.4, severity: 3, say: "She said my name. I never told her my name." },
      { text: "She will not stand in the torchlight.", shows: "trap", p: 0.4, severity: 1, say: "She keeps out of the torchlight." },
      { text: "She looks at the Haze as if it is a person she used to know.", shows: "noise", p: 0.4, severity: 1, say: "She looks at the Haze like she knows it." },
    ],
    options: [
      {
        id: "take",
        label: "Lift her onto the wagon",
        hours: 1,
        tag: "help",
        results: {
          genuine: [
            say(o("Her name is Juniper. Eleven days alone. She eats, then sleeps against {actor}.", [fx.recruit("juniper"), fx.nerve("all", 3), fx.trust({ trait: "kind" }, 3)], 6), [
              { who: "npc:juniper", text: "Juniper. My name's Juniper.", mood: "calm", gesture: "none" },
              { who: "npc:juniper", text: "Eleven days. I counted. I kept counting.", mood: "grieving", gesture: "clutch" },
              { who: "actor", text: "You can stop counting now.", alt: { stoic: "Eat. Then sleep. We'll keep watch." } },
            ]),
            say(o("Within a minute she bolts into the trees. You never see her again.", [fx.nerve("all", -2)], 1), [
              { who: "npc:juniper", text: "No. I can't. I'm sorry.", mood: "afraid", gesture: "turn-away" },
              { who: "actor", text: "Wait! Come back!", mood: "pleading", gesture: "beckon" },
            ]),
          ],
          trap: [
            say(o("Later, at the edge of the light, the trees are full of people with her face.", [fx.combat("hollowed-pack"), fx.nerve("all", -3)], 6), [
              { who: "npc:juniper", text: "They wanted to meet you too.", mood: "sly", gesture: "point" },
              { who: "actor", text: "How many are there? How many?", mood: "afraid" },
            ]),
            say(o("When you look again she is gone, and the ration sack is torn and empty.", [fx.res("rations", [-10, -5]), fx.nerve("all", -4)], 3), [
              { who: "actor", text: "Where is she? She was right here.", mood: "afraid" },
              { who: "observer", text: "Sack's torn open. Every crumb gone.", mood: "cold" },
            ]),
          ],
        },
      },
      {
        id: "feed",
        label: "Give her food and point the way",
        hours: 0.5,
        cost: { rations: 2 },
        tag: "help",
        results: {
          genuine: [
            say(o("She follows the wagons a mile, then another, then out of sight.", [fx.nerve({ trait: "kind" }, -2)], 1), [
              { who: "npc:juniper", text: "Thank you. Which way is west?", mood: "calm" },
              { who: "actor", text: "I can't watch this.", mood: "grieving", gesture: "turn-away", alt: { stoic: "Don't look back. It doesn't help her." } },
            ]),
          ],
          trap: [
            say(o("She does not eat. She watches you all the way over the hill.", [fx.nerve("all", -2)], 1), [
              { who: "npc:juniper", text: "I'll see you later.", mood: "sly" },
              { who: "observer", text: "She didn't eat it. Not a bite.", mood: "afraid" },
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
            say(o("She does not run after you. She just gets smaller.", [fx.nerve("all", -3), fx.trust({ trait: "kind" }, -6), fx.nerve({ trait: "kind" }, -4), fx.flag("refusedGenuine")], 1), [
              { who: "npc:juniper", text: "That's all right. I'm used to it.", mood: "grieving", gesture: "turn-away" },
              { who: "actor", text: "She's a child. She's a child.", mood: "grieving", alt: { kind: "Stop. Stop the wagon. Please." } },
            ]),
          ],
          trap: [
            say(o("When you look back, the road is empty.", [fx.nerve("all", -1)], 1), [
              { who: "actor", text: "Where'd she go? It's flat for miles.", mood: "afraid" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "stranded-caravan",
    kind: "stranger",
    weight: 4,
    when: [{ recruitLeft: "orin" }],
    genuineOdds: 0.4,
    title: "The stalled train",
    intro: ["A dead wagon train, unhitched, oxen gone. One lantern on the last wagon. A man beside it, waving."],
    stranger: { name: "The man by the lantern", look: npcById("orin")!.look },
    talk: [
      { who: "npc:orin", text: "Over here. Slow. Come slow.", mood: "afraid", gesture: "beckon" },
      { who: "npc:orin", text: "Did you pass anyone? Behind you? Anyone?", mood: "afraid", gesture: "clutch" },
      { who: "observer", text: "Eight wagons. Not one ox. Where'd they go?", mood: "calm" },
      {
        who: "actor",
        text: "Could be supplies in there.",
        alt: { greedy: "Eight wagons. Think what's in eight wagons.", paranoid: "Nobody leaves eight wagons. Nobody." },
      },
    ],
    tells: [
      { text: "The wagons wear a fine layer of red dust. It has been days.", shows: "genuine", p: 0.55, severity: 2, say: "Red dust on everything. They've sat here days." },
      { text: "The dead oxen were not butchered. Nobody here had the strength.", shows: "genuine", p: 0.45, severity: 2, say: "Nobody butchered the oxen. Nobody had the strength." },
      { text: "The man says: 'Be careful. Something took the others in the night.'", shows: "genuine", p: 0.4, severity: 3, say: "He said be careful. Something took the others." },
      { text: "The dust has been swept off the front seats. Someone sits there often.", shows: "trap", p: 0.5, severity: 2, say: "Seats are swept clean. Someone sits up there." },
      { text: "The wagons make a killing ground. The grass either side is trampled flat.", shows: "trap", p: 0.55, severity: 3, say: "That's a killing ground. Look at the grass." },
      { text: "He asks how many guns you have, before he asks your names.", shows: "trap", p: 0.55, severity: 2, say: "He asked about our guns before our names." },
      { text: "The lantern is full. Someone trimmed the wick this morning.", shows: "trap", p: 0.4, severity: 1, say: "Lantern's full. Wick trimmed this morning." },
    ],
    options: [
      {
        id: "search",
        label: "Search the wagons",
        hint: "There could be supplies.",
        hours: 3,
        tag: "help",
        results: {
          genuine: [
            say(o("Fever took the train. Food, powder, a ledger in a strange hand. He weeps, then helps.", [fx.res("rations", [10, 18]), fx.res("ammo", [5, 12]), fx.res("spares", [0, 1]), fx.recruit("orin", 0.35)], 6), [
              { who: "npc:orin", text: "Fever. One a night. I buried six.", mood: "grieving", gesture: "clutch" },
              { who: "npc:orin", text: "Take it. They'd want somebody to have it.", mood: "grieving", gesture: "offer" },
              { who: "npc:orin", text: "Is there room? I can walk. I can.", mood: "pleading" },
            ]),
            say(o("Little left. But what there is, is clean.", [fx.res("rations", [4, 8]), fx.res("ammo", [2, 6])], 2), [
              { who: "npc:orin", text: "Sorry. There was more. Before.", mood: "grieving", gesture: "shrug" },
              { who: "actor", text: "Clean flour's still flour.", alt: { greedy: "Eight wagons, and this? This is it?" } },
            ]),
          ],
          trap: [
            say(o("Nothing but bones. You're ankle-deep in grass when the horns sound.", [fx.combat("raiders"), fx.hp("actor", [-8, -3])], 7), [
              { who: "npc:orin", text: "Now! Now!", mood: "angry", gesture: "point" },
              { who: "actor", text: "The grass! They're in the grass!", mood: "afraid" },
            ]),
            say(o("The wagons are empty. Then the tall grass is not.", [fx.combat("raiders")], 3), [
              { who: "observer", text: "Something's moving. Left side. Low.", mood: "afraid" },
              { who: "npc:orin", text: "Sorry. They'd have killed me.", mood: "cold", gesture: "turn-away" },
            ]),
          ],
        },
      },
      {
        id: "speak",
        label: "Talk from the road, and don't stop",
        hours: 1,
        tag: "help",
        results: {
          genuine: [
            say(o("He tells you the road ahead and where a cache might be. He asks for nothing.", [fx.gap([3, 6]), fx.res("rations", [2, 5])], 1), [
              { who: "npc:orin", text: "Road forks past the dead elm. Go left.", mood: "calm", gesture: "point" },
              { who: "npc:orin", text: "Cache under the mile-post. Maybe. If it's there.", mood: "afraid", gesture: "shrug" },
            ]),
          ],
          trap: [
            say(o("He asks the same three questions in new orders. Then he stops smiling.", [fx.nerve("all", -1)], 1), [
              { who: "npc:orin", text: "Where you headed? How many? Where, again?", mood: "sly" },
              { who: "observer", text: "Same questions. Third time now.", mood: "cold" },
            ]),
          ],
        },
      },
      {
        id: "pass",
        label: "Roll past without stopping",
        tag: "refuse",
        results: {
          genuine: [
            say(o("The lantern shrinks behind you. He does not even stand.", [fx.nerve({ trait: "kind" }, -3), fx.flag("refusedGenuine")], 1), [
              { who: "npc:orin", text: "Right. Right. Of course.", mood: "grieving", gesture: "turn-away" },
              { who: "actor", text: "He didn't even get up.", alt: { kind: "He looked so tired. So tired." } },
            ]),
          ],
          trap: [
            say(o("You pass. Somewhere in the tall grass, someone curses.", [], 1), [
              { who: "observer", text: "Hear that? The grass just swore at us.", alt: { paranoid: "Told you. Told you there was someone." } },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "roadside-merchant",
    kind: "stranger",
    weight: 4,
    genuineOdds: 0.5,
    title: "A Company peddler",
    intro: ["A mule cart with a painted placard: MERIDIAN CO. HONEST GOODS. The peddler takes off his hat."],
    stranger: {
      name: "The peddler",
      look: {
        build: "average",
        height: "average",
        age: 50,
        skin: "ruddy, broad-cheeked",
        hair: { style: "short", color: "grey, oiled flat", facial: "moustache" },
        clothing: ["a brown checked coat", "a battered bowler hat held to his chest", "a tin Company badge on the lapel"],
        palette: ["checked brown", "Company green", "brass"],
        prop: { id: "brass-scale", desc: "a brass hanging scale on a hook at the cart's tailboard" },
        marks: ["a wide, gap-toothed smile"],
        summary: "A moustached peddler in a checked coat beside a mule cart, bowler hat held to his chest, smiling.",
      },
    },
    talk: [
      { who: "stranger", text: "Rations, physic, powder. Fair prices.", mood: "calm", gesture: "offer" },
      { who: "stranger", text: "Times being what they are. Fair as I can.", mood: "calm", gesture: "shrug" },
      {
        who: "actor",
        text: "Scrip's short. Choose careful.",
        alt: { greedy: "Fair prices? Let's find out how fair.", paranoid: "Company man. Out here. Alone. Hm." },
      },
      { who: "observer", text: "Let me see those sacks before we pay.", mood: "calm" },
    ],
    tells: [
      { text: "His scale is stamped with the Company seal, its tag renewed this season.", shows: "genuine", p: 0.55, severity: 2, say: "Scale's stamped and tagged this season. It's honest." },
      { text: "The sacks are Company-sewn: tight chain stitch, sealed with wax.", shows: "genuine", p: 0.55, severity: 2, say: "Company stitching. Wax seals. Those sacks are real." },
      { text: "The peddler is thin. His coat is re-sewn at the elbows. He eats last.", shows: "genuine", p: 0.4, severity: 1, say: "He's thin under that coat. Eats last, I'd bet." },
      { text: "Several sacks have been re-sewn by hand, badly. The wax is fresh.", shows: "trap", p: 0.55, severity: 2, say: "Those sacks were opened and sewn again. Badly." },
      { text: "He weighs with his thumb on the scale.", shows: "trap", p: 0.5, severity: 3, say: "His thumb. Look. His thumb's on the scale." },
      { text: "His mule is fat. His cart is new. His boots are older than both.", shows: "trap", p: 0.45, severity: 1, say: "Fat mule, new cart, old boots. Doesn't add up." },
      { text: "He wants your scrip, and only your scrip. He waves off offers of goods.", shows: "noise", p: 0.35, severity: 1, say: "Only wants scrip. Won't hear of trade." },
    ],
    options: [
      {
        id: "buy-food",
        label: "Buy 15 rations (30 scrip)",
        hours: 1,
        cost: { scrip: 30 },
        tag: "help",
        results: {
          genuine: [
            say(o("Fair weight, fair grain. He glances nervously at the sky.", [fx.res("rations", 15)], 1), [
              { who: "stranger", text: "Weighed true. You'll not find truer.", mood: "calm", gesture: "offer" },
              { who: "stranger", text: "Get west. Don't dawdle on my account.", mood: "afraid", gesture: "point" },
            ]),
          ],
          trap: [
            say(o("Half the sacks are wormy. You find out at supper.", [fx.res("rations", 7), fx.sick("random")], 5), [
              { who: "actor", text: "It's moving. The flour's moving.", mood: "afraid", alt: { greedy: "Thirty scrip. For worms." } },
            ]),
            say(o("Sawdust, under a thin skin of grain.", [fx.res("rations", 4), fx.nerve("all", -2)], 3), [
              { who: "actor", text: "Sawdust. He sold us sawdust.", mood: "angry", alt: { hothead: "I'll find him. I swear I'll find him." } },
            ]),
          ],
        },
      },
      {
        id: "buy-physic",
        label: "Buy 3 physic (48 scrip)",
        hours: 1,
        cost: { scrip: 48 },
        tag: "help",
        results: {
          genuine: [
            say(o("Amber bottles, Company wax. The real thing.", [fx.res("medicine", 3)], 1), [
              { who: "stranger", text: "Mind the dose. It's strong stuff.", mood: "calm", gesture: "offer" },
              { who: "role:medic", text: "It's real. Thank God, it's real.", mood: "calm" },
            ]),
          ],
          trap: [
            say(o("Coloured water, sugar and laudanum. The bottles are worth more empty.", [fx.res("medicine", 1), fx.nerve("all", -2)], 1), [
              { who: "role:medic", text: "Sugar water. Sugar and a lick of laudanum.", mood: "angry" },
              { who: "actor", text: "Forty-eight scrip. For sugar.", mood: "angry" },
            ]),
          ],
        },
      },
      {
        id: "haggle",
        label: "Haggle for the rations (20 scrip)",
        hint: "Knock him down. He may short you for it.",
        hours: 1.5,
        cost: { scrip: 20 },
        check: { kind: "haggle", dc: 12, target: "the peddler" },
        tag: "help",
        results: {
          genuine: [
            say(o("He grumbles, and gives full weight for twenty.", [fx.res("rations", 15)], 1), [
              { who: "by", text: "Twenty, and you keep your hat on.", mood: "sly" },
              { who: "stranger", text: "Robbery. Fine. Fine. Twenty.", mood: "angry", gesture: "shrug" },
            ], "success"),
            say(o("He takes the twenty and hands over a lighter sack.", [fx.res("rations", 11), fx.nerve("all", -1)], 1), [
              { who: "by", text: "Fifteen scrip. Not a penny more.", mood: "sly" },
              { who: "stranger", text: "Then you'll get twenty's worth. Light.", mood: "cold", gesture: "turn-away" },
            ], "fail"),
          ],
          trap: [
            say(o("{by} catches his thumb on the scale. He tops up the sack, sheepish.", [fx.res("rations", 10), fx.nerve("all", 1)], 1), [
              { who: "by", text: "Take your thumb off the scale.", mood: "cold", gesture: "point" },
              { who: "stranger", text: "Ha. Sharp eyes. Call it even, then.", mood: "sly", gesture: "raise-hands" },
            ], "success"),
            say(o("A bargain, you think. At supper the grain is crawling.", [fx.res("rations", 5), fx.sick("random")], 1), [
              { who: "by", text: "Come on. Twenty, between friends.", mood: "sly" },
              { who: "stranger", text: "Between friends. Of course.", mood: "sly", gesture: "offer" },
            ], "fail"),
          ],
        },
      },
      {
        id: "pass",
        label: "Politely decline",
        tag: "refuse",
        results: {
          genuine: [
            say(o("He tips his hat and goes back to watching the sky.", [], 1), [
              { who: "stranger", text: "Suit yourselves. Safe road.", mood: "calm", gesture: "shrug" },
            ]),
          ],
          trap: [
            say(o("His smile stays put. He waves until you're out of sight.", [], 1), [
              { who: "stranger", text: "Another time, friends! Another time!", mood: "sly", gesture: "raise-hands" },
              { who: "observer", text: "He's still waving. Still.", mood: "afraid" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "vigil-of-the-red",
    kind: "stranger",
    weight: 3,
    closeBias: 1.5,
    genuineOdds: 0.35,
    title: "The Vigil of the Red",
    intro: ["A hundred people kneel in wheat, facing the Haze, chanting low. A preacher walks among them."],
    stranger: {
      name: "The preacher",
      look: {
        build: "gaunt",
        height: "tall",
        age: 52,
        skin: "pale, flushed red at the throat",
        hair: { style: "long", color: "white-grey, loose to the shoulders", facial: "beard" },
        clothing: ["a long coat stained red-brown at the hem", "a collarless shirt buttoned to the throat", "trousers worn through at the knees"],
        palette: ["rust red", "bone white", "wheat gold"],
        prop: { id: "tin-bowl", desc: "a dented tin bowl he carries everywhere, never full" },
        marks: ["kneeling calluses he does not hide"],
        summary: "A gaunt white-bearded preacher in a red-stained coat, arms open, walking among kneeling people in wheat.",
      },
    },
    talk: [
      { who: "stranger", text: "The Red is not the end. It is the answer.", mood: "calm", gesture: "raise-hands" },
      { who: "stranger", text: "Come and be answered. Rest a while.", mood: "calm", gesture: "beckon" },
      {
        who: "actor",
        text: "They look so peaceful.",
        alt: { pious: "Maybe they know something we don't.", paranoid: "Peaceful. On their knees. Facing the Haze." },
      },
      { who: "leader", text: "Nobody drinks anything. Understood?", mood: "cold" },
    ],
    tells: [
      { text: "The kneeling people are gaunt. The food is thin, and shared evenly.", shows: "genuine", p: 0.5, severity: 2, say: "They're thin. But they share it even." },
      { text: "The preacher gives his own bowl to a child before he speaks to you.", shows: "genuine", p: 0.45, severity: 2, say: "He gave his bowl to that child. Before us." },
      { text: "Half of them watch the Haze. The others watch your wagons.", shows: "trap", p: 0.5, severity: 2, say: "Half watch the Haze. Half watch our wagons." },
      { text: "Their eyes do not track when you walk in front of them.", shows: "trap", p: 0.5, severity: 2, say: "Their eyes don't follow you. Not at all." },
      { text: "The tea in their cups smells of sweet rot and copper.", shows: "trap", p: 0.55, severity: 3, say: "That tea smells like copper. Like rot." },
      { text: "Nobody blinks for the whole length of the chant.", shows: "trap", p: 0.4, severity: 1, say: "Nobody's blinked. The whole chant." },
      { text: "The chant is quiet and rhythmic. Some of your party are humming along.", shows: "noise", p: 0.45, severity: 1, say: "Some of ours are humming along." },
    ],
    options: [
      {
        id: "attend",
        label: "Join the vigil for the evening",
        hint: "Rest and company. You will lose hours.",
        hours: 4,
        tag: "help",
        results: {
          genuine: [
            say(o("A comfort that asks no believing. They share what they have. Your people sleep.", [fx.nerve("all", 8), fx.res("rations", [5, 9]), fx.bondAll(3)], 1), [
              { who: "stranger", text: "Eat. There's no price on it.", mood: "calm", gesture: "offer" },
              { who: "actor", text: "I slept. I actually slept.", alt: { haunted: "No dreams. First time in weeks." } },
            ]),
          ],
          trap: [
            say(o("The tea. By morning, two of yours can't remember being afraid.", [fx.fog("two"), fx.nerve("two", 10), fx.trust("two", -8), fx.hours(2)], 5), [
              { who: "actor", text: "Afraid? Of what? It's lovely out.", mood: "calm" },
              { who: "leader", text: "Look at me. What's your name? Say it.", mood: "afraid" },
            ]),
            say(o("In the night, one of your own walks into the wheat, smiling.", [fx.leave("random", "walked into the wheat, toward the Haze, smiling"), fx.nerve("all", -6)], 2), [
              { who: "stranger", text: "They've been answered. Be glad.", mood: "calm", gesture: "raise-hands" },
              { who: "leader", text: "Come back! Come back!", mood: "pleading" },
            ]),
          ],
        },
      },
      {
        id: "speak",
        label: "Let a speaker or believer talk to him",
        hint: "Good with words? Now is the time.",
        hours: 1,
        actor: { first: [{ role: "speaker" }, { trait: "pious" }] },
        requires: [{ any: [{ role: "speaker" }, { trait: "pious" }] }],
        why: "No one here can speak for you.",
        results: {
          genuine: [
            say(o("{actor} and the preacher talk an hour. He gives oats and a blessing.", [fx.res("rations", [4, 8]), fx.nerve("all", 2)], 1), [
              { who: "stranger", text: "You carry a lot. Put some down here.", mood: "calm" },
              { who: "stranger", text: "Oats, for the road. No, no payment.", mood: "calm", gesture: "offer" },
              { who: "actor", text: "He means it. He actually means it." },
            ]),
          ],
          trap: [
            say(o("{actor} sees through him, loudly. The kneelers stand. You leave shaken.", [fx.nerve("all", -2), fx.bond("actor", "leader", 4)], 1), [
              { who: "actor", text: "Your tea's poison, and you know it.", mood: "angry", gesture: "point" },
              { who: "stranger", text: "Children. Our guests are leaving.", mood: "cold", gesture: "turn-away" },
            ]),
          ],
        },
      },
      {
        id: "pass",
        label: "Drive around the field",
        tag: "refuse",
        results: {
          genuine: [
            say(o("The chant follows for miles. It sounds like people asking for something.", [fx.nerve({ trait: "pious" }, -3)], 1), [
              { who: "actor", text: "They were just hungry. That's all it was.", mood: "grieving", alt: { pious: "Someone should pray for them. Someone." } },
            ]),
          ],
          trap: [
            say(o("The chant follows you, louder, and then stops.", [fx.nerve("all", -1)], 1), [
              { who: "observer", text: "It stopped. Why'd it stop?", mood: "afraid" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "road-toll",
    kind: "stranger",
    weight: 4,
    genuineOdds: 0.35,
    title: "A rope across the road",
    intro: ["Two men in Company armbands have roped off the road. One holds a ledger. One holds a shotgun."],
    stranger: {
      name: "The ledger man",
      look: {
        build: "lean",
        height: "average",
        age: 41,
        skin: "wind-browned, flushed from coughing",
        hair: { style: "short", color: "sandy, under a Company cap", facial: "moustache" },
        clothing: ["a Company armband on a grey coat", "a clerk's peaked cap", "mud-caked gaiters"],
        palette: ["Company green", "grey", "ledger tan"],
        prop: { id: "toll-ledger", desc: "a fat toll ledger with a pencil tied to it on string" },
        marks: ["ink ground into his right thumb"],
        summary: "A lean moustached man in a Company armband holding a ledger beside a rope strung across the road.",
      },
    },
    talk: [
      { who: "stranger", text: "Toll. Twenty-five scrip.", mood: "cold", gesture: "none" },
      { who: "stranger", text: "The Company keeps the road. Somebody has to.", mood: "calm", gesture: "shrug" },
      {
        who: "actor",
        text: "Twenty-five? For a rope?",
        alt: { greedy: "Twenty-five scrip. Robbery with a pencil.", hothead: "I say we drive straight through it." },
      },
      { who: "observer", text: "Let me get a look at that ledger.", mood: "calm" },
    ],
    tells: [
      { text: "The armbands bear the current stamp. The ledger has names and dates in a clerk's hand.", shows: "genuine", p: 0.55, severity: 2, say: "Current stamp. Ledger's full of names and dates." },
      { text: "The shotgun is old, well cared for, and pointed at the ground.", shows: "genuine", p: 0.4, severity: 1, say: "Shotgun's old, clean, pointed at the dirt." },
      { text: "The men are lean. A road crew's tan and a road crew's cough.", shows: "genuine", p: 0.4, severity: 1, say: "Road crew tan. Road crew cough." },
      { text: "The armbands are stitched on crooked. The ledger is blank past page one.", shows: "trap", p: 0.6, severity: 3, say: "Armbands sewn crooked. Ledger's blank past page one." },
      { text: "Three more men wait in the trees, pretending not to be there.", shows: "trap", p: 0.5, severity: 2, say: "Three more in the trees. Pretending." },
      { text: "They ask about your cargo before they ask about the toll.", shows: "trap", p: 0.5, severity: 2, say: "Asked about cargo before the toll. Wrong order." },
      { text: "The road beyond the rope has been dug up and covered over.", shows: "trap", p: 0.35, severity: 1, say: "Road past the rope's been dug. Covered over." },
    ],
    options: [
      {
        id: "pay",
        label: "Pay the toll (25 scrip)",
        hours: 0.5,
        cost: { scrip: 25 },
        tag: "help",
        results: {
          genuine: [
            say(o("He stamps a chit and, unasked, warns you of a rockslide ahead. He is right.", [fx.gap([2, 5])], 1), [
              { who: "stranger", text: "Slide past the second bridge. Take the high fork.", mood: "calm", gesture: "point" },
              { who: "leader", text: "Obliged. Truly.", mood: "calm" },
            ]),
          ],
          trap: [
            say(o("They take the scrip and let you pass, laughing.", [], 6), [
              { who: "stranger", text: "Pleasure doing business.", mood: "sly", gesture: "shrug" },
              { who: "actor", text: "Eyes forward. Don't give them a reason.", alt: { hothead: "Laugh. Go on. Laugh." } },
            ]),
            say(o("Then they look at your wagons for a long time.", [fx.res("rations", [-12, -6]), fx.nerve("all", -3)], 4), [
              { who: "stranger", text: "And your rations. For the road.", mood: "sly", gesture: "point" },
              { who: "leader", text: "Give it to them. Just give it.", mood: "cold" },
            ]),
          ],
        },
      },
      {
        id: "bluff",
        label: "Talk your way through",
        hint: "A tongue can save scrip.",
        hours: 0.5,
        actor: { role: "speaker" },
        requires: [{ role: "speaker" }],
        why: "Nobody here has the gift.",
        results: {
          genuine: [
            say(o("{actor} argues, and loses. A fine on top of the toll.", [fx.scrip([-70, -45])], 1), [
              { who: "actor", text: "Captain Harlow knows us. Ask him.", mood: "sly" },
              { who: "stranger", text: "Harlow's dead a month. That's a fine.", mood: "cold", gesture: "point" },
            ]),
          ],
          trap: [
            say(o("{actor} names a captain who does not exist. The rope goes up fast.", [fx.bond("actor", "leader", 3)], 1), [
              { who: "actor", text: "Captain Harlow will hear about this rope.", mood: "cold" },
              { who: "stranger", text: "Harlow? No need. Go on through.", mood: "afraid", gesture: "raise-hands" },
            ]),
          ],
        },
      },
      {
        id: "stare-down",
        label: "Talk the shotgun down",
        hint: "Someone steady, no scrip. If it goes wrong, it goes badly.",
        hours: 1,
        check: { kind: "talk-down", dc: 13, target: "the men at the rope" },
        tag: "refuse",
        results: {
          genuine: [
            say(o("The ledger man sighs and lifts the rope. No toll, and no warning either.", [fx.nerve("all", 1)], 1), [
              { who: "by", text: "We've sick aboard. You can see we do.", mood: "pleading" },
              { who: "stranger", text: "Go on. Didn't see you.", mood: "calm", gesture: "shrug" },
            ], "success"),
            say(o("He writes you up: the toll, and a fine for the trouble.", [fx.scrip([-45, -30]), fx.nerve("all", -2)], 1), [
              { who: "by", text: "Put that down and let's talk.", mood: "cold", gesture: "point" },
              { who: "stranger", text: "Obstructing the Company. That's a fine.", mood: "angry", gesture: "point" },
            ], "fail"),
          ],
          trap: [
            say(o("The shotgun lowers. The rope drops. Nobody in the trees moves.", [fx.nerve("all", 2)], 1), [
              { who: "by", text: "Three in the trees. We've got more.", mood: "cold", gesture: "point" },
              { who: "stranger", text: "Easy. Easy. Rope's down.", mood: "afraid", gesture: "raise-hands" },
            ], "success"),
            say(o("Someone in the trees laughs first. Then they come.", [fx.combat("toll-thugs")], 1), [
              { who: "by", text: "Lower it, friend. Nobody wants this.", mood: "pleading", gesture: "raise-hands" },
              { who: "stranger", text: "Nobody asked what you want.", mood: "cold", gesture: "draw-weapon" },
            ], "fail"),
          ],
        },
      },
      {
        id: "ram",
        label: "Drive through the rope",
        results: {
          genuine: [
            say(o("They do not laugh. They open fire.", [fx.hp("actor", [-12, -6]), fx.repair(-8), fx.nerve("all", -4), fx.scrip(-40)], 1), [
              { who: "stranger", text: "That's Company property! Fire!", mood: "angry", gesture: "draw-weapon" },
              { who: "actor", text: "They're real! They're real Company!", mood: "afraid" },
            ]),
          ],
          trap: [
            say(o("The rope tears free. The men scatter. Someone shoots, badly.", [fx.repair(-5)], 5), [
              { who: "actor", text: "Go! Go! Don't stop!", mood: "afraid", alt: { hothead: "Ha! Look at them run!" } },
            ]),
            say(o("A shot takes an ox in the flank. The rest of them close in.", [fx.combat("toll-thugs"), fx.repair(-6)], 3), [
              { who: "stranger", text: "Out of the trees, boys!", mood: "angry", gesture: "draw-weapon" },
              { who: "actor", text: "The ox is down! They hit the ox!", mood: "afraid" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "farm-hospitality",
    kind: "stranger",
    weight: 3,
    regions: ["tallow", "fen", "threshold"],
    genuineOdds: 0.45,
    title: "Lit windows",
    intro: ["A farmhouse with lit windows and chimney smoke, where every other roof has fallen in. A woman waves."],
    stranger: {
      name: "The farm woman",
      look: {
        build: "sturdy",
        height: "average",
        age: 45,
        skin: "weathered, windburnt cheeks",
        hair: { style: "bun", color: "brown going grey", facial: "none" },
        clothing: ["a flour-dusted apron", "a blue work dress, sleeves rolled", "a brown wool shawl"],
        palette: ["cornflower blue", "flour white", "hearth orange"],
        prop: { id: "porch-lantern", desc: "a tin lantern she holds up from the porch step" },
        marks: ["old stove burns on both forearms"],
        summary: "A sturdy farm woman on a lit porch in a flour-dusted apron, holding up a tin lantern and waving.",
      },
    },
    talk: [
      { who: "stranger", text: "There's stew. There's beds.", mood: "calm", gesture: "beckon" },
      { who: "stranger", text: "Come in off the road. It's not safe.", mood: "afraid", gesture: "beckon" },
      {
        who: "actor",
        text: "A bed. A real bed.",
        alt: { coward: "Walls. Please. One night with walls.", paranoid: "Lit windows. Out here. Who's lighting them?" },
      },
      { who: "observer", text: "Wait. Let me look first.", mood: "calm" },
    ],
    tells: [
      { text: "The table is set for six. There are four of them. Nobody says why.", shows: "genuine", p: 0.4, severity: 1, say: "Table's set for six. There's four of them." },
      { text: "Their hands are cracked from work. The children are thin and wary.", shows: "genuine", p: 0.55, severity: 2, say: "Worked hands. Thin kids. That's a real farm." },
      { text: "The woman glances at the Haze and says, quietly, 'You should not stay long.'", shows: "genuine", p: 0.4, severity: 3, say: "She said don't stay long. She meant it." },
      { text: "There is no dog, no chickens, no manure. A farm with no animals.", shows: "trap", p: 0.5, severity: 2, say: "No dog. No chickens. No dung. No animals." },
      { text: "The chimney smoke does not smell of wood.", shows: "trap", p: 0.4, severity: 1, say: "That smoke isn't wood smoke." },
      { text: "All the windows are lit. There is nobody in any of them.", shows: "trap", p: 0.4, severity: 2, say: "Every window's lit. Nobody's in any of them." },
      { text: "They ask, again and again, how many of you there are.", shows: "trap", p: 0.55, severity: 3, say: "She's asked how many we are three times." },
    ],
    options: [
      {
        id: "stay",
        label: "Stay the night under a roof",
        hint: "A real bed. A great deal of time.",
        hours: 8,
        tag: "help",
        results: {
          genuine: [
            say(o("Stew, bread, a fire. Everyone sleeps. In the morning, flour, and a favour asked.", [fx.nerve("all", 12), fx.hp("all", 10), fx.res("rations", [4, 9]), fx.bondAll(4)], 1), [
              { who: "stranger", text: "Don't tell anyone where we are. Please.", mood: "pleading", gesture: "clutch" },
              { who: "actor", text: "Not a soul. I promise.", alt: { greedy: "Not a soul. Could you spare more flour?" } },
            ]),
          ],
          trap: [
            say(o("You wake in ash. The oxen are gone, and the house with them.", [fx.repair(-22), fx.res("rations", [-16, -8]), fx.res("torches", [-4, -1]), fx.nerve("all", -8)], 5), [
              { who: "actor", text: "Where's the house? Where's the house?", mood: "afraid" },
              { who: "leader", text: "Count the oxen. Count everything.", mood: "cold" },
            ]),
            say(o("A scream before dawn. {actor} is found in the wheat, unhurt, staring.", [fx.nerve("actor", -25), fx.fog("actor"), fx.res("rations", [-8, -4])], 3), [
              { who: "actor", text: "She sang to me. She's still singing.", mood: "afraid" },
              { who: "leader", text: "Look at me. Come back. Look at me.", mood: "pleading" },
            ]),
          ],
        },
      },
      {
        id: "supper",
        label: "Supper only, then sleep in the wagons",
        hours: 3,
        tag: "help",
        results: {
          genuine: [
            say(o("Good stew. The children stare at your boots. You leave full, before dark.", [fx.nerve("all", 5), fx.res("rations", [2, 4])], 1), [
              { who: "stranger", text: "Take the heel of the loaf. Go on.", mood: "calm", gesture: "offer" },
              { who: "actor", text: "Best thing I've eaten in a month.", alt: { greedy: "Wrap the rest. They won't miss it." } },
            ]),
          ],
          trap: [
            say(o("The stew tastes wrong. By midnight, half the party is retching.", [fx.sick("two"), fx.nerve("all", -3)], 6), [
              { who: "actor", text: "Something in the stew. Something in it.", mood: "afraid" },
              { who: "role:medic", text: "Water. Everyone. Now.", mood: "cold" },
            ]),
            say(o("The stew is fine. Her smile isn't. She keeps asking about your route.", [fx.nerve("all", -2)], 3), [
              { who: "stranger", text: "Which way north? The ridge, or the river?", mood: "sly" },
              { who: "observer", text: "Don't tell her. Don't tell her anything.", mood: "cold" },
            ]),
          ],
        },
      },
      {
        id: "pass",
        label: "Thank her and keep going",
        tag: "refuse",
        results: {
          genuine: [
            say(o("She nods like she's heard it before. The windows stay lit a long time.", [fx.nerve({ trait: "kind" }, -2)], 1), [
              { who: "stranger", text: "Mind the river road, then.", mood: "calm", gesture: "turn-away" },
              { who: "actor", text: "We could've had a bed.", alt: { coward: "We could've had walls. Walls." } },
            ]),
          ],
          trap: [
            say(o("She stops smiling. Every window goes dark at once.", [fx.nerve("all", -2)], 1), [
              { who: "actor", text: "All of them. All at once.", mood: "afraid" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "signal-fire",
    kind: "stranger",
    weight: 3,
    genuineOdds: 0.5,
    title: "Three rockets in the pattern",
    intro: ["A mile off the road, three flares in the Company pattern: HELP. Then a fire. Then a figure, waving."],
    stranger: {
      name: "The figure by the fire",
      look: {
        build: "lean",
        height: "average",
        age: 30,
        skin: "wind-burnt, hard to make out at distance",
        hair: { style: "covered", color: "hidden under an oilskin hood", facial: "stubble" },
        clothing: ["a hooded black oilskin coat", "a scrap of white shirt tied to a stick", "a Company flare pistol on a cord"],
        palette: ["oilskin black", "signal red", "smoke grey"],
        prop: { id: "white-rag", desc: "a scrap of white shirt waved on a stick" },
        marks: [],
        summary: "A hooded figure a mile off the road beside a fire, waving a white rag on a stick at the wagons.",
      },
    },
    talk: [
      { who: "stranger", text: "Here! Over here!", mood: "pleading", gesture: "raise-hands" },
      { who: "observer", text: "Company pattern. Three. That's a call for help.", mood: "calm" },
      {
        who: "actor",
        text: "A mile out, and a mile back.",
        alt: { kind: "Someone's out there asking. We go.", coward: "Could be anyone waving. Anyone at all." },
      },
      { who: "leader", text: "Somebody give me the glass.", mood: "calm" },
    ],
    tells: [
      { text: "The fire is small, low and well hidden. Someone fears the wrong people.", shows: "genuine", p: 0.5, severity: 2, say: "Small fire. Low. They're hiding from somebody." },
      { text: "The flares went up ragged and far apart. Whoever fired them was hurt or slow.", shows: "genuine", p: 0.45, severity: 1, say: "Flares went up ragged. Somebody's hurt, or slow." },
      { text: "The fire is big, stacked high, in clear sight of the road.", shows: "trap", p: 0.55, severity: 2, say: "That fire's built to be seen from the road." },
      { text: "The ground by the fire is trampled, and littered with cigarette ends.", shows: "trap", p: 0.5, severity: 2, say: "Ground's trampled. Cigarette ends everywhere. Lots of men." },
      { text: "A second fire, hidden behind a rise, gives off a thin trail of smoke.", shows: "trap", p: 0.4, severity: 1, say: "Second smoke, behind the rise." },
      { text: "The figure keeps waving after you have clearly seen them.", shows: "noise", p: 0.4, severity: 1, say: "Still waving. We've seen you. We've seen you." },
    ],
    options: [
      {
        id: "go",
        label: "Take the wagons to the fire",
        hint: "A mile off the road, and a mile back.",
        hours: 3,
        tag: "help",
        results: {
          genuine: [
            say(o("Three survivors, frostbitten, wild with thirst. One can walk. You take them aboard.", [fx.recruit(undefined, 0.6), fx.res("rations", [-4, -2]), fx.nerve("all", 3), fx.trust({ trait: "kind" }, 3)], 1), [
              { who: "stranger", text: "You came. You actually came.", mood: "pleading", gesture: "kneel" },
              { who: "role:medic", text: "Water first. Small sips.", mood: "calm" },
            ]),
          ],
          trap: [
            say(o("Eleven of them. None wounded. All armed.", [fx.combat("raiders"), fx.hp("actor", [-6, -2])], 6), [
              { who: "stranger", text: "Welcome. Hands where we can see them.", mood: "cold", gesture: "draw-weapon" },
              { who: "actor", text: "Eleven. I count eleven.", mood: "afraid" },
            ]),
            say(o("Nobody at either fire. Eleven men in the grass.", [fx.combat("raiders")], 3), [
              { who: "observer", text: "Nobody here. Nobody at the other one either.", mood: "afraid" },
              { who: "stranger", text: "Behind you, friend.", mood: "sly", gesture: "draw-weapon" },
            ]),
          ],
        },
      },
      {
        id: "scout",
        label: "Send {actor} on foot, alone",
        hint: "A gamble with one life.",
        hours: 1.5,
        actor: { role: "scout" },
        tag: "help",
        results: {
          genuine: [
            say(o("{actor} comes back leading three ragged people, all of them crying.", [fx.recruit(undefined, 0.5), fx.res("rations", [-3, -1]), fx.nerve("all", 3)], 1), [
              { who: "actor", text: "Three of them. Alive. Barely.", mood: "calm" },
              { who: "stranger", text: "God bless you. Every one of you.", mood: "grieving", gesture: "clutch" },
            ]),
          ],
          trap: [
            say(o("{actor} runs back bleeding. Eleven men, a good ambush. You are miles off before they follow.", [fx.hp("actor", [-9, -4]), fx.nerve("all", -2)], 1), [
              { who: "actor", text: "Eleven! Go! Go now!", mood: "afraid" },
            ]),
          ],
        },
      },
      {
        id: "pass",
        label: "Keep going",
        tag: "refuse",
        results: {
          genuine: [
            say(o("The flares go up again. And again. Then no more.", [fx.nerve("all", -3), fx.nerve({ trait: "kind" }, -3), fx.flag("refusedGenuine")], 1), [
              { who: "actor", text: "They stopped. Why'd they stop?", mood: "grieving", alt: { kind: "That was someone. Someone asking." } },
            ]),
          ],
          trap: [
            say(o("A horn sounds. Riders follow a little way, and stop.", [fx.nerve("all", -1)], 1), [
              { who: "observer", text: "Riders. Behind us. Now they're stopping.", mood: "afraid" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "doctor-pinned",
    kind: "stranger",
    weight: 2,
    when: [{ recruitLeft: "mattie" }],
    genuineOdds: 0.5,
    title: "Under the barn beam",
    intro: ["A woman pinned under a fallen barn beam, calling weakly. Beside her, a doctor's bag, spilled open."],
    stranger: { name: "The woman under the beam", look: npcById("mattie")!.look },
    talk: [
      { who: "npc:mattie", text: "My legs. Please. I can't feel my legs.", mood: "pleading", gesture: "raise-hands" },
      { who: "npc:mattie", text: "I can tell you what to do. Just lift.", mood: "afraid", gesture: "point" },
      {
        who: "actor",
        text: "That beam'll take all of us.",
        alt: { coward: "What if she's not alone out here?", kind: "Hold on. We're coming. Hold on." },
      },
      { who: "observer", text: "Wait. Let me see how it fell.", mood: "calm" },
    ],
    tells: [
      { text: "Her legs below the knee are grey-blue. She has been here hours, perhaps days.", shows: "genuine", p: 0.55, severity: 2, say: "Her legs are blue. She's been under there hours." },
      { text: "She is calm and precise, naming her own injuries in words no fraud would know.", shows: "genuine", p: 0.5, severity: 3, say: "She's naming her own injuries. Doctor's words." },
      { text: "The bag is well-worn, the clasp black with use.", shows: "genuine", p: 0.4, severity: 1, say: "That bag's old. Clasp worn black." },
      { text: "The beam rests on a fresh-cut prop stone. It did not fall. It was set.", shows: "trap", p: 0.55, severity: 3, say: "Beam's propped on a fresh stone. Someone set it." },
      { text: "The bag's clasp is new, and the physic seals have never been broken.", shows: "trap", p: 0.5, severity: 2, say: "New clasp. Seals on the bottles never broken." },
      { text: "A trail of boot prints leads from the barn to the treeline.", shows: "trap", p: 0.45, severity: 2, say: "Boot prints. Barn to trees. Recent." },
    ],
    options: [
      {
        id: "lift",
        label: "Lift the beam and free her",
        hours: 3,
        hoursMod: { if: { role: "mechanic" }, mult: 0.6 },
        tag: "help",
        results: {
          genuine: [
            say(o("Six of you and a lever. She will limp for life, and she knows fevers.", [fx.recruit("mattie"), fx.res("medicine", [1, 3]), fx.nerve("all", 4), fx.trust({ trait: "kind" }, 3)], 7), [
              { who: "npc:mattie", text: "Mattie. Mattie Voss. My father was the doctor.", mood: "afraid", gesture: "clutch" },
              { who: "npc:mattie", text: "I can set bones. Let me earn the ride.", mood: "pleading", gesture: "offer" },
              { who: "actor", text: "You don't have to earn anything.", alt: { greedy: "Physic and a doctor. Best find all month." } },
            ]),
            say(o("Free, but her legs won't hold. She asks for a rifle and a bottle.", [fx.recruit("mattie"), fx.res("medicine", [0, 2]), fx.nerve("all", -2)], 2), [
              { who: "npc:mattie", text: "Leave me a rifle and a bottle. Go.", mood: "grieving", gesture: "turn-away" },
              { who: "leader", text: "No. You're coming. That's the end of it.", mood: "cold", gesture: "beckon" },
            ]),
          ],
          trap: [
            say(o("The beam lifts. She rolls free and whistles. The barn was bait.", [fx.combat("raiders"), fx.hp("actor", [-7, -3])], 7), [
              { who: "npc:mattie", text: "Boys! Now!", mood: "angry", gesture: "beckon" },
              { who: "actor", text: "It's a trap! Back to the wagons!", mood: "afraid" },
            ]),
            say(o("She is up and running, and her friends take half your ration sacks.", [fx.res("rations", [-16, -8]), fx.res("ammo", [-6, -2]), fx.nerve("all", -3)], 3), [
              { who: "npc:mattie", text: "Obliged for the lift!", mood: "sly", gesture: "raise-hands" },
              { who: "actor", text: "The sacks! They're at the sacks!", mood: "angry" },
            ]),
          ],
        },
      },
      {
        id: "pass",
        label: "Leave her, and go",
        tag: "refuse",
        results: {
          genuine: [
            say(o("Her calling follows you across three fields. Nobody speaks for an hour.", [fx.nerve("all", -4), fx.nerve({ trait: "kind" }, -5), fx.trust({ trait: "kind" }, -6), fx.flag("refusedGenuine")], 1), [
              { who: "npc:mattie", text: "Please! Please come back!", mood: "pleading", gesture: "raise-hands" },
              { who: "actor", text: "...", mood: "grieving", gesture: "turn-away", alt: { kind: "I can still hear her. I can still hear her." } },
            ]),
          ],
          trap: [
            say(o("The calling stops, as if someone corked it.", [], 1), [
              { who: "observer", text: "Just stopped. Like a door shut.", mood: "afraid" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "uniformed-men",
    kind: "stranger",
    weight: 3,
    when: [{ recruitLeft: "thaddeus" }],
    genuineOdds: 0.4,
    title: "Deserters",
    intro: ["Six men in Company greatcoats stand in the road, rifles slung, hands open. The eldest steps forward."],
    stranger: { name: "The eldest deserter", look: npcById("thaddeus")!.look },
    talk: [
      { who: "npc:thaddeus", text: "We're not here to hurt anyone.", mood: "calm", gesture: "raise-hands" },
      { who: "npc:thaddeus", text: "Powder for food. We've had neither in nine days.", mood: "pleading", gesture: "offer" },
      {
        who: "actor",
        text: "Company coats. Company guns.",
        alt: { paranoid: "Six rifles. Count the ones you can't see.", hothead: "Say the word and we clear the road." },
      },
      { who: "observer", text: "Keep him talking. I'll watch the rest.", mood: "calm" },
    ],
    tells: [
      { text: "The coats are patched and faded, the collars shaped to each man's neck by years.", shows: "genuine", p: 0.5, severity: 2, say: "Coats shaped to their necks. Worn for years." },
      { text: "They stand in the open, and keep their hands in view the whole time.", shows: "genuine", p: 0.5, severity: 2, say: "Hands in the open. Every one of them." },
      { text: "The eldest asks after your sick before he asks about your powder.", shows: "genuine", p: 0.4, severity: 1, say: "He asked after our sick first." },
      { text: "The coats are new. The boots under them are not.", shows: "trap", p: 0.55, severity: 2, say: "New coats. Old boots." },
      { text: "Two men have drifted round behind your wagons while the eldest talks.", shows: "trap", p: 0.55, severity: 3, say: "Two of them just walked behind our wagons." },
      { text: "Their rifles are cleaner than their faces.", shows: "trap", p: 0.45, severity: 1, say: "Rifles cleaner than their faces." },
    ],
    options: [
      {
        id: "trade",
        label: "Trade 6 powder & shot for food and news",
        hours: 1,
        cost: { ammo: 6 },
        tag: "help",
        results: {
          genuine: [
            say(o("A fair trade. Rations, and quietly, word of a road that saves an hour.", [fx.res("rations", [8, 14]), fx.gap([3, 6]), fx.recruit("thaddeus", 0.3)], 1), [
              { who: "npc:thaddeus", text: "The ford's washed out. Take the ridge.", mood: "calm", gesture: "point" },
              { who: "npc:thaddeus", text: "I ran from the Company. I'll not lie about it.", mood: "cold", gesture: "none" },
            ]),
          ],
          trap: [
            say(o("They take the powder and turn their rifles on you.", [fx.combat("raiders")], 6), [
              { who: "npc:thaddeus", text: "Thank you kindly. Now the rest.", mood: "cold", gesture: "draw-weapon" },
              { who: "actor", text: "Behind us! They're behind us!", mood: "afraid" },
            ]),
            say(o("They smile, hand you a sack of gravel, and vanish into the trees.", [fx.nerve("all", -3)], 3), [
              { who: "npc:thaddeus", text: "God keep you.", mood: "sly", gesture: "offer" },
              { who: "actor", text: "Gravel. It's gravel.", mood: "angry", alt: { hothead: "Let me put one in his back." } },
            ]),
          ],
        },
      },
      {
        id: "hands-first",
        label: "Ask them to ground their rifles first",
        hint: "An honest man will. A proud one may walk away.",
        hours: 1,
        check: { kind: "persuade", dc: 12, target: "the eldest deserter" },
        tag: "help",
        results: {
          genuine: [
            say(o("Six rifles go down in the dirt. Then a fair trade, and a word about the road.", [fx.res("ammo", -6), fx.res("rations", [8, 14]), fx.gap([3, 6]), fx.recruit("thaddeus", 0.3)], 1), [
              { who: "by", text: "Rifles on the ground. Then we talk.", mood: "calm" },
              { who: "npc:thaddeus", text: "Fair. Lads, down. All of them.", mood: "calm", gesture: "raise-hands" },
            ], "success"),
            say(o("The eldest bristles. They keep their rifles, and their hunger, and go.", [fx.nerve({ trait: "kind" }, -2)], 1), [
              { who: "by", text: "Guns down, or no deal.", mood: "cold", gesture: "point" },
              { who: "npc:thaddeus", text: "We asked you honest. Go on, then.", mood: "angry", gesture: "turn-away" },
            ], "fail"),
          ],
          trap: [
            say(o("They will not ground them. They drift into the trees. You keep your powder.", [fx.nerve("all", 2)], 1), [
              { who: "by", text: "Rifles down, or the deal's off.", mood: "cold" },
              { who: "npc:thaddeus", text: "No. No, I think not.", mood: "cold", gesture: "turn-away" },
              { who: "observer", text: "They're backing off. All of them.", mood: "calm" },
            ], "success"),
            say(o("The talking goes badly. The rifles come off their shoulders.", [fx.combat("raiders")], 1), [
              { who: "by", text: "Just set them down. Slow. Please.", mood: "pleading", gesture: "raise-hands" },
              { who: "npc:thaddeus", text: "Set yours down first.", mood: "cold", gesture: "draw-weapon" },
            ], "fail"),
          ],
        },
      },
      {
        id: "refuse",
        label: "Decline and keep going",
        tag: "refuse",
        results: {
          genuine: [
            say(o("The eldest nods, tired, and steps aside.", [fx.nerve({ trait: "kind" }, -2)], 1), [
              { who: "npc:thaddeus", text: "I understand. I'd not trust us either.", mood: "grieving", gesture: "turn-away" },
            ]),
          ],
          trap: [
            say(o("Two of the men do not step aside. You keep them in your sights to the bend.", [fx.nerve("all", -2)], 1), [
              { who: "npc:thaddeus", text: "Let them pass, lads.", mood: "cold" },
              { who: "observer", text: "Those two. Watch those two till the bend.", mood: "cold" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "ferryman",
    kind: "stranger",
    regions: ["fen", "threshold"],
    weight: 4,
    genuineOdds: 0.5,
    title: "The ferry",
    intro: ["A flat barge waits at a river too wide to ford. A gaunt man with a pole raises a hand."],
    stranger: {
      name: "The ferryman",
      look: {
        build: "gaunt",
        height: "tall",
        age: 61,
        skin: "river-grey, deeply lined",
        hair: { style: "cropped", color: "thin and white", facial: "beard" },
        clothing: ["a waxed canvas coat gone green with damp", "a flat hat with a frayed brim", "bare feet on the wet deck"],
        palette: ["river green", "tar black", "bone"],
        prop: { id: "ferry-pole", desc: "a long ash pole, worn pale where his hands grip it" },
        marks: ["two fingers missing from the left hand"],
        summary: "A gaunt old ferryman on a flat barge, leaning on a long pale pole, one hand raised.",
      },
    },
    talk: [
      { who: "stranger", text: "Twenty scrip. Wagons and all.", mood: "calm", gesture: "raise-hands" },
      { who: "stranger", text: "River's high. Nobody fords it this week.", mood: "calm", gesture: "shrug" },
      {
        who: "actor",
        text: "I don't like the look of that water.",
        alt: { coward: "I can't swim. Did I say? I can't swim.", greedy: "Twenty? For a raft?" },
      },
      { who: "observer", text: "Hold on. Let me check his rope.", mood: "calm" },
    ],
    tells: [
      { text: "The barge is patched and re-patched by someone with years to do it.", shows: "genuine", p: 0.5, severity: 2, say: "Patched a hundred times. Years of work in that barge." },
      { text: "The rope is permanent, slung across the river and bolted into stone both sides.", shows: "genuine", p: 0.5, severity: 2, say: "Rope's bolted into stone. Both banks. Permanent." },
      { text: "He quotes a price, then a lower one when he sees your faces.", shows: "genuine", p: 0.35, severity: 1, say: "He dropped his price. Saw our faces and dropped it." },
      { text: "The far-bank rope end is tied to a single sapling, and not well.", shows: "trap", p: 0.5, severity: 2, say: "Far rope's tied to one sapling. Badly." },
      { text: "The barge sits very high, as if it expects to carry very little.", shows: "trap", p: 0.4, severity: 1, say: "Sits high. Like it's not meant to carry much." },
      { text: "A second barge waits on the far bank, three men in it, watching.", shows: "trap", p: 0.4, severity: 2, say: "Second barge, far bank. Three men watching." },
    ],
    options: [
      {
        id: "pay",
        label: "Pay 20 scrip and ride the ferry",
        hours: 2,
        cost: { scrip: 20 },
        tag: "help",
        results: {
          genuine: [
            say(o("A slow, careful crossing. On the far bank he turns his hat in his hands.", [], 1), [
              { who: "stranger", text: "God keep you.", mood: "calm", gesture: "none" },
              { who: "actor", text: "Not a word, the whole way across." },
            ]),
          ],
          trap: [
            say(o("Midway, he lets go the pole. The current takes you, and goods go overboard.", [fx.res("rations", [-14, -6]), fx.res("ammo", [-6, -2]), fx.hours(2), fx.nerve("all", -3)], 6), [
              { who: "stranger", text: "Sorry. Current's strong today.", mood: "sly", gesture: "shrug" },
              { who: "actor", text: "The sacks! Grab the sacks!", mood: "afraid" },
            ]),
            say(o("On the far bank he wants double. There are men behind the trees.", [fx.scrip(-20), fx.res("rations", [-8, -4]), fx.nerve("all", -2)], 4), [
              { who: "stranger", text: "Twenty more. And a little flour.", mood: "cold", gesture: "point" },
              { who: "leader", text: "Pay him. Just pay him.", mood: "cold", alt: { hothead: "Pay him? I'll pay him." } },
            ]),
          ],
        },
      },
      {
        id: "ford",
        label: "Look for a ford instead",
        hours: 4,
        results: {
          any: [
            say(o("Shallows upstream. Half a day lost, but nobody drowns.", [fx.repair(-6), fx.nerve("all", -1)], 1), [
              { who: "actor", text: "Cold. Cold. Keep the oxen moving.", alt: { stoic: "Slow and steady. It's only waist high." } },
              { who: "leader", text: "Nobody drowns today. Nobody.", mood: "calm" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "refugee-camp",
    kind: "stranger",
    weight: 4,
    genuineOdds: 0.75,
    title: "The ruined chapel",
    intro: ["Forty people camp in a gutted chapel: children, old men, a nun. They hold out empty bowls."],
    stranger: {
      name: "The nun",
      look: {
        build: "slight",
        height: "short",
        age: 63,
        skin: "pale, grey with dust",
        hair: { style: "covered", color: "under a torn black veil", facial: "none" },
        clothing: ["a black habit gone grey with dust", "a wooden cross on a leather thong", "cracked sandals"],
        palette: ["dust grey", "habit black", "bone white"],
        prop: { id: "empty-bowl", desc: "a chipped wooden bowl she holds out with both hands" },
        marks: ["a cataract clouding her left eye"],
        summary: "An old nun in a dust-grey habit at a ruined chapel door, holding out an empty wooden bowl.",
      },
    },
    talk: [
      { who: "stranger", text: "Whatever you can spare. The children first.", mood: "pleading", gesture: "offer" },
      { who: "stranger", text: "We won't keep you. We know how it is.", mood: "calm" },
      {
        who: "actor",
        text: "Forty mouths. We can't feed forty.",
        alt: { kind: "Look at them. Look at the little ones.", greedy: "Give them a sack, they'll want the wagon." },
      },
      { who: "observer", text: "Let me look around first.", mood: "calm" },
    ],
    tells: [
      { text: "Every one of them is thin as a fence post. Nobody has more than one blanket.", shows: "genuine", p: 0.6, severity: 2, say: "Thin as fence posts. One blanket each." },
      { text: "The nun takes a bowl for herself last.", shows: "genuine", p: 0.4, severity: 1, say: "The nun took her bowl last." },
      { text: "A few of the men watch the wagons with different eyes to the rest.", shows: "trap", p: 0.5, severity: 2, say: "Some of those men are pricing our wagons." },
      { text: "Hard meat is drying at the back of the chapel, and there are no animals anywhere.", shows: "trap", p: 0.35, severity: 3, say: "Meat drying in the back. No animals anywhere." },
    ],
    options: [
      {
        id: "give",
        label: "Share out 8 rations",
        hours: 1,
        cost: { rations: 8 },
        tag: "help",
        results: {
          genuine: [
            say(o("The nun weeps. An old man draws you a map from memory. A good one.", [fx.gap([3, 7]), fx.nerve("all", 3), fx.trust({ trait: "kind" }, 4), fx.recruit(undefined, 0.25)], 6), [
              { who: "stranger", text: "God sees this. He sees you.", mood: "grieving", gesture: "clutch" },
              { who: "actor", text: "The map's good. He knows this road." },
            ]),
            say(o("They are so grateful it hurts to watch.", [fx.nerve("all", 2), fx.trust({ trait: "kind" }, 3)], 3), [
              { who: "stranger", text: "Bless you. Bless you.", mood: "grieving", gesture: "kneel" },
              { who: "actor", text: "I can't look at them. I can't.", mood: "grieving", gesture: "turn-away", alt: { stoic: "Don't look away. It's the least we owe." } },
            ]),
          ],
          trap: [
            say(o("The sack opens, and a hundred hands reach in. It is not a request.", [fx.combat("mob"), fx.res("rations", [-6, -2])], 1), [
              { who: "stranger", text: "Wait! Wait your turn!", mood: "afraid", gesture: "raise-hands" },
              { who: "actor", text: "Back! Get back from the wagon!", mood: "afraid" },
            ]),
          ],
        },
      },
      {
        id: "pass",
        label: "Drive on, eyes forward",
        tag: "refuse",
        results: {
          genuine: [
            say(o("A boy runs beside the wagon for a hundred yards. You don't look.", [fx.nerve("all", -4), fx.nerve({ trait: "kind" }, -4), fx.trust({ trait: "kind" }, -5), fx.flag("refusedGenuine")], 1), [
              { who: "actor", text: "Don't look at him. Don't.", mood: "grieving", gesture: "turn-away", alt: { kind: "He's still running. God, he's still running." } },
            ]),
          ],
          trap: [
            say(o("Stones fly out of the ruins and ring off the iron rims.", [fx.repair(-4)], 1), [
              { who: "actor", text: "Stones! Heads down!", mood: "afraid" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "map-seller",
    kind: "stranger",
    weight: 3,
    genuineOdds: 0.35,
    title: "A man selling maps",
    intro: ["A man in a wide hat sits by the road with a portfolio of hand-drawn maps, routes inked red."],
    stranger: {
      name: "The map seller",
      look: {
        build: "lean",
        height: "average",
        age: 48,
        skin: "olive, sun-dark",
        hair: { style: "short", color: "black going grey, under a wide hat", facial: "moustache" },
        clothing: ["a wide black felt hat", "a surveyor's waistcoat bristling with pencils", "a long dust coat"],
        palette: ["dust tan", "red ink", "felt black"],
        prop: { id: "map-portfolio", desc: "a leather portfolio of hand-drawn maps, routes marked in red ink" },
        marks: ["ink stains to the knuckles"],
        summary: "A moustached man in a wide felt hat by the road, a leather portfolio of red-inked maps open on his knee.",
      },
    },
    talk: [
      { who: "stranger", text: "A safe way through. Around the worst of it.", mood: "calm", gesture: "offer" },
      { who: "stranger", text: "Forty scrip. Worth ten times that.", mood: "calm", gesture: "shrug" },
      {
        who: "actor",
        text: "Forty scrip for a drawing.",
        alt: { greedy: "If it saves a day, it's cheap.", paranoid: "Who's he drawing maps for, out here?" },
      },
      { who: "observer", text: "Let me see one up close.", mood: "calm" },
    ],
    tells: [
      { text: "His maps show landmarks you know, in the right places, drawn with a surveyor's care.", shows: "genuine", p: 0.55, severity: 2, say: "These landmarks are right. Surveyor's hand." },
      { text: "The red route is marked, corrected, and re-marked. He is still working on it.", shows: "genuine", p: 0.4, severity: 1, say: "He's still correcting the route. Still working on it." },
      { text: "Every map looks exactly like the others, down to the ink blots.", shows: "trap", p: 0.55, severity: 3, say: "Every map's the same. Same ink blots, even." },
      { text: "The landmarks are correct, right up to where the red ink starts.", shows: "trap", p: 0.45, severity: 1, say: "Right, all of it. Until the red ink starts." },
      { text: "He takes your scrip without looking at it, and starts packing.", shows: "trap", p: 0.4, severity: 2, say: "Didn't even count it. Already packing." },
    ],
    options: [
      {
        id: "buy",
        label: "Buy a map (40 scrip)",
        hours: 1,
        cost: { scrip: 40 },
        tag: "help",
        results: {
          genuine: [
            say(o("A good map. Better than good. It shaves a day off the road.", [fx.advance([22, 34])], 1), [
              { who: "stranger", text: "Mind the crossing at the dry creek.", mood: "calm", gesture: "point" },
              { who: "actor", text: "He was right. Right about all of it." },
            ]),
          ],
          trap: [
            say(o("The red route ends in a rust-coloured bog. Half a day to get out.", [fx.gap([-9, -5]), fx.hours(3), fx.nerve("all", -3), fx.repair(-8)], 6), [
              { who: "actor", text: "Bog. Forty scrip for a bog.", mood: "angry", alt: { hothead: "Next time I see him, he eats that map." } },
            ]),
            say(o("The red route runs into the Haze, and only just out again.", [fx.fog("two"), fx.gap(-6), fx.nerve("all", -4)], 3), [
              { who: "actor", text: "It's red. The map, the road. All red.", mood: "afraid" },
              { who: "leader", text: "Turn them! Turn the wagons now!", mood: "afraid" },
            ]),
          ],
        },
      },
      {
        id: "pass",
        label: "Not today",
        tag: "refuse",
        results: {
          genuine: [
            say(o("He shrugs. He does not plead. A man who knows what he has.", [fx.flag("passedMap")], 1), [
              { who: "stranger", text: "Suit yourself. The road's long.", mood: "calm", gesture: "shrug" },
            ]),
          ],
          trap: [
            say(o("He folds his maps, and is gone when you look back.", [], 1), [
              { who: "observer", text: "Gone. Didn't even see him go.", mood: "afraid" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "walker-beside",
    kind: "stranger",
    weight: 3,
    closeBias: 2,
    genuineOdds: 0.5,
    title: "Someone walking beside the wagons",
    intro: ["For an hour a figure has walked beside the lead wagon, twenty yards off. It matches your pace exactly."],
    stranger: {
      name: "The walker",
      look: {
        build: "lean",
        height: "average",
        age: 36,
        skin: "grey with road dust, hard to make out",
        hair: { style: "covered", color: "hidden under a hat pulled low", facial: "stubble" },
        clothing: ["a long coat grey with dust", "a drover's hat pulled low", "drover's boots"],
        palette: ["dust grey", "faded brown", "shadow black"],
        prop: { id: "drovers-crook", desc: "a drover's crook used as a walking staff" },
        marks: [],
        summary: "A dust-grey figure in a long coat and low hat, walking steadily twenty yards off the road beside the wagons.",
      },
    },
    talk: [
      {
        who: "actor",
        text: "How long's that been there?",
        mood: "afraid",
        alt: { paranoid: "An hour. It's been there an hour. I counted.", stoic: "Keep driving. It's only walking." },
      },
      { who: "observer", text: "Nobody saw it come. Nobody.", mood: "afraid" },
      { who: "leader", text: "Don't stop. Not yet.", mood: "calm" },
    ],
    tells: [
      { text: "The figure limps: a real, careful limp, the ankle bound in strips of cloth.", shows: "genuine", p: 0.5, severity: 2, say: "It's limping. Ankle's bound up in rags." },
      { text: "It has been calling out, quietly. Nobody heard. Its mouth is cracked and dry.", shows: "genuine", p: 0.45, severity: 1, say: "Mouth's cracked. It's been calling. We didn't hear." },
      { text: "It does not limp, or tire, or speed up. It just matches you.", shows: "trap", p: 0.6, severity: 2, say: "Doesn't tire. Doesn't slow. Just matches us." },
      { text: "The oxen refuse to look at it. They stare hard at the road.", shows: "trap", p: 0.55, severity: 2, say: "Oxen won't look at it. Won't." },
      { text: "It has no shadow, despite the torches.", shows: "trap", p: 0.45, severity: 3, say: "No shadow. Look. The torches, and no shadow." },
      { text: "It has been looking at the wagons the whole time. Not at any one person.", shows: "noise", p: 0.4, severity: 1, say: "It's watching the wagons. Not any one of us." },
    ],
    options: [
      {
        id: "call",
        label: "Call out to it",
        hours: 0.5,
        tag: "help",
        results: {
          genuine: [
            say(o("It stumbles over with a cry. A drover, lost for days. Dazed and broken, but real.", [fx.recruit(undefined, 0.5), fx.res("rations", -2), fx.nerve({ trait: "kind" }, 3)], 1), [
              { who: "stranger", text: "Oh God. I thought you were them.", mood: "pleading", gesture: "kneel" },
              { who: "actor", text: "He's real. He's just a man." },
            ]),
          ],
          trap: [
            say(o("It stops. It turns. Too many teeth. The walk becomes a run.", [fx.combat("hollowed-single"), fx.nerve("all", -3)], 1), [
              { who: "stranger", text: "You called.", mood: "sly", gesture: "beckon" },
              { who: "actor", text: "Run! Get the rifles!", mood: "afraid" },
            ]),
          ],
        },
      },
      {
        id: "torch",
        label: "Ring it with torches and watch",
        hours: 0.5,
        cost: { torches: 2 },
        results: {
          genuine: [
            say(o("A frightened man, blinded, begging on his knees. You leave water and a ration.", [fx.res("rations", -1), fx.nerve({ trait: "kind" }, -2)], 1), [
              { who: "stranger", text: "Don't! Please! I'm only walking!", mood: "pleading", gesture: "raise-hands" },
              { who: "actor", text: "We scared him half to death.", alt: { kind: "I'm sorry. We didn't know." } },
            ]),
          ],
          trap: [
            say(o("It shrieks, and comes apart, and is gone. The air smells of hot copper.", [fx.nerve("all", -2)], 1), [
              { who: "actor", text: "Where'd it go? Where'd it go?", mood: "afraid" },
            ]),
          ],
        },
      },
      {
        id: "ignore",
        label: "Do not acknowledge it",
        tag: "refuse",
        results: {
          genuine: [
            say(o("It walks with you another hour, then falls behind. Nobody turns around.", [fx.nerve({ trait: "kind" }, -3), fx.flag("refusedGenuine")], 1), [
              { who: "stranger", text: "Wait. Please. Wait.", mood: "pleading", gesture: "raise-hands" },
              { who: "actor", text: "Don't turn around.", mood: "afraid", alt: { kind: "It said please. Did you hear it?" } },
            ]),
          ],
          trap: [
            say(o("Another hour. Then, at a bend, it is gone.", [fx.nerve("all", -3)], 1), [
              { who: "observer", text: "Gone. Where it stood, there's nothing.", mood: "afraid" },
            ]),
          ],
        },
      },
    ],
  },
];
