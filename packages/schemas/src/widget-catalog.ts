export interface WidgetGuideConfigField {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface WidgetGuideData {
  oneLiner: string;
  whatItDoes: string;
  whenToUse: string[];
  setupSteps: string[];
  configFields: WidgetGuideConfigField[];
  exampleJson: string;
  tips: string[];
  sidebarPosition: number;
  relatedWidgets?: Array<{ id: string; name: string; domain: string; slug: string }>;
}

export interface WidgetCatalogEntry {
  id: string;
  name?: string;
  description?: string;
  domain?: string;
  status?: string;
  deprecated?: boolean;
  replacement?: string;
  keywords?: string[];
  learningIntents?: string[];
  legacyId?: string;
  capabilities?: string[];
  accessibility?: string[];
  analytics?: string[];
  reward?: { completionXP?: number; positiveMessage?: string; achievement?: string };
  ai?: {
    difficulty?: string;
    estimatedMinutes?: number;
    bloomsLevel?: string;
    cognitiveLoad?: string;
    recommendedAge?: [number, number];
    readingLevel?: string;
    subjectTags?: string[];
    learningObjectives?: string[];
    commonMisconceptions?: string[];
    generationHints?: string[];
  };
  guide?: WidgetGuideData;
}
