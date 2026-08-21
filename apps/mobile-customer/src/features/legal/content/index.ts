import { ACCEPTABLE_USE_POLICY } from "./acceptable-use-policy";
import { COOKIE_POLICY } from "./cookie-policy";
import { DMCA_POLICY } from "./dmca-policy";
import { PRIVACY_POLICY } from "./privacy-policy";
import { RETURNS_REFUNDS_POLICY } from "./returns-refunds-policy";
import { TERMS_OF_SERVICE } from "./terms-of-service";

export const LEGAL_DOCUMENTS = {
  terms: { titleKey: "footer.terms", source: TERMS_OF_SERVICE },
  privacy: { titleKey: "footer.privacy", source: PRIVACY_POLICY },
  returns: { titleKey: "footer.returns", source: RETURNS_REFUNDS_POLICY },
  cookies: { titleKey: "footer.cookies", source: COOKIE_POLICY },
  "acceptable-use": { titleKey: "footer.acceptableUse", source: ACCEPTABLE_USE_POLICY },
  dmca: { titleKey: "footer.dmca", source: DMCA_POLICY },
} as const;

export type LegalDocumentSlug = keyof typeof LEGAL_DOCUMENTS;
