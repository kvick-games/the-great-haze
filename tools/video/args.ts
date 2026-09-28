// Tiny argv parser: --flag, --key value, --key=value. Keys named in `repeatKeys` may repeat (--set a=1 --set b=2).
export interface Args {
  flags: Set<string>;
  values: Map<string, string>;
  multi: Map<string, string[]>;
  rest: string[];
}

export function parseArgs(argv: string[], valueKeys: string[], repeatKeys: string[] = []): Args {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  const multi = new Map<string, string[]>();
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      rest.push(a);
      continue;
    }
    const eq = a.indexOf("=");
    const key = eq >= 0 ? a.slice(2, eq) : a.slice(2);
    if (valueKeys.includes(key) || repeatKeys.includes(key)) {
      const v = eq >= 0 ? a.slice(eq + 1) : argv[++i];
      if (v === undefined) throw new Error(`--${key} needs a value`);
      if (repeatKeys.includes(key)) multi.set(key, [...(multi.get(key) ?? []), v]);
      else values.set(key, v);
    } else flags.add(key);
  }
  return { flags, values, multi, rest };
}

export const num = (a: Args, key: string, dflt: number): number => {
  const v = a.values.get(key);
  if (v === undefined) return dflt;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`--${key} must be a number`);
  return n;
};
