# 项目长期维护与协作规范 (YZAZIY BLOG RULES)

## 核心规则：文章与首页同步更新 (强制)
每当新增、修改或发布任何教程、板块或文章内容（包括但不限于“嵌入式入门”各个段位、单片机模块、AI 教程等）：
1. **必须在 `src/content/blog/` 中同步注册/更新对应的文章条目**（例如 `.md` 文件，包含完整的 `title`、`description`、`pubDate`，若有定制交互页面则配置 `customUrl`）。
2. 首页 (`src/pages/index.astro`) 通过 Astro Content Collections 自动按发布日期倒序展示**最新文章**。
3. 任何文章上线前，必须执行 `npm run build` 确保无类型错误，并确认首页与详情页皆可正常访问。

## 设计规范
- 样式：Tailwind CSS，严格适配浅色 (Light) 与深色 (Dark) 主题。
- 侧边栏：多级层级结构统一由 `src/data/sidebar.ts` 驱动。

