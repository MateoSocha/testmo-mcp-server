const uid = () => Date.now().toString(36).toUpperCase();

export function makeFolderInput(overrides: { name?: string; parent_id?: number } = {}) {
  return { name: `[TEST] Folder ${uid()}`, ...overrides };
}

export function makeCaseInput(overrides: Partial<{
  name: string;
  folder_id: number;
  custom_priority: number;
  custom_description: string;
  custom_steps: Array<{ text1: string; text3?: string }>;
}> = {}) {
  return {
    name: `[TEST] Case ${uid()}`,
    custom_priority: 3,
    ...overrides,
  };
}
