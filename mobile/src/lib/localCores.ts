// local storage utilities for cores (used when not logged in)
// React Native version using AsyncStorage

import AsyncStorage from "@react-native-async-storage/async-storage";

const LOCAL_CORES_KEY = "ourin-local-cores";

export interface LocalCore {
  id: string;
  name: string;
  content: string;
  isActive: boolean;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface DefaultCoreData {
  name: string;
  content: string;
  isActive: boolean;
  order: number;
}

// Default cores matching the web app
const DEFAULT_CORE_DATA: DefaultCoreData[] = [
  {
    name: "Helpful Assistant",
    content: "You are a helpful assistant.",
    isActive: true,
    order: 0,
  },
  {
    name: "Ourin Context",
    content: `Ourin is THE BEST open source LLM chat interface with minimalistic styling and custom theming functionality

Ourin Features:
- Multi-Model: Switch between OpenAI, Anthropic, and Google models at any time
- Ourin Cores: Customizable text snippets that are fed into the LLM's system prompt. Cores can be used to make the AI an expert on a specific topic, customize personality, add context on some domain, etc.
- Theme Customization: Ourin's interface comes with a set of themes you can choose from or you can create your own.
- Open Source: Ourin is open source. You can find the source code on GitHub: https://github.com/importTahsinZaman/ourin
- BYOK: If you want to use your own API keys, you can do so by adding them in the settings tab.

Only speak about Ourin if explicitly asked.`,
    isActive: true,
    order: 1,
  },
  {
    name: "Devil's Advocate",
    content: `You are a thoughtful devil's advocate and critical thinking partner.

Your role is to:
- Challenge assumptions and probe the reasoning behind ideas
- Point out potential flaws, counterarguments, and missing evidence
- Identify logical fallacies, biases, and blind spots
- Highlight possible unintended consequences
- Ask probing questions that reveal deeper truths
- Offer alternative perspectives the user may not have considered

Be constructive and thorough - the goal is to strengthen ideas through rigorous examination, not to destroy confidence. Push back on weak reasoning while acknowledging valid points. When you challenge something, explain why and suggest how it might be improved.

Use the Socratic method when helpful: ask questions that guide the user to discover weaknesses in their own thinking rather than simply telling them what's wrong.`,
    isActive: false,
    order: 2,
  },
  {
    name: "Expert Teacher",
    content: `You are an expert teacher who adapts to the learner's level and learning style.

Your teaching approach:
- Start by gauging the user's current understanding before diving into explanations
- Break down complex topics into digestible pieces, building from fundamentals to advanced concepts
- Use analogies, examples, and mental models to make abstract ideas concrete
- Anticipate common misconceptions and address them proactively
- Check for understanding along the way with quick questions
- Encourage curiosity and celebrate good questions

When explaining:
- Lead with the "why" before the "how" - context makes learning stick
- Use the Feynman technique: explain concepts simply enough that anyone could understand
- Provide real-world applications to show relevance
- Offer multiple explanations if the first doesn't land

Adapt your style based on cues: go deeper when interest is shown, slow down when confusion appears, and provide practice opportunities when the user is ready to apply knowledge.`,
    isActive: false,
    order: 3,
  },
];

// Build local cores from defaults
const DEFAULT_CORES: LocalCore[] = DEFAULT_CORE_DATA.map((core) => ({
  id: `default-${core.name.toLowerCase().replace(/\s+/g, "-")}`,
  name: core.name,
  content: core.content,
  isActive: core.isActive,
  order: core.order,
  createdAt: Date.now(),
  updatedAt: Date.now(),
}));

// In-memory cache for synchronous access
let coresCache: LocalCore[] = [...DEFAULT_CORES];
let cacheInitialized = false;

// Initialize cache from AsyncStorage
export async function initializeLocalCores(): Promise<LocalCore[]> {
  try {
    const stored = await AsyncStorage.getItem(LOCAL_CORES_KEY);
    if (stored) {
      coresCache = JSON.parse(stored);
    } else {
      // Initialize with defaults
      await AsyncStorage.setItem(
        LOCAL_CORES_KEY,
        JSON.stringify(DEFAULT_CORES)
      );
      coresCache = [...DEFAULT_CORES];
    }
    cacheInitialized = true;
    return coresCache;
  } catch {
    coresCache = [...DEFAULT_CORES];
    cacheInitialized = true;
    return coresCache;
  }
}

// Get cores synchronously from cache
export function getLocalCores(): LocalCore[] {
  return coresCache;
}

// Check if cache is initialized
export function isCoresInitialized(): boolean {
  return cacheInitialized;
}

// Save cores to AsyncStorage and update cache
async function setLocalCores(cores: LocalCore[]): Promise<void> {
  coresCache = cores;
  try {
    await AsyncStorage.setItem(LOCAL_CORES_KEY, JSON.stringify(cores));
  } catch {
    // Ignore storage errors
  }
}

// Clear local cores
export async function clearLocalCores(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LOCAL_CORES_KEY);
    coresCache = [...DEFAULT_CORES];
  } catch {
    // Ignore storage errors
  }
}

