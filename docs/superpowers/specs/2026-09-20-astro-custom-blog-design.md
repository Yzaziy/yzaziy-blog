# Astro 自定义个人博客系统设计规范

## 1. 项目目标
构建一个基于 Astro 的高度可自定义、轻量、高加载速度的静态个人博客与主页系统。

## 2. 技术选型
- **框架**: Astro (最新稳定版本)
- **样式方案**: Tailwind CSS + @tailwindcss/typography (文章正文排版)
- **内容管理**: Astro Content Collections (基于 TypeScript 类型约束与 Zod 校验)
- **格式支持**: Markdown (.md) / MDX (.mdx)
- **代码高亮**: Shiki (内置无需额外运行时)
- **部署平台**: 预置静态构建输出，支持 GitHub Pages / Vercel 零配置托管

## 3. 目录架构
```
D:\工程\网站
├── docs/superpowers/specs/
├── public/
│   ├── favicon.svg
│   └── avatar.png
├── src/
│   ├── components/
│   │   ├── Header.astro       # 顶部导航与 Logo
│   │   ├── Footer.astro       # 底部版权与社交链接
│   │   ├── PostCard.astro     # 首页文章卡片
│   │   └── ThemeToggle.astro  # 明暗主题切换器
│   ├── content/
│   │   ├── config.ts          # Content Collections schema 定义
│   │   └── blog/              # Markdown 文章存储库
│   │       └── hello-world.md # 初始示例文章
│   ├── layouts/
│   │   ├── BaseLayout.astro   # 通用 HTML 外层骨架
│   │   └── BlogPost.astro     # 文章详情页专有排版骨架
│   ├── pages/
│   │   ├── index.astro        # 博客首页（个人介绍 + 最新文章列表）
│   │   ├── blog/
│   │   │   └── [...slug].astro# 动态路由文章详情页
│   │   └── about.astro        # 关于我页面
│   └── styles/
│       └── global.css         # 全局样式与 Tailwind 基础指令
├── astro.config.mjs
├── package.json
├── tailwind.config.mjs
└── tsconfig.json
```

## 4. 功能设计

### 4.1 内容定义 (Schema)
在 `src/content/config.ts` 中定义文章字段：
- `title`: 字符串，必填
- `description`: 字符串，选填
- `pubDate`: 日期类型，必填
- `updatedDate`: 日期类型，选填
- `tags`: 字符串数组，选填
- `heroImage`: 文章封面图路径，选填

### 4.2 视觉与主题规范
- **色彩模式**: 支持 Light / Dark 模式无缝切换，基于 HTML class 切换，持久化在 localStorage。
- **自定义机制**: 配色与排版变量集中在 `tailwind.config.mjs`，方便一键修改主色调与字体。

### 4.3 验证与测试标准
- `npm run build` 生成完整的静态 HTML。
- 本地启动 `npm run dev` 验证首页排版、文章渲染、路由跳转与主题切换工作正常。
