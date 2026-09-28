// Hazards: the road itself trying to kill you. No hidden truth: what you see is
// what you get, but every answer costs time, cargo, or blood.

import type { Line, Outcome, SceneDef } from "../../types.ts";
import { fx, o } from "../fx.ts";

/** An outcome with spoken lines, optionally gated on a dialogue check. */
function t(out: Outcome, talk: Line[], needs?: "success" | "fail"): Outcome {
  return needs ? { ...out, talk, needs } : { ...out, talk };
}

export const HAZARDS: SceneDef[] = [
  {
    id: "axle-break",
    kind: "hazard",
    weight: 3,
    title: "An axle goes",
    intro: ["A crack like a rifle shot. The rear axle snaps and the oxen bawl, pulling sideways.", "Everyone looks east before they look at the wheel."],
    talk: [
      { who: "actor", text: "That's the axle. That's the whole axle.", mood: "afraid", gesture: "point", alt: { veteran: "Clean break. Could be worse. Somebody get the jack.", coward: "Leave it. Please, can we just leave it?" } },
      { who: "other", text: "How long, {actor}? How long will it take?", mood: "afraid" },
      { who: "role:mechanic", text: "Give me the spare and three hands. And quiet.", mood: "calm" },
      { who: "leader", text: "Nobody looks east. Look at the wheel.", mood: "cold" },
    ],
    options: [
      {
        id: "replace",
        label: "Fit a spare axle",
        hint: "The proper fix.",
        hours: 3,
        hoursMod: { if: { role: "mechanic" }, mult: 0.5 },
        cost: { spares: 1 },
        results: {
          any: [
            t(o("The new axle seats true. {actor} wipes their hands and doesn't look at the sky.", [fx.repair(22)], 4), [
              { who: "actor", text: "There. There. She'll hold.", mood: "calm", alt: { stoic: "Done. Load up." } },
            ]),
            t(o("It takes longer than it should. The axle is sound. The hands are shaking.", [fx.repair(20), fx.nerve("actor", -2), fx.hours(1)], 1), [
              { who: "actor", text: "I can't get it to— hold it still!", mood: "afraid" },
              { who: "other", text: "I am holding it still.", mood: "angry" },
            ]),
          ],
        },
      },
      {
        id: "splint",
        label: "Splint it with rope and scrap",
        hint: "Cheap and fast. It may not hold.",
        hours: 1.5,
        hoursMod: { if: { role: "mechanic" }, mult: 0.7 },
        results: {
          any: [
            t(o("The splint holds. For now.", [fx.repair(6)], 5, [{ if: { role: "mechanic" }, add: 3 }]), [
              { who: "actor", text: "Don't hit a single rut. Not one.", mood: "calm" },
            ]),
            t(o("The splint gives a mile on. This time the fix takes hours.", [fx.repair(-8), fx.hours(3), fx.nerve("all", -2)], 4), [
              { who: "other", text: "You said it would hold.", mood: "angry" },
              { who: "actor", text: "I said it might.", mood: "cold", alt: { hothead: "Then you fix it next time!" } },
            ]),
          ],
        },
      },
      {
        id: "abandon",
        label: "Leave the wagon and split the load",
        hint: "Fast. You will carry less.",
        hours: 1,
        requires: [{ wagonsMin: 2 }],
        why: "It is your last wagon.",
        results: {
          any: [
            t(o("You unhitch the oxen, share out the cargo, and leave the wagon to the Haze.", [fx.wagons(-1), fx.nerve("all", -3)]), [
              { who: "other", text: "My mother's chair was in that one.", mood: "grieving", alt: { stoic: "It's wood. Keep walking." } },
              { who: "leader", text: "Don't look back at it.", mood: "cold" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "swollen-creek",
    kind: "hazard",
    regions: ["tallow", "fen", "pines", "threshold"],
    weight: 5,
    title: "A swollen creek",
    intro: ["The road runs into black, fast water. The bridge is gone. Somebody's shoe is caught in the reeds."],
    talk: [
      { who: "actor", text: "How deep? Does anybody know how deep?", mood: "afraid", alt: { veteran: "Could be knee. Could be neck. Test it first." } },
      { who: "other", text: "Whose shoe is that?", mood: "afraid", alt: { haunted: "Don't look at the shoe. Just don't." } },
      { who: "role:scout", text: "Fast in the middle. Maybe slower upstream.", mood: "calm", gesture: "point" },
      { who: "leader", text: "Nobody goes in alone.", mood: "cold" },
    ],
    options: [
      {
        id: "drive",
        label: "Drive straight across",
        hours: 0.5,
        results: {
          any: [
            t(o("The oxen lean into the current. You come out soaked, and moving.", [fx.repair(-4)], 6), [
              { who: "actor", text: "Ha! We're across. We're across!", mood: "calm" },
            ]),
            t(o("A wagon slews on the far bank. Sacks go into the water, and are gone.", [fx.res("rations", [-12, -6]), fx.repair(-8), fx.hours(1)], 3), [
              { who: "other", text: "The flour! Grab the—", mood: "afraid", gesture: "point" },
              { who: "actor", text: "Leave it. It's gone.", mood: "cold" },
            ]),
            t(o("A wheel drops into a hole. The wagon goes over, and {actor} is under it.", [fx.res("rations", [-16, -8]), fx.hp("actor", [-14, -7]), fx.repair(-18), fx.hours(2)], 1.2), [
              { who: "actor", text: "My leg— I can't— my leg!", mood: "afraid", gesture: "clutch" },
              { who: "other", text: "Lift! Everybody lift, now!", mood: "afraid" },
            ]),
          ],
        },
      },
      {
        id: "float",
        label: "Unload, rope the wagons over, carry the cargo",
        hint: "The careful way.",
        hours: 4,
        hoursMod: { if: { role: "mechanic" }, mult: 0.75 },
        results: {
          any: [
            t(o("It takes the afternoon and everyone's skin. Nothing is lost.", [fx.nerve("all", -1)], 8), [
              { who: "other", text: "I never want to be wet again.", mood: "calm", alt: { sickly: "I can't feel my feet. Is that bad?" } },
            ]),
            t(o("A rope parts. A crate drifts off, and you let it.", [fx.res("rations", [-4, -2])], 2), [
              { who: "actor", text: "Let it go. Let it go.", mood: "calm" },
            ]),
          ],
        },
      },
      {
        id: "upstream",
        label: "Look upstream for a real crossing",
        hint: "Long. Out of the way.",
        hours: 6,
        results: {
          any: [
            t(o("A stone weir, mostly whole. You cross it one wagon at a time.", [], 7), [
              { who: "actor", text: "Dry boots. I could cry.", mood: "calm", alt: { stoic: "Stone holds. Good." } },
            ]),
            t(o("Something is sitting on the weir, facing the water. It stands up.", [fx.combat("hollowed-single")], 3), [
              { who: "actor", text: "That's not a— that isn't a person.", mood: "afraid", gesture: "point" },
              { who: "leader", text: "Guns. Now.", mood: "cold", gesture: "draw-weapon" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "sinkhole-road",
    kind: "hazard",
    regions: ["tallow", "fen", "flats", "pines"],
    weight: 3,
    title: "The road has fallen in",
    intro: ["Twenty yards ahead the road drops into the earth. A warm wind breathes up out of the dark."],
    talk: [
      { who: "actor", text: "It's breathing. The hole is breathing.", mood: "afraid", gesture: "point", alt: { paranoid: "Something dug that. Roads don't just fall in." } },
      { who: "other", text: "It's only air. Warm air. From down there.", mood: "afraid" },
      { who: "leader", text: "Nobody near the edge on foot.", mood: "cold" },
    ],
    options: [
      {
        id: "edge",
        label: "Skirt the rim, one wagon at a time",
        hours: 1.5,
        results: {
          any: [
            t(o("The ground holds. Barely. No one speaks until it is behind you.", [fx.nerve("all", -1)], 6), [
              { who: "other", text: "Don't talk. Nobody talk till we're past.", mood: "afraid" },
            ]),
            t(o("The rim crumbles under a rear wheel. The wagon tilts, and comes back hurt.", [fx.repair(-14), fx.hp("actor", [-9, -4]), fx.nerve("all", -2)], 3), [
              { who: "actor", text: "My arm— it caught my arm!", mood: "afraid", gesture: "clutch" },
              { who: "other", text: "Don't look down there. Look at me.", mood: "calm" },
            ]),
          ],
        },
      },
      {
        id: "detour",
        label: "Cut a wide detour through the brush",
        hint: "Slow, but safe.",
        hours: 4,
        results: {
          any: [
            t(o("Hours of hacking scrub. But solid ground.", [], 1), [
              { who: "actor", text: "Look at my hands.", mood: "grieving", alt: { stoic: "Blisters heal. Holes don't." } },
              { who: "other", text: "Better than the hole.", mood: "calm" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "ash-squall",
    kind: "hazard",
    weight: 4,
    closeBias: 1.6,
    title: "The sky sheds ash",
    intro: ["A gray-red curtain sweeps the road. Not rain. It leaves rust on the oxen's hides.", "Everyone is coughing."],
    talk: [
      { who: "actor", text: "Cover your mouths! Cover your mouths!", mood: "afraid", alt: { coward: "It's in my mouth. It's in my mouth." } },
      { who: "other", text: "It tastes like pennies.", mood: "afraid" },
      { who: "role:medic", text: "Shallow breaths. Through cloth. Don't gulp it.", mood: "calm" },
      { who: "leader", text: "Stay close to the wagons. Everybody.", mood: "cold" },
    ],
    options: [
      {
        id: "veils",
        label: "Veils on, and drive through",
        hint: "Needs a veil for most of the party.",
        hours: 0.5,
        requires: [{ res: "veils", min: 3 }],
        why: "Not enough veils.",
        results: {
          any: [
            t(o("The veils reek of vinegar and wet linen, but you keep breathing. It passes.", [fx.nerve("all", -1)], 1), [
              { who: "other", text: "Breathe. Just keep breathing.", mood: "calm" },
            ]),
          ],
        },
      },
      {
        id: "shelter",
        label: "Hunker down and wait it out",
        hours: 4,
        results: {
          any: [
            t(o("Four hours under canvas, the wind screaming. Then nothing, as if it never was.", [fx.nerve("all", -1)], 8), [
              { who: "other", text: "Is it over? Is it really over?", mood: "afraid" },
              { who: "actor", text: "Don't open the flap yet.", mood: "cold" },
            ]),
            t(o("It lasts longer. {actor} has stopped coughing in a way you don't like.", [fx.sick("actor"), fx.hours(2)], 2), [
              { who: "actor", text: "I'm fine. I'm fine. Just tired.", mood: "afraid" },
              { who: "role:medic", text: "That isn't fine. Lie down.", mood: "cold" },
            ]),
          ],
        },
      },
      {
        id: "blind",
        label: "Drive blind and pray",
        results: {
          any: [
            t(o("You can't see the oxen's heads. But the road holds, and so do they.", [fx.nerve("all", -3), fx.repair(-6)], 4), [
              { who: "actor", text: "Our Father, who art in heaven...", mood: "pleading", alt: { coward: "I can't see. I can't see anything!" } },
              { who: "other", text: "Keep praying. Keep going.", mood: "afraid" },
            ]),
            t(o("The wagons drift off the road. Hours to find it, and a hand torn on a wheel.", [fx.hours(3), fx.hp("actor", [-9, -5]), fx.nerve("all", -3), fx.sick("random")], 3), [
              { who: "actor", text: "Where's the road? Where did the road go?", mood: "afraid" },
              { who: "other", text: "Hold still. You're bleeding on everything.", mood: "angry" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "spoiled-stores",
    kind: "hazard",
    weight: 3,
    title: "The damp got into the stores",
    intro: ["A sack splits as it's lifted. The rations have gone black and soft along one side."],
    talk: [
      { who: "actor", text: "Oh, God. The smell.", mood: "afraid", gesture: "turn-away", alt: { greedy: "How much? How much is gone?" } },
      { who: "other", text: "That was a week of eating.", mood: "grieving" },
      { who: "leader", text: "Count what's good. Nobody panic.", mood: "calm" },
    ],
    options: [
      {
        id: "cull",
        label: "Cull the rot",
        hours: 1,
        results: {
          any: [
            t(o("You throw out what has turned. It is a lot.", [fx.res("rations", [-12, -5])], 1), [
              { who: "other", text: "Six. Seven. Stop counting. It doesn't help.", mood: "grieving" },
            ]),
          ],
        },
      },
      {
        id: "eat",
        label: "Eat it anyway. Waste nothing.",
        hint: "Nobody will thank you for this one.",
        results: {
          any: [
            t(o("Foul, and tasting of copper. Everyone keeps it down.", [fx.nerve("all", -2)], 6), [
              { who: "actor", text: "Don't chew. Just swallow.", mood: "cold", alt: { kind: "Here. Hold your nose. I'll go first." } },
            ]),
            t(o("It was foul for a reason. By dusk, three people are doubled over.", [fx.sick("two"), fx.sick("random"), fx.nerve("all", -3)], 5), [
              { who: "actor", text: "I said. I said it was bad!", mood: "angry", gesture: "clutch" },
              { who: "other", text: "Bucket. Somebody. Bucket.", mood: "afraid" },
            ]),
          ],
        },
      },
      {
        id: "forage",
        label: "Send {actor} to forage",
        hint: "Best done by a hunter.",
        hours: 3,
        actor: { role: "hunter" },
        requires: [{ role: "hunter" }],
        why: "Nobody here can hunt.",
        cost: { ammo: 3 },
        results: {
          any: [
            t(o("{actor} comes back with two hares and a fistful of sour berries. Enough.", [fx.res("rations", [8, 14])], 6), [
              { who: "actor", text: "Hares. Real ones. Nothing wrong with them.", mood: "calm", gesture: "offer" },
            ]),
            t(o("{actor} comes back with nothing, and won't say much.", [fx.nerve("actor", -4)], 3), [
              { who: "actor", text: "The birds don't sing in there.", mood: "afraid", alt: { veteran: "Not a track. Something ate it all first." } },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "fever",
    kind: "hazard",
    weight: 4,
    title: "A fever in the train",
    intro: ["{actor} wakes soaked and shaking, eyes glassy. The others keep their distance."],
    talk: [
      { who: "actor", text: "Why's it so cold? Why is it so cold?", mood: "afraid", gesture: "clutch", alt: { stoic: "It's nothing. Help me up." } },
      { who: "other", text: "Don't touch them. Don't touch them!", mood: "afraid", alt: { kind: "Somebody get a blanket. Now." } },
      { who: "role:medic", text: "Look at me. Let me see your eyes.", mood: "calm" },
      { who: "leader", text: "Tell me it's just fever.", mood: "afraid" },
    ],
    options: [
      {
        id: "physic",
        label: "Treat {actor} now",
        hours: 1,
        hoursMod: { if: { role: "medic" }, mult: 0.5 },
        cost: { medicine: 1 },
        results: {
          any: [
            t(o("It breaks before dawn. They will live, and be angry about it.", [fx.cureSick("actor")], 1), [
              { who: "actor", text: "You spent the physic on me? That was ours.", mood: "angry", alt: { kind: "Thank you. I'm sorry. Thank you." } },
            ]),
          ],
        },
      },
      {
        id: "isolate",
        label: "Quarantine them in the last wagon",
        hint: "Slows the spread. Doesn't stop the fever.",
        hours: 1.5,
        results: {
          any: [
            t(o("The last wagon goes quiet. The fever runs its course.", [fx.sick("actor"), fx.hp("actor", -4)], 6), [
              { who: "actor", text: "Is anyone there? Hello?", mood: "afraid" },
            ]),
            t(o("It runs its course. Nobody trusts the canvas between them.", [fx.sick("actor"), fx.nerve("all", -2)], 3), [
              { who: "other", text: "You can hear it through the canvas. Coughing.", mood: "afraid", alt: { paranoid: "Canvas stops nothing. Burn their blankets." } },
            ]),
          ],
        },
      },
      {
        id: "ignore",
        label: "Push on. No time to nurse anyone.",
        results: {
          any: [
            t(o("They ride, sweating, and eat little.", [fx.sick("actor")], 4), [
              { who: "actor", text: "Just don't let me fall off.", mood: "afraid" },
            ]),
            t(o("It goes through the whole wagon. By dusk two more are down.", [fx.sick("actor"), fx.sick("two"), fx.nerve("all", -2)], 4), [
              { who: "other", text: "It's in me now. I can feel it.", mood: "afraid" },
              { who: "leader", text: "Keep moving.", mood: "cold" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "oxen-balk",
    kind: "hazard",
    weight: 4,
    closeBias: 2,
    title: "The oxen will not move",
    intro: ["The lead ox stops. Then all of them. They turn their heads together to look east, trembling."],
    talk: [
      { who: "actor", text: "Come on. Come on! Move!", mood: "angry", alt: { kind: "Easy, girl. Easy. What do you see?" } },
      { who: "other", text: "What are they looking at?", mood: "afraid" },
      { who: "role:hunter", text: "Animals know first. They always know first.", mood: "cold" },
      { who: "leader", text: "Don't look where they're looking.", mood: "cold" },
    ],
    options: [
      {
        id: "wait",
        label: "Wait for them to calm",
        hours: 2,
        results: {
          any: [
            t(o("At last, one by one, they lower their heads. You go on.", [fx.nerve("all", -2)], 1), [
              { who: "other", text: "Two hours. It gained two hours on us.", mood: "afraid", alt: { pious: "Thank you, Lord. Thank you." } },
            ]),
          ],
        },
      },
      {
        id: "goad",
        label: "Goad them forward",
        results: {
          any: [
            t(o("Whips and shouting. They lurch on, wild-eyed, dragging the wagons.", [fx.nerve("all", -2), fx.repair(-5)], 6), [
              { who: "actor", text: "Hyah! Hyah! Go, damn you!", mood: "angry" },
              { who: "other", text: "Look at their eyes.", mood: "afraid" },
            ]),
            t(o("They bolt. A wagon jackknifes into a ditch, and {actor} is thrown, badly.", [fx.repair(-16), fx.hp("actor", [-13, -6]), fx.hours(2)], 3), [
              { who: "other", text: "{actor}! Say something!", mood: "afraid", gesture: "kneel" },
              { who: "actor", text: "Did they stop? Did the oxen stop?", mood: "afraid" },
            ]),
          ],
        },
      },
      {
        id: "fire",
        label: "Light torches to lead them",
        hint: "Oxen trust fire. Mostly.",
        hours: 0.5,
        cost: { torches: 2 },
        results: {
          any: [
            t(o("They follow the fire the way they did in the old world. It works.", [], 1), [
              { who: "actor", text: "That's it. Follow the light. Good.", mood: "calm", gesture: "beckon" },
            ]),
          ],
        },
      },
      {
        id: "soothe",
        label: "Gentle them on by hand",
        hint: "Costs nothing if it works. If it doesn't, they bolt.",
        hours: 0.5,
        check: { kind: "calm", dc: 12, target: "the oxen" },
        results: {
          any: [
            t(o("{by} walks the line, a hand on every neck. The oxen lower their heads and go.", [], 1), [
              { who: "by", text: "Shh. I know. I smell it too. Walk with me.", mood: "calm", gesture: "beckon" },
              { who: "other", text: "How did you do that?", mood: "calm" },
            ], "success"),
            t(o("The lead ox bolts past {by} and the rest follow. Hours to round them up.", [fx.hours(2), fx.hp("by", [-8, -4]), fx.repair(-8), fx.nerve("all", -2)], 1), [
              { who: "by", text: "Whoa— whoa! No!", mood: "afraid", gesture: "raise-hands" },
              { who: "other", text: "Can you get up? Can you stand?", mood: "afraid", gesture: "kneel" },
            ], "fail"),
          ],
        },
      },
    ],
  },
  {
    id: "rockfall",
    kind: "hazard",
    regions: ["spine"],
    weight: 6,
    title: "Rockfall",
    intro: ["Scree slides onto the switchback, still rattling. Thirty feet of broken stone buries the road."],
    talk: [
      { who: "actor", text: "Is anybody under it? Is anybody under it?", mood: "afraid", alt: { stoic: "Nobody under it. Good. Start moving rock." } },
      { who: "other", text: "The whole mountain's coming down.", mood: "afraid" },
      { who: "role:mechanic", text: "Gap on the left. Might take a wagon.", mood: "calm", gesture: "point" },
      { who: "leader", text: "Everyone off the slope side.", mood: "cold" },
    ],
    options: [
      {
        id: "clear",
        label: "Clear a lane by hand",
        hint: "Everyone works. It is slow.",
        hours: 4,
        hoursMod: { if: { role: "mechanic" }, mult: 0.75 },
        results: {
          any: [
            t(o("You pry and drag until your hands bleed. It is enough.", [fx.hp("all", -2), fx.nerve("all", -1)], 7), [
              { who: "other", text: "I can't feel my fingers.", mood: "grieving" },
              { who: "actor", text: "One more. Just one more.", mood: "calm" },
            ]),
            t(o("More comes down while you work. {actor} is caught by it.", [fx.hp("actor", [-13, -6]), fx.hours(1)], 3), [
              { who: "other", text: "Above you! {actor}, above—", mood: "afraid", gesture: "point" },
              { who: "actor", text: "Something's wrong in my ribs.", mood: "afraid", gesture: "clutch" },
            ]),
          ],
        },
      },
      {
        id: "squeeze",
        label: "Squeeze the wagons through the gap",
        hours: 1,
        results: {
          any: [
            t(o("The wheels scream against stone. Inches to spare.", [fx.repair(-12)], 5), [
              { who: "actor", text: "Breathe in, wagon. Breathe in.", mood: "calm", alt: { coward: "It's going to stick. It's going to stick!" } },
            ]),
            t(o("A wagon jams. The axle tears half off before you drag it free.", [fx.repair(-24), fx.hours(2)], 3), [
              { who: "actor", text: "Pull! All together, pull!", mood: "angry" },
              { who: "role:mechanic", text: "Well. That's half an axle.", mood: "cold" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "rotted-trestle",
    kind: "hazard",
    regions: ["tallow", "fen", "pines"],
    weight: 3,
    title: "A rotted trestle",
    intro: ["A wooden trestle carries the road across a gorge. Half the planks are gone. The rest are gray as bone."],
    talk: [
      { who: "actor", text: "That won't hold a dog.", mood: "afraid", alt: { veteran: "Seen worse. Not much worse." } },
      { who: "other", text: "Don't look down. That's what they say, right?", mood: "afraid" },
      { who: "leader", text: "Listen to it creak.", mood: "cold" },
    ],
    options: [
      {
        id: "rush",
        label: "Cross all at once, quickly",
        hours: 0.5,
        results: {
          any: [
            t(o("The timbers groan and hold. Nobody breathes until the last wheel is over.", [fx.nerve("all", -2)], 6), [
              { who: "actor", text: "We're over. Oh God, we're over.", mood: "afraid" },
            ]),
            t(o("A plank gives. The rear wagon drops, and you cut it loose before it takes the rest.", [fx.wagons(-1), fx.nerve("all", -5)], 2), [
              { who: "other", text: "Cut it! Cut it or it takes us all!", mood: "afraid" },
              { who: "actor", text: "Everything was in that one.", mood: "grieving", gesture: "turn-away" },
            ]),
          ],
        },
      },
      {
        id: "single",
        label: "One wagon at a time, unloaded",
        hint: "Slow. Careful.",
        hours: 3,
        results: {
          any: [
            t(o("It takes the afternoon. You cross, and the trestle bows behind you.", [], 9), [
              { who: "other", text: "Hear that? We were the last ones over.", mood: "calm" },
            ]),
            t(o("A rope snaps. A crate is lost to the gorge.", [fx.res("rations", [-6, -3])], 2), [
              { who: "actor", text: "Listen. It hasn't hit the bottom yet.", mood: "afraid" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "cold-night",
    kind: "hazard",
    regions: ["spine", "pines", "threshold"],
    weight: 4,
    title: "A killing cold",
    intro: ["The cold comes like a door opening on winter. The oxen steam. Fingers go white."],
    talk: [
      { who: "actor", text: "I can't feel my hands.", mood: "afraid", alt: { sickly: "It hurts to breathe it. My chest." } },
      { who: "other", text: "Is this the Haze? Does it do this?", mood: "afraid" },
      { who: "leader", text: "Nobody sleeps alone tonight.", mood: "calm" },
    ],
    options: [
      {
        id: "burn",
        label: "Burn extra torches for warmth",
        cost: { torches: 3 },
        results: {
          any: [
            t(o("Fire ringed round the wagons. A costly night, and a warm one.", [fx.nerve("all", 1)], 1), [
              { who: "other", text: "Tell a story. Anyone. Something from before.", mood: "calm" },
              { who: "actor", text: "Once there was a town with no fog...", mood: "calm" },
            ]),
          ],
        },
      },
      {
        id: "huddle",
        label: "Huddle together under every blanket",
        hours: 3,
        results: {
          any: [
            t(o("No one sleeps. But you all wake alive, and a little closer.", [fx.bondAll(3)], 1), [
              { who: "actor", text: "Your feet are like ice.", mood: "calm" },
              { who: "other", text: "Hush. Hold still. I've got you.", mood: "calm", alt: { hothead: "Then stop putting them on me." } },
            ]),
          ],
        },
      },
      {
        id: "push",
        label: "Keep moving to stay warm",
        results: {
          any: [
            t(o("Blue lips and stiff hands. But you go on.", [fx.hp("all", -3)], 5), [
              { who: "actor", text: "Keep walking. Walking's warm.", mood: "cold" },
            ]),
            t(o("The cold takes two of them badly.", [fx.hp("two", [-9, -5]), fx.sick("random"), fx.nerve("all", -2)], 3), [
              { who: "other", text: "Their fingers are black. Why are they black?", mood: "afraid" },
              { who: "role:medic", text: "Rub them. Don't stop rubbing.", mood: "calm" },
            ]),
          ],
        },
      },
    ],
  },
  {
    id: "mud-road",
    kind: "hazard",
    regions: ["tallow", "fen", "pines"],
    weight: 4,
    title: "Bottomless mud",
    intro: ["The road has turned to stew. A wheel is sunk to the hub. The oxen strain and slip."],
    talk: [
      { who: "actor", text: "It's got the wheel. It's got the whole wheel.", mood: "afraid", alt: { hothead: "Stupid, stupid, stupid road!" } },
      { who: "other", text: "Every hour we sit here, it gets closer.", mood: "afraid" },
      { who: "leader", text: "Get the shovels.", mood: "cold" },
    ],
    options: [
      {
        id: "dig",
        label: "Dig the wheels out and lay brush",
        hours: 3,
        results: {
          any: [
            t(o("A wretched hour of digging, then another. Then it gives.", [fx.hp("all", -1)], 1), [
              { who: "actor", text: "On three! One, two—", mood: "angry" },
              { who: "other", text: "It's moving! It's moving!", mood: "calm" },
            ]),
          ],
        },
      },
      {
        id: "lighten",
        label: "Dump 12 rations off the wagons to lighten them",
        hint: "Fast. Awful.",
        hours: 0.5,
        cost: { rations: 12 },
        results: {
          any: [
            t(o("The wagons rise out of the muck. You don't look at what you left.", [fx.nerve("all", -2)], 1), [
              { who: "other", text: "That was food. That was food.", mood: "grieving", alt: { greedy: "Twelve rations. In the mud. Twelve." } },
              { who: "leader", text: "Don't look at it. Drive.", mood: "cold" },
            ]),
          ],
        },
      },
    ],
  },
];
