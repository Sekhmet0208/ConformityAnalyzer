import { describe, expect, it } from 'vitest';
import { RobotsTxt } from '../src/crawler/robots.js';

const UA = 'ComplianceBot/1.0';

describe('RobotsTxt', () => {
  it('autorise tout quand robots.txt est vide', () => {
    const r = RobotsTxt.allowAll();
    expect(r.isAllowed('/anything', UA)).toBe(true);
  });

  it('respecte un Disallow global', () => {
    const r = RobotsTxt.parse('User-agent: *\nDisallow: /private');
    expect(r.isAllowed('/private/page', UA)).toBe(false);
    expect(r.isAllowed('/public', UA)).toBe(true);
  });

  it('Disallow vide signifie tout autoriser', () => {
    const r = RobotsTxt.parse('User-agent: *\nDisallow:');
    expect(r.isAllowed('/anything', UA)).toBe(true);
  });

  it('Allow plus specifique prime sur Disallow plus general', () => {
    const r = RobotsTxt.parse(
      'User-agent: *\nDisallow: /folder\nAllow: /folder/public',
    );
    expect(r.isAllowed('/folder/secret', UA)).toBe(false);
    expect(r.isAllowed('/folder/public/page', UA)).toBe(true);
  });

  it('cible le groupe specifique au user-agent plutot que *', () => {
    const r = RobotsTxt.parse(
      'User-agent: *\nDisallow: /\n\nUser-agent: ComplianceBot\nDisallow: /admin',
    );
    // Le bot a son propre groupe : seul /admin est interdit.
    expect(r.isAllowed('/page', UA)).toBe(true);
    expect(r.isAllowed('/admin/x', UA)).toBe(false);
  });

  it('gere les jokers * et l ancre $', () => {
    const r = RobotsTxt.parse('User-agent: *\nDisallow: /*.pdf$');
    expect(r.isAllowed('/files/report.pdf', UA)).toBe(false);
    expect(r.isAllowed('/files/report.pdf?x=1', UA)).toBe(true);
    expect(r.isAllowed('/files/report.html', UA)).toBe(true);
  });

  it('lit Crawl-delay', () => {
    const r = RobotsTxt.parse('User-agent: *\nCrawl-delay: 5');
    expect(r.crawlDelay(UA)).toBe(5);
  });

  it('ignore les commentaires', () => {
    const r = RobotsTxt.parse('# commentaire\nUser-agent: *\nDisallow: /x # inline');
    expect(r.isAllowed('/x', UA)).toBe(false);
  });
});
