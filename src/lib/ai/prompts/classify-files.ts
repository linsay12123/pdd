type FilePromptInput = {
  id: string;
  originalFilename: string;
  extractedText: string;
};

export function buildClassifyFilesPrompt(files: FilePromptInput[]) {
  const renderedFiles = files
    .map((file) => {
      const preview = file.extractedText.slice(0, 800);
      return `FILE ${file.id}\nNAME: ${file.originalFilename}\nTEXT:\n${preview}`;
    })
    .join("\n\n---\n\n");

  return [
    "You are classifying uploaded files for an academic writing workflow.",
    "Choose which file is the primary requirement file, which files are background material, and which files are irrelevant.",
    "Prioritize explicit assignment constraints such as target word count, citation style, rubric, and direct task instructions.",
    "If more than one file clearly looks like an assignment brief, mark needsUserConfirmation as true instead of guessing.",
    "",
    renderedFiles
  ].join("\n");
}
