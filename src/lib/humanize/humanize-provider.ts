export type HumanizeProfile = {
  readability: "High School" | "University" | "Doctorate" | "Journalist" | "Marketing";
  purpose:
    | "General Writing"
    | "Essay"
    | "Article"
    | "Marketing Material"
    | "Story"
    | "Cover Letter"
    | "Report"
    | "Business Material"
    | "Legal Material";
  strength: "Quality" | "Balanced" | "More Human";
  model: "v2" | "v11" | "v11sr";
};

export type HumanizeDocumentSubmissionInput = {
  content: string;
  profile?: HumanizeProfile;
};

export type HumanizeDocumentSubmissionResult = {
  documentId: string;
  status: string;
};

export type HumanizeDocumentResult = {
  documentId: string;
  status: string;
  output: string | null;
  errorMessage: string | null;
};

export interface HumanizeProvider {
  readonly name: string;
  submitDocument(input: HumanizeDocumentSubmissionInput): Promise<HumanizeDocumentSubmissionResult>;
  getDocument(documentId: string): Promise<HumanizeDocumentResult>;
  rehumanize(documentId: string): Promise<HumanizeDocumentSubmissionResult>;
}

export const defaultHumanizeProfile: HumanizeProfile = {
  readability: "University",
  purpose: "Essay",
  strength: "More Human",
  model: "v11sr"
};
