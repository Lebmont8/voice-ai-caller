import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const ignored = new Set([".git", "node_modules"]);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    if (entry.isFile()) files.push(path);
  }

  return files;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const mockPath = join(root, "config", "voice-call.mock.example.json");
const livePath = join(root, "config", "voice-call.twilio.example.json");
const mock = JSON.parse(await readFile(mockPath, "utf8"));
const live = JSON.parse(await readFile(livePath, "utf8"));

const mockConfig = mock.plugins?.entries?.["voice-call"]?.config;
const liveConfig = live.plugins?.entries?.["voice-call"]?.config;

assert(mockConfig?.provider === "mock", "Mock config must use the mock provider");
assert(mockConfig?.realtime?.enabled === false, "Mock config must keep Realtime disabled");
assert(liveConfig?.provider === "twilio", "Live example must use Twilio");
assert(liveConfig?.sessionScope === "per-call", "Live example must isolate each call");
assert(liveConfig?.inboundPolicy === "disabled", "Inbound calls must be disabled by default");
assert(liveConfig?.maxConcurrentCalls === 1, "Default concurrency must remain one call");
assert(liveConfig?.twilio?.recordingAllowTo?.length === 0, "Recording allowlist must be empty");
assert(liveConfig?.realtime?.toolPolicy === "none", "Realtime tools must be disabled");
assert(liveConfig?.realtime?.fastContext?.enabled === false, "Fast context must be disabled");
assert(liveConfig?.realtime?.agentContext?.enabled === false, "Agent context must be disabled");
assert(liveConfig?.twilio?.authToken?.source === "env", "Twilio token must use an env SecretRef");
assert(liveConfig?.realtime?.providers?.openai?.apiKey?.source === "env", "OpenAI key must use an env SecretRef");

const personalNames = ["Il" + "ya", "Il" + "ia", "Ил" + "ья", "As" + "ya", "Ас" + "я"];

const forbidden = [
  ["OpenAI-style API key", /\bsk-[A-Za-z0-9_-]{20,}\b/g],
  ["Twilio Account SID", /\bAC[a-fA-F0-9]{32}\b/g],
  ["literal E.164 phone number", /\+[1-9]\d{7,14}\b/g],
  ["private deployment hostname", /vexoraworkingspaces\.com/gi],
  ["personal operator name", new RegExp(`\\b(?:${personalNames.join("|")})\\b`, "giu")]
];

for (const path of await walk(root)) {
  const text = await readFile(path, "utf8");
  for (const [label, pattern] of forbidden) {
    pattern.lastIndex = 0;
    assert(!pattern.test(text), `${label} found in ${path}`);
  }
}

console.log("PASS: configs are valid JSON, safety defaults are intact, and no known secret/PII patterns were found.");
