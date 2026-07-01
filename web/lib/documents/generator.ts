import type { DocumentContext, DocumentType } from './types';
import { DOCUMENT_META } from './types';
import {
  renderAccessibilityStatement,
  renderCookieBanner,
  renderLegalNotice,
  renderPrivacyPolicy,
} from './templates';

/**
 * Generateur de documents.
 *
 * Contrat volontairement identique a l'approche du Lot 1 (LegalExtractor) :
 * l'implementation par defaut est 100 % DETERMINISTE (templates a trous, aucune
 * API, gratuite). Un generateur LLM pourra l'enrichir plus tard SANS changer le
 * reste du code — mais il devra rester CONTRAINT (remplir des trous valides, ne
 * jamais inventer de clauses, PRD §9).
 */
export interface DocumentGenerator {
  readonly id: string;
  generate(type: DocumentType, context: DocumentContext): GeneratedDocument;
}

export interface GeneratedDocument {
  type: DocumentType;
  title: string;
  html: string;
  generator: string;
}

/** Generateur par defaut : templates purs, hors-ligne, sans coût. */
export class TemplateDocumentGenerator implements DocumentGenerator {
  readonly id = 'template';

  generate(type: DocumentType, context: DocumentContext): GeneratedDocument {
    const html = renderByType(type, context);
    return {
      type,
      title: DOCUMENT_META[type].label,
      html,
      generator: this.id,
    };
  }
}

function renderByType(type: DocumentType, ctx: DocumentContext): string {
  switch (type) {
    case 'legal_notice':
      return renderLegalNotice(ctx);
    case 'privacy_policy':
      return renderPrivacyPolicy(ctx);
    case 'accessibility_statement':
      return renderAccessibilityStatement(ctx);
    case 'cookie_banner':
      return renderCookieBanner(ctx);
    default:
      throw new Error(`Type de document inconnu : ${type}`);
  }
}

let defaultGenerator: DocumentGenerator = new TemplateDocumentGenerator();

/** Generateur actif (templates par defaut ; injectable pour un LLM plus tard). */
export function getDocumentGenerator(): DocumentGenerator {
  return defaultGenerator;
}

export function setDocumentGenerator(gen: DocumentGenerator): void {
  defaultGenerator = gen;
}
