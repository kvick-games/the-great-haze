// Boot: the 3D world, the HTML layer, sound, and the director that joins them.

import * as THREE from "three";
import { World } from "./world/world.ts";
import { UI } from "./ui/ui.ts";
import { Director } from "./director.ts";
import { Audio } from "./audio.ts";
import type { Figure } from "./world/actors.ts";
import { ROSTER } from "../../src/game/content/roster.ts";

declare global {
  interface Window {
    __haze?: { booted: boolean; director: Director; world: World };
  }
}

const QUALITY_KEY = "great-haze:quality";

function storedQuality(): number {
  try {
    const v = localStorage.getItem(QUALITY_KEY);
    if (v === "low") return 0;
    if (v === "high") return 1;
  } catch {
    /* ignore */
  }
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  return small || coarse ? 0 : 1;
}

function boot(): void {
  const canvas = document.getElementById("scene") as HTMLCanvasElement;
  const root = document.getElementById("ui") as HTMLElement;
  let world: World;
  try {
    world = new World(canvas, storedQuality());
  } catch (e) {
    root.innerHTML = `<div class="fatal"><h2>This browser could not start WebGL.</h2><p>The Great Haze needs WebGL 2. Try a current version of Chrome, Edge, Firefox, or Safari with hardware acceleration turned on.</p></div>`;
    console.error(e);
    return;
  }
  const audio = new Audio();
  let director: Director;
  const ui = new UI(root, {
    choose: (id) => {
      audio.wake();
      void director.act(id);
    },
    trade: (item, qty) => void director.trade(item, qty),
    start: (opts) => {
      audio.wake();
      ui.setSound(audio.on);
      ui.hideTitle();
      void director.newGame(opts);
    },
    resume: () => {
      const saved = Director.saved();
      audio.wake();
      ui.setSound(audio.on);
      if (!saved) {
        // Finished or abandoned in another tab since the title appeared.
        ui.showTitle(null);
        ui.toast("That journey is already over.");
        return;
      }
      ui.hideTitle();
      try {
        director.resume(saved.raw);
      } catch (e) {
        // A save from an older build can name content that no longer exists.
        console.error(e);
        Director.clearSave();
        director.game = null;
        director.titleScene();
        ui.showTitle(null);
        ui.toast("That save could not be loaded.");
      }
    },
    abandon: () => {
      // Never mid-cinematic: the director is still acting on the current run.
      if (director.busy) return;
      Director.clearSave();
      director.game = null;
      director.titleScene();
      ui.showTitle(null);
    },
    skip: () => director.skip(),
    focusMember: (id) => director.focusMember(id),
    hoverMember: (id) => director.highlight(id),
    toggleSound: () => audio.toggle(),
    toggleQuality: () => {
      const q = world.quality > 0.5 ? 0 : 1;
      world.setQuality(q);
      try {
        localStorage.setItem(QUALITY_KEY, q ? "high" : "low");
      } catch {
        /* ignore */
      }
      return q ? "full effects" : "light";
    },
  });
  director = new Director(world, ui, audio);
  director.titleScene();
  const saved = Director.saved();
  ui.showTitle(saved ? { day: saved.day, miles: saved.miles } : null);

  // Pointer: drag to look around, hover people for names, click to focus or pick.
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down: { x: number; y: number; moved: boolean } | null = null;
  const pickFigure = (ev: PointerEvent): { id: string; fig: Figure; candidate: boolean } | null => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, world.rig.camera);
    let best: { id: string; fig: Figure; candidate: boolean } | null = null;
    let bestD = Infinity;
    for (const f of director.figures()) {
      if (!f.fig.root.visible) continue;
      const hits = ray.intersectObject(f.fig.body, true);
      if (hits.length && hits[0].distance < bestD) {
        bestD = hits[0].distance;
        best = f;
      }
    }
    return best;
  };
  canvas.addEventListener("pointerdown", (ev) => {
    down = { x: ev.clientX, y: ev.clientY, moved: false };
    canvas.setPointerCapture(ev.pointerId);
  });
  canvas.addEventListener("pointermove", (ev) => {
    if (down) {
      const dx = ev.clientX - down.x;
      const dy = ev.clientY - down.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) down.moved = true;
      if (down.moved) {
        world.rig.drag(ev.movementX, ev.movementY);
        ui.tip(null);
      }
      return;
    }
    if (ev.pointerType !== "mouse") return;
    const hit = pickFigure(ev);
    if (hit && director.game) {
      const m = director.game.s.party.find((p) => p.id === hit.id);
      const tpl = hit.candidate ? ROSTER.find((r) => r.id === hit.id) : undefined;
      const label = m ? `${m.name} · ${m.role}` : tpl ? `${tpl.name} · ${tpl.role} · click to choose` : "";
      ui.tip(label || null, ev.clientX, ev.clientY);
      canvas.style.cursor = "pointer";
    } else {
      ui.tip(null);
      canvas.style.cursor = "";
    }
  });
  canvas.addEventListener("pointerup", (ev) => {
    const d = down;
    down = null;
    if (!d || d.moved) return;
    if (director.busy) {
      director.skip();
      return;
    }
    const hit = pickFigure(ev);
    if (!hit || !director.game) return;
    if (hit.candidate) void director.act(`pick:${hit.id}`);
    else director.focusMember(hit.id);
  });
  canvas.addEventListener("wheel", (ev) => {
    world.rig.zoom(ev.deltaY);
    ev.preventDefault();
  }, { passive: false });
  window.addEventListener("resize", () => {
    world.resize();
    // The card may have moved (bottom sheet ↔ side panel), so re-frame around it.
    if (director.game && !director.busy) director.frameForUI();
  });

  let last = performance.now();
  const loop = (now: number) => {
    world.frame((now - last) / 1000);
    last = now;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.__haze = { booted: true, director, world };
}

boot();
