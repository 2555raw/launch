# Launch · Emberhold（中文说明）

> English version: [README.md](./README.md)

**Emberhold** 是一款原创的、以服务器为权威的多人策略游戏，灵感来自基地建造与掠夺类游戏：建造属于你的持久化村庄、训练军队、实时掠夺真实玩家、加入部落并攀登排行榜。
**Launch** 是一个真实的代币发射台，支持 **Solana**（带链上元数据的 Token-2022 铸币）和 **Robinhood Chain**（Robinhood 基于 Arbitrum 的 L2 上的 ERC-20）。每一次发射都是由用户自己的钱包签名的交易，并在发布前由服务器在链上验证。

本仓库中的一切都是真实的：PostgreSQL 持久化、基于 Redis 的限流与锁、在服务器上模拟的 WebSocket 战斗、Ed25519 / EIP-191 钱包登录、来自 DexScreener 和区块浏览器的实时行情数据（没有数据时明确显示「暂无数据」）、Jupiter v2 兑换，以及官方的 Robinhood 加密货币交易 API。除非测试明确说明，否则没有任何模拟数据。

> 默认网络为 **Solana 主网（mainnet-beta）** 和 **Robinhood Chain 主网**。在这些网络上发射代币会消耗用户钱包中真实的 SOL / ETH。设置 `SOLANA_NETWORK=devnet` / `ROBINHOOD_CHAIN_NETWORK=testnet`（以及对应的 `NEXT_PUBLIC_*`）即可切换到测试网络。

## 界面语言

网页界面支持 **English** 和 **中文**，右上角（以及游戏 HUD 中）可随时切换；首次访问会根据浏览器语言自动选择，选择结果保存在浏览器中。

## 快速开始

```bash
git clone <本仓库> && cd launch
npm install
docker compose up -d postgres redis     # 或者把 DATABASE_URL / REDIS_URL 指向你自己的实例
npm run setup                            # 生成带随机密钥的 .env，构建、迁移数据库并写入种子数据
npm run dev                              # 网页 :3000 · API :4000 · 游戏服务器 :4100
```

打开 http://localhost:3000。种子脚本会根据 `.env` 中的 `ADMIN_EMAIL` / `ADMIN_PASSWORD` 创建管理员账号（默认 `admin@example.com` / `ChangeMe-Admin-123`）。

全部容器化运行：`docker compose --profile full up --build`。

## 第一天就能做的事

1. 用邮箱密码注册，或用 Phantom / Solflare / EVM 钱包签名登录（只签名，绝不索取助记词）。
2. 在村庄中建造、移动、升级、取消和拆除建筑；从金矿和收集器收取资源；用水晶加速。
3. 训练部队、研究升级并进攻其他玩家：匹配 → 侦察 → 通过 WebSocket 逐格部署 → 服务器计算结果、战利品、奖杯、经验和成就。
4. 创建或加入部落，实时聊天，请求和捐赠援军，管理职位。
5. 发射代币：连接钱包 → 填写项目信息 → 上传标志 → 审核 → 签署真实交易 → 服务器验证 → 带实时指标和浏览器链接的公开项目页。
6. 在「资产组合」中查看钱包与 Robinhood 加密持仓；通过 Jupiter 兑换；在「设置」中绑定官方 Robinhood 加密 API 密钥。
7. 在 `/admin` 管理一切（用户、封禁、村庄、战斗审计、部落、项目、代币、举报、配置、审计日志）。

## 仓库结构

```
apps/
  web/           Next.js 15 应用（游戏界面、发射台、钱包、资产组合、管理后台）
  api/           Fastify REST API（认证、游戏、部落、发射台、兑换、资产、Robinhood、管理）
  game-server/   WebSocket 服务器：权威战斗、部落聊天、通知
packages/
  types/         共享 DTO 与 WebSocket 协议
  config/        环境变量校验与链常量
  database/      Prisma 模型、迁移、种子
  game-engine/   纯游戏规则：建筑、部队、经济、放置、战斗模拟
  game-core/     基于 Prisma 的服务端游戏服务（api 与 game-server 共用）
  solana/        Token-2022 发射构建器、验证、余额、Jupiter v2、钱包认证
  evm/           Robinhood Chain 配置、LaunchToken.sol 及编译产物、验证
  robinhood/     RobinhoodProvider：官方加密交易 API 客户端与能力矩阵
programs/launchpad   可选的 Anchor 程序（链上发射登记）。非必需，未部署。
scripts/       开发 / 安装 / 测试脚本
docs/          架构、安装、API、WebSocket、游戏引擎、Solana、发射台、Robinhood、安全、测试、部署、主网
```

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 构建共享包（监听模式），运行 api + game-server + web |
| `npm test` | 构建包、生成 Prisma 客户端，运行全部测试（单元 + 针对 `DATABASE_URL_TEST`/Redis 的集成测试 + 只读主网检查） |
| `npm run test:devnet` | 额外运行 Solana devnet 真实铸币测试与 Robinhood Chain 测试网部署测试（需要有余额的密钥，见 docs/TESTING.md） |
| `npm run build` | 生产构建所有包与应用 |
| `npm run db:migrate` / `db:migrate:dev` / `db:seed` / `db:reset` | Prisma 迁移与种子 |
| `npm run compile:evm` | 用 solc-js 重新编译 `LaunchToken.sol` |

更多内容见 `docs/`。
