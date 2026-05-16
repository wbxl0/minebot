import { ChevronDown, ChevronRight, File, Folder } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface FileNode {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  description?: string;
}

const fileStructure: FileNode[] = [
  {
    name: "mc-bot",
    type: "folder",
    children: [
      { name: "index.js", type: "file", description: "入口（只做初始化）" },
      {
        name: "bot",
        type: "folder",
        children: [
          { name: "bot.js", type: "file", description: "创建 mineflayer 实例" },
          { name: "events.js", type: "file", description: "所有事件监听" },
        ],
      },
      {
        name: "commands",
        type: "folder",
        children: [
          { name: "help.js", type: "file", description: "!help" },
          { name: "come.js", type: "file", description: "!come（跟随）" },
          { name: "ask.js", type: "file", description: "!ask（AI）" },
        ],
      },
      {
        name: "ai",
        type: "folder",
        children: [
          { name: "ai.js", type: "file", description: "AI 统一接口" },
          { name: "prompt.js", type: "file", description: "人设 / 教学风格" },
        ],
      },
      {
        name: "actions",
        type: "folder",
        children: [
          { name: "move.js", type: "file", description: "行走 / 跟随" },
          { name: "look.js", type: "file", description: "看向玩家" },
        ],
      },
      {
        name: "config",
        type: "folder",
        children: [
          { name: "bot.json", type: "file", description: "服务器信息" },
          { name: "rules.json", type: "file", description: "白名单 / 权限" },
        ],
      },
      {
        name: "utils",
        type: "folder",
        children: [
          { name: "logger.js", type: "file" },
          { name: "text.js", type: "file" },
        ],
      },
    ],
  },
];

function TreeNode({ node, depth = 0 }: { node: FileNode; depth?: number }) {
  const [isOpen, setIsOpen] = useState(depth < 2);

  return (
    <div>
      <div
        className={cn(
          "group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-secondary",
          node.type === "folder" && "font-medium"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => node.type === "folder" && setIsOpen(!isOpen)}
      >
        {node.type === "folder" ? (
          <>
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <Folder className="h-4 w-4 text-gold" />
          </>
        ) : (
          <>
            <span className="w-4" />
            <File className="h-4 w-4 text-primary" />
          </>
        )}
        <span className={cn(node.type === "file" && "text-muted-foreground group-hover:text-foreground")}>
          {node.name}
        </span>
        {node.description && (
          <span className="ml-2 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            ← {node.description}
          </span>
        )}
      </div>
      
      {node.type === "folder" && isOpen && node.children && (
        <div>
          {node.children.map((child, index) => (
            <TreeNode key={index} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-4 flex items-center gap-2 px-2 text-lg font-semibold">
        <Folder className="h-5 w-5 text-primary" />
        项目结构
      </h3>
      <div className="font-mono">
        {fileStructure.map((node, index) => (
          <TreeNode key={index} node={node} />
        ))}
      </div>
      <div className="mt-4 rounded-lg bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
        👉 这是"项目级结构"，不是脚本
      </div>
    </div>
  );
}
