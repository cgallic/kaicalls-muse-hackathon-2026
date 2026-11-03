/** Muse is a separate opt-in experiment; never follow memory's default-ON convention. */
export function isMuseMemoryShadowEnabled(): boolean {
  return process.env.MUSE_MEMORY_SHADOW_ENABLED === "true";
}

/** Separate from observation-only shadowing. Never inherits the shadow opt-in. */
export function isMuseMemoryRecallEnabled(): boolean {
  return process.env.MUSE_MEMORY_RECALL_ENABLED === "true";
}

/** Consolidation is a separate observation-only experiment, never enabled by P1 alone. */
export function isMuseConsolidationShadowEnabled(): boolean {
  return process.env.MUSE_MEMORY_CONSOLIDATION_SHADOW_ENABLED === "true";
}
