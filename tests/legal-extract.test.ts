import { describe, expect, it } from 'vitest';
import { HeuristicLegalExtractor } from '../src/analyzers/legal-extract.js';

const extractor = new HeuristicLegalExtractor();

describe('HeuristicLegalExtractor', () => {
  it('detecte tous les elements sur des mentions completes', () => {
    const text = `Mentions legales.
      Le site est edite par Boutique Conforme SAS au capital de 10 000 euros.
      Directeur de la publication : Jeanne Dupont.
      Hebergeur : OVH SAS, 2 rue Kellermann, 59100 Roubaix.
      Contact : contact@exemple.fr, 01 23 45 67 89.
      RCS Paris 123 456 789 - SIRET 123 456 789 00012.`;
    const c = extractor.extract(text);
    expect(c.editeur).toBe('present');
    expect(c.hebergeur).toBe('present');
    expect(c.directeur_publication).toBe('present');
    expect(c.contact).toBe('present');
    expect(c.siret_rcs).toBe('present');
  });

  it('marque manquant ce qui est absent', () => {
    const c = extractor.extract('Page de contenu sans aucune mention legale.');
    expect(c.directeur_publication).toBe('manquant');
    expect(c.hebergeur).toBe('manquant');
  });

  it('detecte un email comme contact', () => {
    const c = extractor.extract('Pour nous joindre : hello@exemple.fr');
    expect(c.contact).toBe('present');
  });

  it('detecte un telephone francais comme contact', () => {
    const c = extractor.extract('Appelez le 01 23 45 67 89');
    expect(c.contact).toBe('present');
  });

  it('reste prudent : signal faible -> incertain', () => {
    // "heberg" present sans nom d hebergeur reconnu.
    const c = extractor.extract('Informations sur l hebergement du site.');
    expect(c.hebergeur).toBe('incertain');
  });
});
