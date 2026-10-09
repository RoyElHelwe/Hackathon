/**
 * Privacy tokenizer for AI calls (CLAUDE.md: never send names or emails to the AI).
 * Known people's names and any email in a text are replaced by stable tokens (staff T1…, students S1…, emails E1…)
 * before the AI sees it; tokens in the AI's answer are mapped back on the server.
 */

export interface TokenPerson {
  id: string;
  name: string;
  kind: 'staff' | 'student';
}

export interface Tokenizer {
  /** replace names and emails by tokens */
  encode(text: string): string;
  /** replace tokens by the original names / emails */
  decode(text: string): string;
  /** token → person id (staff and students only) */
  idOf(token: string): string | undefined;
  /** person id → token (assigned on first use) */
  tokenOf(id: string): string | undefined;
  /** email token → email */
  emailOf(token: string): string | undefined;
  /** ambiguous aliases met while encoding ("Khoury" → several people), as `T?1` tokens */
  ambiguous(token: string): string[] | undefined;
}

const HONORIFICS = ['mr', 'mrs', 'ms', 'miss', 'mme', 'mlle', 'madame', 'mister', 'dr', 'prof', 'teacher', 'الأستاذ', 'الأستاذة', 'أستاذ', 'أستاذة', 'الاستاذ', 'الاستاذة', 'استاذ', 'استاذة', 'مس', 'مدام', 'السيد', 'السيدة'];
const EMAIL_RE = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu;
const TOKEN_RE = /\b(T\?\d+|[TSE]\d+)\b/g;

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function norm(s: string) {
  return s.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

/**
 * Build a tokenizer for a set of people. Aliases: full name; last name (with or without an honorific);
 * first name when it is unique. Longest alias wins; matching is case-insensitive with Unicode word boundaries.
 */
export function buildTokenizer(people: TokenPerson[]): Tokenizer {
  const tokenById = new Map<string, string>();
  const idByToken = new Map<string, string>();
  const nameById = new Map(people.map((p) => [p.id, norm(p.name)]));
  const kindById = new Map(people.map((p) => [p.id, p.kind]));
  const emails = new Map<string, string>(); // token → email
  const emailTokens = new Map<string, string>(); // lowercased email → token
  const ambig = new Map<string, string[]>(); // T?n → ids
  let staffN = 0;
  let studentN = 0;
  let ambigN = 0;

  const tokenFor = (id: string) => {
    let t = tokenById.get(id);
    if (!t) {
      t = kindById.get(id) === 'student' ? `S${++studentN}` : `T${++staffN}`;
      tokenById.set(id, t);
      idByToken.set(t, id);
    }
    return t;
  };

  // alias → ids
  const aliases = new Map<string, Set<string>>();
  const add = (alias: string, id: string) => {
    const a = norm(alias).toLowerCase();
    if (a.length < 2) return;
    if (!aliases.has(a)) aliases.set(a, new Set());
    aliases.get(a)!.add(id);
  };
  const firstCount = new Map<string, number>();
  for (const p of people) {
    const parts = norm(p.name).split(' ');
    if (parts.length > 1) firstCount.set(parts[0].toLowerCase(), (firstCount.get(parts[0].toLowerCase()) ?? 0) + 1);
  }
  for (const p of people) {
    const name = norm(p.name);
    const parts = name.split(' ');
    add(name, p.id);
    if (parts.length > 1) {
      const last = parts.slice(1).join(' ');
      add(last, p.id);
      for (const h of HONORIFICS) {
        add(`${h} ${last}`, p.id);
        add(`${h}. ${last}`, p.id);
        add(`${h} ${name}`, p.id);
      }
      if ((firstCount.get(parts[0].toLowerCase()) ?? 0) === 1 && parts[0].length > 2) add(parts[0], p.id);
    }
  }
  const sorted = [...aliases.keys()].sort((a, b) => b.length - a.length);
  const re = sorted.length ? new RegExp(`(?<![\\p{L}\\p{N}])(${sorted.map(escape).join('|')})(?![\\p{L}\\p{N}])`, 'giu') : null;

  return {
    encode(text) {
      let out = text.replace(EMAIL_RE, (m) => {
        const k = m.toLowerCase();
        let t = emailTokens.get(k);
        if (!t) {
          t = `E${emailTokens.size + 1}`;
          emailTokens.set(k, t);
          emails.set(t, m);
        }
        return t;
      });
      if (re) {
        out = out.replace(re, (m) => {
          const ids = [...(aliases.get(norm(m).toLowerCase()) ?? [])];
          if (ids.length === 1) return tokenFor(ids[0]);
          if (ids.length > 1) {
            const t = `T?${++ambigN}`;
            ambig.set(t, ids);
            return t;
          }
          return m;
        });
      }
      return out;
    },
    decode(text) {
      return text.replace(TOKEN_RE, (t) => {
        if (emails.has(t)) return emails.get(t)!;
        const id = idByToken.get(t);
        if (id) return nameById.get(id) ?? t;
        const many = ambig.get(t);
        if (many) return nameById.get(many[0])?.split(' ').slice(1).join(' ') || t;
        return t;
      });
    },
    idOf: (t) => idByToken.get(t),
    tokenOf: (id) => (nameById.has(id) ? tokenFor(id) : undefined),
    emailOf: (t) => emails.get(t),
    ambiguous: (t) => ambig.get(t),
  };
}
