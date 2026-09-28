// Who looks like what. Silhouettes first: hat and build tell people apart at a
// distance in the dark; the scarf colour marks their role.

import type { Role } from "../../../src/game/types.ts";
import type { Look } from "./actors.ts";

export const ROLE_ACCENT: Record<Role, number> = {
  scout: 0x3f8a86,
  mechanic: 0x9a7430,
  medic: 0xcfc6b2,
  hunter: 0x55703a,
  guard: 0x6a7684,
  speaker: 0x7a4f7e,
};

const SKINS = [0x6a4a3a, 0x4a3226, 0x8a6a55, 0x3a2820, 0x7a5a48, 0x5c4033];

const PEOPLE: Record<string, Partial<Look>> = {
  ines: { hat: "bonnet", coat: 0x3a3530, build: "slight", skin: SKINS[2] },
  dov: { hat: "cap", coat: 0x2b2620, skin: SKINS[0] },
  odalys: { hat: "hood", coat: 0x17171d, longCoat: true, skin: SKINS[1] },
  cutter: { hat: "wide", coat: 0x3a2a1a, build: "broad", skin: SKINS[4] },
  wren: { hat: "bare", coat: 0x2a3036, build: "slight", skin: SKINS[2] },
  pim: { hat: "cap", coat: 0x3a3a2a, build: "child", skin: SKINS[2] },
  harlan: { hat: "wide", coat: 0x262b30, longCoat: true, build: "broad", skin: SKINS[3] },
  marisol: { hat: "bonnet", coat: 0x2c2230, skin: SKINS[5] },
  abel: { hat: "cap", coat: 0x3a2e22, skin: SKINS[0] },
  priya: { hat: "bare", coat: 0x2a2e2a, skin: SKINS[5] },
  gus: { hat: "cap", coat: 0x302418, build: "broad", skin: SKINS[1] },
  elspeth: { hat: "bonnet", coat: 0x121216, longCoat: true, skin: SKINS[2] },
  mattie: { hat: "bonnet", coat: 0x34302c, build: "slight", skin: SKINS[4] },
  juniper: { hat: "bare", coat: 0x3a2f26, build: "child", skin: SKINS[3] },
  thaddeus: { hat: "tall", coat: 0x1f2630, longCoat: true, skin: SKINS[1] },
  birdie: { hat: "cap", coat: 0x2f2a22, skin: SKINS[3] },
  ambrose: { hat: "hood", coat: 0x2a2218, longCoat: true, skin: SKINS[0] },
  rue: { hat: "wide", coat: 0x3a2618, skin: SKINS[5] },
  orin: { hat: "bare", coat: 0x2a2a2a, build: "slight", skin: SKINS[2] },
  hollis: { hat: "wide", coat: 0x2a2c24, skin: SKINS[4] },
  nell: { hat: "bonnet", coat: 0x2a2630, build: "slight", skin: SKINS[0] },
};

export function lookFor(id: string, role: Role, isLeader: boolean): Look {
  const base: Look = {
    hat: "bare",
    coat: 0x2a2622,
    trousers: 0x171411,
    accent: ROLE_ACCENT[role],
    skin: SKINS[Math.abs(hashString(id)) % SKINS.length],
    build: "normal",
  };
  if (isLeader) return { ...base, hat: "wide", coat: 0x2a1c14, longCoat: true, build: "normal", skin: SKINS[4] };
  return { ...base, ...PEOPLE[id], accent: ROLE_ACCENT[role] };
}

export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}

export const ENEMY_LOOKS: Record<string, Look> = {
  raider: { hat: "wide", coat: 0x221a14, trousers: 0x14110e, accent: 0x6a1010, skin: SKINS[4], build: "normal", longCoat: true },
  thug: { hat: "cap", coat: 0x262220, trousers: 0x14110e, accent: 0x7a6a30, skin: SKINS[0], build: "broad" },
  starving: { hat: "bare", coat: 0x2a2620, trousers: 0x1a1612, accent: 0x3a3228, skin: SKINS[2], build: "gaunt" },
  hollowed: { hat: "bare", coat: 0x3a3634, trousers: 0x2a2826, accent: 0x4a2020, skin: 0x8a8886, build: "gaunt", hollow: true },
  longman: { hat: "bare", coat: 0x1a1818, trousers: 0x141212, accent: 0x3a1010, skin: 0x9a9894, build: "long", hollow: true },
  stranger: { hat: "wide", coat: 0x2e261e, trousers: 0x171411, accent: 0x5a4a3a, skin: SKINS[1], build: "normal" },
  woman: { hat: "bonnet", coat: 0x2a2228, trousers: 0x171411, accent: 0x6a5a5a, skin: SKINS[2], build: "slight" },
  child: { hat: "bare", coat: 0x3a3026, trousers: 0x171411, accent: 0x5a3a2a, skin: SKINS[3], build: "child" },
  monk: { hat: "hood", coat: 0xb8b0a0, trousers: 0x171411, accent: 0x8a8070, skin: SKINS[0], build: "normal", longCoat: true },
  official: { hat: "tall", coat: 0x1c2230, trousers: 0x12141a, accent: 0x8a2020, skin: SKINS[4], build: "broad", longCoat: true },
  preacher: { hat: "wide", coat: 0x140c0c, trousers: 0x100a0a, accent: 0x9a1a1a, skin: SKINS[2], build: "gaunt", longCoat: true },
};
