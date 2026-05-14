const PREFIXES = [
  "Mine",
  "Craft",
  "Block",
  "Stone",
  "Red",
  "Blue",
  "Nova",
  "Pixel",
  "Quartz",
  "Cobalt",
  "Amber",
  "Iron",
  "Lime",
  "Sky",
];

const ROLES = [
  "Bot",
  "Guard",
  "Helper",
  "Scout",
  "Keeper",
  "Miner",
  "Builder",
  "Runner",
  "Worker",
  "Sentinel",
];

function pick(items: string[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export function generateBotUsername() {
  for (let i = 0; i < 8; i++) {
    const suffix = String(Math.floor(Math.random() * 90) + 10);
    const name = `${pick(PREFIXES)}${pick(ROLES)}${suffix}`;
    if (name.length >= 3 && name.length <= 16) {
      return name;
    }
  }

  return `MineBot${Math.floor(Math.random() * 900) + 100}`;
}
