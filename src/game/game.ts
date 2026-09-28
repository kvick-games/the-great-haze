// The session controller. A Game is a serializable state machine:
//
//   const game = Game.create({ leaderName: "Jo", background: "surveyor" });
//   let screen = game.screen();      // what to show
//   screen = game.choose(optionId);  // what the player picked
//
// No rendering, input, or engine code lives here, so a Dream Engine scene, a
// terminal, and a headless bot can all drive the same run.

import type {
  Difficulty,
  GameState,
  Hud,
  Member,
  ResourceId,
  Screen,
  ScreenOption,
  StoreLine,
  StoreView,
} from "./types.ts";
import { RESOURCE_IDS } from "./types.ts";
import { Rng, hashSeed } from "./rng.ts";
import type { Env } from "./effects.ts";
import { addResource, applyEffects, changeNerve, fillText, heal } from "./effects.ts";
import {
  able,
  addBond,
  avgNerve,
  byId,
  cargoCap,
  cargoUsed,
  clamp,
  conditionsOf,
  firstName,
  hasRole,
  hasTrait,
  leader,
  living,
  memberView,
  pairKey,
} from "./party.ts";
import { DIFFICULTY, ITEMS, PACES, RATIONS, TUNING, zoneOf } from "./tuning.ts";
import { STORES } from "./world.ts";
import { EDGE_BY_ID, NODE_BY_ID } from "./routes.ts";
import {
  atEnd,
  beginBeat,
  buyMap,
  chooseRoute,
  ensureRoute,
  forageMult,
  forkView,
  initRoute,
  mapHud,
  mapOffersAt,
  regionOf,
  routeOptionText,
  routeRemaining,
  takeArrivals,
  travelHours as routeTravel,
  wearMult,
} from "./map.ts";
import { BACKGROUNDS, ROSTER } from "./content/roster.ts";
import type { MemberTemplate } from "./content/roster.ts";
import { finish } from "./ending.ts";
import { baseHazeMiles, catchupMiles, expectedHazeMiles, hoursToMiles, planTravel } from "./travel.ts";
import { processNight } from "./night.ts";
import { rollDay } from "./events.ts";
import { buildScene, doLook, hasPair, optionAvailable, resolveOption, requireScene, sceneOptions, sceneText, bindFor } from "./scenes.ts";
import { combatOptions, combatRound, combatSummary, enemyDef, startCombat } from "./combat.ts";

export interface NewGameOptions {
  seed?: number | string;
  leaderName?: string;
  background?: string;
  difficulty?: Difficulty;
  /** Four roster ids. Omit to choose them in-game from six offered. */
  companions?: string[];
}

const ZONE_INDEX = { far: 0, near: 1, close: 2, upon: 3 } as const;
const PARTY_PICKS = 4;

function makeMember(tpl: MemberTemplate, isLeader: boolean): Member {
  let maxHealth = tpl.maxHealth ?? 90;
  if (tpl.traits.includes("sickly") && !tpl.maxHealth) maxHealth -= 15;
  return {
    id: tpl.id,
    name: tpl.name,
    role: tpl.role,
    traits: tpl.traits.slice(),
    bio: tpl.bio,
    health: maxHealth,
    maxHealth,
    nerve: tpl.nerve ?? (tpl.traits.includes("haunted") ? 55 : 65),
    trust: isLeader ? 100 : 60,
    wounded: false,
    sick: false,
    dying: false,
    fog: 0,
    alive: true,
    isLeader,
  };
}

function emptyResources(): Record<ResourceId, number> {
  const res = {} as Record<ResourceId, number>;
  for (const id of RESOURCE_IDS) res[id] = ITEMS[id].start;
  return res;
}

export class Game {
  s: GameState;
  rng: Rng;

  constructor(state: GameState) {
    this.s = state;
    ensureRoute(state);
    this.rng = new Rng(state);
  }

  // -------------------------------------------------------------------------
  // Creation & persistence
  // -------------------------------------------------------------------------

