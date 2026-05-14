export interface AutoChatTemplate {
  id: string;
  name: string;
  description: string;
  messages: string[];
}

export const autoChatTemplates: AutoChatTemplate[] = [
  {
    id: "welcome",
    name: "欢迎引导",
    description: "适合大厅、主城和新玩家进服提示",
    messages: [
      "欢迎来到服务器，祝你玩得开心！",
      "新玩家可以先看看公告和规则，避免错过重要信息。",
      "遇到问题可以输入 !help 查看可用指令。",
      "需要问答帮助可以输入 !ask 加上你的问题。",
      "记得设置家和保存重要坐标。"
    ]
  },
  {
    id: "survival",
    name: "生存提醒",
    description: "适合生存服的温和提示",
    messages: [
      "外出探索前记得带食物、火把和备用工具。",
      "下矿时注意脚下，岩浆附近先蹲住再挖。",
      "贵重物品建议及时放箱子，别全带在身上。",
      "夜晚外出注意怪物，低血量先撤回安全区。",
      "发现异常地形或危险区域可以先标记坐标。"
    ]
  },
  {
    id: "commands",
    name: "指令帮助",
    description: "循环提示机器人和服务器常用指令",
    messages: [
      "输入 !help 可以查看机器人可用指令。",
      "输入 !ask 问题 可以向 AI 提问。",
      "需要机器人过来时，可以尝试 !come。",
      "需要跟随协助时，可以使用 !follow 玩家名。",
      "自动功能异常时，先关闭对应模式再重新开启。"
    ]
  },
  {
    id: "quiet",
    name: "低打扰挂机",
    description: "更像在线助手，适合低频自动发言",
    messages: [
      "我在后台待命，有需要可以叫我。",
      "服务器运行中，大家注意安全。",
      "如果发现卡顿或异常，可以先记录时间和现象。",
      "我会尽量保持在线，断线后会自动尝试恢复。",
      "有问题可以留言，我看到后会尽快响应。"
    ]
  },
  {
    id: "community",
    name: "社区氛围",
    description: "轻松一点的聊天氛围提示",
    messages: [
      "互相帮忙会让服务器更好玩。",
      "建筑和红石作品可以发坐标让大家参观。",
      "公共资源用完记得补一点，后来的人会感谢你。",
      "发现漂亮地形可以记个坐标，适合以后一起开发。",
      "今天也适合整理仓库，虽然这事总是明天再说。"
    ]
  },
  {
    id: "maintenance",
    name: "维护提醒",
    description: "适合重启、备份、续期前后的提示",
    messages: [
      "服务器可能会定期维护，重要操作前建议先保存进度。",
      "如遇短暂断线，请稍等自动恢复。",
      "维护或重启前请尽量回到安全位置。",
      "备份期间可能有轻微卡顿，请避免大量红石或跑图。",
      "如果服务长时间不可用，可以联系管理员检查。"
    ]
  }
];

export const defaultAutoChatMessages = autoChatTemplates[0].messages;

export function mergeAutoChatMessages(currentText: string, messages: string[]): string {
  const current = currentText
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);
  const seen = new Set(current);
  const merged = [...current];

  for (const message of messages) {
    if (!seen.has(message)) {
      seen.add(message);
      merged.push(message);
    }
  }

  return merged.join("\n");
}
