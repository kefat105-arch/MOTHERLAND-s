/**
 * Bangladesh Services — Digital Services Hub Types
 * Section 12 Implementation
 */

export type ServiceCategory =
  | 'government'
  | 'education'
  | 'utilities'
  | 'payments'
  | 'banking'
  | 'loans'
  | 'health'
  | 'transport'
  | 'jobs'
  | 'communication';

export type EmbedSupportType = 'IN_APP_SUPPORTED' | 'EXTERNAL_OFFICIAL_REQUIRED';

export type ServiceFeeType = 'FREE_PUBLIC_SERVICE' | 'GOVERNMENT_STATUTORY_FEE' | 'PROVIDER_COMMERCIAL_FEE';

export interface BangladeshServiceEntry {
  id: string;
  name: string;
  bengaliName: string;
  category: ServiceCategory;
  categoryBengali: string;
  authority: string;
  officialUrl: string;
  officialDomain: string;
  description: string;
  bengaliDescription: string;
  status: 'VERIFIED_ACTIVE';
  embedSupport: EmbedSupportType;
  feeStructure: ServiceFeeType;
  feeDetails: string;
  lastVerified: string;
  requiresLogin: boolean;
  isPopular?: boolean;
  ageRestricted?: boolean; // Under-18 restriction for loans/financial products
  keywords: string[];
}
