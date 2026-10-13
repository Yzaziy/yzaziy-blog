# 网站总访问量

使用 Cloudflare Pages Functions + D1 计数，Cloudflare Turnstile 校验新增访问，不接入第三方统计服务。

- 打开任意页面或刷新，验证通过后记一次；同一浏览器 60 秒内不重复计数。Astro 站内切换、预加载和静态资源请求不重复计数。
- `site_visits` 仍只有 `id`、`total` 两列，不保存 IP、Cookie、设备信息或逐次访问记录。冷却 Cookie 只包含时间戳和签名，60 秒过期，不含访客 ID。Cloudflare 自身仍会处理网络及验证信息；服务端验证不提交可选的 `remoteip`。
- 先显示已有总数，再按需加载验证脚本；冷却期间不加载。验证通常在后台完成，需要交互时显示紧凑验证框；验证失败不增加计数，但保留已读总数、不阻挡正文。只有读取总数失败才显示“暂不可用”。不轮询、不自动重试。
- 这是经过基础防刷的访问次数，不是独立访客数，也不是完全防刷。清除 Cookie 可绕过冷却；首次计数前同时打开多个标签页可能各计一次。关闭 JavaScript、拦截验证或中途关闭页面可能漏计。历史数字不会清零或回溯修正。
- 生产数据库 `yzaziy-visits` 绑定为 `VISITS_DB`。本地 Wrangler 默认使用独立本地存储；预览部署不绑定生产数据库，显示“暂不可用”，防止测试污染正式计数。

## 初始化与本地验证

在项目根目录执行：

```powershell
npx.cmd wrangler@4 d1 execute yzaziy-visits --local --file migrations/0001_visits.sql
npm.cmd run check
npx.cmd wrangler@4 pages dev dist --port 4322
```

正式数据库已初始化。将来重建数据库时，先更新 `wrangler.toml` 的数据库 ID，再执行：

```powershell
npx.cmd wrangler@4 d1 execute yzaziy-visits --remote --file migrations/0001_visits.sql
```

初始化 SQL 可以重复运行，不会清零计数。Git 推送触发 Pages 部署，绑定随 `wrangler.toml` 一起生效。

## Turnstile 配置

正式 Widget 名称为 `yzaziy site visits`，Managed 模式，仅允许 `yzaziy.cn`、`yzaziy-blog.pages.dev`，不开启预放行或设备指纹功能。

Pages 生产环境已有 `TURNSTILE_SITE_KEY` 和 `TURNSTILE_SECRET_KEY` 两个加密配置；前者是公开的站点标识，后者仅供服务端验证和 Cookie 签名。密钥不得提交 Git、写入静态资源或发到聊天。更换 Widget 后通过 Wrangler Pages secrets 更新这两个配置并重新部署。

本地未配置密钥时只读本地总数、不增加；预览部署仍不绑定正式 D1。自动测试使用隔离 SQLite 和模拟的外部验证响应，不访问正式计数。`.dev.vars*`、`.wrangler/` 已加入 Git 忽略。

## 接口与限制

`GET /api/visits` 只读，返回 `total`、是否允许尝试计数的 `canCount` 和公开的 `sitekey`。

同源 `POST /api/visits` 接收 JSON `{ "token": "Turnstile 凭据" }`。先检查签名冷却 Cookie；冷却中只返回总数。其余请求必须通过 Siteverify，并匹配当前 hostname 和 `site_visit` 用途，才能原子加一、设置安全的 HttpOnly Cookie。凭据一次性，由 Cloudflare 拒绝重放。

缺失或不同的 Origin 返回 403；空/非法/超长凭据或超过 4096 字节的请求体返回 400；验证失败返回 403；服务、配置或数据库故障返回 503，均不计数。响应不缓存、不开放 CORS、不记录请求 IP。Origin 校验本身不是防刷保障。

`public/_routes.json` 仅让计数接口调用 Function，其余页面和视频继续静态分发。每天几百次访问远低于免费额度，但账户内其他 Workers/Functions 共享请求额度。没有升级付费套餐。

当前整数上限是 `9,007,199,254,740,991`，到达后停止增加并返回不可用，避免 JavaScript 丢失精度。数据库和托管配额不是这个数字上限。

平台文档：[Pages Functions 路由](https://developers.cloudflare.com/pages/functions/routing/)、[D1 绑定](https://developers.cloudflare.com/pages/functions/bindings/#d1-databases)、[D1 免费额度](https://developers.cloudflare.com/d1/platform/pricing/)。

验证文档：[服务端验证](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)、[Widget 配置](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/)。未启用按 IP 限流；若发生持续恶意刷量，可另加 Cloudflare 接口限流。
