/* ============================================================================
 * content.js — Site content (the only file that needs to be maintained)
 * ----------------------------------------------------------------------------
 * Rules:
 *   1. All text facing visitors should be written as { zh: "...", en: "..." } two segments, and the language switcher will automatically take care of it.
 *   2. To add a new project / note, just add an object to the corresponding array,
 *      and the page will render it automatically, no need to touch HTML and CSS.
 * 规则：
 *   1. 所有面向访客的文字都写成 { zh: "...", en: "..." } 两段，切换语言时自动取用。
 *   2. 想新增一个项目 / 一条笔记，就是往对应数组里加一个对象，
 *      页面会自动渲染，不需要动 HTML 和 CSS。
 * ========================================================================== */

window.SITE = {

  /* ──────────────────────────────────────────────────────────────────────────
   * personal profile —— update here will affect the header, footer and SEO structured data
   * ──────────────────────────────────────────────────────────────────────── */
  profile: {
    name:      "Peixin Liu",
    handle:    "lpeixin",
    initials:  "PL",
    email:     "",   // if you want to hide your email, change it to "" and the button will be hidden automatically
    github:    "https://github.com/lpeixin",
    avatar:    "https://avatars.githubusercontent.com/u/1281563?v=4",
    since:     "2011",                      // joined GitHub in the year
    location:  { zh: "加拿大", en: "Canada" }, // location
    updated:   "2026-09-28",                // last updated date, update it when making changes

    /* 首屏三个数字。开着 liveStats 时，页面加载后会尝试用 GitHub API 覆盖前两个；
       请求失败（限流 / 离线）就静静保留下面的兜底值，不会报错也不会留空。 */
    liveStats:     true,
    fallbackStats: { repos: 24, followers: 14 }
  },

  /* ──────────────────────────────────────────────────────────────────────────
   * interface copy —— buttons, nav, footer etc
   * ──────────────────────────────────────────────────────────────────────── */
  ui: {
    zh: {
      brandSub:     "软件工程师 / AI Agent",
      nav: [
        { id: "now",      label: "最近在做" },
        { id: "projects", label: "项目" },
        { id: "oss",      label: "开源" },
        { id: "notes",    label: "笔记" },
        { id: "skills",   label: "技能" },
        { id: "contact",  label: "联系" }
      ],
      btnGithub:    "GitHub",
      btnEmail:     "邮件联系",
      btnProjects:  "看项目",
      copied:       "邮箱已复制到剪贴板",
      copyLabel:    "复制邮箱",
      moreRepos:    "更多仓库",
      moreReposAlt: "More repositories",
      seeAll:       "在 GitHub 上查看全部 {n} 个公开仓库",
      ossNote:      "GitHub Pull Shark ×2 —— 有已合并进上游的 Pull Request。",
      slotLabel:    "继续添加",
      slotHint:     "下一步：在 content.js 的 notes.items 里加一条，并复制 notes/fde/ 目录建新子页面。",
      notesCountUnit: "篇文档",
      slotPrTitle:  "已合并的 PR",
      slotPrDesc:   "把你提交并被合并的 Pull Request 链接补充在这里。",
      builtWith:    "手写 HTML / CSS / JavaScript",
      rights:       "保留所有权利",
      backTop:      "回到顶部"
    },
    en: {
      brandSub:     "Software Engineer / AI Agents",
      nav: [
        { id: "now",      label: "Now" },
        { id: "projects", label: "Work" },
        { id: "oss",      label: "Open Source" },
        { id: "notes",    label: "Notes" },
        { id: "skills",   label: "Skills" },
        { id: "contact",  label: "Contact" }
      ],
      btnGithub:    "GitHub",
      btnEmail:     "Email me",
      btnProjects:  "View work",
      copied:       "Email copied to clipboard",
      copyLabel:    "Copy email address",
      moreRepos:    "More repositories",
      moreReposAlt: "更多仓库",
      seeAll:       "See all {n} public repositories on GitHub",
      ossNote:      "GitHub Pull Shark ×2 — pull requests merged upstream.",
      slotLabel:    "Add more",
      slotHint:     "Next: add an entry to notes.items in content.js and copy the notes/fde/ folder to create a new sub-page.",
      notesCountUnit: "docs",
      slotPrTitle:  "Merged pull requests",
      slotPrDesc:   "Drop links to the pull requests you submitted and got merged.",
      builtWith:    "Hand-written HTML / CSS / JavaScript",
      rights:       "All rights reserved",
      backTop:      "Back to top"
    }
  },

  /* ──────────────────────────────────────────────────────────────────────────
   * hero section —— the big headline and stats
   * ──────────────────────────────────────────────────────────────────────── */
  hero: {
    kicker: { zh: "软件工程师 · AI Agent 开发者", en: "Software Engineer · AI Agent Developer" },
    headline: {
      zh: "把大模型接进真实的工作流里。",
      en: "Putting LLMs to work in real workflows."
    },
    sub: {
      zh: "专注探索 AI Agent 技术栈与应用开发，关注 Agent 架构、MCP、Agent Skills 等方向。也喜欢 Vibe Coding，通过 AI 快速把想法变成有趣的工具和产品，并不断迭代、打磨，让它们变得越来越好用。",
      en: "Exploring AI agents through hands-on development, with a focus on agent architectures, MCP, Agent Skills, and the tooling around them. I also enjoy vibe coding — turning ideas into interesting tools and products with AI, then continuously iterating on them to make them more useful and enjoyable."
    },
    status: { zh: "开放远程协作与技术交流", en: "Open to remote collaboration" },
    stats: [
      { key: "repos",     label: { zh: "GitHub 公开仓库", en: "Public repositories" } },
      /* { key: "followers", label: { zh: "GitHub Followers", en: "GitHub followers" } },*/
      { value: "2011",    label: { zh: "开始使用 GitHub", en: "On GitHub since" } } 
    ]
  },

  /* ──────────────────────────────────────────────────────────────────────────
   * recent work —— cards. Pick 4-6 projects that best represent you, the rest go in more
   * ──────────────────────────────────────────────────────────────────────── */
  now: {
    title: { zh: "最近在做", en: "Now" },
    lede: {
      zh: "近期个人项目。",
      en: "Recent personal projects."
    },
    items: [
      {
        tag: "Shipping",
        title: "StockMCPilot",
        desc: {
          zh: "面向美股、港股和 A 股市场的本地优先 AI 辅助股票研究桌面应用，提供交互式图表、财务数据、新闻，以及本地/云端 LLM 分析。",
          en: "Local-first AI-assisted stock research desktop app for US, HK, and A-share markets, with interactive charts, financial data, news, and local/cloud LLM analysis."
        }
      },
      {
        tag: "Building",
        title: "KnowMemo",
        desc: {
          zh: "面向个人对话与知识的私有 AI 记忆系统——数据留在本地，记忆可以被检索、被追溯。",
          en: "A private AI memory system for conversations and personal knowledge. Data stays local, memories stay searchable and traceable."
        }
      },
      {
        tag: "Exploring",
        title: "Agent Skills",
        desc: {
          zh: "把 EPUB 解析、本地电子书检索这类能力封装成符合 Agent Skills 规范的模块，让 Agent 按需装载，而不是把什么都塞进上下文。",
          en: "Packaging capabilities like EPUB parsing and local ebook retrieval into Agent Skills–compliant modules, so agents load them on demand instead of stuffing everything into context."
        }
      }
    ]
  },

  /* ──────────────────────────────────────────────────────────────────────────
   * selected work —— cards. Pick 4-6 projects that best represent you, the rest go in more
   * ──────────────────────────────────────────────────────────────────────── */
  projects: {
    title: { zh: "代表项目", en: "Selected Work" },
    lede: {
      zh: "挑出来的一部分。写代码的偏好在这里能看出来：本地优先、接口干净、能长期跑。",
      en: "A subset. My defaults are visible here: local-first, clean interfaces, built to keep running."
    },
    items: [
      {
        name: "stock-mcpilot",
        url:  "https://github.com/lpeixin/stock-mcpilot",
        lang: "Python",
        stars: 0,
        tags: ["Tauri 2", "React", "TypeScript", "FastAPI", "Multi-Provider AI", "SQLite"],
        desc: {
          zh: "面向美股、港股和 A 股市场的本地优先 AI 辅助股票研究桌面应用，提供交互式图表、财务数据、新闻，以及本地/云端 LLM 分析。",
          en: "Local-first AI-assisted stock research desktop app for US, HK, and A-share markets, with interactive charts, financial data, news, and local/cloud LLM analysis."
        }
      },
      {
        name: "app-pocket",
        url:  "https://github.com/lpeixin/app-pocket",
        lang: "Swift",
        stars: 1,
        tags: ["SwiftUI", "macOS"],
        desc: {
          zh: "macOS 上的高密度 SwiftUI 启动器：智能分类、拖拽整理与实时应用监控。",
          en: "A fast, high-density SwiftUI launcher for macOS with smart categories, drag-and-drop and live app monitoring."
        }
      },
      {
        name: "knowmemo",
        url:  "https://github.com/lpeixin/knowmemo",
        lang: "Python",
        stars: 0,
        tags: ["RAG", "Local-first", "Memory"],
        desc: {
          zh: "私有的 AI 记忆系统，为你自己的对话与个人知识建立可检索的记忆层。",
          en: "A private AI memory system for your conversations and personal knowledge."
        }
      },
      {
        name: "cats-perilous-adventure",
        url:  "https://github.com/lpeixin/cats-perilous-adventure",
        lang: "JavaScript",
        stars: 0,
        tags: ["Phaser 3", "Game"],
        desc: {
          zh: "一个刁钻的横版平台跳跃游戏：看似踏实的地面处处是陷阱，会塌的假平台和不讲道理的设计。基于 Phaser 3。",
          en: "A devilishly tricky platformer where nothing is as it seems — hidden traps, fake platforms and cruel surprises. Built with Phaser 3."
        }
      },
      {
        name: "epub-agent-skill",
        url:  "https://github.com/lpeixin/epub-agent-skill",
        lang: "Python",
        stars: 0,
        tags: ["Agent Skills", "LLM Pipeline"],
        desc: {
          zh: "符合 Agent Skills 规范的模块：用可扩展的 LLM 流水线从 EPUB 中抽取结构化大纲与章节摘要。",
          en: "An Agent Skills–compliant module that extracts structured outlines and chapter summaries from EPUB books using scalable LLM-driven pipelines."
        }
      },
      {
        name: "market-anomaly-agent",
        url:  "https://github.com/lpeixin/market-anomaly-agent",
        lang: "Java",
        stars: 0,
        tags: ["Agent", "Quant"],
        desc: {
          zh: "AI 驱动的市场异动检测 Agent：识别异常模式，并给出可执行的交易洞察。",
          en: "An AI-powered market anomaly detection agent that spots unusual patterns and turns them into actionable trading insight."
        }
      }
    ],

    /* more repositories */
    more: {
      title: { zh: "更多仓库", en: "More repositories" },
      items: [
        {
          name: "stock-k-line-prediction", url: "https://github.com/lpeixin/stock-k-line-prediction",
          lang: "Python", stars: 2,
          desc: { zh: "基于 K 线历史、由 Kronos 模型驱动的股价预测工具。",
                  en: "Tools for stock price prediction based on k-line history, powered by Kronos models." }
        },
        {
          name: "image-toolbox", url: "https://github.com/lpeixin/image-toolbox",
          lang: "Python", stars: 0,
          desc: { zh: "图像处理、格式转换、压缩优化与自动化脚本合集。",
                  en: "Scripts and utilities for image processing, conversion, optimization and automation." }
        },
        {
          name: "batch-file-renamer", url: "https://github.com/lpeixin/batch-file-renamer",
          lang: "Python", stars: 0,
          desc: { zh: "按自定义规则批量重命名文件的轻量脚本。",
                  en: "A lightweight script for batch renaming files using customizable rules." }
        },
        {
          name: "stock-data-crawler", url: "https://github.com/lpeixin/stock-data-crawler",
          lang: "Python", stars: 0,
          desc: { zh: "抓取股票历史数据的工具。",
                  en: "Tools for fetching historical stock data." }
        }
      ]
    }
  },

  /* ──────────────────────────────────────────────────────────────────────────
   * open source — fork / PR / upstream contributions
   * ──────────────────────────────────────────────────────────────────────── */
  oss: {
    title: { zh: "开源参与", en: "Open Source" },
    lede: {
      zh: "我参与过、也长期跟踪的上游项目。下面这些仓库是 fork，用来跟进与本地改造。",
      en: "Upstream projects I've worked with and kept following. The repositories below are forks, kept for tracking and local work."
    },
    items: [
      {
        name: "microsoft-authentication-library-for-android",
        label: "MSAL for Android",
        url: "https://github.com/lpeixin/microsoft-authentication-library-for-android",
        badge: { zh: "Fork", en: "Fork" },
        desc: {
          zh: "微软身份认证库的 Android 实现。",
          en: "Microsoft Authentication Library (MSAL) for Android."
        }
      },
      {
        name: "communication-services-android-calling-hero",
        label: "ACS · Android Calling Hero",
        url: "https://github.com/lpeixin/communication-services-android-calling-hero",
        badge: { zh: "Fork", en: "Fork" },
        desc: {
          zh: "Azure Communication Services 的 Android 通话示例工程。",
          en: "Hero sample for Android calling on Azure Communication Services."
        }
      },
      {
        name: "communication-services-web-calling-tutorial",
        label: "ACS · Web Calling Tutorial",
        url: "https://github.com/lpeixin/communication-services-web-calling-tutorial",
        badge: { zh: "Fork", en: "Fork" },
        desc: {
          zh: "Azure Communication Services 的 Web 通话入门示例。",
          en: "Onboarding sample for web calling capabilities on Azure Communication Services."
        }
      }
    ]
  },

  /* ──────────────────────────────────────────────────────────────────────────
   * 07. 学习笔记 —— 每个条目都是一个「文档子页面」的入口。
   *     子页面用 Docsify 构建，放在 notes/<站点名>/ 目录下，形如：
   *       notes/fde/index.html  →  https://lpeixin.github.io/notes/fde/#/
   *     加一个子页面入口：往 items 数组里加一个对象即可（见下面的形状）。
   *     形状：
   *       {
   *         title:   { zh: "…", en: "…" },      // 子页面名称
   *         summary: { zh: "…", en: "…" },      // 一句话简介
   *         url:     "notes/xxx/index.html",    // 相对路径=同标签打开；http(s)://=新标签打开
   *         count:   12,                        // 可选：文档篇数，显示在卡片底部
   *         date:    "2026-10",                 // 可选：最近更新月份
   *         tags:    ["MCP", "Agent"]           // 可选：主题标签
   *       }
   *     想新建一个子页面：复制 notes/fde/ 整个目录改名为 notes/<新站点>/，
   *     编辑其中的 _sidebar.md 与 markdown 文件，再回到这里加一条入口即可。
   * ──────────────────────────────────────────────────────────────────────── */
  notes: {
    title: { zh: "学习笔记", en: "Notes" },
    lede: {
      zh: "把读源码、跑实验、踩完坑之后写下来的东西，整理成可以分享的文档站。每个卡片是一个独立的子页面，点进去就是一整套笔记。",
      en: "Notes distilled from reading source, running experiments and hitting walls — packaged as shareable documentation sites. Each card is its own sub-site."
    },
    items: [
      {
        title:   { zh: "FDE 知识库", en: "FDE Knowledge Base" },
        summary: {
          zh: "AI 前线部署工程师的学习与面试笔记：角色认知、交付方法论、AI 落地与行业案例。这是一个 Docsify 模板子页面，直接替换内容即可。",
          en: "A Docsify starter: forward-deployed engineer notes on role, delivery methodology, AI rollout and industry cases. Swap in your own content."
        },
        url:     "notes/fde/index.html",
        count:   6,
        date:    "2026-10",
        tags:    ["Docsify", "AI", "模板"]
      }
    ],
    slotCount: 2        // ← 空槽数量：提示「还可以继续添加更多子页面」
  },

  /* ──────────────────────────────────────────────────────────────────────────
   * technology stack — based on technology inferred from your public repositories
   * ──────────────────────────────────────────────────────────────────────── */
  skills: {
    title: { zh: "技能栈", en: "Toolbox" },
    lede: {
      zh: "我实际在用的东西，按用途分组。",
      en: "What I actually reach for, grouped by purpose."
    },
    groups: [
      { name: { zh: "语言", en: "Languages" }, alt: "langs",
        items: ["Python", "Java", "TypeScript", "JavaScript", "Swift"] },
      { name: { zh: "AI 与 Agent", en: "AI & Agents" }, alt: "agents",
        items: ["MCP", "Agent Skills", "RAG", "LangChain", "LLM Integration"] },
      { name: { zh: "客户端", en: "Clients" }, alt: "clients",
        items: ["SwiftUI", "macOS desktop", "cross-platform desktop", "Phaser 3"] },
      { name: { zh: "数据与量化", en: "Data & Quant" }, alt: "quant",
        items: ["financial data", "K-line / Time Series Analysis", "Pandas", "Data Visualization"] },
      { name: { zh: "工程与工具", en: "Engineering" }, alt: "tools",
        items: ["Docker", "Vibe coding", "Kubernetes", "Git/GitHub"] }
    ]
  },

  /* ──────────────────────────────────────────────────────────────────────────
   * about the site — key-value pairs, feel free to add or remove lines
   * ──────────────────────────────────────────────────────────────────────── */
  colophon: {
    title: { zh: "关于本站", en: "About this site" },
    rows: [
      { k: { zh: "构建方式", en: "Built with" },
        v: { zh: "手写 HTML / CSS / JavaScript，没有框架，没有构建步骤。",
             en: "Hand-written HTML, CSS and JavaScript. No framework, no build step." } },
      { k: { zh: "内容在哪", en: "Content" },
        v: { zh: "全部内容集中在 assets/js/content.js 一个文件里。",
             en: "All copy lives in a single file: assets/js/content.js" } },
      { k: { zh: "托管", en: "Hosting" },
        v: { zh: "GitHub Pages，直接从这个仓库发布。",
             en: "GitHub Pages, served straight from this repository." } },
      { k: { zh: "字体", en: "Type" },
        v: { zh: "系统字体栈，不请求任何外部字体文件。",
             en: "System font stack — no external font requests." } },
      { k: { zh: "隐私", en: "Privacy" },
        v: { zh: "没有分析脚本，没有 Cookie，没有第三方追踪。",
             en: "No analytics, no cookies, no third-party tracking." } },
      { k: { zh: "源码", en: "Source" },
        v: { zh: "<a href=\"https://github.com/lpeixin/lpeixin.github.io\">lpeixin.github.io</a>",
             en: "<a href=\"https://github.com/lpeixin/lpeixin.github.io\">lpeixin.github.io</a>" } }
    ]
  }
};
