import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { TautulliAPI } from "./api.js";
import { saveConfig } from "./config.js";

/**
 * Prompt the user for a single line of input.
 */
async function prompt(rl, question) {
  const answer = await rl.question(question);
  return answer.trim();
}

/**
 * Run the interactive setup wizard.
 * Prompts for API key, base URL, and notifier selection, then saves to config.
 */
export async function runSetup() {
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    console.log("\n🔧 Tautulli Weekly Report — Setup\n");

    // 1. API Key
    const apiKey = await prompt(rl, "Paste your Tautulli API key: ");
    if (!apiKey) {
      console.error("❌ API key cannot be empty.");
      process.exit(1);
    }

    // 2. Base URL
    let baseUrl = await prompt(
      rl,
      "Enter the Tautulli base URL (e.g. http://192.168.1.100:8181): "
    );
    if (!baseUrl) {
      console.error("❌ Base URL cannot be empty.");
      process.exit(1);
    }
    // Strip trailing slashes
    baseUrl = baseUrl.replace(/\/+$/, "");

    // 3. Validate connection by fetching notifiers
    console.log("\n📡 Connecting to Tautulli...");
    const api = new TautulliAPI(baseUrl, apiKey);

    let notifiers;
    try {
      notifiers = await api.getNotifiers();
    } catch (err) {
      console.error(`\n❌ Could not connect to Tautulli: ${err.message}`);
      console.error("   Please verify your API key and base URL.");
      process.exit(1);
    }

    if (!notifiers || notifiers.length === 0) {
      console.error(
        "\n❌ No notification agents found in Tautulli. Please configure one first."
      );
      process.exit(1);
    }

    // 4. Display notifiers and let user pick
    console.log("\n📋 Available Notification Agents:\n");
    console.log("   #   Type              Name");
    console.log("   ─── ───────────────── ────────────────────────────");
    notifiers.forEach((n, i) => {
      const name = n.friendly_name || n.agent_label;
      const active = n.active ? "✓" : "✗";
      console.log(
        `   ${String(i + 1).padStart(2)}.  ${n.agent_label.padEnd(18)} ${name} [${active}]`
      );
    });

    const choice = await prompt(rl, "\nSelect a notifier by number: ");
    const choiceIdx = parseInt(choice, 10) - 1;

    if (isNaN(choiceIdx) || choiceIdx < 0 || choiceIdx >= notifiers.length) {
      console.error("❌ Invalid selection.");
      process.exit(1);
    }

    const selectedNotifier = notifiers[choiceIdx];
    const notifierName =
      selectedNotifier.friendly_name || selectedNotifier.agent_label;

    // 5. Save config
    const config = {
      api_key: apiKey,
      base_url: baseUrl,
      notifier_id: selectedNotifier.id,
    };
    saveConfig(config);

    console.log(
      `\n✅ Configuration saved! Using notifier: ${notifierName} (ID: ${selectedNotifier.id})`
    );
    console.log(
      `   Config file: $HOME/.tautulli-weekly-report/config.json\n`
    );
  } finally {
    rl.close();
  }
}
