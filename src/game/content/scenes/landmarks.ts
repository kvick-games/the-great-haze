// Landmarks: fixed points on the road where the route itself makes a demand of
// you. The Gate is the finale, and it asks the hardest question of all.

import type { Line, Outcome, SceneDef } from "../../types.ts";
import { fx, o } from "../fx.ts";

/** An outcome with spoken lines, optionally gated on a dialogue check. */
function t(out: Outcome, talk: Line[], needs?: "success" | "fail"): Outcome {
  return needs ? { ...out, talk, needs } : { ...out, talk };
}

export const LANDMARK_SCENES: SceneDef[] = [
  {
    id: "ninefold-crossing",
    kind: "landmark",
    weight: 0,
    title: "Ninefold Bridge",
    intro: [
      "Nine stone arches over a brown, fast river. The fifth is gone; a cracked slab hangs where it stood.",
      "On the far bank, someone has left a lantern burning.",
    ],
    talk: [
      { who: "actor", text: "Who lit that lantern?", mood: "afraid", gesture: "point", alt: { paranoid: "Somebody lit that lantern for us. Why would they?" } },
      { who: "other", text: "That slab's cracked clean through.", mood: "afraid" },
      { who: "role:mechanic", text: "Planks and rope. Give me five hours.", mood: "calm" },
      { who: "leader", text: "Someone crossed before us. That's all it means.", mood: "calm" },
    ],
    options: [
      {
        id: "cross",
        label: "Cross the broken span, one wagon at a time",
        hours: 1.5,
        results: {
          any: [
            t(o("The slab bows and groans and holds.", [fx.nerve("all", -2)], 6, [{ if: { role: "mechanic" }, add: 2 }]), [
              { who: "other", text: "Don't stop on it. Don't stop.", mood: "afraid" },
              { who: "actor", text: "Over. All of us, over.", mood: "calm" },
            ]),
            t(o("The slab cracks under the last wagon. It goes, cargo and all.", [fx.wagons(-1), fx.nerve("all", -6)], 3), [
              { who: "actor", text: "No— no, no, no—", mood: "afraid", gesture: "raise-hands" },
              { who: "other", text: "It's gone. It's just gone.", mood: "grieving" },
            ]),
          ],
        },
      },
      {
        id: "plank",
        label: "Bridge the gap with wagon planks",
        hint: "Costs 1 spare part. Slow and sure.",
        hours: 5,
        hoursMod: { if: { role: "mechanic" }, mult: 0.6 },
        cost: { spares: 1 },
        results: {
          any: [
            t(o("A rickety span of planks and rope. Not pretty. Enough.", [], 1), [
              { who: "role:mechanic", text: "Don't bounce. I mean it.", mood: "cold" },
              { who: "actor", text: "I'm going to kiss the far bank.", mood: "calm", alt: { stoic: "Good work. Let's go." } },
            ]),
          ],
        },
      },
      {
        id: "ford",
        label: "Ford the river below the bridge",
        hours: 2,
        results: {
          any: [
            t(o("Cold, brown, waist deep. Every ox complains. Every wagon lands.", [fx.repair(-6), fx.res("rations", [-6, -2])], 6), [
              { who: "actor", text: "My boots are full of river.", mood: "calm" },
            ]),
            t(o("The river takes a wagon by the wheels, and does not give it back.", [fx.wagons(-1), fx.hp("actor", [-9, -4]), fx.nerve("all", -5)], 3), [
              { who: "actor", text: "I had it! I had the rope!", mood: "grieving", gesture: "clutch" },
              { who: "other", text: "Let go. Let go or it takes you too.", mood: "afraid" },
            ]),
          ],
        },
      },
      {
        id: "lead",
        label: "Lead the oxen over by hand, fast",
        hint: "Quick if they stay calm. If they panic on the slab...",
        hours: 1,
        check: { kind: "calm", dc: 13, target: "the oxen" },
        results: {
          any: [
            t(o("{by} walks backwards over the crack, talking the whole way. The oxen follow.", [], 1), [
              { who: "by", text: "Look at me. Only me. Step. Good. Step.", mood: "calm", gesture: "beckon" },
              { who: "other", text: "I couldn't have done that.", mood: "calm" },
            ], "success"),
            t(o("Halfway, the lead ox panics. The slab takes a wagon, and nearly takes {by}.", [fx.wagons(-1), fx.hp("by", [-10, -5]), fx.nerve("all", -6)], 1), [
              { who: "by", text: "Easy— easy— no!", mood: "afraid", gesture: "raise-hands" },
              { who: "other", text: "Your hand! Give me your hand!", mood: "afraid", gesture: "beckon" },
            ], "fail"),
          ],
        },
      },
    ],
  },
  {
    id: "glass-fork",
    kind: "landmark",
    weight: 0,
    title: "The Fork at Glass Cross",
    intro: [
      "A sign in the salt: OLD RAIL LINE, 45 MILES SAVED, MIND THE TUNNELS. PILGRIM ROAD, LONGER, SAFER, BLESSED.",
      "Someone has crossed out BLESSED with a knife.",
    ],
    talk: [
      { who: "actor", text: "Forty-five miles. That's two days. Two days!", mood: "calm", alt: { coward: "It says tunnels. I'm not going in tunnels." } },
      { who: "other", text: "Who crosses out blessed? Who does that?", mood: "afraid", alt: { pious: "Somebody lost their faith right here. Right here." } },
      { who: "role:scout", text: "Rail's straight. But you can't see into a tunnel.", mood: "cold" },
      { who: "leader", text: "Fast or safe. Nobody complains after.", mood: "cold" },
    ],
    options: [
      {
        id: "rail",
        label: "Take the old rail line",
        hint: "Flat and fast. There is a reason nobody takes it.",
        hours: 0.5,
        results: {
          any: [
            t(o("The bed is flat as a table. You fly. Twice, you pass things that were once trains.", [fx.advance([40, 55]), fx.nerve("all", -1)], 5), [
              { who: "actor", text: "Don't look in the carriages.", mood: "afraid" },
              { who: "other", text: "Were those people? In the windows?", mood: "afraid" },
            ]),
            t(o("A broken rail. A wagon leaves the track and goes over. A long afternoon.", [fx.advance([16, 26]), fx.repair(-25), fx.hours(3)], 2), [
              { who: "role:mechanic", text: "Rail's snapped. Like something bit it.", mood: "cold" },
              { who: "actor", text: "Two days saved, they said.", mood: "angry" },
            ]),
            t(o("Something has been living in the tunnels. It does not like visitors.", [fx.advance([20, 30]), fx.combat("hollowed-pack"), fx.nerve("all", -3)], 3), [
              { who: "other", text: "Something's moving. In the dark, there—", mood: "afraid", gesture: "point" },
              { who: "leader", text: "Light! Guns! Get the light up!", mood: "angry", gesture: "draw-weapon" },
            ]),
          ],
        },
      },
      {
        id: "pilgrim",
        label: "Take the pilgrim road",
        hint: "Slower. The cairns often hold offerings.",
        hours: 3,
        results: {
          any: [
            t(o("A long, dry road of cairns. In several, someone has left food.", [fx.res("rations", [5, 12]), fx.nerve("all", 2)], 6), [
              { who: "actor", text: "Bread. Somebody left bread for strangers.", mood: "grieving", gesture: "offer", alt: { pious: "Blessed after all. Somebody out here's still kind." } },
            ]),
            t(o("A long, dry, winding road. Safe. You resent every mile of it.", [fx.nerve("all", -1)], 4), [
              { who: "other", text: "We'd be there by now.", mood: "angry", alt: { stoic: "Safe is safe. Walk." } },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "saint-ambrose",
    kind: "landmark",
    weight: 0,
    genuineOdds: 0.5,
    title: "The Mission of Saint Ambrose",
    intro: [
      "A whitewashed mission on a low rise, one light in a window. As you near, the bell begins to ring.",
      "By the gate, a cloth laid out: bread, water, a bowl of salt.",
    ],
    stranger: {
      name: "The monk at the gate",
      look: {
        build: "gaunt",
        height: "tall",
        age: 44,
        skin: "pale, windburned across the cheeks",
        hair: { style: "cropped", color: "grey-brown, a ragged tonsure", facial: "stubble" },
        clothing: ["a grey wool habit, the hem black with mud", "a rope belt with one iron key", "bare feet, grey with dust"],
        palette: ["whitewash", "wool grey", "lamp amber"],
        prop: { id: "bell-rope", desc: "a length of frayed bell rope wound round one raw fist" },
        marks: ["knuckles split from the rope", "a tremor in the lamp hand"],
        summary: "A gaunt, barefoot monk in a mud-hemmed grey habit at a whitewashed gate, a lamp in one hand and bell rope round the other.",
      },
    },
    talk: [
      { who: "stranger", text: "Come in. Come in out of the red.", mood: "pleading", gesture: "beckon" },
      { who: "actor", text: "Walls. Real walls. And bread.", mood: "grieving", alt: { paranoid: "Bread on a wall. That's how you bait a trap." } },
      { who: "other", text: "Monks don't live this close to the Haze. Do they?", mood: "afraid" },
      { who: "leader", text: "Watch the windows. All of them.", mood: "cold" },
    ],
    tells: [
      { text: "The bell rings unevenly, pulled by an unsteady hand.", shows: "genuine", p: 0.5, severity: 1, say: "Hear the bell? Somebody tired is pulling that." },
      { text: "Small graves in the yard. Fresh, neat, wildflowers on each one.", shows: "genuine", p: 0.5, severity: 2, say: "Children's graves. Somebody still brings them flowers." },
      { text: "The garden is tended: beans staked, weeds pulled. Slowly, but pulled.", shows: "genuine", p: 0.45, severity: 2, say: "Beans are staked. Somebody's been weeding. Slowly." },
      { text: "Every shutter is closed. Every one. From the outside.", shows: "trap", p: 0.55, severity: 3, say: "The shutters are barred. From outside. Who bars them outside?" },
      { text: "The light in the window does not flicker. Not once.", shows: "trap", p: 0.5, severity: 2, say: "That lamp hasn't flickered once. Not once." },
      { text: "The bell rings again, on the exact same beat, for a very long time.", shows: "trap", p: 0.45, severity: 2, say: "Same beat, every time. Nobody pulls a rope like that." },
      { text: "No smoke from the chimney. No smell of anything at all.", shows: "trap", p: 0.4, severity: 1, say: "No smoke. No cooking. Nothing." },
    ],
    options: [
      {
        id: "enter",
        label: "Take shelter inside for the night",
        hint: "Warmth, food, walls. If it is real.",
        hours: 6,
        tag: "help",
        results: {
          genuine: [
            t(
              o("A dozen weary monks and a scared dog. Soup, beds, no questions. At dawn, Brother Ambrose asks to come with you.", [fx.nerve("all", 10), fx.hp("all", 12), fx.res("rations", [6, 12]), fx.res("medicine", [1, 3]), fx.bondAll(3), fx.recruit("ambrose", 0.8)], 1),
              [
                { who: "stranger", text: "Eat. Sleep. Nobody counts your plates here.", mood: "calm", gesture: "offer" },
                { who: "actor", text: "I'd forgotten what soup was.", mood: "grieving", alt: { stoic: "Good soup. Thank you." } },
                { who: "npc:ambrose", text: "Let me come. I can still speak for people.", mood: "calm", gesture: "offer" },
              ],
            ),
          ],
          trap: [
            t(o("The doors close behind you. The hoods fall back, and the faces are people long since gone.", [fx.combat("hollowed-pack"), fx.fog("two"), fx.nerve("all", -5)], 6), [
              { who: "stranger", text: "Stay. Everyone stays.", mood: "cold" },
              { who: "actor", text: "Their faces. God, their faces.", mood: "afraid" },
              { who: "leader", text: "Back to back! Now!", mood: "angry", gesture: "draw-weapon" },
            ]),
            t(o("Morning. Three ration sacks lie open. Two of yours stare at the roof and will not say why.", [fx.res("rations", [-10, -5]), fx.fog("two"), fx.nerve("all", -6)], 3), [
              { who: "leader", text: "Who opened the sacks? Who?", mood: "angry" },
              { who: "actor", text: "Don't ask me what I saw. Don't.", mood: "afraid", gesture: "turn-away" },
            ]),
          ],
        },
      },
      {
        id: "yard",
        label: "Camp in the yard and speak at the gate",
        hint: "Trust them a little. Not entirely.",
        hours: 2,
        tag: "help",
        results: {
          genuine: [
            t(o("They bring bread and a little physic to the threshold, and ask nothing. An old monk blesses the wagons.", [fx.res("rations", [3, 7]), fx.res("medicine", [0, 1]), fx.nerve("all", 4)], 1), [
              { who: "stranger", text: "It isn't much. It's what we have.", mood: "calm", gesture: "offer" },
              { who: "other", text: "They're just... kind. Out here.", mood: "grieving", alt: { pious: "Bless them. Bless every one of them." } },
            ]),
          ],
          trap: [
            t(o("Nobody comes to the gate. The bell rings all night, patiently.", [fx.nerve("all", -4)], 1), [
              { who: "actor", text: "Make it stop. Please make it stop.", mood: "pleading", alt: { stoic: "It's a bell. Sleep." } },
            ]),
          ],
        },
      },
      {
        id: "pass",
        label: "Go on past",
        tag: "refuse",
        results: {
          genuine: [
            t(o("The bell rings behind you until it's out of earshot. It sounds like someone hoping.", [fx.nerve({ trait: "pious" }, -4), fx.flag("refusedGenuine")], 1), [
              { who: "stranger", text: "Wait! Please, there's room!", mood: "pleading", gesture: "raise-hands" },
              { who: "actor", text: "Keep driving.", mood: "cold", alt: { kind: "He sounded so alone.", pious: "We passed a house of God. We just passed it." } },
            ]),
          ],
          trap: [
            t(o("The bell stops the moment you pass the gate.", [], 1), [
              { who: "other", text: "It stopped. Why did it stop?", mood: "afraid" },
              { who: "leader", text: "Don't look back.", mood: "cold" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "toll-gate",
    kind: "landmark",
    weight: 0,
    genuineOdds: 0.3,
    title: "The Toll Gate at the Spine",
    intro: ["An iron chain across the pass. A stone hut. Eight men in Company armbands who've sat in the sun too long."],
    stranger: {
      name: "The toll captain",
      look: {
        build: "broad",
        height: "average",
        age: 46,
        skin: "sunburnt red, peeling at the nose",
        hair: { style: "short", color: "iron grey, sweat-flattened", facial: "moustache" },
        clothing: ["a faded Company coat with a red armband", "a cartridge belt worn loose", "cavalry boots split at the toe"],
        palette: ["Company blue gone grey", "armband red", "rust"],
        prop: { id: "chain-key", desc: "a big iron padlock key on a thong round his neck" },
        marks: ["a pale scar through one eyebrow", "chews his lip when he counts"],
        summary: "A broad, sunburnt man in a faded Company coat and red armband, an iron key on his chest, standing before a chained mountain pass.",
      },
    },
    talk: [
      { who: "stranger", text: "Toll's sixty scrip. Road's the road. You want over, you pay.", mood: "cold", gesture: "point" },
      { who: "actor", text: "Sixty? For a chain across a mountain?", mood: "angry", alt: { greedy: "Sixty. We'd eat a week on sixty." } },
      { who: "other", text: "Count them. Eight. Eight rifles.", mood: "afraid", alt: { veteran: "Eight men. Half of them have never fired." } },
      { who: "leader", text: "Easy. Everybody easy.", mood: "calm" },
    ],
    tells: [
      { text: "A proper ledger, a proper strongbox, a proper Company writ on the wall, faded with weather.", shows: "genuine", p: 0.5, severity: 2, say: "Proper ledger. Proper writ. They're Company, all right." },
      { text: "A rockfall ahead has been cleared from the road. Recently. By hand.", shows: "genuine", p: 0.4, severity: 1, say: "Somebody cleared the road past them. By hand." },
      { text: "The men watch the sky as much as they watch you. They are afraid, too.", shows: "genuine", p: 0.4, severity: 2, say: "They keep checking the sky. They're scared too." },
      { text: "The chain is new. The hut is old. The men are neither.", shows: "trap", p: 0.5, severity: 2, say: "New chain, old hut. Those men don't fit either." },
      { text: "Bones in the ditch beside the hut. Human ones.", shows: "trap", p: 0.4, severity: 3, say: "Bones in the ditch. Human. Don't point." },
      { text: "The writ on the hut wall hangs upside down.", shows: "trap", p: 0.4, severity: 2, say: "Their writ's upside down. Nobody here can read." },
      { text: "They ask what you carry, and what you'd rather not lose.", shows: "trap", p: 0.5, severity: 2, say: "They keep asking what we've got. Tolls don't care." },
    ],
    options: [
      {
        id: "pay",
        label: "Pay the toll (60 scrip)",
        hours: 1,
        cost: { scrip: 60 },
        tag: "help",
        results: {
          genuine: [
            t(o("The chain drops. The captain stamps a chit, and quietly tells you what's past the pass.", [fx.gap([4, 8])], 1), [
              { who: "stranger", text: "Slide on the far side. Keep left. Don't stop.", mood: "calm" },
              { who: "other", text: "He didn't have to tell us that.", mood: "calm" },
            ]),
          ],
          trap: [
            t(o("The chain drops. Then it rises again, and the captain smiles.", [fx.res("rations", [-14, -8]), fx.res("ammo", [-8, -3]), fx.nerve("all", -3)], 6), [
              { who: "stranger", text: "And a bit extra. For the road.", mood: "sly", gesture: "beckon" },
              { who: "actor", text: "We paid. We paid you!", mood: "angry", alt: { coward: "Give it to them. Give them what they want." } },
            ]),
            t(o("The chain drops, and you pass. Nobody says a word. Nobody has to.", [], 3), [
              { who: "other", text: "Don't look at them. Just drive.", mood: "afraid" },
            ]),
          ],
        },
      },
      {
        id: "parley",
        label: "Have your speaker negotiate",
        hours: 1.5,
        actor: { role: "speaker" },
        requires: [{ role: "speaker" }],
        why: "No one here can bargain.",
        results: {
          genuine: [
            t(o("{actor} argues a long hour. A lower toll, and a promise. It's fair.", [fx.scrip(-35)], 1), [
              { who: "actor", text: "Thirty-five, and all the news from behind us.", mood: "sly" },
              { who: "stranger", text: "Done. And you never saw me go soft.", mood: "cold" },
            ]),
          ],
          trap: [
            t(o("{actor} names a Company man, twice. The captain's smile thins. The chain drops.", [fx.bond("actor", "leader", 3)], 1), [
              { who: "actor", text: "Colonel Harrow sends his regards. Shall I say it again?", mood: "sly" },
              { who: "stranger", text: "...Let them through.", mood: "cold", gesture: "turn-away" },
            ]),
          ],
        },
      },
      {
        id: "smash",
        label: "Drive through the chain",
        results: {
          genuine: [
            t(o("They don't laugh. They open fire.", [fx.combat("toll-thugs"), fx.repair(-10)], 1), [
              { who: "stranger", text: "Company road! Fire!", mood: "angry", gesture: "draw-weapon" },
              { who: "leader", text: "Heads down!", mood: "afraid" },
            ]),
          ],
          trap: [
            t(o("The chain snaps. The men scatter, and a shot takes an ox in the flank.", [fx.repair(-8), fx.hp("actor", [-9, -3])], 4), [
              { who: "actor", text: "Go, go, go!", mood: "afraid" },
              { who: "other", text: "They hit an ox! Don't stop!", mood: "afraid" },
            ]),
            t(o("They close on the wagons as one, clubs raised.", [fx.combat("toll-thugs")], 4), [
              { who: "stranger", text: "Nobody runs my chain.", mood: "angry", gesture: "draw-weapon" },
            ]),
          ],
        },
      },
      {
        id: "haggle",
        label: "Haggle him down",
        hint: "Could save half. Annoy him, and it costs more.",
        hours: 1,
        requires: [{ scrip: 60 }],
        why: "You can't haggle with empty pockets.",
        check: { kind: "haggle", dc: 12, target: "the toll captain" },
        tag: "help",
        results: {
          genuine: [
            t(o("{by} gets him down to thirty. The captain stamps the chit, sour.", [fx.scrip(-30)], 1), [
              { who: "by", text: "Thirty, and the whole train's thanks.", mood: "sly", gesture: "offer" },
              { who: "stranger", text: "Thanks don't eat. Fine. Thirty.", mood: "cold" },
            ], "success"),
            t(o("The captain digs in. Seventy now, and an hour in the sun for the trouble.", [fx.scrip(-70), fx.hours(1)], 1), [
              { who: "stranger", text: "Seventy. For wasting my afternoon.", mood: "cold" },
              { who: "by", text: "That's robbery.", mood: "angry" },
            ], "fail"),
          ],
          trap: [
            t(o("The men laugh, and take forty. The chain drops.", [fx.scrip(-40)], 1), [
              { who: "stranger", text: "Forty. You've got a mouth on you.", mood: "sly" },
            ], "success"),
            t(o("They take the sixty. Then they take the rest.", [fx.scrip(-60), fx.res("rations", [-14, -8]), fx.res("ammo", [-8, -3]), fx.nerve("all", -3)], 1), [
              { who: "stranger", text: "Haggle? Let's see what else you've got.", mood: "sly", gesture: "draw-weapon" },
              { who: "by", text: "I'm sorry. I pushed. I'm sorry.", mood: "afraid" },
            ], "fail"),
          ],
        },
      },
      {
        id: "stare-down",
        label: "Tell them to drop the chain",
        hint: "No toll if they fold. Rifles if they don't.",
        hours: 0.5,
        check: { kind: "talk-down", dc: 14, target: "the toll captain" },
        results: {
          genuine: [
            t(o("The captain looks at {by} a long time, then at the sky. The chain drops.", [fx.nerve("all", 1)], 1), [
              { who: "by", text: "The Haze is an hour behind us. Want to argue?", mood: "cold" },
              { who: "stranger", text: "Go. Before I change my mind.", mood: "cold", gesture: "turn-away" },
            ], "success"),
            t(o("The captain's hand goes up. The rifles come down.", [fx.combat("toll-thugs"), fx.nerve("all", -2)], 1), [
              { who: "stranger", text: "Company road. Company toll. Warning's over.", mood: "angry", gesture: "draw-weapon" },
              { who: "by", text: "Wait— wait, we can pay—", mood: "afraid", gesture: "raise-hands" },
            ], "fail"),
          ],
          trap: [
            t(o("{by} doesn't blink. The men look to their captain, and he looks away.", [], 1), [
              { who: "by", text: "You've eaten well off frightened people. We're not frightened.", mood: "cold" },
              { who: "stranger", text: "Drop it. They're not worth the lead.", mood: "cold" },
            ], "success"),
            t(o("They laugh at {by}. Then they come for the wagons.", [fx.combat("toll-thugs"), fx.hp("by", [-8, -3])], 1), [
              { who: "stranger", text: "Brave. Hold that one down first.", mood: "sly", gesture: "draw-weapon" },
            ], "fail"),
          ],
        },
      },
    ],
  },
  {
    id: "the-gate",
    kind: "landmark",
    weight: 0,
    title: "The Gate of the Blue Reach",
    intro: [
      "A wall of white stone, sixty feet high. Above it, a sky the color of a robin's egg.",
      "A small door opens. A woman steps out with a ledger and a lamp.",
    ],
    stranger: {
      name: "The warden",
      look: {
        build: "slight",
        height: "tall",
        age: 61,
        skin: "pale, almost paper, never sunburnt",
        hair: { style: "bun", color: "white, pinned tight", facial: "none" },
        clothing: ["a high-collared grey dress, starched stiff", "white cotton gloves, ink at the fingertips", "a ring of keys at the waist"],
        palette: ["chalk white", "slate grey", "ink black"],
        prop: { id: "ledger", desc: "a ledger thick as a family Bible, every page ruled in two columns" },
        marks: ["spectacles on a cord", "eyes red-rimmed from years of lamplight"],
        summary: "A slight, white-haired woman in starched grey at the foot of an endless white wall, a lamp in one gloved hand and a huge ledger in the other.",
      },
    },
    talk: [
      { who: "stranger", text: "Names. Everyone's. And I will need to see your eyes.", mood: "cold" },
      { who: "actor", text: "It's blue. I forgot it was blue.", mood: "grieving", alt: { stoic: "Eight hundred and forty miles.", coward: "Is it real? Somebody tell me it's real." } },
      { who: "other", text: "What happens if she finds the red in someone?", mood: "afraid", alt: { paranoid: "Two columns in that book. What's the second one for?" } },
      { who: "stranger", text: "Two columns. In, and the ward. I don't make the marks.", mood: "calm" },
      { who: "leader", text: "Stand in a line. Look her in the eye.", mood: "calm" },
    ],
    options: [
      {
        id: "enter",
        label: "Give your names, and step through together",
        requires: [{ not: { fog: true } }],
        why: "Someone among you has been marked. There is no unmarked way in.",
        results: {
          any: [
            t(
              o("She writes each of you down. The door opens on grass, and a child staring at your wagons.", [
                fx.end("victory", "The Blue Reach", [
                  "You have crossed eight hundred and forty miles and the whole world has followed you to the door.",
                  "The gate closes behind you with a sound like a book. Somewhere, very far off, the Haze arrives at the wall and stops, as if listening.",
                  "The sky above you is blue. At its very edge, where the wall meets it, it is, perhaps, a little pink.",
                ]),
              ]),
              [
                { who: "stranger", text: "All clean. Go on through. Welcome to the Reach.", mood: "calm", gesture: "beckon" },
                { who: "actor", text: "We made it. We made it. We—", mood: "grieving", gesture: "clutch", alt: { stoic: "...", hothead: "We made it! You hear that? We made it!" } },
                { who: "other", text: "Say their names. The ones who didn't.", mood: "grieving" },
                { who: "leader", text: "Inside. We'll say every one of them.", mood: "calm" },
              ],
            ),
          ],
        },
      },
      {
        id: "leave-marked",
        label: "Leave the marked in the ward, and go in without them",
        hint: "\"For observation.\" Nobody has ever come out.",
        requires: [{ fog: true }, { leaderFog: false }],
        why: "Either no one is marked, or the mark is on you. You cannot leave yourself behind.",
        results: {
          any: [
            t(
              o("They take the marked gently, to tents beyond the wall. You cannot make yourself believe her.", [
                fx.leave("fogsick", "left in the quarantine ward at the Gate"),
                fx.end("victory", "The Blue Reach: the ones you left", [
                  "The Gate opens for the rest of you. It closes on the marked, and on the last promise you made them.",
                  "The sky is blue. It will be blue for a long time, if you can stand to look at it.",
                  "There is a window in the ward, high up. Sometimes, at dusk, someone stands in it.",
                ]),
              ]),
              [
                { who: "stranger", text: "They'll be looked after. I write down every name.", mood: "calm" },
                { who: "leader", text: "I'll come back for you. I swear it.", mood: "grieving" },
                { who: "stranger", text: "Don't promise. Everyone promises. Say goodbye instead.", mood: "grieving", gesture: "turn-away" },
                { who: "other", text: "Don't look at the tents. Don't.", mood: "grieving", alt: { kind: "They're waving. Wave back. Please, just wave back." } },
              ],
            ),
          ],
        },
      },
      {
        id: "smuggle",
        label: "Hide the marked in the wagons and bluff the ledger",
        hint: "If you are caught, the Gate closes for good.",
        requires: [{ fog: true }],
        why: "No one here is marked.",
        results: {
          any: [
            t(
              o("At the wagons her lamp stops, a long moment. Then she writes a number, and steps aside, and does not look up.", [
                fx.end("victory", "The Blue Reach: the ones you hid", [
                  "The Gate opens, and takes you all. In the shade of the first tree, one of the marked opens their eyes and asks, very quietly, whether the sky is what it looks like.",
                  "It is. Mostly.",
                  "You do not sleep, that first night. But nobody comes for them. Yet.",
                ]),
              ], 4, [{ if: { role: "speaker" }, add: 3 }]),
              [
                { who: "stranger", text: "Four. Five... Five. Go on.", mood: "cold", gesture: "turn-away" },
                { who: "other", text: "She knew. She knew, and she let us.", mood: "grieving" },
              ],
            ),
            t(
              o("Her lamp swings up, and stops. The door is already closing.", [
                fx.end("lost", "Turned away at the Gate", [
                  "The door shuts, and does not open again.",
                  "Behind you, the fog is arriving over the last hill, walking slowly, in no hurry at all, and it is a very long way back to the road.",
                ]),
              ], 4),
              [
                { who: "stranger", text: "You knew.", mood: "cold" },
                { who: "leader", text: "Please. Please, just look at them.", mood: "pleading", gesture: "kneel" },
                { who: "stranger", text: "I'm not angry. I'm only tired.", mood: "grieving", gesture: "turn-away" },
              ],
            ),
          ],
        },
      },
      {
        id: "stay-out",
        label: "Refuse to go in without them. Camp outside.",
        requires: [{ fog: true }],
        why: "No one here is marked.",
        results: {
          any: [
            t(
              o("Your backs to the white wall, your faces to the fog. Somewhere in the night, you all begin to sing.", [
                fx.end("lost", "You stay", [
                  "The Gate does not open. You do not ask it to.",
                  "In the morning the Haze reaches the wall, and stops, as if surprised. It stays there for a long time.",
                  "It is very quiet at the foot of the wall, beneath a blue sky none of you will ever stand under. But you are all still together.",
                ]),
              ]),
              [
                { who: "leader", text: "We came together. We stay together.", mood: "calm" },
                { who: "other", text: "What do we sing?", mood: "grieving", alt: { pious: "Abide with me. Everyone knows that one." } },
                { who: "stranger", text: "I'll leave the lamp out. As long as it lasts.", mood: "grieving", gesture: "offer" },
              ],
            ),
          ],
        },
      },
      {
        id: "plead",
        label: "Ask the warden to write the marked in",
        hint: "The honest way. If she says no, the door closes on all of you.",
        requires: [{ fog: true }],
        why: "No one here is marked.",
        check: { kind: "persuade", dc: 14, target: "the warden" },
        results: {
          any: [
            t(
              o("She reads your whole road in {by}'s face. Then she dips her pen, and writes every name.", [
                fx.end("victory", "The Blue Reach: the ones she wrote in", [
                  "She writes the marked into the same column as the rest of you, and her hand does not shake.",
                  "Inside, a doctor looks into their eyes every morning. Some mornings, the red is fainter.",
                  "The sky is blue. You all stand under it.",
                ]),
              ], 1),
              [
                { who: "by", text: "They carried us here. Every mile. Write them with us.", mood: "pleading", gesture: "kneel" },
                { who: "stranger", text: "One column. Just this once.", mood: "grieving" },
                { who: "stranger", text: "Don't make me sorry.", mood: "cold", gesture: "beckon" },
              ],
              "success",
            ),
            t(
              o("She hears {by} out, all of it. Then she closes the ledger.", [
                fx.end("lost", "The ledger closed", [
                  "The door shuts on all of you. She would not split you, and she would not let them in.",
                  "You make camp against the wall. The Haze comes over the last hill in no hurry at all.",
                ]),
              ], 1),
              [
                { who: "by", text: "Eight hundred miles. Please. Eight hundred miles.", mood: "pleading", gesture: "kneel" },
                { who: "stranger", text: "Every one of them walked eight hundred miles.", mood: "grieving" },
                { who: "stranger", text: "Two columns. Not three. I'm sorry.", mood: "grieving", gesture: "turn-away" },
              ],
              "fail",
            ),
          ],
        },
      },
    ],
  },
];