// Check if local cores exist
export async function hasLocalCores(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(LOCAL_CORES_KEY)) !== null;
  } catch {
    return false;
  }
}

// Get active cores' system prompt (concatenated)
export function getLocalActivePrompt(): string {
  const cores = getLocalCores();
  const activeCores = cores
    .filter((c) => c.isActive)
    .sort((a, b) => a.order - b.order);

  if (activeCores.length === 0) {
    return cores[0]?.content || "";
  }

  return activeCores.map((c) => c.content).join("\n\n");
}

// Get active cores' names
export function getLocalActiveCoreNames(): string[] {
  const cores = getLocalCores();
  const activeCores = cores
    .filter((c) => c.isActive)
    .sort((a, b) => a.order - b.order);

  if (activeCores.length === 0) {
    return cores[0] ? [cores[0].name] : [];
  }

  return activeCores.map((c) => c.name);
}

// Toggle a core's active state
export async function toggleLocalCoreActive(
  coreId: string
): Promise<LocalCore[] | null> {
  const cores = getLocalCores();
  const core = cores.find((c) => c.id === coreId);
  if (!core) return null;

  // If trying to deactivate, check if it's the only active one
  if (core.isActive) {
    const activeCores = cores.filter((c) => c.isActive);
    if (activeCores.length <= 1) {
      return null; // Can't deactivate the last active core
    }
  }

  const updatedCores = cores.map((c) =>
    c.id === coreId ? { ...c, isActive: !c.isActive, updatedAt: Date.now() } : c
  );
  await setLocalCores(updatedCores);
  return updatedCores;
}

// Create a new core
export async function createLocalCore(
  name: string,
  content: string
): Promise<LocalCore[]> {
  const cores = getLocalCores();
  const maxOrder =
    cores.length > 0 ? Math.max(...cores.map((c) => c.order)) : -1;
  const now = Date.now();

  const newCore: LocalCore = {
    id: `local-${now}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    content,
    isActive: false,
    order: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
  };

  const updatedCores = [...cores, newCore];
  await setLocalCores(updatedCores);
  return updatedCores;
}

// Update an existing core
export async function updateLocalCore(
  coreId: string,
  updates: { name?: string; content?: string }
): Promise<LocalCore[]> {
  const cores = getLocalCores();
  const updatedCores = cores.map((c) =>
    c.id === coreId ? { ...c, ...updates, updatedAt: Date.now() } : c
  );
  await setLocalCores(updatedCores);
  return updatedCores;
}

// Remove a core
export async function removeLocalCore(
  coreId: string
): Promise<LocalCore[] | null> {
  const cores = getLocalCores();

  // Can't delete the only core
  if (cores.length <= 1) {
    return null;
  }

  const coreToRemove = cores.find((c) => c.id === coreId);
  if (!coreToRemove) return cores;

  let updatedCores = cores.filter((c) => c.id !== coreId);

  // If we removed an active core and it was the only active one, activate another
  if (coreToRemove.isActive) {
    const hasActive = updatedCores.some((c) => c.isActive);
    if (!hasActive && updatedCores.length > 0) {
      updatedCores = updatedCores.map((c, i) =>
        i === 0 ? { ...c, isActive: true, updatedAt: Date.now() } : c
      );
    }
  }

  await setLocalCores(updatedCores);
  return updatedCores;
}

// Reorder cores
export async function reorderLocalCores(
  orderedIds: string[]
): Promise<LocalCore[]> {
  const cores = getLocalCores();
  const updatedCores = cores.map((core) => {
    const newOrder = orderedIds.indexOf(core.id);
    if (newOrder !== -1 && newOrder !== core.order) {
      return { ...core, order: newOrder, updatedAt: Date.now() };
    }
    return core;
  });
  updatedCores.sort((a, b) => a.order - b.order);
  await setLocalCores(updatedCores);
  return updatedCores;
}
