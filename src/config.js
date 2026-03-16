import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Resolve the config directory.
 * Priority: TAUTULLI_CONFIG_DIR env var → $HOME/.tautulli-weekly-report
 */
function resolveConfigDir() {
  return process.env.TAUTULLI_CONFIG_DIR || join(homedir(), ".tautulli-weekly-report");
}

/**
 * Returns the path to the config directory.
 */
export function getConfigDir() {
  return resolveConfigDir();
}

/**
 * Returns the path to the config file.
 */
export function getConfigPath() {
  return join(resolveConfigDir(), "config.json");
}

/**
 * Load the config, merging file-based config with env var overrides.
 *
 * Env vars (override file values):
 *   TAUTULLI_API_KEY, TAUTULLI_BASE_URL, TAUTULLI_NOTIFIER_ID
 *
 * @returns {{ api_key: string, base_url: string, notifier_id: number } | null}
 */
export function loadConfig() {
  const configFile = getConfigPath();
  let fileConfig = {};

  if (existsSync(configFile)) {
    try {
      const raw = readFileSync(configFile, "utf-8");
      fileConfig = JSON.parse(raw);
    } catch {
      // ignore parse errors, fall through to env vars
    }
  }

  const config = {
    api_key: process.env.TAUTULLI_API_KEY || fileConfig.api_key,
    base_url: process.env.TAUTULLI_BASE_URL || fileConfig.base_url,
    notifier_id: process.env.TAUTULLI_NOTIFIER_ID
      ? parseInt(process.env.TAUTULLI_NOTIFIER_ID, 10)
      : fileConfig.notifier_id,
  };

  // Return null only if nothing is set at all
  if (!config.api_key && !config.base_url && !config.notifier_id) {
    return null;
  }

  return config;
}

/**
 * Save the config to disk, creating the directory if needed.
 * @param {{ api_key: string, base_url: string, notifier_id: number }} data
 */
export function saveConfig(data) {
  const dir = resolveConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(join(dir, "config.json"), JSON.stringify(data, null, 2) + "\n", "utf-8");
}