  static create(opts: NewGameOptions = {}): Game {
    const seed = typeof opts.seed === "string" ? hashSeed(opts.seed) : (opts.seed ?? Math.floor(Math.random() * 2 ** 31));
    const difficulty = opts.difficulty ?? "normal";
    const diff = DIFFICULTY[difficulty];
    const background = BACKGROUNDS.find((b) => b.id === opts.background) ?? BACKGROUNDS[0];
    const leaderName = opts.leaderName?.trim() || "The Wagon-Master";
    const state: GameState = {
      version: 1,
      seed,
      rng: seed | 0,
      difficulty,
      leaderName,
      day: 0,
      miles: 0,
      gap: TUNING.startGap + diff.gap,
      scrip: TUNING.startScrip + diff.scrip,
      res: emptyResources(),
      train: { wagons: TUNING.startWagons, condition: 100 },
      party: [],
      bonds: {},
      pace: "steady",
      rations: "meager",
      today: { hoursUsed: 0, startMiles: 0, hazeMiles: 0, surge: null, forecast: false },
      carryHours: 0,
      flags: {},
      recent: [],
      used: [],
      landmarks: [],
      recruitsUsed: [],
      stock: {},
      queue: [],
      pending: { kind: "setup", offered: [], picked: [] },
      journal: [],
      stats: {
        strangersHelped: 0,
        strangersRefused: 0,
        trapsSprung: 0,
        trapsAvoided: 0,
        genuineTurnedAway: 0,
        fights: 0,
        hoursLost: 0,
        deaths: 0,
        departures: 0,
        starvedDays: 0,
        minGap: TUNING.startGap + diff.gap,
        daysNoRations: 0,
      },
      ending: null,
      route: initRoute(),
    };
    const game = new Game(state);
    const leaderTpl: MemberTemplate = {
      id: "leader",
      name: leaderName,
      role: background.role,
      traits: background.traits,
      bio: background.blurb,
    };
    state.party.push(makeMember(leaderTpl, true));
    if (opts.companions && opts.companions.length) {
      game.finalizeParty(opts.companions);
    } else {
      const offered = game.rng.shuffle(ROSTER).slice(0, 6).map((r) => r.id);
      state.pending = { kind: "setup", offered, picked: [] };
    }
    return game;
  }

  static restore(json: string): Game {
    return new Game(JSON.parse(json) as GameState);
  }

  serialize(): string {
    return JSON.stringify(this.s);
  }

  get over(): boolean {
    return this.s.ending !== null;
  }

  private env(bind: Env["bind"] = {}): Env {
    return { s: this.s, rng: this.rng, bind };
  }

  /** An environment that cannot disturb the run's random stream (for building views). */
  private viewEnv(bind: Env["bind"] = {}): Env {
    return { s: this.s, rng: new Rng({ rng: this.s.rng }), bind };
  }

  private finalizeParty(ids: string[]): void {
    const s = this.s;
    const chosen = ids.map((id) => {
      const tpl = ROSTER.find((r) => r.id === id);
      if (!tpl) throw new Error(`Unknown companion: ${id}`);
      return tpl;
    });
    for (const tpl of chosen) s.party.push(makeMember(tpl, false));
    // Ties from shared history, plus a little run-to-run variance.
    for (let i = 0; i < s.party.length; i++) {
      for (let j = i + 1; j < s.party.length; j++) {
        const a = s.party[i];
        const b = s.party[j];
        let v = this.rng.int(-8, 8);
        const tplA = chosen.find((c) => c.id === a.id);
        const tplB = chosen.find((c) => c.id === b.id);
        v += tplA?.ties?.[b.id] ?? 0;
        v += tplB?.ties?.[a.id] ?? 0;
        s.bonds[pairKey(a.id, b.id)] = clamp(v, -100, 100);
      }
    }
    // The wagon-master starts with a little goodwill toward the kind.
    for (const m of s.party) if (!m.isLeader && hasTrait(m, "kind")) addBond(s, m.id, leader(s).id, 5);
    s.pending = { kind: "store", storeId: "cinder-ford" };
    this.initStock("cinder-ford");
  }

  private initStock(storeId: string): void {
    if (!this.s.stock[storeId]) this.s.stock[storeId] = { ...STORES[storeId].stock };
  }

  // -------------------------------------------------------------------------
  // Views
  // -------------------------------------------------------------------------

  hud(): Hud {
    const s = this.s;
    const region = regionOf(s);
    const zone = zoneOf(s.gap);
    return {
      day: s.day,
      miles: Math.round(s.miles),
      milesToGo: Math.max(0, Math.round(routeRemaining(s))),
      gap: Math.round(s.gap * 10) / 10,
      zone,
      hazeToday: Math.round(expectedHazeMiles(s)),
      region: region.name,
      regionId: region.id,
      sky: region.sky[ZONE_INDEX[zone]],
      scrip: s.scrip,
      res: { ...s.res },
      cargoUsed: Math.round(cargoUsed(s.res) * 10) / 10,
      cargoCap: cargoCap(s),
      wagons: s.train.wagons,
      condition: Math.round(s.train.condition),
      pace: s.pace,
      rations: s.rations,
      party: living(s).map(memberView),
      map: mapHud(s),
    };
  }

  private storeView(storeId: string): StoreView {
    const def = STORES[storeId];
    this.initStock(storeId);
    const stock = this.s.stock[storeId];
    const lines: StoreLine[] = RESOURCE_IDS.map((id) => {
      const price = Math.max(1, Math.round(ITEMS[id].price * def.markup));
      return {
        id,
        name: ITEMS[id].name,
        blurb: ITEMS[id].blurb,
        price,
        sellPrice: Math.max(0, Math.floor(price * def.buyback)),
        owned: this.s.res[id],
        weight: ITEMS[id].weight,
        stock: stock[id] ?? 0,
      };
    });
    const maps = mapOffersAt(this.s, storeId);
    return maps.length ? { name: def.name, keeper: def.keeper, lines, maps } : { name: def.name, keeper: def.keeper, lines };
  }

