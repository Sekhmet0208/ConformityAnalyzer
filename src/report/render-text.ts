import type { ScanResult, Severity } from '../types.js';

const SEV_LABEL: Record<Severity, string> = {
  critique: 'CRITIQUE',
  important: 'IMPORTANT',
  mineur: 'MINEUR',
};

/** Rendu console lisible d'un rapport de scan (pour la CLI). */
export function renderText(report: ScanResult): string {
  const lines: string[] = [];
  const { scan, summary } = report;

  lines.push('='.repeat(64));
  lines.push(`  RAPPORT DE CONFORMITE — ${scan.root_url}`);
  lines.push('='.repeat(64));
  lines.push(
    `Score : ${report.score}/100  (note ${report.grade})   Palier : ${scan.tier}`,
  );
  lines.push(
    `Pages analysees : ${scan.pages_crawled} / ${scan.pages_discovered} decouvertes` +
      `   robots.txt respecte : ${scan.robots_respected ? 'oui' : 'non'}`,
  );
  lines.push(`Duree : ${(scan.duration_ms / 1000).toFixed(1)} s`);
  lines.push('');
  lines.push(
    `Stack detectee — CMS : ${report.stack.cms ?? 'inconnu'} | ` +
      `CMP : ${report.stack.cmp ?? 'aucune detectee'} | ` +
      `Traceurs : ${report.stack.trackers.length ? report.stack.trackers.join(', ') : 'aucun'}`,
  );
  lines.push('');
  lines.push(
    `Problemes : ${summary.total} ` +
      `(critiques ${summary.by_severity.critique}, ` +
      `importants ${summary.by_severity.important}, ` +
      `mineurs ${summary.by_severity.mineur})`,
  );
  lines.push(
    `Confirmes : ${summary.confirmed}   A verifier : ${summary.to_verify}`,
  );
  lines.push(
    `Par categorie — cookies ${summary.by_category.cookies}, ` +
      `rgpd ${summary.by_category.rgpd}, ` +
      `mentions_legales ${summary.by_category.mentions_legales}, ` +
      `accessibilite ${summary.by_category.accessibilite}`,
  );
  lines.push('');
  lines.push('-'.repeat(64));
  lines.push('  DETAIL DES CONSTATS');
  lines.push('-'.repeat(64));

  if (report.findings.length === 0) {
    lines.push('Aucun probleme detecte par les modules automatises.');
  }

  let i = 1;
  for (const f of report.findings) {
    const flag = f.status === 'a_verifier' ? ' [A VERIFIER]' : '';
    const lock = f.locked ? ' [VERROUILLE]' : '';
    const wcag = f.wcag_ref ? ` (WCAG ${f.wcag_ref})` : '';
    lines.push('');
    lines.push(
      `${i}. [${SEV_LABEL[f.severity]}] (${f.category})${wcag}${flag}${lock}`,
    );
    lines.push(`   ${f.title}`);
    if (!f.locked) {
      if (f.evidence.url) lines.push(`   URL : ${f.evidence.url}`);
      if (f.evidence.selector) lines.push(`   Selecteur : ${f.evidence.selector}`);
      if (f.evidence.detail) lines.push(`   Constat : ${f.evidence.detail}`);
      lines.push(`   Action : ${f.recommendation}`);
    } else {
      lines.push('   Details et correction verrouilles (offre payante).');
    }
    i++;
  }

  lines.push('');
  lines.push('-'.repeat(64));
  lines.push('AVERTISSEMENT');
  lines.push(wrap(report.disclaimer, 64));
  lines.push('='.repeat(64));

  return lines.join('\n');
}

function wrap(text: string, width: number): string {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > width) {
      out.push(line.trim());
      line = w;
    } else {
      line += ' ' + w;
    }
  }
  if (line.trim()) out.push(line.trim());
  return out.join('\n');
}
