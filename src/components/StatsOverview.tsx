import { Server, Wifi, WifiOff, Users, HardDrive } from "lucide-react";
import { StatusCard } from "./StatusCard";
import { useWebSocketContext } from "@/contexts/WebSocketContext";

interface StatsStatus {
    botList?: Array<{ players?: string[]; serverAddress?: string; serverHost?: string | null; serverPort?: number | null }>;
    players?: string[];
    connectedBots?: number;
    totalBots?: number;
}

interface StatsOverviewProps {
    status: StatsStatus | null;
    connected: boolean;
}

export function StatsOverview({ status, connected }: StatsOverviewProps) {
    const { systemStatus } = useWebSocketContext();

    const currentServerPlayers = status?.players?.length || 0;

    // 计算所有服务器的总玩家数
    const serverPlayers = new Map<string, Set<string>>();
    status?.botList?.forEach((bot, index) => {
        const key = bot.serverAddress || (bot.serverHost ? `${bot.serverHost}:${bot.serverPort || 25565}` : `bot:${index}`);
        const players = serverPlayers.get(key) || new Set<string>();
        bot.players?.forEach(player => players.add(player));
        serverPlayers.set(key, players);
    });
    const totalPlayers = serverPlayers.size > 0
        ? Array.from(serverPlayers.values()).reduce((sum, players) => sum + players.size, 0)
        : currentServerPlayers;

    // 内存状态颜色
    const memoryPercent = systemStatus ? parseFloat(systemStatus.percent) : 0;
    const memoryStatus = memoryPercent >= 60 ? "warning" : "online";

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Connection Status */}
            <StatusCard
                title="连接状态"
                value={connected ? "已连接" : "未连接"}
                description="WebSocket 实时通信"
                icon={connected ? Wifi : WifiOff}
                status={connected ? "online" : "offline"}
            />

            {/* Current Server Player Count */}
            <StatusCard
                title="当前服务器人数"
                value={`${currentServerPlayers} 人`}
                description={`${status?.connectedBots || 0} / ${status?.totalBots || 0} 个 Bot 已连接`}
                icon={Server}
                status={currentServerPlayers > 0 ? "online" : "warning"}
            />

            {/* Memory Status */}
            <StatusCard
                title="内存监测"
                value={systemStatus ? `${systemStatus.percent}%` : '-'}
                description={systemStatus ? `${systemStatus.used} / ${systemStatus.total} MB` : "获取中..."}
                icon={HardDrive}
                status={memoryStatus}
            />

            {/* Total Player Count */}
            <StatusCard
                title="在线玩家"
                value={`${totalPlayers} 人`}
                description="所有服务器总人数"
                icon={Users}
                status={totalPlayers > 0 ? "online" : "warning"}
            />
        </div>
    );
}
