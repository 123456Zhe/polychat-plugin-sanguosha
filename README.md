# polychat-plugin-sanguosha

PolyChat 插件：把 [CLI-SanGuoSha](https://github.com/123456Zhe/Cli-SanGuoSha-online) 联机版嵌入 PolyChat——聊天室发命令建房、公告拉人、独立对局页开打。

## 玩法

1. 在任意聊天室发送命令：

   | 命令 | 效果 |
   |---|---|
   | `/sanguosha` | 4 人局（全真人，等齐 4 人开局） |
   | `/sanguosha 5` | 5 人局 |
   | `/sgs 3` | `/sanguosha` 的别名，3 人局 |

2. 插件在聊天室发一条公告（markdown 链接）。**发起者和其他玩家都从链接进入对局页**：
   - 对局页自动以你的 PolyChat 账号名入座，无需填名；
   - 同一聊天室同时只有一局；玩家数 2–6，**全部为真人座位，人齐才开局**（空位不会被 AI 代占）；
   - 对局结束**需在聊天室发送 `/sanguosha` 确认后开下一局**（对局页玩家保持连接，确认后自动进入新局）；
   - 断线自动 AI 托管（`aiDriver` 驱动），60 秒内可重连取回。

## 安装

- 目录部署：`git clone https://github.com/123456Zhe/polychat-plugin-sanguosha ~/polychat/plugins/polychat-plugin-sanguosha`，重启 PolyChat 即被自动发现；或
- npm：`npm install polychat-plugin-sanguosha`（发布后）。
- 内置打包（SEA 单文件）需把插件注册进 `modules/plugin-loader.js` 的 `BUILTIN_MODULES`。

启用开关在 `data/plugins.json`（`enabledByDefault: false`，首次部署需手动启用）：

```jsonc
{
  "plugins": {
    "sanguosha": {
      "enabled": true,
      "config": {
        "maxRooms": 3,
        "idleTimeoutMs": 1800000,
        "defaultPlayers": 4,
        "openingHandCount": 4,
        "aiDriver": "simple",
        "allowMultiSource": false,
        "chatEvents": true
      }
    }
  }
}
```

## 配置项

| 配置 | 默认 | 说明 |
|---|---|---|
| `maxRooms` | 3 | 同时进行的最多对局数 |
| `idleTimeoutMs` | 1800000 | 无玩家连接后多久回收房间（毫秒） |
| `defaultPlayers` | 4 | `/sanguosha` 缺省玩家数（全真人） |
| `openingHandCount` | 4 | 起手牌数 |
| `aiDriver` | `simple` | 断线托管 AI 驱动：`qwen` / `ollama` / `simple`（qwen 需容器内配置 `STEP_PLAN_API_KEY`，见下） |
| `allowMultiSource` | false | 同机多座位放行（原版同机单账号校验默认开启） |
| `chatEvents` | true | 建房/回收/结束/续局时向聊天室发公告 |

> qwen 驱动的 LLM 配置（与 CLI-SanGuoSha 本地一致）：`STEP_PLAN_API_KEY`（必填）、可选
> `STEP_PLAN_BASE_URL`（默认 `https://api.stepfun.com/step_plan/v1`）、`STEP_PLAN_MODEL`
> （默认 `step-3.7-flash`）。docker-compose 需把这些变量透传进 polychat 容器。

## 架构

```
PolyChat 单进程
├── GET  /api/sanguosha/         静态页（注入 __SG_WS_PATH__）
├── GET  /api/sanguosha/{app.js,style.css}
├── GET  /api/sanguosha/me       会话账号名（cookie/Bearer 鉴权）
├── WS   /api/sanguosha/ws?room=  cookie 鉴权 → WS↔TCP 双向透传（换行 JSON 协议）
└── 进程内 GameServer（127.0.0.1 随机端口，每聊天室一局）
     ├── AI 座位 / 断线托管 / 重连 / 同机校验 / 自动续局（全部复用 CLI-SanGuoSha 原逻辑）
     └── rules.md 由 rulesPath 显式指定（嵌入时 cwd 不可靠）
```

要点：

- **身份**：对局页以 PolyChat 会话账号为座位名（服务端强制替换 `join` 的 name，不信任客户端自填）；
  机器标识（同机单账号校验）沿用浏览器 localStorage，`source` 消息由插件补浏览器真实 IP。
- **协议**：完全复用 CLI-SanGuoSha 联机 TCP 协议（换行分隔 JSON，`NETWORK_PROTOCOL_VERSION`），
  浏览器客户端零逻辑改动，仅 WS 地址可配置（`window.__SG_WS_PATH__`）。
- **公告**：建房/回收消息 = 核心同款 `INSERT INTO messages` + `broadcast`，不经过改动核心消息链路。
- **vendor/**：CLI-SanGuoSha 编译产物快照（`npm run build` 的 dist 子集）+ `rules.md` + `webui/`。
  上游更新后用 `scripts/sync-vendor.sh` 重建。

## 开发

```bash
GAME_REPO=/path/to/CLI-SanGuoSha ./scripts/sync-vendor.sh   # 重建 vendor 快照
node --check index.js                                        # 语法检查
# 本地联调：把本仓库放入 ~/polychat/plugins/polychat-plugin-sanguosha 后重启 PolyChat
```

## 依赖的上游小改动

- CLI-SanGuoSha `src/network/server.ts`：`GameServerOptions.rulesPath`（显式 rules.md 路径）。
- CLI-SanGuoSha `webui/app.js`：WS 路径可配置（`window.__SG_WS_PATH__`）+ 宿主模式自动填名。
- PolyChat `server.mjs`：WS upgrade 处理器由 `/api/onebot/ws` 特判放宽为 `/api/` 前缀放行（插件自有 WS 端点）。

## License

MIT
