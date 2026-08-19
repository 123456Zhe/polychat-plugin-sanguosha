// PolyChat 插件：三国杀联机。
//
// 玩法：在任意聊天室发送 `/sanguosha [玩家数 [AI数]]`（如 `/sanguosha` = 4人局3AI，
// `/sanguosha 5 0` = 纯玩家5人局），插件为该聊天室创建一个 host-authoritative 对局并
// 发公告（含加入链接）。点链接进入独立对局页，自动以 polychat 账号名入座。
//
// 架构：
//   - 进程内运行三国杀 GameServer（vendor/，来自 CLI-SanGuoSha 编译产物），监听
//     127.0.0.1 随机端口，复用其全部能力（AI 驱动/断线托管/重连/同机校验/自动下一局）。
//   - `GET /api/sanguosha/*` 由插件路由提供：静态页（注入 WS 路径）+ `/me`（会话账号名）。
//   - `WS /api/sanguosha/ws?room=<key>` 走 server.on('upgrade')（onebot 同款模式）：
//     cookie/Bearer 会话鉴权后，WS 消息与 TCP GameServer 双向透传（换行 JSON 协议原样复用），
//     join 名字强制替换为 polychat 账号名，source 消息补浏览器真实 IP。
//   - 聊天室公告 = 核心同款 INSERT INTO messages + broadcast，无需改动核心消息链路。
import { createConnection } from 'node:net';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

import { GameServer } from './vendor/network/server.js';
import { JsonLineParser } from './vendor/network/line-parser.js';

const PLUGIN_ROOT = dirname(fileURLToPath(import.meta.url));

// 与核心一致的会话鉴权（cookie polychat_session 或 Authorization: Bearer）。
function sessionUserOf(req, db) {
  const auth = req.headers.authorization || '';
  let token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) {
    token = Object.fromEntries(
      (req.headers.cookie || '').split(';').filter(Boolean).map((part) => {
        const idx = part.indexOf('=');
        return idx === -1 ? [part.trim(), ''] : [part.slice(0, idx).trim(), part.slice(idx + 1).trim()];
      })
    ).polychat_session || '';
  }
  if (!token) return null;
  return db.prepare(
    `SELECT users.id, users.username, users.is_admin, users.avatar_updated_at, users.banned_until, users.muted_until
     FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.token = ? AND sessions.expires_at > ?`
  ).get(token, Date.now()) || null;
}

function clientIpOf(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0]?.trim();
  return fwd || req.socket.remoteAddress || 'unknown';
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const DEFAULT_CONFIG = {
  maxRooms: 3,              // 同时进行的最多对局数
  idleTimeoutMs: 1800000,   // 无玩家连接多久后回收房间（30 分钟）
  defaultPlayers: 4,        // 命令缺省玩家数（全真人，人齐开局）
  openingHandCount: 4,
  aiDriver: 'simple',       // qwen | ollama | simple（仅用于断线托管；开局前不占 AI 座位）
  allowMultiSource: false,  // 同一台机器是否允许多个座位（原版同机单账号校验）
  chatEvents: true,         // 建房/回收/结束/续局是否向聊天室发公告
};

function staticFile(req, res, url, name) {
  const ext = name.endsWith('.html') ? '.html' : name.slice(name.lastIndexOf('.'));
  const body = readFileSync(join(PLUGIN_ROOT, 'webui', name));
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': 'no-cache' });
  res.end(body);
  return true;
}

