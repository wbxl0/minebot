import { normalizeServerEndpoint } from '../utils/endpoint.js';

const MINECRAFT_USERNAME_REGEX = /^[a-zA-Z0-9_]{3,16}$/;

function normalizeMinecraftUsername(value) {
  if (value === undefined || value === null) return undefined;
  return String(value).trim();
}

function validateMinecraftUsername(username) {
  if (username === undefined || username === '') return null;
  if (MINECRAFT_USERNAME_REGEX.test(username)) return null;
  return 'Username must be 3-16 characters and contain only letters, numbers, and underscores';
}

export function registerBotRoutes(app, {
  botManager,
  configManager,
  agentRegistry,
  agentGateway,
  generateAgentCredentials
}) {
  // ===== Multi-Server APIs =====

  // Get all bots status
  app.get('/api/bots', (req, res) => {
    const statuses = botManager.getAllStatus();
    const enriched = {};
    Object.entries(statuses).forEach(([id, status]) => {
      const agentId = status?.agentId;
      const agentStatus = agentId ? agentGateway.getStatus(agentId) : null;
      enriched[id] = { ...status, agentStatus };
    });
    res.json(enriched);
  });

  // Add new server
  app.post('/api/bots/add', async (req, res) => {
    try {
      const requestConfig = { ...(req.body || {}) };
      if ((requestConfig.type || 'minecraft') === 'minecraft') {
        const endpoint = normalizeServerEndpoint(requestConfig.host, requestConfig.port, { allowUndefinedPort: true });
        requestConfig.host = endpoint.host;
        requestConfig.port = endpoint.port || 0;
      }
      const normalizedUsername = normalizeMinecraftUsername(requestConfig.username);
      const usernameError = validateMinecraftUsername(normalizedUsername);
      if (usernameError) {
        return res.status(400).json({ success: false, error: usernameError });
      }
      if (normalizedUsername !== undefined) {
        requestConfig.username = normalizedUsername;
      }

      let serverConfig;
      let created = false;
      let agentPayload = null;
      try {
        serverConfig = configManager.addServer(requestConfig);
        created = true;
      } catch (e) {
        const servers = configManager.getServers();
        serverConfig = servers.find(s => s.id === requestConfig.id) || requestConfig;
      }

      if (created && !serverConfig.agentId) {
        const generated = generateAgentCredentials();
        configManager.updateServer(serverConfig.id, { agentId: generated.agentId });
        agentRegistry.upsert({ agentId: generated.agentId, token: generated.token, name: generated.agentId });
        agentPayload = generated;
        serverConfig = { ...serverConfig, agentId: generated.agentId };
      }
      const result = await botManager.addServer(serverConfig);
      res.json({ success: true, ...result, agent: agentPayload });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Remove server
  app.delete('/api/bots/:id', (req, res) => {
    try {
      const success = botManager.removeServer(req.params.id);
      configManager.removeServer(req.params.id);
      res.json({ success });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Reorder servers
  app.post('/api/bots/reorder', (req, res) => {
    try {
      const { orderedIds } = req.body;
      if (!Array.isArray(orderedIds)) {
        return res.status(400).json({ success: false, error: 'orderedIds must be an array' });
      }
      const success = configManager.reorderServers(orderedIds);
      res.json({ success });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Update server config (name, username, host, port)
  app.put('/api/bots/:id', async (req, res) => {
    try {
      const body = req.body || {};
      const { name, host, port } = body;
      const username = normalizeMinecraftUsername(body.username);
      const id = req.params.id;

      const usernameError = validateMinecraftUsername(username);
      if (usernameError) {
        return res.status(400).json({ success: false, error: usernameError });
      }

      const updates = {};
      if (name !== undefined) updates.name = name;
      if (username !== undefined) updates.username = username;
      if (host !== undefined) {
        const endpoint = normalizeServerEndpoint(host, port, { allowUndefinedPort: true });
        updates.host = endpoint.host;
        updates.port = endpoint.port || 0;
      } else if (port !== undefined) {
        updates.port = parseInt(port);
      }
      if (body.proxyNodeId !== undefined) updates.proxyNodeId = body.proxyNodeId;
      if (body.autoReconnect !== undefined) updates.autoReconnect = !!body.autoReconnect;

      const updatedConfig = configManager.updateServer(id, updates);

      const bot = botManager.bots.get(id);
      if (bot) {
        if (typeof bot.updateConfig === 'function') {
          bot.updateConfig(updates);
        } else {
          if (name !== undefined) {
            bot.status.serverName = name;
            bot.config.name = name;
          }
          if (username !== undefined) {
            bot.config.username = username;
            if (!bot.status.connected) {
              bot.status.username = username;
            }
          }
          if (updates.host !== undefined) bot.config.host = updates.host;
          if (updates.port !== undefined) bot.config.port = updates.port;

          if (body.proxyNodeId !== undefined) bot.config.proxyNodeId = body.proxyNodeId;
          if (body.autoReconnect !== undefined) {
            bot.status.autoReconnect = !!body.autoReconnect;
            bot.config.autoReconnect = !!body.autoReconnect;
          }
        }

        if ((host !== undefined || port !== undefined) && bot.refreshStatusCheck) {
          bot.refreshStatusCheck();
        }
      }

      res.json({ success: true, config: updatedConfig });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // 切换服务器类型（机器人 <-> 仅面板）
  app.post('/api/bots/:id/switch-type', async (req, res) => {
    try {
      const id = req.params.id;
      const { type } = req.body;

      if (!['minecraft', 'panel'].includes(type)) {
        return res.status(400).json({ success: false, error: '无效的类型，只能是 minecraft 或 panel' });
      }

      const bot = botManager.bots.get(id);
      if (!bot) {
        return res.status(404).json({ success: false, error: '服务器不存在' });
      }

      const currentType = bot.status.type || 'minecraft';
      if (currentType === type) {
        return res.json({ success: true, message: '类型未改变' });
      }

      const serverConfig = configManager.getServer(id);
      if (!serverConfig) {
        return res.status(404).json({ success: false, error: '服务器配置不存在' });
      }

      if (bot.disconnect) {
        bot.disconnect();
      }
      if (bot.cleanup) {
        bot.cleanup();
      }

      const updatedConfig = configManager.updateServer(id, { type });

      botManager.bots.delete(id);

      const newInstance = botManager.createInstance({ ...serverConfig, ...updatedConfig, id });
      botManager.bots.set(id, newInstance);

      if (type === 'panel') {
        newInstance.connect().catch(err => {
          console.log(`切换后连接失败: ${err.message}`);
        });
      }

      res.json({ success: true, message: `已切换为 ${type === 'panel' ? '仅面板管理' : '机器人'} 模式`, type });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/api/bots/connect-all', async (req, res) => {
    try {
      const results = await botManager.connectAll();
      res.json({ success: true, results });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/api/bots/disconnect-all', (req, res) => {
    try {
      botManager.disconnectAll();
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/api/bots/:id/restart', async (req, res) => {
    try {
      const status = await botManager.restart(req.params.id);
      res.json({ success: true, status });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // ===== Behavior Control APIs =====
  app.post('/api/bots/:id/behavior', async (req, res) => {
    try {
      const { behavior, enabled, options } = req.body;
      const bot = botManager.bots.get(req.params.id);
      if (!bot) {
        return res.status(404).json({ success: false, error: 'Bot not found' });
      }
      const result = await bot.setBehavior(behavior, enabled, options || {});
      res.json({ success: result.success, message: result.message, status: bot.getStatus() });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/api/bots/:id/action', (req, res) => {
    try {
      const { action, params } = req.body;
      const bot = botManager.bots.get(req.params.id);
      if (!bot) {
        return res.status(404).json({ success: false, error: 'Bot not found' });
      }
      const result = bot.doAction(action, params || {});
      res.json({ success: result.success, message: result.message });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/api/bots/:id/stop-all', (req, res) => {
    try {
      const bot = botManager.bots.get(req.params.id);
      if (!bot) {
        return res.status(404).json({ success: false, error: 'Bot not found' });
      }
      if (bot.behaviors) {
        bot.behaviors.stopAll();
        bot.modes.follow = false;
        bot.modes.autoAttack = false;
        bot.modes.patrol = false;
        bot.modes.mining = false;
        bot.modes.antiAfk = false;
        bot.modes.autoEat = false;
        bot.modes.guard = false;
        bot.modes.fishing = false;
        bot.modes.rateLimit = false;
        bot.modes.humanize = false;
        bot.modes.safeIdle = false;
        bot.modes.workflow = false;
      }
      res.json({ success: true, status: bot.getStatus() });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.get('/api/bots/:id/behaviors', (req, res) => {
    try {
      const bot = botManager.bots.get(req.params.id);
      if (!bot) {
        return res.status(404).json({ success: false, error: 'Bot not found' });
      }
      res.json({
        modes: bot.modes,
        behaviors: bot.behaviors?.getStatus() || null
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/api/bots/:id/restart-timer', (req, res) => {
    try {
      const bot = botManager.bots.get(req.params.id);
      if (!bot) {
        return res.status(404).json({ success: false, error: 'Bot not found' });
      }
      const { minutes } = req.body;
      const result = bot.setRestartTimer(minutes || 0);
      res.json({ success: true, restartTimer: result });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/api/bots/:id/behavior-settings', (req, res) => {
    try {
      const bot = botManager.bots.get(req.params.id);
      if (!bot) {
        return res.status(404).json({ success: false, error: 'Bot not found' });
      }
      if (typeof bot.updateBehaviorSettings !== 'function') {
        return res.status(400).json({ success: false, error: 'Bot does not support behavior settings' });
      }
      const result = bot.updateBehaviorSettings(req.body || {});
      res.json({ success: true, behaviorSettings: result });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/api/bots/:id/command-settings', (req, res) => {
    try {
      const bot = botManager.bots.get(req.params.id);
      if (!bot) {
        return res.status(404).json({ success: false, error: 'Bot not found' });
      }
      if (typeof bot.updateCommandSettings !== 'function') {
        return res.status(400).json({ success: false, error: 'Bot does not support command settings' });
      }
      const result = bot.updateCommandSettings(req.body || {});
      res.json({ success: true, commandSettings: result });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/api/bots/:id/restart-command', (req, res) => {
    try {
      const bot = botManager.bots.get(req.params.id);
      if (!bot) {
        return res.status(404).json({ success: false, error: 'Bot not found' });
      }
      const result = bot.sendRestartCommand();
      res.json(result);
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/api/bots/:id/mode', async (req, res) => {
    try {
      const bot = botManager.bots.get(req.params.id);
      if (!bot) {
        return res.status(404).json({ success: false, error: 'Bot not found' });
      }
      const { mode, enabled } = req.body;
      const result = await bot.setMode(mode, enabled);
      res.json({
        success: result?.success !== false,
        message: result?.message,
        modes: bot.modes,
        status: bot.getStatus()
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/api/bots/:id/pterodactyl', (req, res) => {
    try {
      const bot = botManager.bots.get(req.params.id);
      if (!bot) {
        return res.status(404).json({ success: false, error: 'Bot not found' });
      }
      const result = bot.setPterodactylConfig(req.body);
      res.json({ success: true, pterodactyl: result });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/api/bots/:id/sftp', (req, res) => {
    try {
      const bot = botManager.bots.get(req.params.id);
      if (!bot) {
        return res.status(404).json({ success: false, error: 'Bot not found' });
      }
      const result = bot.setSftpConfig(req.body);
      res.json({ success: true, sftp: result });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/api/bots/:id/rcon', (req, res) => {
    try {
      const bot = botManager.bots.get(req.params.id);
      if (!bot) {
        return res.status(404).json({ success: false, error: 'Bot not found' });
      }
      const result = bot.setRconConfig(req.body || {});
      res.json({ success: true, rcon: result });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/api/bots/:id/agent-binding', (req, res) => {
    try {
      const bot = botManager.bots.get(req.params.id);
      if (!bot) {
        return res.status(404).json({ success: false, error: 'Bot not found' });
      }
      const { agentId } = req.body || {};
      const result = bot.setAgentId(agentId || null);
      res.json({ success: true, agentId: result });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/api/bots/:id/agent-reset', (req, res) => {
    try {
      const bot = botManager.bots.get(req.params.id);
      if (!bot) {
        return res.status(404).json({ success: false, error: 'Bot not found' });
      }

      const oldAgentId = bot.status.agentId;
      if (oldAgentId) {
        agentRegistry.remove(oldAgentId);
      }

      const generated = generateAgentCredentials();
      configManager.updateServer(bot.id, { agentId: generated.agentId });
      agentRegistry.upsert({ agentId: generated.agentId, token: generated.token, name: bot.status.serverName || generated.agentId });
      if (typeof bot.setAgentId === 'function') {
        bot.setAgentId(generated.agentId);
      } else {
        bot.status.agentId = generated.agentId;
      }

      res.json({ success: true, agentId: generated.agentId, token: generated.token });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/api/bots/:id/rcon-test', async (req, res) => {
    try {
      const bot = botManager.bots.get(req.params.id);
      if (!bot) {
        return res.status(404).json({ success: false, error: 'Bot not found' });
      }
      const result = await bot.testRconConnection();
      res.json(result);
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/api/bots/:id/auto-op', async (req, res) => {
    try {
      const bot = botManager.bots.get(req.params.id);
      if (!bot) {
        return res.status(404).json({ success: false, error: 'Bot not found' });
      }
      await bot.autoOpSelf();
      res.json({ success: true, message: `已尝试给 ${bot.status.username} OP权限` });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.get('/api/bots/:id/logs', (req, res) => {
    try {
      const bot = botManager.bots.get(req.params.id);
      if (!bot) {
        return res.status(404).json({ success: false, error: 'Bot not found' });
      }
      res.json({ success: true, logs: bot.getLogs() });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.delete('/api/bots/:id/logs', (req, res) => {
    try {
      const bot = botManager.bots.get(req.params.id);
      if (!bot) {
        return res.status(404).json({ success: false, error: 'Bot not found' });
      }
      bot.clearLogs();
      res.json({ success: true, message: '日志已清空' });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/api/bots/:id/auto-chat', async (req, res) => {
    try {
      const bot = botManager.bots.get(req.params.id);
      if (!bot) {
        return res.status(404).json({ success: false, error: 'Bot not found' });
      }
      const { enabled, interval, messages } = req.body;
      const config = {};
      if (enabled !== undefined) config.enabled = enabled;
      if (interval !== undefined) config.interval = interval;
      if (messages !== undefined) config.messages = messages;

      const result = bot.updateAutoChatConfig(config);

      if (enabled !== undefined) {
        await bot.setMode('autoChat', enabled);
      }

      res.json({ success: true, autoChat: result, status: bot.getStatus() });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.get('/api/bots/:id/config', (req, res) => {
    try {
      const bot = botManager.bots.get(req.params.id);
      if (!bot) {
        return res.status(404).json({ success: false, error: 'Bot not found' });
      }
      if (!bot.status.agentId) {
        const generated = generateAgentCredentials();
        configManager.updateServer(bot.id, { agentId: generated.agentId });
        agentRegistry.upsert({ agentId: generated.agentId, token: generated.token, name: bot.status.serverName || generated.agentId });
        if (typeof bot.setAgentId === 'function') {
          bot.setAgentId(generated.agentId);
        } else {
          bot.status.agentId = generated.agentId;
        }
      }
      const agentToken = bot.status.agentId
        ? agentRegistry.get(bot.status.agentId)?.token || null
        : null;
      res.json({
        success: true,
        config: {
          id: bot.id,
          name: bot.status.serverName,
          modes: bot.modes,
          autoChat: bot.autoChatConfig,
          restartTimer: bot.status.restartTimer,
          pterodactyl: bot.status.pterodactyl,
          rcon: bot.status.rcon,
          sftp: bot.status.sftp,
          fileAccessType: bot.status.fileAccessType,
          autoOp: bot.status.autoOp,
          agentId: bot.status.agentId,
          agentToken,
          behaviorSettings: bot.behaviorSettings || null,
          commandSettings: bot.commandSettings || null
        }
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });
}
