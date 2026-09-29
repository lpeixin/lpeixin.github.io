# lpeixin.github.io

个人主页。手写 HTML / CSS / JavaScript，没有框架，没有构建步骤，没有依赖。

线上地址：<https://lpeixin.github.io/>

---

## 目录结构

```
.
├── index.html              # 页面骨架：head、顶栏、空的 <main> 与 <footer>
├── assets/
│   ├── css/style.css       # 全部样式（含亮/暗两套设计变量）
│   ├── js/content.js       # ★ 全部内容都在这里 —— 日常只需要改这个文件
│   ├── js/main.js          # 渲染与交互逻辑，一般不用动
│   ├── favicon.svg         # 站点图标
│   ├── og-card.html        # 社交分享卡片的源文件（1200×630，不参与站点页面）
│   └── og.png              # 由 og-card.html 截出来的分享图
└── README.md
```

## 本地预览

不需要任何工具链，起个静态服务器即可（直接双击 `index.html` 也能看，但建议用服务器，行为更接近线上）：

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000
```

预览指定语言或主题，用 URL 参数覆盖：

```
http://localhost:8000/?lang=en&theme=dark
```

## 部署

推送到 `main` 分支即可，GitHub Pages 会自动发布。无需 Actions、无需产物目录。

```bash
git add -A && git commit -m "Update homepage" && git push
```

---

## 怎么更新内容

**所有内容都在 `assets/js/content.js`，一个文件。** 改完刷新页面就能看到，不用碰 HTML 和 CSS。

每个面向访客的字段都写成 `{ zh: "...", en: "..." }`，切语言时自动取对应的一段。

| 页面板块 | 在 content.js 里的位置 |
| --- | --- |
| 姓名、头像、邮箱、GitHub、所在地 | `profile` |
| 按钮文字、导航标签、页脚文案 | `ui.zh` / `ui.en` |
| 首屏标题、副标题、三个数字 | `hero` |
| 最近在做 | `now.items` |
| 代表项目（卡片） | `projects.items` |
| 更多仓库（紧凑列表） | `projects.more.items` |
| 开源参与 | `oss.items` |
| 学习笔记 | `notes.items`（现在为空，`slotCount` 控制占位槽数量） |
| 技能栈 | `skills.groups` |
| 关于本站 | `colophon.rows` |

### 新增一个代表项目

往 `projects.items` 里加一个对象：

```js
{
  name: "repo-name",
  url:  "https://github.com/lpeixin/repo-name",
  lang: "Python",          // 语言小圆点的颜色靠这个字段匹配，见 style.css 里的 .langdot
  stars: 0,                // 0 就不显示星标
  tags: ["MCP", "CLI"],    // 可省略
  desc: { zh: "中文一句话。", en: "One line in English." }
}
```

### 新增一条学习笔记

`notes.items` 现在是空数组，所以页面显示 3 个虚线占位槽。加真实条目：

```js
{
  date: "2026-10",
  title:   { zh: "笔记标题", en: "Note title" },
  summary: { zh: "可选的一句话摘要。", en: "Optional one-line summary." },
  url: "https://...",          // 站内相对路径或外部链接都行
  tags: ["MCP"]
}
```

加完之后如果还想保留占位槽，调整 `notes.slotCount`。

`colophon.rows` 的 `v` 字段允许写 HTML（源码那一行就是链接），其余字段都是纯文本、会被转义。

### 社交分享卡片

分享链接时显示的那张图是 `assets/og.png`，源文件是 `assets/og-card.html`（一个自包含的 1200×630 页面）。
改完源文件后重新截图即可：

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --screenshot=assets/og.png --window-size=1200,630 \
  --force-device-scale-factor=1 \
  file://$PWD/assets/og-card.html
```

---

## 设计说明

- **亮色默认，深色可切。** 首次访问跟随系统 `prefers-color-scheme`，手动切换后写入 `localStorage`。首屏有一段内联脚本提前设好 `data-theme`，避免刷新时闪白。
- **中英双语。** 默认跟随浏览器语言，切换后写入 `localStorage`。右上角按钮显示的是"目标语言"。
- **单一强调色。** 全站只有一个紫色强调色，靠留白和字重做层次，不靠颜色堆砌。
- **无外部请求。** 字体用系统字体栈，样式和脚本都是本地文件。唯一的外部资源是 GitHub 头像。
- **无障碍。** 有跳转链接、`:focus-visible` 焦点环、`prefers-reduced-motion` 下关闭动画、语义化标签与 `aria-current`。
- **首屏数字。** 默认是 `profile.fallbackStats` 里的静态值；页面加载后会尝试用 GitHub API 覆盖（失败就静默保留静态值）。想彻底不请求，把 `profile.liveStats` 设为 `false`。

---

## ⚠️ 需要你核对的内容

首页初版是我根据你 GitHub 上的公开信息生成的，以下几处是我**推断**出来的，发布前请过一遍：

1. **`projects.more.items` 里 `mcp-local-ebook-server` 和 `local-file-sage` 的描述。**
   这两个仓库在 GitHub 上没有写 description，页面上的说法是我从仓库名推的。
2. **`oss.items`（开源参与）。**
   依据是你账号下存在这三个 fork，措辞写得比较中性。如果实际有合并进上游的 PR，建议换成 PR 条目（`oss` 里已经留了一个占位卡片）。
3. **`skills.groups`（技能栈）。**
   完全从公开仓库里出现的技术推断，没有经过你确认，请自行增删。
4. **`notes.items`（笔记）。**
   全是占位，没有编造任何内容。
5. **邮箱 `example@mail.com` 会出现在页面上**（首屏按钮 + 页脚），可能被爬虫抓取。
   不想公开：把 `profile.email` 改成 `""`，相关按钮和链接会自动隐藏。
6. **`profile.updated`** 是手写的日期字符串，改内容时顺手更新。
7. **结构化数据（JSON-LD）** 由 `main.js` 从 `content.js` 同步生成，但 `index.html` 里还留了一份静态的初始版本给不执行 JS 的爬虫；改动 `profile` 后建议顺手把 `index.html` 头部那份也对一遍。