export default {
  name: 'sanguosha',
  version: '1.1.0',
  description: '三国杀联机：聊天室命令建房（全真人，人齐开局）+ 公告拉人 + 独立对局页；对局结束真人确认后续局（断线托管由 LLM/本地策略代打）',
  enabledByDefault: false,
  defaultConfig: DEFAULT_CONFIG,
  setup(ctx) {
    const { registry, db, eventBus, server, json, requireUser, hydrateMessages, broadcast, publicBaseUrl, pluginConfig } = ctx;
    const cfg = { ...DEFAULT_CONFIG, ...pluginConfig };

    /** roomKey -> { server, port, chatRoomId, creatorId, playerCount, lastActiveAt, wsClients, gameOverNotified } */
    const rooms = new Map();
    const roomWsServers = new Map(); // roomKey -> WebSocketServer (noServer)

    // ── 聊天室公告：与核心 POST /api/rooms/:id/messages 完全一致的落库 + 广播 ──
    const MESSAGE_SELECT = `SELECT messages.id, messages.content, messages.created_at, messages.reply_to, messages.thread_root, messages.edited_at, messages.deleted_at,
      users.id AS user_id, users.username, users.avatar_updated_at, parent.content AS reply_content, parent_user.username AS reply_username,
      attachments.id AS attachment_id, attachments.original_name AS attachment_name, attachments.mime_type AS attachment_type,
      attachments.size AS attachment_size, attachments.stored_name AS attachment_stored_name
      FROM messages JOIN users ON users.id = messages.user_id
      LEFT JOIN messages AS parent ON parent.id = messages.reply_to LEFT JOIN users AS parent_user ON parent_user.id = parent.user_id
      LEFT JOIN attachments ON attachments.id = messages.attachment_id WHERE messages.id = ?`;
    function postChatMessage(chatRoomId, userId, content) {
      const result = db.prepare('INSERT INTO messages(room_id, user_id, content, attachment_id, reply_to, thread_root) VALUES (?, ?, ?, NULL, NULL, NULL)')
        .run(chatRoomId, userId, String(content).trim().slice(0, 10000));
      const row = db.prepare(MESSAGE_SELECT).get(result.lastInsertRowid);
      if (!row) return;
      const hydrated = hydrateMessages([row], userId)[0];
      broadcast({ type: 'message', room_id: chatRoomId, message_id: Number(result.lastInsertRowid), thread_root: null, message: hydrated }, chatRoomId);
    }

    // ── 建房：全真人房间（aiCount=0，人齐才开局；AI 仅断线托管用） ──
    async function createRoom(roomKey, chatRoomId, creatorId, playerCount) {
      const gameServer = new GameServer({
        host: '127.0.0.1',
        port: 0,
        playerCount,
        openingHandCount: cfg.openingHandCount,
        autoRestartAfterGameOver: false, // 下一局由真人确认后 requestRestart()
        allowMultiConnectionsPerSource: cfg.allowMultiSource,
        aiCount: 0, // 空位不由 AI 代占：直到人齐才开局
        aiDriver: cfg.aiDriver,
        rulesPath: join(PLUGIN_ROOT, 'rules.md'),
      });
      const port = await gameServer.listen();
      const room = {
        server: gameServer,
        port,
        chatRoomId,
        creatorId,
        playerCount,
        lastActiveAt: Date.now(),
        wsClients: new Set(),
        gameOverNotified: false, // 对局结束是否已向聊天室发过「确认续局」公告
      };
      rooms.set(roomKey, room);
      const link = `${publicBaseUrl}/api/sanguosha/?room=${encodeURIComponent(roomKey)}`;
      postChatMessage(chatRoomId, creatorId, `创建了三国杀${playerCount}人局（全真人，人齐开局）。[点击加入对局](${link})；其他玩家也可直接打开：${link}`);
      return room;
    }

    async function destroyRoom(roomKey, reason) {
      const room = rooms.get(roomKey);
      if (!room) return;
      rooms.delete(roomKey);
      roomWsServers.get(roomKey)?.close();
      roomWsServers.delete(roomKey);
      try { await room.server.close(); } catch { /* ignore */ }
      if (cfg.chatEvents) {
        postChatMessage(room.chatRoomId, room.creatorId, `三国杀对局已回收（${reason}），需要再玩请重新发送 /sanguosha`);
      }
    }

    // ── 聊天室命令：/sanguosha [玩家数]（全真人）；对局结束时可确认续局 ──
    const onMessageSent = ({ roomId, message, sender }) => {
      const text = String(message?.content || '').trim();
      const cmd = text.match(/^\/(?:sanguosha|sgs)(?:\s+(\d+))?/);
      if (!cmd) return;
      const roomKey = `chat-${roomId}`;
      const existing = rooms.get(roomKey);
      if (existing) {
        if (existing.server.isGameOver()) {
          // 对局已结束：真人确认后开下一局（已连接的玩家保持连接，原地无缝续玩）
          void existing.server.requestRestart().then((ok) => {
            if (ok) {
              existing.gameOverNotified = false;
              postChatMessage(roomId, sender.id, '已确认！新一局三国杀开始（对局页玩家将自动进入新局）。');
            } else {
              postChatMessage(roomId, sender.id, '对局尚未结束或正在切换中，请稍后再试。');
            }
          }).catch((error) => {
            postChatMessage(roomId, sender.id, `开启下一局失败：${error instanceof Error ? error.message : String(error)}`);
          });
          return;
        }
        postChatMessage(roomId, sender.id, `本聊天室已有一局三国杀进行中：${publicBaseUrl}/api/sanguosha/?room=${encodeURIComponent(roomKey)}`);
        return;
      }
      if (rooms.size >= cfg.maxRooms) {
        postChatMessage(roomId, sender.id, `同时进行的对局已达上限（${cfg.maxRooms}），请稍后再试`);
        return;
      }
      const playerCount = cmd[1] ? Number(cmd[1]) : cfg.defaultPlayers;
      if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 6) {
        postChatMessage(roomId, sender.id, '玩家数需为 2–6，用法：/sanguosha [玩家数]（全真人，人齐开局）');
        return;
      }
      void createRoom(roomKey, roomId, sender.id, playerCount).catch((error) => {
        postChatMessage(roomId, sender.id, `创建对局失败：${error instanceof Error ? error.message : String(error)}`);
      });
    };
    eventBus.on('message:sent', onMessageSent);

    // ── 静态页 / 身份端点 ──
    registry.registerApiRoute('GET', /^\/api\/sanguosha\//, (req, res, url) => {
      const tail = url.pathname.slice('/api/sanguosha/'.length);
      if (tail === 'me') {
        const user = requireUser(req, res);
        if (!user) return;
        return json(res, 200, { username: user.username });
      }
      if (tail === '' || tail === 'index.html') {
        const body = readFileSync(join(PLUGIN_ROOT, 'webui', 'index.html'), 'utf8');
        // 注入 WS 路径：页面带 ?room= 用该房间；缺省且只有一个房间时直接进；否则让客户端报错提示。
        let wsPath = '/api/sanguosha/ws';
        const roomParam = url.searchParams.get('room');
        if (roomParam && rooms.has(roomParam)) wsPath = `/api/sanguosha/ws?room=${encodeURIComponent(roomParam)}`;
        else if (!roomParam && rooms.size === 1) wsPath = `/api/sanguosha/ws?room=${encodeURIComponent([...rooms.keys()][0])}`;
        const html = body.replace('</head>', `<script>window.__SG_WS_PATH__ = ${JSON.stringify(wsPath)};</script></head>`);
        res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-cache' });
        res.end(html);
        return;
      }
      if (tail === 'app.js' || tail === 'style.css') {
        return staticFile(req, res, url, tail);
      }
      // 新版 webui 资产：assets/index-*.js / assets/index-*.css
      if (tail.startsWith('assets/')) {
        const assetName = tail.slice('assets/'.length);
        if (/^index-[\w-]+\.(js|css)$/.test(assetName)) {
          return staticFile(req, res, url, `assets/${assetName}`);
        }
      }
      return json(res, 404, { error: '页面不存在' });
    });

    // ── WS 端点：/api/sanguosha/ws?room=<key>（onebot 同款 upgrade 模式） ──
    const onUpgrade = (req, socket, head) => {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      if (url.pathname !== '/api/sanguosha/ws') return;
      const user = sessionUserOf(req, db);
      if (!user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
        return socket.destroy();
      }
      const roomKey = url.searchParams.get('room') || '';
      const room = rooms.get(roomKey);
      if (!room) {
        socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
        return socket.destroy();
      }
      const wss = roomWsServers.get(roomKey) ?? (roomWsServers.set(roomKey, new WebSocketServer({ noServer: true })), roomWsServers.get(roomKey));
      const ip = clientIpOf(req);
      wss.handleUpgrade(req, socket, head, (ws) => {
        room.wsClients.add(ws);
        room.lastActiveAt = Date.now();
        ws.on('close', () => { room.wsClients.delete(ws); });
        pipeToGame(ws, room, user, ip);
      });
    };
    server.on('upgrade', onUpgrade);

    // 消息透传：WS <-> TCP GameServer（换行 JSON 协议原样复用，join 名强制绑定账号，source 补 IP）。
    function pipeToGame(ws, room, user, ip) {
      const tcp = createConnection({ host: '127.0.0.1', port: room.port });
      const parser = new JsonLineParser();
      let tcpReady = false;
      const pending = [];
      const flush = () => {
        while (tcpReady && pending.length > 0 && !tcp.destroyed) {
          const text = pending.shift();
          if (text !== undefined) tcp.write(`${text}\n`);
        }
      };
      tcp.setEncoding('utf8');
      tcp.on('connect', () => { tcpReady = true; flush(); });
      tcp.on('data', (chunk) => { for (const msg of parser.push(chunk)) ws.send(JSON.stringify(msg)); });
      tcp.on('error', () => ws.close());
      tcp.on('close', () => ws.close());
      ws.on('message', (raw) => {
        let payload = String(raw);
        try {
          const parsed = JSON.parse(payload);
          if (parsed?.type === 'source') {
            payload = JSON.stringify({ type: 'source', ip, machineId: String(parsed.machineId ?? '') });
          } else if (parsed?.type === 'join') {
            // 自动绑定 polychat 账号：不信任客户端自填名
            payload = JSON.stringify({ type: 'join', name: user.username, version: Number(parsed.version ?? 4) });
          }
        } catch { /* 非 JSON 原样转发 */ }
        pending.push(payload);
        flush();
      });
      ws.on('close', () => tcp.destroy());
      ws.on('error', () => tcp.destroy());
    }

    // 心跳：WS 心跳 + 空闲房间回收 + 对局结束检测（轮询 GameServer 状态，全玩家掉线也能发现）
    registry.registerHeartbeat(() => {
      for (const [key, room] of rooms) {
        for (const ws of room.wsClients) {
          if (ws.isAlive === false) { ws.terminate(); room.wsClients.delete(ws); continue; }
          ws.isAlive = false;
          ws.ping();
        }
        // 对局结束 → 公告「确认续局」（只公告一次；续局/新开局后复位）
        const result = room.server.getGameResult();
        if (result && !room.gameOverNotified) {
          room.gameOverNotified = true;
          if (cfg.chatEvents) {
            postChatMessage(room.chatRoomId, room.creatorId, `${result.message} 发送 /sanguosha 确认开下一局（对局页玩家保持连接，确认后自动进入新局）。`);
          }
        } else if (!result && room.gameOverNotified) {
          room.gameOverNotified = false;
        }
        const now = Date.now();
        if (room.wsClients.size === 0 && now - room.lastActiveAt > cfg.idleTimeoutMs) {
          void destroyRoom(key, '长时间无人加入');
        }
      }
    });
    for (const wss of roomWsServers.values()) {
      wss.on('connection', (ws) => { ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; }); });
    }

    return () => {
      eventBus.off('message:sent', onMessageSent);
      server.off('upgrade', onUpgrade);
      for (const key of [...rooms.keys()]) void destroyRoom(key, '插件停用');
    };
  },
};
