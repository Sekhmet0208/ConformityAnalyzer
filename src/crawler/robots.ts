/**
 * Parseur robots.txt minimal mais conforme au comportement attendu (PRD 3.1 :
 * "Respecter robots.txt"). Gere les groupes User-agent, les directives
 * Allow/Disallow avec precedence au chemin le plus specifique (longest match,
 * tie -> Allow), les jokers `*` et l'ancre `$`, ainsi que Crawl-delay.
 *
 * Implementation deliberement sans dependance reseau : on parse une chaine deja
 * recuperee. La recuperation HTTP est faite par l'appelant (le crawler), ce qui
 * rend ce module pur et testable.
 */

interface Rule {
  type: 'allow' | 'disallow';
  path: string;
}

interface Group {
  agents: string[];
  rules: Rule[];
  crawlDelay?: number;
}

export class RobotsTxt {
  private groups: Group[] = [];

  private constructor(groups: Group[]) {
    this.groups = groups;
  }

  static parse(content: string): RobotsTxt {
    const groups: Group[] = [];
    let current: Group | null = null;
    let expectingAgents = false; // pour regrouper des User-agent consecutifs

    const lines = content.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.replace(/#.*$/, '').trim();
      if (!line) continue;
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const field = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1).trim();

      if (field === 'user-agent') {
        if (!expectingAgents || !current) {
          current = { agents: [], rules: [] };
          groups.push(current);
          expectingAgents = true;
        }
        current.agents.push(value.toLowerCase());
        continue;
      }

      // Toute directive non user-agent ferme la phase de collecte d'agents.
      expectingAgents = false;
      if (!current) {
        // Directives avant tout User-agent : on les ignore (non standard).
        continue;
      }
      if (field === 'disallow') {
        current.rules.push({ type: 'disallow', path: value });
      } else if (field === 'allow') {
        current.rules.push({ type: 'allow', path: value });
      } else if (field === 'crawl-delay') {
        const n = Number.parseFloat(value);
        if (!Number.isNaN(n)) current.crawlDelay = n;
      }
      // Sitemap et autres champs : ignores ici.
    }

    return new RobotsTxt(groups);
  }

  /** robots.txt absent ou illisible -> tout est autorise. */
  static allowAll(): RobotsTxt {
    return new RobotsTxt([]);
  }

  private groupFor(userAgent: string): Group | null {
    const ua = userAgent.toLowerCase();
    let best: Group | null = null;
    let bestLen = -1;
    let wildcard: Group | null = null;

    for (const g of this.groups) {
      for (const agent of g.agents) {
        if (agent === '*') {
          wildcard = g;
        } else if (ua.includes(agent) && agent.length > bestLen) {
          best = g;
          bestLen = agent.length;
        }
      }
    }
    return best ?? wildcard;
  }

  isAllowed(path: string, userAgent: string): boolean {
    const group = this.groupFor(userAgent);
    if (!group) return true;

    let decision: { allow: boolean; specificity: number } | null = null;
    for (const rule of group.rules) {
      // Une regle Disallow vide signifie "tout autoriser" -> ignoree ici.
      if (rule.type === 'disallow' && rule.path === '') continue;
      const matchLen = matchLength(rule.path, path);
      if (matchLen === -1) continue;
      const isAllow = rule.type === 'allow';
      if (
        decision === null ||
        matchLen > decision.specificity ||
        // Egalite de specificite : Allow l'emporte (recommandation Google).
        (matchLen === decision.specificity && isAllow && !decision.allow)
      ) {
        decision = { allow: isAllow, specificity: matchLen };
      }
    }
    return decision ? decision.allow : true;
  }

  crawlDelay(userAgent: string): number | undefined {
    return this.groupFor(userAgent)?.crawlDelay;
  }
}

/**
 * Renvoie la longueur de motif "consommee" si `pattern` matche le debut de
 * `path` (avec support de `*` et de l'ancre finale `$`), sinon -1.
 * La longueur sert de mesure de specificite.
 */
function matchLength(pattern: string, path: string): number {
  if (pattern === '') return -1;
  if (!pattern.includes('*') && !pattern.endsWith('$')) {
    return path.startsWith(pattern) ? pattern.length : -1;
  }

  // Conversion en RegExp ancree au debut.
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  let re = '^';
  for (const ch of body) {
    if (ch === '*') re += '.*';
    else re += escapeRegExp(ch);
  }
  if (anchored) re += '$';
  const ok = new RegExp(re).test(path);
  // Specificite approximee : longueur du motif hors jokers.
  return ok ? body.replace(/\*/g, '').length : -1;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}