  screen(): Screen {
    const s = this.s;
    const p = s.pending;
    const hud = this.hud();
    const base = { hud, observations: [] as string[], notes: [] as string[] };
    switch (p.kind) {
      case "setup": {
        const options: ScreenOption[] = p.offered.map((id) => {
          const tpl = ROSTER.find((r) => r.id === id) as MemberTemplate;
          const picked = p.picked.includes(id);
          return {
            id: `pick:${id}`,
            label: `${picked ? "[x]" : "[ ]"} ${tpl.name} — ${tpl.role}; ${tpl.traits.join(", ")}`,
            hint: tpl.bio,
            disabled: !picked && p.picked.length >= PARTY_PICKS ? "Your party is full." : undefined,
          };
        });
        options.push({
          id: "confirm",
          label: "Set out with this party",
          disabled: p.picked.length === PARTY_PICKS ? undefined : `Choose ${PARTY_PICKS} companions.`,
        });
        return {
          kind: "setup",
          title: "The Last Muster at Cinder Ford",
          lines: [
            "Six people are willing to walk with you. There is only room for four.",
            "Nobody here is who they were before the sky went red. Choose carefully. You will have to live with each other.",
          ],
          options,
          ...base,
        };
      }
      case "store": {
        const def = STORES[p.storeId];
        const opts: ScreenOption[] = [];
        const starving = p.storeId === "cinder-ford" && s.res.rations < living(s).length;
        const inspected = (s.flags[`inspected:${p.storeId}`] ?? 0) > 0;
        if (def.rigged && !inspected) {
          opts.push({
            id: "inspect",
            label: "Check the scales",
            hint: "Something about how he weighs bothers you. Takes an hour, and he will not enjoy it.",
            hours: 1,
          });
        }
        for (const m of mapOffersAt(s, p.storeId)) {
          opts.push({
            id: `buymap:${m.id}`,
            label: `Buy ${m.name} (${m.price} scrip)`,
            hint: [m.pitch, ...m.clues].join(" "),
            disabled: m.owned ? "You already carry it." : s.scrip < m.price ? "You cannot afford it." : undefined,
          });
        }
        opts.push({
          id: "depart",
          label: p.storeId === "cinder-ford" ? "Hitch the oxen and leave Cinder Ford" : "Leave the store",
          disabled: starving ? "You cannot set out with nothing to eat." : undefined,
        });
        const lines = [
          `${def.keeper} leans on the counter and does not pretend to be sorry about the prices.`,
          p.storeId === "cinder-ford"
            ? "Everything you carry will have to last 840 miles. It will not. Buy what you cannot live without and hope the road provides the rest."
            : "Anything you sell back is worth a fraction of what you paid. Anything you buy is worth more than the shelf says.",
          `Your wagons hold ${cargoCap(s)} units. You have ${s.scrip} scrip.`,
        ];
        if (def.tell && !inspected) lines.push(def.tell);
        return {
          kind: "store",
          title: def.name,
          lines,
          options: opts,
          store: this.storeView(p.storeId),
          hud,
          observations: [],
          notes: p.notes ?? [],
        };
      }
      case "arrival": {
        const lm = NODE_BY_ID.get(p.id)!;
        const opts: ScreenOption[] = [];
        if (lm.storeId) {
          opts.push({
            id: "shop",
            label: `Resupply at ${STORES[lm.storeId].name}`,
            hint: "You will take stock of what you need. It takes hours.",
            hours: STORES[lm.storeId].stopHours ?? TUNING.storeHours,
          });
          opts.push({ id: "move", label: "Press on without stopping", hint: "The Haze does not shop." });
        } else {
          opts.push({ id: "move", label: "Continue" });
        }
        return {
          kind: "arrival",
          title: lm.name,
          lines: [lm.blurb, regionOf(s).sky[ZONE_INDEX[zoneOf(s.gap)]]],
          options: opts,
          ...base,
        };
      }
      case "fork": {
        const node = NODE_BY_ID.get(p.node)!;
        const view = forkView(s, p.node);
        const held = s.route.maps.length > 0;
        return {
          kind: "fork",
          title: node.name,
          lines: [
            node.blurb,
            held ? "You unroll your map against a wheel and look for where it says the roads go." : "Your rough map shows the roads and their lengths, and nothing else.",
          ],
          options: view.routes.map((v) => {
            const { label, hint } = routeOptionText(v);
            return { id: v.id, label, hint };
          }),
          hud,
          observations: view.routes.filter((v) => v.sign).map((v) => v.sign as string),
          notes: [],
          fork: view,
        };
      }
      case "plan":
        return this.planScreen(base);
      case "scene": {
        const env = this.viewEnv(bindFor(p.scene));
        const def = requireScene(p.scene.id);
        const text = sceneText(env, p.scene);
        return {
          kind: "scene",
          title: fillText(env, def.title),
          lines: text.lines,
          options: sceneOptions(env, p.scene),
          hud,
          observations: text.observations,
          notes: p.scene.note ? [p.scene.note] : [],
        };
      }
      case "combat": {
        const env = this.viewEnv();
        const def = enemyDef(p.combat.enemy);
        return {
          kind: "combat",
          title: `Combat: ${def.name}`,
          lines: [def.intro, combatSummary(p.combat)],
          options: combatOptions(env, p.combat),
          hud,
          observations: p.combat.log.slice(),
          notes: [],
        };
      }
      case "result":
        return {
          kind: "result",
          title: p.title,
          lines: p.lines,
          options: [{ id: "continue", label: "Continue" }],
          hud,
          observations: [],
          notes: p.notes,
        };
      case "ending": {
        const e = s.ending!;
        return {
          kind: "ending",
          title: e.headline,
          lines: e.lines,
          options: [],
          ending: e,
          ...base,
        };
      }
    }
  }

