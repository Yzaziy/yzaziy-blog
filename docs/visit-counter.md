# 网站总访问量

使用 Cloudflare Pages Functions + D1，不依赖第三方统计脚本。

- 直接打开任意页面或刷新记一次；Astro 站内切换、预加载和静态资源请求不重复计数。
- `site_visits` 只有 `id`、`total` 两列，不保存 IP、Cookie、设备信息或逐次访问记录。Cloudflare 作为托管商仍会处理网络请求信息。
- 数字在本次打开时更新，不轮询。断网或数据库不可用时显示“暂不可用”，正文仍能正常访问；请求不会自动重试，以免重复计数。
- 这是访问次数，不是独立访客数；重复刷新及运行 JavaScript 的机器人也可能计入。关闭 JavaScript、拦截请求或中途关闭页面可能漏计。没有部署前的历史数据。
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

## 接口与限制

`GET /api/visits` 只读总数；同源 `POST /api/visits` 原子加一并返回 `{ "total": 1 }`。写入拒绝缺失或不同的 Origin，响应不缓存、不开放 CORS。Origin 校验不能阻止伪造请求的脚本，因此这不是防刷系统。

`public/_routes.json` 仅让计数接口调用 Function，其余页面和视频继续静态分发。每天几百次访问远低于免费额度，但账户内其他 Workers/Functions 共享请求额度。没有升级付费套餐。

当前整数上限是 `9,007,199,254,740,991`，到达后停止增加并返回不可用，避免 JavaScript 丢失精度。数据库和托管配额不是这个数字上限。

平台文档：[Pages Functions 路由](https://developers.cloudflare.com/pages/functions/routing/)、[D1 绑定](https://developers.cloudflare.com/pages/functions/bindings/#d1-databases)、[D1 免费额度](https://developers.cloudflare.com/d1/platform/pricing/)。
