// Strangers: each carries a hidden truth (genuine need or a trap). The player
// gets probabilistic tells, never certainty. Tells are consistent across scenes
// so an attentive player can learn the road's grammar:
//   traps    -> too clean, too eager, asks about your supplies first, hidden cover,
//               stories with a hole, the oxen dislike them
//   genuine  -> ask for less than they need, old real wounds, shame, warn you
//               of something before they ask for anything

import type { SceneDef } from "../../types.ts";
import { fx, o } from "../fx.ts";

export const STRANGERS: SceneDef[] = [
  {
    id: "wounded-traveler",
    kind: "stranger",
    weight: 6,
    genuineOdds: 0.5,
    title: "A man on the roadside",
    intro: [
      "A man sits against a milestone with his leg stretched out in front of him, wrapped in a bloodied coat. He raises one hand when he sees the wagons.",
      "\"Please. Anything. I've been here since morning.\"",
    ],
    tells: [
      { text: "The wound is days old. Someone bandaged it with care once, and then stopped being able to.", shows: "genuine", p: 0.6 },
      { text: "He will not meet your eyes when you offer water. It looks like shame, not scheming.", shows: "genuine", p: 0.5 },
      { text: "He asks for water first. Not food, not physic, not a ride.", shows: "genuine", p: 0.45 },
      { text: "His boots are clean. Wherever he limped from, it was not far.", shows: "trap", p: 0.6 },
      { text: "Fresh wheel ruts lead off the road into the trees behind him.", shows: "trap", p: 0.5 },
      { text: "His eyes are not on the wagons. They are on your rifles.", shows: "trap", p: 0.55 },
      { text: "He keeps glancing at the Haze, then away.", shows: "noise", p: 0.4 },
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
            o("He was a Company runner, cut down by wolves three nights back. He weeps, and then he tells you where the road is faster.", [fx.gap([4, 8]), fx.nerve({ trait: "kind" }, 3), fx.recruit(undefined, 0.35), fx.trust("all", 2)], 5),
            o("He does not survive the night. But he presses something into your hand: a Company cache token. It gets you a little.", [fx.res("rations", [5, 10]), fx.nerve({ trait: "kind" }, 2)], 2),
          ],
          trap: [
            o("You are bending over his leg when the first shot comes out of the trees.", [fx.hp("actor", [-9, -4]), fx.combat("raiders")], 6),
            o("His leg is not wounded at all. Nor are his friends.", [fx.res("ammo", [-6, -3]), fx.res("rations", [-8, -3]), fx.nerve("all", -3)], 3),
          ],
        },
      },
      {
        id: "water",
        label: "Leave him water and a ration, and go",
        hint: "Not nothing. Not everything.",
        hours: 0.5,
        cost: { rations: 1 },
        tag: "help",
        results: {
          genuine: [o("He clasps your hand. It is all he has to give. Something loosens in {actor}'s face.", [fx.nerve({ trait: "kind" }, 2)], 1)],
          trap: [o("He takes the food and does not thank you. He watches you go all the way to the bend.", [], 1)],
        },
      },
      {
        id: "pass",
        label: "Drive on",
        tag: "refuse",
        results: {
          genuine: [o("You drive on. In the mirror-glass of the sky behind you, you can still see him raise his hand.", [fx.nerve({ trait: "kind" }, -5), fx.trust({ trait: "kind" }, -4), fx.flag("refusedGenuine")], 1)],
          trap: [o("You drive on. A rifle shot cracks somewhere back behind you, hits nothing, and does not come again.", [], 1)],
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
    intro: [
      "A woman stands in the road with a bundle in her arms. She does not wave. She just stands there, and lifts the blanket a little.",
      "\"He's burning up. Please. I don't know what to do.\"",
    ],
    tells: [
      { text: "The child's breathing is quick and shallow. His forehead is dry and hot to the wrist.", shows: "genuine", p: 0.6 },
      { text: "She asks for water and cloth, not for medicine. She does not know the word for it.", shows: "genuine", p: 0.5 },
      { text: "Her hands are cracked and raw, and shaking so badly she cannot hold the blanket up.", shows: "genuine", p: 0.5 },
      { text: "The child has not moved once. The blanket does not rise and fall.", shows: "trap", p: 0.6 },
      { text: "She is humming four notes over and over, and does not stop to breathe.", shows: "trap", p: 0.55 },
      { text: "Her feet are bare, and clean. There is not a mark on them after all these miles.", shows: "trap", p: 0.5 },
      { text: "She keeps looking behind you, not at the child.", shows: "noise", p: 0.35 },
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
            o("By dusk his fever breaks. She cannot speak. She presses a handful of coins and a bag of flour into your hands and will not take no.", [fx.res("rations", [5, 9]), fx.scrip([15, 45]), fx.nerve("all", 4), fx.trust({ trait: "kind" }, 3)], 6),
            o("It is too late. He is already gone. She sits in the road with him for an hour, and you sit with her. You are nowhere near forgiven for the physic you spent.", [fx.nerve("all", -4)], 2),
          ],
          trap: [
            o("The child opens its eyes. They are the color of the sky. She smiles, and the smile does not move.", [fx.hp("actor", [-10, -6]), fx.fog("actor"), fx.combat("hollowed-single")], 7),
            o("You reach for the blanket, and something beneath it takes your hand.", [fx.fog("actor"), fx.combat("hollowed-single")], 3),
          ],
        },
      },
      {
        id: "food",
        label: "Give food and blankets, but no physic",
        hint: "A middle way.",
        hours: 0.5,
        cost: { rations: 4 },
        tag: "help",
        results: {
          genuine: [o("She takes them with both hands. It is not what the child needs. She knows that, and thanks you anyway.", [fx.nerve({ trait: "kind" }, 1)], 1)],
          trap: [o("She takes them, and her smile does not change. You are glad when the road bends.", [fx.nerve("all", -2)], 1)],
        },
      },
      {
        id: "pass",
        label: "Drive on",
        tag: "refuse",
        results: {
          genuine: [o("You drive past. She does not shout. That is worse.", [fx.nerve("all", -3), fx.nerve({ trait: "kind" }, -4), fx.trust({ trait: "kind" }, -5), fx.flag("refusedGenuine")], 1)],
          trap: [o("You drive past her, close, and she turns her head to watch you go. All the way. Longer than a neck should.", [fx.nerve("all", -2)], 1)],
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
    intro: ["A girl of ten or so is walking down the middle of the road, carrying a single shoe. She stops when she sees you and waits."],
    tells: [
      { text: "She is filthy, scabbed, and starving. There are tear tracks through the grime.", shows: "genuine", p: 0.6 },
      { text: "She flinches from raised hands, and looks at the oxen before she looks at you.", shows: "genuine", p: 0.5 },
      { text: "She is hoarding the shoe, not the food you offer her.", shows: "genuine", p: 0.4 },
      { text: "She is very clean. Her hair is braided. Someone braided it today.", shows: "trap", p: 0.6 },
      { text: "The lead ox lowers its head and backs away from her, shivering.", shows: "trap", p: 0.6 },
      { text: "She says your name before you say hers.", shows: "trap", p: 0.4 },
      { text: "She will not stand in the torchlight.", shows: "trap", p: 0.4 },
      { text: "She looks at the Haze as if it is a person she used to know.", shows: "noise", p: 0.4 },
    ],
    options: [
      {
        id: "take",
        label: "Lift her onto the wagon",
        hours: 1,
        tag: "help",
        results: {
          genuine: [
            o("Her name is Juniper. She has been alone eleven days. She eats until she is sick, and then falls asleep against {actor}'s shoulder.", [fx.recruit("juniper"), fx.nerve("all", 3), fx.trust({ trait: "kind" }, 3)], 6),
            o("She is on the wagon less than a minute before she bolts, back into the trees. You never see her again.", [fx.nerve("all", -2)], 1),
          ],
          trap: [
            o("She sits between two of the sacks. Something about how she sits. Later, at the edge of the light, the trees are full of people, and they all have her face.", [fx.combat("hollowed-pack"), fx.nerve("all", -3)], 6),
            o("She sits very still. When you look again she is not there, and the ration sack at her feet is torn open and empty.", [fx.res("rations", [-10, -5]), fx.nerve("all", -4)], 3),
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
          genuine: [o("She eats, and looks at you with such lost gratitude that {actor} has to look away. Then she follows the wagons for a mile, and a mile more, and out of sight.", [fx.nerve({ trait: "kind" }, -2)], 1)],
          trap: [o("She takes the bread. She does not eat it. She stands in the road and watches you all the way over the hill.", [fx.nerve("all", -2)], 1)],
        },
      },
      {
        id: "pass",
        label: "Drive on",
        tag: "refuse",
        results: {
          genuine: [o("You drive on. She does not run after you. She just stands there getting smaller.", [fx.nerve("all", -3), fx.trust({ trait: "kind" }, -6), fx.nerve({ trait: "kind" }, -4), fx.flag("refusedGenuine")], 1)],
          trap: [o("You drive on. When you look back, the road is empty.", [fx.nerve("all", -1)], 1)],
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
    intro: [
      "A wagon train stands dead in the road, unhitched, oxen gone. One lantern burns on the tail of the last wagon. A man sits beside it, waving slowly.",
    ],
    tells: [
      { text: "The wagons are covered in a fine layer of red dust. It has been days.", shows: "genuine", p: 0.55 },
      { text: "The dead oxen were not butchered. Whoever was here did not have the strength.", shows: "genuine", p: 0.45 },
      { text: "The man says: 'Be careful. Something took the others in the night.'", shows: "genuine", p: 0.4 },
      { text: "The dust on the wagons has been swept off the front seats. Someone sits there regularly.", shows: "trap", p: 0.5 },
      { text: "The wagons are parked to make a killing ground. The tall grass on either side is trampled flat.", shows: "trap", p: 0.55 },
      { text: "He asks how many guns you have, before he asks your names.", shows: "trap", p: 0.55 },
      { text: "The lantern is full. Someone has trimmed the wick this morning.", shows: "trap", p: 0.4 },
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
            o("The last of the train died of fever. There is food, powder, and a ledger in a language you don't know. The man weeps as you go through it, and then helps.", [fx.res("rations", [10, 18]), fx.res("ammo", [5, 12]), fx.res("spares", [0, 1]), fx.recruit("orin", 0.35)], 6),
            o("Little left. But what there is, is clean.", [fx.res("rations", [4, 8]), fx.res("ammo", [2, 6])], 2),
          ],
          trap: [
            o("The wagons are empty except for bones. You are ankle deep in tall grass when the horns sound.", [fx.combat("raiders"), fx.hp("actor", [-8, -3])], 7),
            o("The wagons are empty. So is the tall grass, so far. Then the tall grass is not empty at all.", [fx.combat("raiders")], 3),
          ],
        },
      },
      {
        id: "speak",
        label: "Talk to the man from the road, and do not stop",
        hours: 1,
        tag: "help",
        results: {
          genuine: [o("He tells you what he knows: the road ahead, and a place that might still have a cache. He thanks you. He does not ask for anything.", [fx.gap([3, 6]), fx.res("rations", [2, 5])], 1)],
          trap: [o("He asks the same three questions in different orders. When you do not stop, he stops smiling. Nothing else happens.", [fx.nerve("all", -1)], 1)],
        },
      },
      {
        id: "pass",
        label: "Roll past without stopping",
        tag: "refuse",
        results: {
          genuine: [o("The lantern shrinks behind you. The man does not follow. He does not even stand.", [fx.nerve({ trait: "kind" }, -3), fx.flag("refusedGenuine")], 1)],
          trap: [o("You pass. Somewhere in the tall grass, someone curses.", [], 1)],
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
    intro: [
      "A mule cart with a painted placard: MERIDIAN CO. — HONEST GOODS. The peddler is round and cheerful and takes off his hat as you approach.",
      "\"Rations, physic, powder. Fair prices. The times being what they are.\"",
    ],
    tells: [
      { text: "His scale is stamped with the Company seal, and the calibration tag has been renewed this season.", shows: "genuine", p: 0.55 },
      { text: "The sacks are Company-sewn: tight chain stitch, sealed with wax.", shows: "genuine", p: 0.55 },
      { text: "The peddler is thin. His coat has been re-sewn at the elbows. He eats last.", shows: "genuine", p: 0.4 },
      { text: "Several of the sacks have been re-sewn by hand, badly. The wax is fresh.", shows: "trap", p: 0.55 },
      { text: "He weighs with his thumb on the scale.", shows: "trap", p: 0.5 },
      { text: "His mule is fat. His cart is new. His boots are older than both.", shows: "trap", p: 0.45 },
      { text: "He wants your scrip, and only your scrip. He waves off offers of goods.", shows: "noise", p: 0.35 },
    ],
    options: [
      {
        id: "buy-food",
        label: "Buy 15 rations (30 scrip)",
        hours: 1,
        cost: { scrip: 30 },
        tag: "help",
        results: {
          genuine: [o("Fair weight, fair grain. The peddler thanks you and looks nervously at the sky.", [fx.res("rations", 15)], 1)],
          trap: [
            o("Half the sacks are wormy. You only find out at supper.", [fx.res("rations", 7), fx.sick("random")], 5),
            o("The sacks hold sawdust under a thin layer of grain.", [fx.res("rations", 4), fx.nerve("all", -2)], 3),
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
          genuine: [o("Amber bottles, Company seal, sealed with wax. The real thing.", [fx.res("medicine", 3)], 1)],
          trap: [o("Colored water, sugar, and laudanum for the smell. The bottles are worth more empty.", [fx.res("medicine", 1), fx.nerve("all", -2)], 1)],
        },
      },
      {
        id: "pass",
        label: "Politely decline",
        tag: "refuse",
        results: {
          genuine: [o("He shrugs, tips his hat, and goes back to watching the sky.", [], 1)],
          trap: [o("His smile stays exactly where it was. He waves at you until you are out of sight.", [], 1)],
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
    intro: [
      "A hundred people kneel in a field of wheat, facing the Haze, chanting low. A man in a stained coat walks among them. When he sees your wagons he opens his arms.",
      "\"The Red is not the end. It is the answer. Come and be answered.\"",
    ],
    tells: [
      { text: "The kneeling people are gaunt. There is food, but it is thin, and shared evenly.", shows: "genuine", p: 0.5 },
      { text: "The preacher gives his own bowl to a child before he speaks to you.", shows: "genuine", p: 0.45 },
      { text: "Half of them are looking at the Haze. The others are looking at your wagons.", shows: "trap", p: 0.5 },
      { text: "Their eyes do not track when you walk in front of them.", shows: "trap", p: 0.5 },
      { text: "The tea in their cups smells of sweet rot and copper.", shows: "trap", p: 0.55 },
      { text: "Nobody blinks for the whole length of the chant.", shows: "trap", p: 0.4 },
      { text: "The chant is quiet and rhythmic. Some of your party are humming along.", shows: "noise", p: 0.45 },
    ],
    options: [
      {
        id: "attend",
        label: "Join the vigil for the evening",
        hint: "Rest and company. You will lose hours.",
        hours: 4,
        tag: "help",
        results: {
          genuine: [o("It is real. It is a comfort, of the kind that requires no believing. They share what they have. Your people sleep for once.", [fx.nerve("all", 8), fx.res("rations", [5, 9]), fx.bondAll(3)], 1)],
          trap: [
            o("The tea. You should not have drunk the tea. In the morning two of your people cannot remember why they were afraid.", [fx.fog("two"), fx.nerve("two", 10), fx.trust("two", -8), fx.hours(2)], 5),
            o("In the night, one of your own gets up and walks into the wheat, smiling, and does not come back.", [fx.leave("random", "walked into the wheat, toward the Haze, smiling"), fx.nerve("all", -6)], 2),
          ],
        },
      },
      {
        id: "speak",
        label: "Let a speaker or a believer talk to him",
        hint: "Good with words? Now is the time.",
        hours: 1,
        actor: { first: [{ role: "speaker" }, { trait: "pious" }] },
        requires: [{ any: [{ role: "speaker" }, { trait: "pious" }] }],
        why: "No one here can speak for you.",
        results: {
          genuine: [o("{actor} and the preacher speak for an hour. He gives you a sack of oats and his blessing, and asks for nothing.", [fx.res("rations", [4, 8]), fx.nerve("all", 2)], 1)],
          trap: [o("{actor} sees through him within minutes and says so, loudly. The kneeling people stand up. You leave quickly, and unharmed, and shaken.", [fx.nerve("all", -2), fx.bond("actor", "leader", 4)], 1)],
        },
      },
      {
        id: "pass",
        label: "Drive around the field",
        tag: "refuse",
        results: {
          genuine: [o("The chant follows you for miles. It does not sound sinister anymore. It sounds like people asking for something.", [fx.nerve({ trait: "pious" }, -3)], 1)],
          trap: [o("The chant follows you for miles, and gets louder, and then stops.", [fx.nerve("all", -1)], 1)],
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
    intro: [
      "Two men in Company armbands have strung a rope across the road between two posts. One holds a ledger. The other holds a shotgun and looks bored.",
      "\"Toll. Twenty-five scrip. The Company keeps the road.\"",
    ],
    tells: [
      { text: "The armbands have the current Company stamp, and one man's ledger has names and dates in a clerk's hand.", shows: "genuine", p: 0.55 },
      { text: "The shotgun is old, well cared for, and pointed at the ground.", shows: "genuine", p: 0.4 },
      { text: "The men are lean. A road crew's tan and a road crew's cough.", shows: "genuine", p: 0.4 },
      { text: "The armbands are stitched on crooked. The ledger is blank past the first page.", shows: "trap", p: 0.6 },
      { text: "You see three more men in the trees, pretending not to be there.", shows: "trap", p: 0.5 },
      { text: "They ask about your cargo before they ask about the toll.", shows: "trap", p: 0.5 },
      { text: "The road beyond the rope has been recently dug up and covered over.", shows: "trap", p: 0.35 },
    ],
    options: [
      {
        id: "pay",
        label: "Pay the toll (25 scrip)",
        hours: 0.5,
        cost: { scrip: 25 },
        tag: "help",
        results: {
          genuine: [o("The ledger man stamps a chit and, unasked, tells you a rock slide ahead is blocked. He is right.", [fx.gap([2, 5])], 1)],
          trap: [
            o("They take the scrip and let you go, laughing.", [], 6),
            o("They take the scrip and then look at your wagons for a long time. 'And your rations. For the road.'", [fx.res("rations", [-12, -6]), fx.nerve("all", -3)], 4),
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
          genuine: [o("{actor} argues. The ledger man argues back. In the end it costs you a fine as well as the toll.", [fx.scrip([-70, -45])], 1)],
          trap: [o("{actor} names a Company captain who does not exist, and they hold the rope up for you so fast it is embarrassing.", [fx.bond("actor", "leader", 3)], 1)],
        },
      },
      {
        id: "ram",
        label: "Drive through the rope",
        results: {
          genuine: [o("They do not laugh. They open fire.", [fx.hp("actor", [-12, -6]), fx.repair(-8), fx.nerve("all", -4), fx.scrip(-40)], 1)],
          trap: [
            o("The rope tears free, and the men scatter, cursing. Someone shoots at you, badly.", [fx.repair(-5)], 5),
            o("A shot takes an ox in the flank. The rest of them close in.", [fx.combat("toll-thugs"), fx.repair(-6)], 3),
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
    intro: [
      "A farmhouse with yellow windows and a curl of chimney smoke, in a country where every other roof has fallen in. A woman on the porch waves.",
      "\"There's stew. There's beds. Come in from the road. It's not safe out there.\"",
    ],
    tells: [
      { text: "The table is set for six. There are four of them. Nobody says who the extra places are for.", shows: "genuine", p: 0.4 },
      { text: "Their hands are cracked from work. There are children, thin and wary.", shows: "genuine", p: 0.55 },
      { text: "The woman glances at the Haze and says, quietly, 'You should not stay long.'", shows: "genuine", p: 0.4 },
      { text: "There is no dog, no chickens, no manure. A farm with no animals.", shows: "trap", p: 0.5 },
      { text: "The chimney smoke does not smell of wood.", shows: "trap", p: 0.4 },
      { text: "All the windows are lit. There is nobody in any of them.", shows: "trap", p: 0.4 },
      { text: "They ask, repeatedly, how many of you there are.", shows: "trap", p: 0.55 },
    ],
    options: [
      {
        id: "stay",
        label: "Stay the night under a roof",
        hint: "A real bed. A great deal of time.",
        hours: 8,
        tag: "help",
        results: {
          genuine: [o("Stew, real bread, a fire. Your people sleep like the dead, and none of them dies. In the morning the woman gives you flour and asks you, please, not to tell anyone where they are.", [fx.nerve("all", 12), fx.hp("all", 10), fx.res("rations", [4, 9]), fx.bondAll(4)], 1)],
          trap: [
            o("You wake to find the oxen gone and the farmhouse a burned-out shell. The others are gone too, along with the shape of the ash of their bedding.", [fx.repair(-22), fx.res("rations", [-16, -8]), fx.res("torches", [-4, -1]), fx.nerve("all", -8)], 5),
            o("In the small hours, a scream. {actor}, in the bed nearest the door, is gone. You find them at dawn, in the wheat, unhurt, and staring.", [fx.nerve("actor", -25), fx.fog("actor"), fx.res("rations", [-8, -4])], 3),
          ],
        },
      },
      {
        id: "supper",
        label: "Accept supper only, then sleep in the wagons",
        hours: 3,
        tag: "help",
        results: {
          genuine: [o("The stew is good. The children stare at your boots. You leave before dark, and full.", [fx.nerve("all", 5), fx.res("rations", [2, 4])], 1)],
          trap: [
            o("The stew tastes wrong. By midnight half the party is retching.", [fx.sick("two"), fx.nerve("all", -3)], 6),
            o("The stew is fine. The woman's smile is not. She keeps asking about your route.", [fx.nerve("all", -2)], 3),
          ],
        },
      },
      {
        id: "pass",
        label: "Thank her and keep going",
        tag: "refuse",
        results: {
          genuine: [o("She nods as if she has heard this before. She goes back inside. The windows stay lit behind you for a long time.", [fx.nerve({ trait: "kind" }, -2)], 1)],
          trap: [o("She stops smiling. All the lit windows go dark at once.", [fx.nerve("all", -2)], 1)],
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
    intro: [
      "Off the road, a mile or so, three flares go up in the Company pattern: HELP. Then a fire. Then a figure waving a scrap of cloth.",
    ],
    tells: [
      { text: "The fire is small and low, well hidden. Someone is trying not to be found by the wrong people.", shows: "genuine", p: 0.5 },
      { text: "The flares were fired ragged, and far apart. Whoever fired them was hurt or slow.", shows: "genuine", p: 0.45 },
      { text: "The fire is big, and stacked high, with a long clear line of sight to the road.", shows: "trap", p: 0.55 },
      { text: "You can see the ground around the fire. It is trampled, and littered with the ends of a great many cigarettes.", shows: "trap", p: 0.5 },
      { text: "A second fire, hidden behind a rise, gives off a thin trail of smoke.", shows: "trap", p: 0.4 },
      { text: "The figure keeps waving after you have clearly seen them.", shows: "noise", p: 0.4 },
    ],
    options: [
      {
        id: "go",
        label: "Take the wagons to the fire",
        hint: "A mile off the road, and a mile back.",
        hours: 3,
        tag: "help",
        results: {
          genuine: [o("Three survivors, badly frostbitten and half-mad with thirst. One of them can walk. You take them aboard.", [fx.recruit(undefined, 0.6), fx.res("rations", [-4, -2]), fx.nerve("all", 3), fx.trust({ trait: "kind" }, 3)], 1)],
          trap: [
            o("There are eleven of them. None is wounded. All are armed.", [fx.combat("raiders"), fx.hp("actor", [-6, -2])], 6),
            o("There is nobody at the fire. There is nobody at the second fire either. There are, however, eleven men in the grass.", [fx.combat("raiders")], 3),
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
          genuine: [o("{actor} finds them, and comes back leading three ragged people, all of them crying.", [fx.recruit(undefined, 0.5), fx.res("rations", [-3, -1]), fx.nerve("all", 3)], 1)],
          trap: [o("{actor} comes back at a run, bleeding, with a story to tell about eleven men and a very good ambush. You are miles away before anyone follows.", [fx.hp("actor", [-9, -4]), fx.nerve("all", -2)], 1)],
        },
      },
      {
        id: "pass",
        label: "Keep going",
        tag: "refuse",
        results: {
          genuine: [o("The flares go up again. Then again. Then no more.", [fx.nerve("all", -3), fx.nerve({ trait: "kind" }, -3), fx.flag("refusedGenuine")], 1)],
          trap: [o("The flares go up again, and then a horn sounds, and then something rides after you a little way, and stops.", [fx.nerve("all", -1)], 1)],
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
    intro: [
      "A woman is pinned under the ridge-beam of a collapsed barn, calling weakly. A doctor's bag lies beside her, open, its contents scattered.",
      "\"My legs. Please. I can tell you what to do.\"",
    ],
    tells: [
      { text: "Her legs below the knee are gray-blue. She has been here hours, perhaps days.", shows: "genuine", p: 0.55 },
      { text: "She is calm, and precise, and describing her own injuries in words no fraud would know.", shows: "genuine", p: 0.5 },
      { text: "The bag is well-worn, the clasp black with use.", shows: "genuine", p: 0.4 },
      { text: "The beam is propped on a fresh-cut prop stone. It did not fall. It was set.", shows: "trap", p: 0.55 },
      { text: "The bag's clasp is new, and the seal on the physic bottles has never been broken.", shows: "trap", p: 0.5 },
      { text: "There is a trail of boot prints leading from the barn to the treeline.", shows: "trap", p: 0.45 },
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
            o("It takes six of you and a lever. Her name is Mattie, and she is a country doctor's daughter, and she will be lame the rest of her life, and she knows what to do with a fever.", [fx.recruit("mattie"), fx.res("medicine", [1, 3]), fx.nerve("all", 4), fx.trust({ trait: "kind" }, 3)], 7),
            o("You free her, and her legs will not hold her, and she tells you to leave her a rifle and a bottle. You will not. But it is a long night.", [fx.recruit("mattie"), fx.res("medicine", [0, 2]), fx.nerve("all", -2)], 2),
          ],
          trap: [
            o("The moment the beam lifts, she rolls free and whistles. The barn was the bait.", [fx.combat("raiders"), fx.hp("actor", [-7, -3])], 7),
            o("The moment the beam lifts, she is up and running, and they have taken half the ration sacks before you have turned around.", [fx.res("rations", [-16, -8]), fx.res("ammo", [-6, -2]), fx.nerve("all", -3)], 3),
          ],
        },
      },
      {
        id: "pass",
        label: "Leave her, and go",
        tag: "refuse",
        results: {
          genuine: [o("The calling follows you across three fields. Nobody says anything for an hour.", [fx.nerve("all", -4), fx.nerve({ trait: "kind" }, -5), fx.trust({ trait: "kind" }, -6), fx.flag("refusedGenuine")], 1)],
          trap: [o("The calling stops abruptly, as if someone had corked it.", [], 1)],
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
    intro: [
      "Six men in Company greatcoats stand in the road, rifles slung, hands empty and open. The eldest steps forward.",
      "\"We're not here to hurt anyone. We want to trade. Powder for food. We've had neither in nine days.\"",
    ],
    tells: [
      { text: "The coats are patched, faded, and do not fit, and every man has worn his so long that the collars have shaped to his neck.", shows: "genuine", p: 0.5 },
      { text: "They stand in the open, and keep their hands in view the whole time.", shows: "genuine", p: 0.5 },
      { text: "The eldest asks after your sick before he asks about your powder.", shows: "genuine", p: 0.4 },
      { text: "The coats are new. The boots, under them, are not.", shows: "trap", p: 0.55 },
      { text: "Two men have drifted around behind your wagons while the eldest talks.", shows: "trap", p: 0.55 },
      { text: "Their rifles are cleaner than their faces.", shows: "trap", p: 0.45 },
    ],
    options: [
      {
        id: "trade",
        label: "Trade 6 powder & shot for food and news",
        hours: 1,
        cost: { ammo: 6 },
        tag: "help",
        results: {
          genuine: [o("A fair trade. The eldest gives you a sack of rations and, in a low voice, a description of the road ahead that saves you an hour.", [fx.res("rations", [8, 14]), fx.gap([3, 6]), fx.recruit("thaddeus", 0.3)], 1)],
          trap: [
            o("They take the powder and turn their rifles on you.", [fx.combat("raiders")], 6),
            o("They take the powder, and smile, and hand you a sack of gravel. Then they are gone into the trees.", [fx.nerve("all", -3)], 3),
          ],
        },
      },
      {
        id: "refuse",
        label: "Decline and keep going",
        tag: "refuse",
        results: {
          genuine: [o("The eldest nods. He looks tired. He steps aside.", [fx.nerve({ trait: "kind" }, -2)], 1)],
          trap: [o("The eldest nods and steps aside. Two of the men do not. You have them in your sights until the bend.", [fx.nerve("all", -2)], 1)],
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
    intro: ["A broad, flat barge waits at a river too wide to ford. A gaunt man with a pole raises a hand."],
    tells: [
      { text: "The barge is patched and re-patched by someone with a great many years to do it.", shows: "genuine", p: 0.5 },
      { text: "The rope is a permanent one, slung across the whole river and bolted into stone on both sides.", shows: "genuine", p: 0.5 },
      { text: "He quotes you a price, and then a lower one when he sees your faces.", shows: "genuine", p: 0.35 },
      { text: "The far-bank rope end is tied off to a single sapling, and not tied well.", shows: "trap", p: 0.5 },
      { text: "The barge sits very high in the water, as if it is expected to carry very little.", shows: "trap", p: 0.4 },
      { text: "There is a second barge on the far bank, with three men in it, watching.", shows: "trap", p: 0.4 },
    ],
    options: [
      {
        id: "pay",
        label: "Pay 20 scrip and ride the ferry",
        hours: 2,
        cost: { scrip: 20 },
        tag: "help",
        results: {
          genuine: [o("A slow, careful crossing. The ferryman does not say a word. On the far bank he turns his hat over in his hands and says: 'God keep you.'", [], 1)],
          trap: [
            o("Midway across, he lets go the pole. The current takes the barge, and the ropes come loose, and you lose things overboard.", [fx.res("rations", [-14, -6]), fx.res("ammo", [-6, -2]), fx.hours(2), fx.nerve("all", -3)], 6),
            o("On the far bank he asks for double. There are men behind the trees.", [fx.scrip(-20), fx.res("rations", [-8, -4]), fx.nerve("all", -2)], 4),
          ],
        },
      },
      {
        id: "ford",
        label: "Look for a ford instead",
        hours: 4,
        results: { any: [o("You find shallows upstream. It costs half a day. But nobody drowns.", [fx.repair(-6), fx.nerve("all", -1)], 1)] },
      },
    ],
  },
  {
    id: "refugee-camp",
    kind: "stranger",
    weight: 4,
    genuineOdds: 0.75,
    title: "The ruined chapel",
    intro: [
      "Forty people camp in the shell of a chapel: children, old men, a nun. They hold out empty bowls. They are the color of the dust.",
    ],
    tells: [
      { text: "Every one of them is thin as fence posts. Nobody has more than one blanket.", shows: "genuine", p: 0.6 },
      { text: "The nun takes a bowl for herself last.", shows: "genuine", p: 0.4 },
      { text: "A few of the men are watching the wagons with different eyes to the rest.", shows: "trap", p: 0.5 },
      { text: "There is hard-looking meat drying at the back of the chapel, and no animals anywhere.", shows: "trap", p: 0.35 },
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
            o("The nun weeps. An old man draws you a map, half from memory. It is a good one.", [fx.gap([3, 7]), fx.nerve("all", 3), fx.trust({ trait: "kind" }, 4), fx.recruit(undefined, 0.25)], 6),
            o("They are so grateful it hurts to watch. It costs you what it costs you.", [fx.nerve("all", 2), fx.trust({ trait: "kind" }, 3)], 3),
          ],
          trap: [o("The moment you open the sack, a hundred hands reach out. It is not a request.", [fx.combat("mob"), fx.res("rations", [-6, -2])], 1),],
        },
      },
      {
        id: "pass",
        label: "Drive on, eyes forward",
        tag: "refuse",
        results: {
          genuine: [o("A boy runs alongside the wagon for a hundred yards. You do not look at him.", [fx.nerve("all", -4), fx.nerve({ trait: "kind" }, -4), fx.trust({ trait: "kind" }, -5), fx.flag("refusedGenuine")], 1)],
          trap: [o("Something comes flying out of the ruins and rings off a wagon's iron rim. Stones. They stop after a while.", [fx.repair(-4)], 1)],
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
    intro: [
      "A man in a wide hat sits by the road with a portfolio of hand-drawn maps. Each has a route marked in red ink.",
      "\"A safe way through. Around the worst of it. Forty scrip, and worth ten times that.\"",
    ],
    tells: [
      { text: "His maps show landmarks you know, in the right places, drawn with a surveyor's care.", shows: "genuine", p: 0.55 },
      { text: "The red route is marked, and corrected, and re-marked. He is still working on it.", shows: "genuine", p: 0.4 },
      { text: "Every map looks exactly like the others, down to the ink blots.", shows: "trap", p: 0.55 },
      { text: "The landmarks on his maps are correct, right up to the point where the red ink starts.", shows: "trap", p: 0.45 },
      { text: "He takes your scrip without looking at it, and starts packing.", shows: "trap", p: 0.4 },
    ],
    options: [
      {
        id: "buy",
        label: "Buy a map (40 scrip)",
        hours: 1,
        cost: { scrip: 40 },
        tag: "help",
        results: {
          genuine: [o("It is a good map. It is better than good. It shaves a full day off the road.", [fx.advance([22, 34])], 1)],
          trap: [
            o("The red route ends in a bog the color of rust. It takes half a day to get out.", [fx.gap([-9, -5]), fx.hours(3), fx.nerve("all", -3), fx.repair(-8)], 6),
            o("The red route runs straight into the Haze, and only just out again.", [fx.fog("two"), fx.gap(-6), fx.nerve("all", -4)], 3),
          ],
        },
      },
      {
        id: "pass",
        label: "Not today",
        tag: "refuse",
        results: {
          genuine: [o("He shrugs. He does not plead. A man who knows what he has.", [fx.flag("passedMap")], 1)],
          trap: [o("He shrugs, and folds up his maps, and is gone by the time you look back.", [], 1)],
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
    intro: [
      "For an hour now a figure has been walking alongside the lead wagon, twenty yards off the road. No one saw it arrive. It matches your pace exactly.",
    ],
    tells: [
      { text: "The figure limps. Real limp, cautious, a hurt ankle taped up in strips of cloth.", shows: "genuine", p: 0.5 },
      { text: "It has been calling out, quietly, but no one heard. Its mouth is cracked and dry.", shows: "genuine", p: 0.45 },
      { text: "It does not limp, or tire, or speed up. It just matches you.", shows: "trap", p: 0.6 },
      { text: "The oxen refuse to look at it. They stare hard at the road.", shows: "trap", p: 0.55 },
      { text: "It has no shadow, despite the torches.", shows: "trap", p: 0.45 },
      { text: "It has been looking at the wagons the whole time. Not at any one person.", shows: "noise", p: 0.4 },
    ],
    options: [
      {
        id: "call",
        label: "Call out to it",
        hours: 0.5,
        tag: "help",
        results: {
          genuine: [o("It stumbles toward you with a cry of relief. A drover, lost for days. He is dazed and broken, but real.", [fx.recruit(undefined, 0.5), fx.res("rations", -2), fx.nerve({ trait: "kind" }, 3)], 1)],
          trap: [o("It stops walking. It turns. It smiles with too many teeth, and the walk becomes a run.", [fx.combat("hollowed-single"), fx.nerve("all", -3)], 1)],
        },
      },
      {
        id: "torch",
        label: "Ring it with torches and see what it does",
        hours: 0.5,
        cost: { torches: 2 },
        results: {
          genuine: [o("It cries out and covers its face, and drops to its knees: a frightened man, blinded by the light. He begs. You give him water and a ration and go on.", [fx.res("rations", -1), fx.nerve({ trait: "kind" }, -2)], 1)],
          trap: [o("It shrieks, and recoils, and the shape of it comes apart and is gone. There is a smell of hot copper.", [fx.nerve("all", -2)], 1)],
        },
      },
      {
        id: "ignore",
        label: "Do not acknowledge it",
        tag: "refuse",
        results: {
          genuine: [o("It walks with you for another hour. Then it falls behind, and you do not turn around.", [fx.nerve({ trait: "kind" }, -3), fx.flag("refusedGenuine")], 1)],
          trap: [o("It walks with you for another hour. Then, at a bend, it is gone. Just gone.", [fx.nerve("all", -3)], 1)],
        },
      },
    ],
  },
];
