/**
 * Extraction des elements obligatoires des mentions legales (droit francais,
 * PRD 3.3). Le PRD prevoit une extraction semantique par LLM ; pour rester
 * testable hors-ligne (Lot 1), on definit ici :
 *
 *  1. Un contrat `LegalExtractor` (qu'un appel LLM pourra implementer plus tard,
 *     cf. architecture PRD 4 "LLM appele pour extraction semantique").
 *  2. Une implementation heuristique par defaut, deterministe, qui marque les
 *     elements incertains comme "incertain" plutot que d'affirmer (PRD 8).
 */

export type ElementPresence = 'present' | 'manquant' | 'incertain';

/** Les elements obligatoires d'une page de mentions legales (France). */
export type LegalElement =
  | 'editeur'
  | 'hebergeur'
  | 'directeur_publication'
  | 'contact'
  | 'siret_rcs';

export const LEGAL_ELEMENT_LABELS: Record<LegalElement, string> = {
  editeur: "Identite de l'editeur",
  hebergeur: "Identite et coordonnees de l'hebergeur",
  directeur_publication: 'Directeur de la publication',
  contact: 'Moyen de contact (email/telephone/adresse)',
  siret_rcs: 'Numero SIRET / RCS',
};

export interface LegalChecklist {
  editeur: ElementPresence;
  hebergeur: ElementPresence;
  directeur_publication: ElementPresence;
  contact: ElementPresence;
  siret_rcs: ElementPresence;
}

export interface LegalExtractor {
  /** Analyse le texte d'une page candidate et renvoie la checklist. */
  extract(text: string): LegalChecklist | Promise<LegalChecklist>;
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE =
  /(?:\+33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/;
const SIRET_RE = /\b\d{3}[\s.]?\d{3}[\s.]?\d{3}[\s.]?\d{5}\b/; // 14 chiffres
const SIREN_RE = /\b\d{3}[\s.]?\d{3}[\s.]?\d{3}\b/; // 9 chiffres
const RCS_RE = /\bR\.?C\.?S\.?\b/i;

/**
 * Extracteur heuristique deterministe. Prudent : "present" seulement sur signal
 * fort ; sinon "incertain" ou "manquant".
 */
export class HeuristicLegalExtractor implements LegalExtractor {
  extract(text: string): LegalChecklist {
    const t = text.toLowerCase();

    const editeur = this.presence(
      /(editeur|éditeur|edite\s+par|édité\s+par|raison\s+sociale|sas\b|sarl\b|s\.a\.s|s\.a\.r\.l|eurl\b|sasu\b|auto-?entrepreneur|société|societe)/i.test(
        text,
      ),
      /(editeur|éditeur|mentions\s+legales|mentions\s+légales)/i.test(t),
    );

    const hebergeur = this.presence(
      /(hebergeur|hébergeur|heberge\s+par|hébergé\s+par|hosting|ovh|scaleway|aws|amazon\s+web\s+services|gandi|o2switch|hostinger|cloudflare|google\s+cloud|microsoft\s+azure|infomaniak)/i.test(
        text,
      ),
      /(heberg|héberg)/i.test(t),
    );

    const directeur = this.presence(
      /(directeur\s+de\s+la\s+publication|directrice\s+de\s+la\s+publication|directeur\s+de\s+publication|responsable\s+de\s+la\s+publication)/i.test(
        text,
      ),
      false,
    );

    const hasEmail = EMAIL_RE.test(text);
    const hasPhone = PHONE_RE.test(text);
    const contact = this.presence(
      hasEmail || hasPhone,
      /(contact|nous\s+ecrire|nous\s+écrire|coordonnees|coordonnées)/i.test(t),
    );

    const siret = this.presence(
      SIRET_RE.test(text) ||
        RCS_RE.test(text) ||
        (/siren/i.test(text) && SIREN_RE.test(text)) ||
        /siret/i.test(text),
      /(rcs|siret|siren|tva\s+intracommunautaire)/i.test(t),
    );

    return {
      editeur,
      hebergeur,
      directeur_publication: directeur,
      contact,
      siret_rcs: siret,
    };
  }

  /** strongSignal -> present ; sinon weakSignal -> incertain ; sinon manquant. */
  private presence(strongSignal: boolean, weakSignal: boolean): ElementPresence {
    if (strongSignal) return 'present';
    if (weakSignal) return 'incertain';
    return 'manquant';
  }
}
