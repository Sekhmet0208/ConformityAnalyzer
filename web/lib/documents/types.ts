/**
 * Types et contexte de generation de documents (Lot 4).
 *
 * Volontairement sans dependance a Playwright/BDD : ce module decrit la forme
 * des donnees et peut etre importe cote client (formulaire) comme serveur.
 */

export type DocumentType =
  | 'privacy_policy'
  | 'legal_notice'
  | 'accessibility_statement'
  | 'cookie_banner';

export const DOCUMENT_TYPES: DocumentType[] = [
  'privacy_policy',
  'legal_notice',
  'accessibility_statement',
  'cookie_banner',
];

export interface DocumentTypeMeta {
  type: DocumentType;
  label: string;
  description: string;
  icon: string;
}

export const DOCUMENT_META: Record<DocumentType, DocumentTypeMeta> = {
  privacy_policy: {
    type: 'privacy_policy',
    label: 'Politique de confidentialité',
    description:
      'Informe vos visiteurs sur les données collectées, les finalités, la ' +
      'durée de conservation et leurs droits (RGPD).',
    icon: '🛡️',
  },
  legal_notice: {
    type: 'legal_notice',
    label: 'Mentions légales',
    description:
      "Identité de l'éditeur, de l'hébergeur, du directeur de la publication " +
      'et coordonnées de contact (obligation LCEN).',
    icon: '⚖️',
  },
  accessibility_statement: {
    type: 'accessibility_statement',
    label: "Déclaration d'accessibilité",
    description:
      "État de conformité de votre site au RGAA/WCAG et modalités de contact " +
      'pour signaler un problème d’accessibilité.',
    icon: '♿',
  },
  cookie_banner: {
    type: 'cookie_banner',
    label: 'Bannière cookies conforme',
    description:
      'Un extrait de code HTML/CSS/JS de bannière de consentement (accepter / ' +
      'refuser / paramétrer) à intégrer à votre site.',
    icon: '🍪',
  },
};

/**
 * Contexte de generation : les informations que l'utilisateur fournit (ou qui
 * sont pre-remplies depuis un scan). Tous les champs sont optionnels : les
 * templates gerent les valeurs manquantes par un marqueur "[À COMPLÉTER]".
 */
export interface DocumentContext {
  // Editeur / organisation
  siteName?: string;
  siteUrl?: string;
  organizationName?: string;
  legalForm?: string; // ex: SAS, SARL, auto-entrepreneur
  capital?: string;
  address?: string;
  siret?: string;
  rcs?: string;
  vatNumber?: string;
  publicationDirector?: string;
  // Contact
  email?: string;
  phone?: string;
  // Hebergeur
  hostName?: string;
  hostAddress?: string;
  hostPhone?: string;
  // Donnees / traceurs (souvent pre-remplies depuis le scan)
  collectsFormData?: boolean;
  trackers?: string[];
  // Accessibilite
  accessibilityScore?: number;
  a11yNonConformities?: string[];
}

/** Champ de formulaire decrivant le contexte (pour l'UI de generation). */
export interface FieldSpec {
  name: keyof DocumentContext;
  label: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'tel';
  required?: boolean;
  help?: string;
}

/** Champs pertinents selon le type de document (pour un formulaire cible). */
export function fieldsForType(type: DocumentType): FieldSpec[] {
  const editor: FieldSpec[] = [
    { name: 'siteName', label: 'Nom du site', placeholder: 'Ma Boutique', required: true },
    { name: 'siteUrl', label: 'Adresse du site', placeholder: 'https://exemple.fr', required: true },
    { name: 'organizationName', label: 'Éditeur (raison sociale ou nom)', placeholder: 'Ma Boutique SAS', required: true },
    { name: 'legalForm', label: 'Forme juridique', placeholder: 'SAS, SARL, auto-entrepreneur…' },
    { name: 'capital', label: 'Capital social', placeholder: '10 000 €' },
    { name: 'address', label: 'Adresse du siège', placeholder: '10 rue de la Paix, 75002 Paris' },
    { name: 'siret', label: 'SIRET', placeholder: '123 456 789 00012' },
    { name: 'rcs', label: 'RCS', placeholder: 'Paris 123 456 789' },
    { name: 'vatNumber', label: 'TVA intracommunautaire', placeholder: 'FR12345678900' },
    { name: 'publicationDirector', label: 'Directeur de la publication', placeholder: 'Jeanne Dupont' },
  ];
  const contact: FieldSpec[] = [
    { name: 'email', label: 'Email de contact', placeholder: 'contact@exemple.fr', type: 'email', required: true },
    { name: 'phone', label: 'Téléphone', placeholder: '01 23 45 67 89', type: 'tel' },
  ];
  const host: FieldSpec[] = [
    { name: 'hostName', label: "Nom de l'hébergeur", placeholder: 'OVH SAS' },
    { name: 'hostAddress', label: "Adresse de l'hébergeur", placeholder: '2 rue Kellermann, 59100 Roubaix' },
    { name: 'hostPhone', label: "Téléphone de l'hébergeur", placeholder: '1007' },
  ];

  switch (type) {
    case 'legal_notice':
      return [...editor, ...contact, ...host];
    case 'privacy_policy':
      return [
        editor[0]!, editor[1]!, editor[2]!, editor[5]!,
        ...contact,
      ];
    case 'accessibility_statement':
      return [editor[0]!, editor[1]!, editor[2]!, ...contact];
    case 'cookie_banner':
      return [editor[0]!, editor[1]!];
    default:
      return editor;
  }
}
