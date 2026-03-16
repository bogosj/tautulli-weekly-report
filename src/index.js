#!/usr/bin/env node

import { parseArgs } from "node:util";
import { loadConfig, getConfigPath } from "./config.js";
import { TautulliAPI } from "./api.js";
import { runSetup } from "./setup.js";
import { generateReport } from "./report.js";

function printUsage() {
  console.log(`
tautulli-weekly-report — Generate and send weekly Plex viewing reports

Usage:
  tautulli-weekly-report <command> [options]

Commands:
  setup              Interactive setup wizard (API key, URL, notifier)
  report             Generate and send the weekly report
  config             Show current configuration

Report Options:
  --days <number>    Number of days to look back (default: 7)
  --dry-run          Print the report without sending it

Examples:
  tautulli-weekly-report setup
  tautulli-weekly-report report
  tautulli-weekly-report report --days 14 --dry-run
  tautulli-weekly-report config
`);
}

/**
 * Ensure the config exists and return an initialized API client.
 * @returns {{ config: object, api: TautulliAPI }}
 */
function requireConfig() {
  const config = loadConfig();
  if (!config) {
    console.error(
      "❌ No configuration found. Run 'tautulli-weekly-report setup' first."
    );
    process.exit(1);
  }
  if (!config.api_key || !config.base_url || !config.notifier_id) {
    console.error(
      "❌ Configuration is incomplete. Run 'tautulli-weekly-report setup' to reconfigure."
    );
    process.exit(1);
  }
  const api = new TautulliAPI(config.base_url, config.api_key);
  return { config, api };
}

async function handleReport(args) {
  const { values } = parseArgs({
    args,
    options: {
      days: { type: "string", default: "7" },
      "dry-run": { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  const days = parseInt(values.days, 10);
  if (isNaN(days) || days < 1) {
    console.error("❌ --days must be a positive integer.");
    process.exit(1);
  }

  const dryRun = values["dry-run"];
  const { config, api } = requireConfig();

  console.log(`\n📡 Fetching ${days}-day history from Tautulli...\n`);

  const { subject, body } = await generateReport(api, days);

  if (dryRun) {
    console.log("── DRY RUN (not sending notification) ──\n");
    console.log(`Subject: ${subject}\n`);
    console.log(body);
    return;
  }

  // Send via notification agent
  console.log(body);
  console.log(`\n📤 Sending report via notifier ${config.notifier_id}...`);

  try {
    await api.notify(config.notifier_id, subject, body);
    console.log("✅ Report sent successfully!\n");
  } catch (err) {
    console.error(`\n❌ Failed to send report: ${err.message}`);
    process.exit(1);
  }
}

function handleConfig() {
  const config = loadConfig();
  if (!config) {
    console.log(
      "\n⚠️  No configuration found. Run 'tautulli-weekly-report setup' first.\n"
    );
    return;
  }

  const maskedKey =
    config.api_key.slice(0, 4) + "•".repeat(config.api_key.length - 8) + config.api_key.slice(-4);

  console.log("\n📋 Current Configuration\n");
  console.log(`   Config file:  ${getConfigPath()}`);
  console.log(`   Base URL:     ${config.base_url}`);
  console.log(`   API Key:      ${maskedKey}`);
  console.log(`   Notifier ID:  ${config.notifier_id}`);
  console.log("");
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "setup":
      await runSetup();
      break;
    case "report":
      await handleReport(args.slice(1));
      break;
    case "config":
      handleConfig();
      break;
    case "--help":
    case "-h":
    case undefined:
      printUsage();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\n❌ Unexpected error: ${err.message}`);
  process.exit(1);
});