  private planScreen(base: { hud: Hud; observations: string[]; notes: string[] }): Screen {
    const s = this.s;
    const p = s.pending as { kind: "plan"; notes?: string[] };
    const region = regionOf(s);
    const zone = zoneOf(s.gap);
    const mouths = living(s).length;
    const ration = RATIONS[s.rations];
    const perDay = Math.max(1, Math.ceil(mouths * ration.perHead));
    const daysFood = s.res.rations / perDay;
    const lines: string[] = [
      `${region.blurb}`,
      region.sky[ZONE_INDEX[zone]],
      `The Haze is ${Math.round(s.gap)} miles behind you and moves about ${Math.round(expectedHazeMiles(s))} miles a day here.`,
      `Food for about ${daysFood.toFixed(1)} days at the current ration.`,
    ];
    if (s.today.forecast) {
      const haunted = able(s).find((m) => hasTrait(m, "haunted") && m.nerve > 20);
      if (haunted) {
        lines.push(
          s.today.surge === "surge"
            ? `${firstName(haunted)} will not meet your eyes. "It's going to lunge today. I can hear it."`
            : `${firstName(haunted)} tilts their head. "It's slow today. Lazy. Don't get used to it."`,
        );
      }
    }
    const opts: ScreenOption[] = [];
    const pace = PACES[s.pace];
    opts.push({
      id: "go",
      label: "Break camp and move on",
      hint: `Pace: ${pace.name} (${pace.hours}h). Rations: ${ration.name}.`,
    });
    for (const id of ["easy", "steady", "hard", "halt"] as const) {
      if (id === s.pace) continue;
      opts.push({ id: `pace:${id}`, label: `Set pace: ${PACES[id].name}`, hint: PACES[id].blurb });
    }
    for (const id of ["full", "meager", "bare"] as const) {
      if (id === s.rations) continue;
      opts.push({ id: `rations:${id}`, label: `Set rations: ${RATIONS[id].name}`, hint: RATIONS[id].blurb });
    }
    const repairHours = hasRole(s, "mechanic") ? 1 : 2;
    opts.push({
      id: "repair",
      label: "Repair the wagons",
      hint: `Costs 1 spare part. ${hasRole(s, "mechanic") ? "Your mechanic works fast." : ""}`.trim(),
      hours: repairHours,
      disabled: s.res.spares < 1 ? "No spare parts." : s.train.condition >= 95 ? "The wagons are sound." : undefined,
    });
    const forageHours = hasRole(s, "hunter") || hasRole(s, "scout") ? 2 : 3;
    opts.push({
      id: "forage",
      label: "Forage along the road",
      hint: `Trade hours for food. ${hasRole(s, "hunter") ? "Your hunter improves the odds. " : ""}The land gives less each time.`.trim(),
      hours: forageHours,
    });
    const tendHours = hasRole(s, "medic") ? 0.5 : 1;
    for (const m of living(s)) {
      if (m.dying) {
        opts.push({
          id: `tend:${m.id}:dying`,
          label: `Treat ${firstName(m)}'s wounds (dying)`,
          hint: "Costs 2 physic. They will not last another night without it.",
          hours: tendHours,
          disabled: s.res.medicine < 2 ? "You need 2 physic." : undefined,
        });
      }
      if (m.wounded && !m.dying) {
        opts.push({
          id: `tend:${m.id}:wound`,
          label: `Dress ${firstName(m)}'s wound`,
          hint: "Costs 1 physic.",
          hours: tendHours,
          disabled: s.res.medicine < 1 ? "No physic." : undefined,
        });
      }
      if (m.sick) {
        opts.push({
          id: `tend:${m.id}:sick`,
          label: `Treat ${firstName(m)}'s fever`,
          hint: "Costs 1 physic.",
          hours: tendHours,
          disabled: s.res.medicine < 1 ? "No physic." : undefined,
        });
      }
      if (m.fog >= 2) {
        opts.push({
          id: `tend:${m.id}:fog`,
          label: `Treat ${firstName(m)}'s fogsickness`,
          hint: "Costs 2 physic. Eases one stage, never below stage I. The Haze does not let go.",
          hours: tendHours,
          disabled: s.res.medicine < 2 ? "You need 2 physic." : undefined,
        });
      }
    }
    opts.push({
      id: "rally",
      label: "Gather everyone round the torches",
      hint: "Costs 1 torch. Steadies nerves and mends quarrels a little.",
      hours: 1,
      disabled: s.res.torches < 1 ? "No torches." : undefined,
    });
    return { kind: "plan", title: `Day ${s.day}: ${region.name}`, lines, options: opts, ...base, notes: p.notes ?? [] };
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  choose(id: string): Screen {
    const s = this.s;
    if (s.ending) throw new Error("The run is over.");
    const p = s.pending;

    if (p.kind === "store" && (id.startsWith("buy:") || id.startsWith("sell:"))) {
      const [verb, item, qty] = id.split(":");
      const n = Number(qty);
      if (!Number.isInteger(n) || n <= 0) throw new Error(`Bad quantity in "${id}".`);
      this.trade(item as ResourceId, (verb === "buy" ? 1 : -1) * n);
      return this.screen();
    }

    const options = this.screen().options;
    const opt = options.find((o) => o.id === id);
    if (!opt) throw new Error(`Unknown option "${id}" for ${p.kind}.`);
    if (opt.disabled) throw new Error(`Option "${id}" is unavailable: ${opt.disabled}`);

    switch (p.kind) {
      case "setup": {
        if (id === "confirm") {
          this.finalizeParty(p.picked);
        } else {
          const pid = id.slice("pick:".length);
          const i = p.picked.indexOf(pid);
          if (i >= 0) p.picked.splice(i, 1);
          else p.picked.push(pid);
        }
        break;
      }
      case "store": {
        if (id.startsWith("buymap:")) {
          p.notes = [buyMap(s, id.slice("buymap:".length), p.storeId)];
          break;
        }
        if (id === "inspect") {
          s.flags[`inspected:${p.storeId}`] = 1;
          s.carryHours = Math.min(TUNING.maxCarryHours, s.carryHours + 1);
          s.stats.hoursLost += 1;
          p.notes = [
            "Time: 1h",
            "Under the felt on the pan there is a lead slug the size of a thumb. Halloran shrugs. \"Calibration.\" He takes it out, and you watch every sack after that.",
          ];
          break;
        }
        const then = p.then;
        if (p.storeId === "cinder-ford") {
          s.day = 0;
          this.startNextDay();
        } else {
          if (then) s.queue.unshift({ t: "scene", id: then });
          this.advance();
        }
        break;
      }
      case "arrival": {
        const lm = NODE_BY_ID.get(p.id)!;
        if (id === "shop" && lm.storeId) {
          const stop = STORES[lm.storeId].stopHours ?? TUNING.storeHours;
          s.carryHours = Math.min(TUNING.maxCarryHours, s.carryHours + stop);
          s.stats.hoursLost += stop;
          this.initStock(lm.storeId);
          s.pending = { kind: "store", storeId: lm.storeId, then: lm.scene };
        } else {
          if (lm.scene) s.queue.unshift({ t: "scene", id: lm.scene });
          this.advance();
        }
        break;
      }
      case "fork":
        this.forkAction(id);
        break;
      case "plan":
        this.planAction(id);
        break;
      case "scene":
        this.sceneAction(id);
        break;
      case "combat":
        this.combatAction(id);
        break;
      case "result":
        this.advance();
        break;
      case "ending":
        break;
    }
    return this.screen();
  }

  // -------------------------------------------------------------------------
  // Store
  // -------------------------------------------------------------------------

  /** Buy (qty > 0) or sell (qty < 0). Returns a message describing what happened. */
  trade(item: ResourceId, qty: number): string {
    const s = this.s;
    if (s.pending.kind !== "store") throw new Error("There is no store here.");
    if (!Number.isInteger(qty) || qty === 0) throw new Error("Choose a whole number of items to buy or sell.");
    const storeId = s.pending.storeId;
    const def = STORES[storeId];
    const line = this.storeView(storeId).lines.find((l) => l.id === item);
    if (!line) throw new Error(`Unknown item: ${item}`);
    const stock = s.stock[storeId];
    if (qty > 0) {
      const free = cargoCap(s) - cargoUsed(s.res);
      const byRoom = Math.floor(free / line.weight + 1e-9);
      const n = Math.min(qty, byRoom, stock[item] ?? 0, Math.floor(s.scrip / line.price));
      if (n <= 0) {
        if ((stock[item] ?? 0) <= 0) return `${def.keeper} is out of ${line.name.toLowerCase()}.`;
        if (byRoom <= 0) return "There is no room left in the wagons.";
        return "You cannot afford that.";
      }
      const crooked = def.rigged && !(s.flags[`inspected:${storeId}`] ?? 0) && (item === "rations" || item === "medicine");
      s.scrip -= n * line.price;
      s.res[item] += crooked ? Math.round(n * (def.rigged as number)) : n;
      stock[item] = (stock[item] ?? 0) - n;
      return `Bought ${n} ${line.name.toLowerCase()} for ${n * line.price} scrip.`;
    }
    const n = Math.min(-qty, s.res[item]);
    if (n <= 0) return `You have no ${line.name.toLowerCase()} to sell.`;
    s.scrip += n * line.sellPrice;
    s.res[item] -= n;
    stock[item] = (stock[item] ?? 0) + n;
    return `Sold ${n} ${line.name.toLowerCase()} for ${n * line.sellPrice} scrip.`;
  }

  // -------------------------------------------------------------------------
  // Day plan
  // -------------------------------------------------------------------------

  private planAction(id: string): void {
    const s = this.s;
    const env = this.env();
    const notes: string[] = [];
    if (id === "go") {
      this.beginDay();
      return;
    }
    if (id.startsWith("pace:")) {
      s.pace = id.slice(5) as GameState["pace"];
      notes.push(`Pace set to ${PACES[s.pace].name}.`);
    } else if (id.startsWith("rations:")) {
      s.rations = id.slice(8) as GameState["rations"];
      notes.push(`Rations set to ${RATIONS[s.rations].name}.`);
    } else if (id === "repair") {
      const mech = hasRole(s, "mechanic");
      const h = mech ? 1 : 2;
      s.res.spares -= 1;
      s.today.hoursUsed += h;
      s.stats.hoursLost += h;
      applyEffects(env, [{ t: "repair", d: mech ? 35 : 25 }], notes);
      notes.unshift("-1 spare parts", `Time: ${h}h`);
    } else if (id === "forage") {
      this.forage(notes);
      return;
    } else if (id === "rally") {
      s.res.torches -= 1;
      s.today.hoursUsed += 1;
      s.stats.hoursLost += 1;
      for (const m of living(s)) changeNerve(m, hasTrait(m, "pious") ? 6 : 4);
      applyEffects(env, [{ t: "bondAll", d: 1 }], notes);
      notes.unshift("-1 torches", "Time: 1h", "Everyone: +4 nerve");
    } else if (id.startsWith("tend:")) {
      const [, mid, cond] = id.split(":");
      const m = byId(s, mid)!;
      const medic = hasRole(s, "medic");
      const h = medic ? 0.5 : 1;
      const dose = cond === "dying" || cond === "fog" ? 2 : 1;
      const saved = medic && this.rng.chance(0.3);
      const spent = saved ? Math.max(0, dose - 1) : dose;
      s.res.medicine -= spent;
      s.today.hoursUsed += h;
      s.stats.hoursLost += h;
      notes.push(`-${spent} physic${saved ? " (your medic stretched it)" : ""}`, `Time: ${h}h`);
      if (cond === "dying") {
        m.dying = false;
        m.health = Math.max(m.health, 25);
        notes.push(`${m.name} will live, if the road allows it.`);
      } else if (cond === "wound") {
        m.wounded = false;
        heal(m, 8);
        notes.push(`${firstName(m)}'s wound is clean and bound.`);
      } else if (cond === "sick") {
        m.sick = false;
        notes.push(`${firstName(m)}'s fever breaks.`);
      } else if (cond === "fog") {
        m.fog = Math.max(1, m.fog - 1);
        notes.push(`${firstName(m)}'s eyes look a little more like their own.`);
      }
    }
    s.pending = { kind: "plan", notes };
  }

  private forage(notes: string[]): void {
    const s = this.s;
    const region = regionOf(s);
    const hunter = hasRole(s, "hunter");
    const h = hunter || hasRole(s, "scout") ? 2 : 3;
    s.today.hoursUsed += h;
    s.stats.hoursLost += h;
    notes.push(`Time: ${h}h`);
    const key = `forage:${region.id}`;
    const times = s.flags[key] ?? 0;
    s.flags[key] = times + 1;
    const yieldMult = region.forage * forageMult(s) * Math.max(0.3, 1 - 0.18 * times) * (hunter ? 1.3 : 1);
    const roll = this.rng.next();
    if (roll < 0.1) {
      const enemy = region.id === "pines" || region.id === "fen" ? "haze-hounds" : "hollowed-single";
      notes.push("Something else was foraging out there, too.");
      s.queue = [{ t: "combat", enemy }, { t: "plan" }];
      s.pending = { kind: "plan", notes };
      this.advance();
      return;
    }
    let found = 0;
    if (roll < 0.28) {
      notes.push("Hours of searching turn up nothing but dust and a bad feeling.");
    } else if (roll < 0.75) {
      found = Math.round(this.rng.int(4, 8) * yieldMult);
      notes.push("Roots, tinned goods from a collapsed cellar, a few eggs. It is something.");
    } else {
      found = Math.round(this.rng.int(9, 15) * yieldMult);
      notes.push("A stroke of luck: a hidden larder, or a snared animal, or both.");
    }
    if (found > 0) addResource(this.env(), "rations", found, notes);
    s.pending = { kind: "plan", notes };
  }

  private startNextDay(): void {
    const s = this.s;
    s.day++;
    // Time spent since the last dawn's travel was resolved (night crises, landmark business) comes out of today.
    s.carryHours = Math.min(TUNING.maxCarryHours, s.carryHours + s.today.hoursUsed);
    const noise = 1 + this.rng.float(-TUNING.hazeNoise, TUNING.hazeNoise);
    let haze = baseHazeMiles(s) * noise;
    // The Haze is patient and relentless: pull far ahead and it quickens.
    haze += catchupMiles(s);
    let surge: "surge" | "lull" | null = null;
    const roll = this.rng.next();
    if (roll < TUNING.surgeChance) {
      surge = "surge";
      haze += TUNING.surgeMiles * DIFFICULTY[s.difficulty].haze;
    } else if (roll < TUNING.surgeChance + TUNING.lullChance) {
      surge = "lull";
      haze = Math.max(2, haze - TUNING.lullMiles);
    }
    const haunted = able(s).some((m) => hasTrait(m, "haunted") && m.nerve > 20);
    s.today = { hoursUsed: 0, startMiles: s.miles, hazeMiles: haze, surge, forecast: haunted && surge !== null };
    s.pending = { kind: "plan" };
  }

  private beginDay(): void {
    const s = this.s;
    const env = this.env();
    s.queue = rollDay(env);
    s.queue.push({ t: "travel" });
    this.advance();
  }

  // -------------------------------------------------------------------------
  // Flow control
  // -------------------------------------------------------------------------

  private advance(): void {
    const s = this.s;
    while (!s.ending) {
      const item = s.queue.shift();
      if (!item) {
        this.startNextDay();
        return;
      }
      switch (item.t) {
        case "scene": {
          const def = requireScene(item.id);
          const env = this.env();
          // The world moved on since this was queued: the person it was about may be gone.
          if ([item.actor, item.a, item.b].some((id) => id && !byId(s, id)?.alive)) continue;
          if (def.pairWeight && !(item.a && item.b) && !hasPair(env, def)) continue;
          if (def.others && living(s).filter((m) => !m.isLeader).length < 2) continue;
          const scene = buildScene(env, item);
          s.recent.push(def.id);
          if (s.recent.length > 12) s.recent.shift();
          if (def.once) s.used.push(def.id);
          s.pending = { kind: "scene", scene };
          return;
        }
        case "combat": {
          const env = this.env();
          const { combat, notes } = startCombat(env, item.enemy);
          combat.log = notes;
          s.pending = { kind: "combat", combat };
          return;
        }
        case "arrival":
          if (!NODE_BY_ID.has(item.id)) continue;
          s.pending = { kind: "arrival", id: item.id };
          return;
        case "fork":
          s.pending = { kind: "fork", node: item.node };
          return;
        case "beat":
          s.queue.unshift({ t: "scene", id: beginBeat(s, item.edge, item.i, item.prep, item.lie) });
          continue;
        case "plan":
          s.pending = { kind: "plan" };
          return;
        case "travel":
          this.resolveDay();
          return;
      }
    }
  }

  private sceneAction(id: string): void {
    const s = this.s;
    const p = s.pending;
    if (p.kind !== "scene") return;
    const env = this.env(bindFor(p.scene));
    const block = optionAvailable(env, p.scene, id);
    if (block) throw new Error(block);
    if (id === "look") {
      doLook(env, p.scene);
      return;
    }
    const result = resolveOption(env, p.scene, id);
    if (s.ending) return;
    s.pending = { kind: "result", title: result.title, lines: result.lines, notes: result.notes };
  }

  private applyCaches(edges: string[], notes: string[]): void {
    for (const edge of edges) {
      const e = EDGE_BY_ID.get(edge);
      if (!e?.cache) continue;
      notes.push("Cairns along the road hold offerings of food.");
      addResource(this.env(), "rations", this.rng.amount(e.cache), notes);
    }
  }

  private forkAction(id: string): void {
    const s = this.s;
    const node = s.route.node;
    const pick = chooseRoute(s, id);
    const notes = pick.notes.slice();
    if (pick.phantom) {
      s.carryHours = Math.min(TUNING.maxCarryHours, s.carryHours + 4);
      s.stats.hoursLost += 4;
      notes.unshift("Time: 4h");
      s.queue.unshift({ t: "fork", node });
    } else {
      const arrived = takeArrivals(s);
      s.queue.unshift(...arrived.items);
      this.applyCaches(arrived.caches, notes);
    }
    s.pending = { kind: "result", title: pick.title, lines: pick.lines, notes };
  }

  private combatAction(id: string): void {
    const s = this.s;
    const p = s.pending;
    if (p.kind !== "combat") return;
    const env = this.env();
    const step = combatRound(env, p.combat, id);
    if (s.ending) return;
    const def = enemyDef(p.combat.enemy);
    if (step.done) {
      s.pending = { kind: "result", title: `Combat: ${def.name}`, lines: step.lines, notes: step.notes };
    } else {
      p.combat.log = [...step.lines, ...step.notes];
    }
  }

  // -------------------------------------------------------------------------
  // The day resolves
  // -------------------------------------------------------------------------

  private resolveDay(): void {
    const s = this.s;
    const env = this.env();
    const pace = PACES[s.pace];
    const region = regionOf(s);
    const edgeWear = wearMult(s);
    const lines: string[] = [];
    const notes: string[] = [];

    const spent = s.today.hoursUsed + s.carryHours;
    const plan = planTravel(s);
    const { travelHours, restQuality } = plan;
    s.carryHours = Math.min(TUNING.maxCarryHours, plan.carry);
    // Today's business is settled. Anything that happens after nightfall (crises, landmarks) is tomorrow's cost.
    s.today.hoursUsed = 0;

    const gapBefore = s.gap;
    const distance = routeTravel(s, travelHours).distance;
    const hazeMove = s.today.hazeMiles;
    s.gap += distance - hazeMove;

    if (s.pace === "halt") {
      lines.push("The wagons do not move. The sky does.");
    } else if (travelHours <= 0) {
      lines.push("You spend the whole day on other business. The wagons never leave camp.");
    } else {
      lines.push(`You cover ${Math.round(distance)} miles in ${Math.round(travelHours * 10) / 10} hours.`);
    }
    if (spent > 0 && s.pace !== "halt") {
      const lost = hoursToMiles(s, Math.min(spent, pace.hours));
      if (lost >= 1) lines.push(`Stops and delays cost you about ${Math.round(lost)} miles.`);
    }
    if (s.today.surge === "surge") lines.push("The Haze lunged today. You felt it come through the soles of your boots.");
    else if (s.today.surge === "lull") lines.push("The Haze slowed today, as if resting. You are not sure that is better.");
    lines.push(
      `The Haze advances ${Math.round(hazeMove)} miles. The gap is ${Math.round(gapBefore)} → ${Math.round(Math.max(0, s.gap))} miles.`,
    );

    if (travelHours > 0) {
      const rough = region.id === "spine" ? 1.6 : region.id === "fen" ? 1.2 : 1;
      const wear = pace.wear * this.rng.float(0.6, 1.8) * rough * edgeWear;
      s.train.condition = Math.max(0, s.train.condition - wear);
      if (s.train.condition < 40) lines.push("The wagons groan and shudder. Something is going to give.");
    }

    s.stats.minGap = Math.min(s.stats.minGap, s.gap);

    if (s.gap <= 0 && !atEnd(s)) {
      finish(s, "consumed", "The Great Haze takes you.", [
        `On day ${s.day}, the fog rolls over the wagons like a tide over sand.`,
        "It is warm. It is very quiet. You can hear the others breathing, and then you can't.",
        "Later, if there is a later, someone will find the wagons standing in the road with the oxen still in their traces, patient, facing west.",
      ]);
      return;
    }

    const night = processNight(env, restQuality);
    lines.push(...night.lines);
    notes.push(...night.notes);
    if (s.ending) return;
    if (living(s).length === 0) {
      finish(s, "lost", "No one is left.", ["The wagons roll on a little way by themselves, and then stop."]);
      return;
    }

    // Night crises come before the dawn's arrivals.
    for (const c of night.crises) s.queue.push(c);
    const arrived = takeArrivals(s);
    s.queue.push(...arrived.items);
    lines.push(...arrived.lines);
    this.applyCaches(arrived.caches, notes);
    s.journal.push(`Day ${s.day}: ${Math.round(s.miles)} mi, gap ${Math.round(s.gap)}`);
    s.pending = { kind: "result", title: `Nightfall, day ${s.day}`, lines, notes };
  }

  // -------------------------------------------------------------------------
  // Conveniences
  // -------------------------------------------------------------------------

  /** Escape hatch for tests and tools: run a Cond-free text fill against the current bindings. */
  fill(text: string): string {
    return fillText(this.viewEnv(), text);
  }

  conditions(memberId: string): string[] {
    const m = byId(this.s, memberId);
    return m ? conditionsOf(m) : [];
  }

  averageNerve(): number {
    return avgNerve(this.s);
  }
}

