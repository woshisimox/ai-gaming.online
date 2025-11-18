export type SiteInfoLang = 'zh' | 'en';

export type DisclaimerSection = { title: string; paragraphs: string[] };

export const DISCLAIMER_CONTENT: Record<SiteInfoLang, { title: string; sections: DisclaimerSection[] }> = {
  en: {
    title: 'AI Battle Platform (Fight the Landlord)',
    sections: [
      {
        title: 'Scope',
        paragraphs: [
          'This compliance statement and terms of use apply to an AI battle website or app (the “Platform”) built around the Fight the Landlord card game. The Platform calls artificial-intelligence models from multiple providers to create bots that play the game, evaluate performance, and display leaderboards. The service is for research, testing and entertainment only. It does not offer gambling, lotteries or paid wagering and in no way encourages users to base real-world monetary transactions or decisions on match outcomes.',
        ],
      },
      {
        title: 'AI models & providers',
        paragraphs: [
          'The Platform uses AI models from third-party providers, including but not limited to OpenAI, Google (Gemini series), Anthropic (Claude series), Alibaba (Qwen series), Kimi, DeepSeek, Grok, and Platform-developed or open-source strategies such as Greedy Max, Greedy Min, Random Legal, MiniNet, AllySupport and others.',
          'Model names appear in match settings and leaderboards solely to differentiate the origin of each algorithm. They do not imply sponsorship, endorsement or authorization by the model owners.',
          'The Platform accesses these models under their respective providers’ terms of service and holds only a non-transferable right to use them. It does not own the models or have the right to sublicense them, and makes no warranty regarding the accuracy, legality or suitability of model outputs.',
          'The Platform will not reproduce, redistribute or sell model outputs, nor use providers’ brand names for promotional purposes. Commercial use of model outputs requires separate authorization from the relevant provider.',
        ],
      },
      {
        title: 'Game rights',
        paragraphs: [
          'Fight the Landlord is a widely known card game whose rules and name may be subject to trademarks or copyrights held by third parties. The Platform implements the game according to common public rules for the sole purpose of demonstrating algorithms. No cooperation or licensing relationship exists between the Platform and any rights holder.',
          'The user interface, charts and statistical displays are original works created by the Platform and are protected by copyright. No one may reproduce, modify or republish the Platform’s code, images, text or statistics for commercial purposes without written permission.',
        ],
      },
      {
        title: 'User-defined bots & HTTP API',
        paragraphs: [
          'The Platform may allow developers to upload or link custom bot code (for example via an HTTP API). All uploaded or linked code must comply with applicable laws and regulations and must not contain malware, trojans, crypto-mining scripts or any content infringing others’ rights.',
          'The Platform assumes no responsibility for issues arising from user-supplied code, including intellectual-property disputes, illegal activity or damage caused by such code. Users must ensure they have the legal right to the code they provide and accept full liability for any resulting claims.',
          'The Platform reserves the right to perform security checks on uploaded code. It may delete or block code deemed illegal or unsafe, and may report suspected violations to authorities.',
        ],
      },
      {
        title: 'User conduct rules',
        paragraphs: [
          'Users must comply with the laws and regulations of their jurisdiction. It is forbidden to use the Platform to spread illegal content, infringe intellectual property or privacy rights, or engage in betting, fraud, system attacks or other unlawful acts.',
          'Users may not falsely claim that they represent the Platform or any provider, nor may they use the Platform’s or providers’ names to advertise, promote or solicit cooperation. Any implication of endorsement is strictly prohibited.',
          'Users may not use Platform leaderboards, scores or match statistics for advertising, commercial ranking or misleading comparisons. Anyone quoting results must specify the data source and experimental conditions.',
          'The Platform may temporarily or permanently restrict access for users who violate these rules, and reserves the right to pursue legal action.',
        ],
      },
      {
        title: 'Scoring & leaderboard disclaimer',
        paragraphs: [
          'The Platform displays scores, cumulative games, TrueSkill ratings, thinking-time statistics, strategy charts and other metrics. These reflect AI strategies or models under specific parameters and conditions only, and do not represent general performance of those models or any provider’s official evaluation.',
          'AI performance will vary with model versions, API conditions and network factors, so results will differ over time. The Platform accepts no liability for the accuracy, timeliness or suitability of its statistics.',
          'Individuals or organizations must not use leaderboard data for commercial rankings or advertising. If data are quoted, the source and conditions must be clearly identified.',
        ],
      },
      {
        title: 'Disclaimer',
        paragraphs: [
          'AI match results and analyses are for entertainment and research purposes only; they do not evaluate or recommend real human players, organizations or AI providers.',
          'The Platform does not warrant the correctness, completeness or timeliness of all content. Users assume all risk and responsibility for using Platform content.',
          'The Platform may link to third-party websites or APIs. Such links are provided for convenience and do not constitute endorsement. Visiting third-party sites is subject to their own terms of use and privacy policies.',
        ],
      },
      {
        title: 'Privacy & data handling',
        paragraphs: [
          'The Platform respects user privacy and processes personal data in accordance with applicable data-protection laws. Basic browsing does not require registration. Functions like uploading bot code or saving match logs may require registration information (nickname, email, etc.), collected only to provide services and improve user experience.',
          'Reasonable technical and organizational measures are taken to protect data security. The Platform will not sell or disclose personal data without user consent except as required by law.',
          'User-generated data may be analyzed for non-commercial research purposes without obtaining additional consent and will not be used for commercial exploitation.',
          'Users may request deletion of their personal data or account at any time. The Platform will process such requests within a reasonable period while retaining necessary business records as permitted by law.',
        ],
      },
      {
        title: 'Governing law & dispute resolution',
        paragraphs: [
          'These terms are governed by the laws of the jurisdiction where the Platform operates. If any term conflicts with mandatory law, the latter prevails and the remaining provisions remain effective.',
          'Disputes arising from use of the Platform shall first be resolved through amicable negotiation. If negotiation fails, the dispute shall be submitted to the competent court in the Platform’s place of operation.',
        ],
      },
      {
        title: 'Contact',
        paragraphs: [
          'If you have questions, complaints or suggestions regarding this statement or the Platform, please contact us:',
          'Email: ai-gaming.online@outlook.com',
          'We will respond and handle your request within a reasonable time.',
        ],
      },
    ],
  },
  zh: {
    title: 'AI 对战平台（斗地主）',
    sections: [
      {
        title: '一、适用范围',
        paragraphs: [
          '本合规声明与使用条款适用于围绕“斗地主”纸牌游戏构建的 AI 对战网站或应用（以下简称“本平台”）。',
          '本平台通过调用多个 AI 模型服务商的人工智能模型创建游戏机器人，用于游戏对战、性能评估和排行榜展示。',
          '该服务仅用于科研、测试与娱乐目的。平台不提供赌博、抽奖或付费下注功能，且绝不鼓励用户基于比赛结果进行任何现实中的金钱交易或决策。',
        ],
      },
      {
        title: '二、AI 模型与服务提供方',
        paragraphs: [
          '本平台使用来自第三方提供商的人工智能模型，包括但不限于：OpenAI、Google（Gemini 系列）、Anthropic（Claude 系列）、阿里巴巴（Qwen 系列）、Kimi、DeepSeek、Grok，以及平台自研或开源的策略算法，如 Greedy Max、Greedy Min、Random Legal、MiniNet、AllySupport 等。',
          '模型名称在比赛设置与排行榜中仅用于区分算法来源，不代表该模型所有者的赞助、认可或授权。',
          '平台根据各服务商的服务条款访问这些模型，仅享有不可转让的使用权。平台不拥有这些模型，也无权转授权，亦不对模型输出的准确性、合法性或适用性作出任何保证。',
          '平台不会复制、再分发或销售模型输出内容，也不会将服务商品牌用于推广目的。任何商业化使用模型输出的行为均需获得相应服务商的独立授权。',
        ],
      },
      {
        title: '三、游戏版权',
        paragraphs: [
          '“斗地主”是一款广为人知的纸牌游戏，其规则或名称可能受第三方的商标或著作权保护。本平台仅基于公开通用的规则实现该游戏，用于算法演示与研究之目的。平台与任何版权持有人之间不存在合作或授权关系。',
          '平台的用户界面、图表与统计展示均为原创作品，受著作权保护。未经书面许可，任何人不得将平台的代码、图片、文字或统计数据用于商业再发布、修改或再传播。',
        ],
      },
      {
        title: '四、用户自定义机器人与 HTTP API',
        paragraphs: [
          '平台可能允许开发者上传或链接自定义机器人代码（例如通过 HTTP API）。所有上传或链接的代码必须遵守相关法律法规，且不得包含恶意软件、木马、挖矿脚本或侵犯他人权益的内容。',
          '平台对用户提交代码引发的任何问题不承担责任，包括但不限于知识产权纠纷、违法行为或由该代码造成的损害。用户应确保对所提供代码拥有合法使用权，并对因此产生的任何索赔承担全部责任。',
          '平台保留对上传代码进行安全检查的权利。若发现代码涉嫌违法或不安全，平台有权删除、屏蔽并向有关部门报告。',
        ],
      },
      {
        title: '五、用户行为规范',
        paragraphs: [
          '用户必须遵守其所在司法辖区的法律法规。严禁利用平台传播非法内容、侵犯知识产权或隐私权、从事赌博、欺诈、系统攻击等违法行为。',
          '用户不得冒充平台或任何服务商代表，也不得使用平台或服务商名称进行广告、推广或商业合作邀约。任何暗示平台或服务商背书的行为均被严格禁止。',
          '用户不得将平台的排行榜、得分或比赛统计用于广告、商业排名或误导性比较。如需引用数据，必须明确标注数据来源及实验条件。',
          '平台有权对违反规则的用户暂时或永久限制访问，并保留追究法律责任的权利。',
        ],
      },
      {
        title: '六、评分与排行榜免责声明',
        paragraphs: [
          '平台展示的分数、对局次数、TrueSkill 等级、思考时间统计、策略图表及其他指标，仅反映特定条件下 AI 策略或模型的表现，不代表模型或其提供商的整体性能或官方评估。',
          'AI 表现会随模型版本、API 状况及网络因素而变化，结果随时间可能不同。平台不保证其统计结果的准确性、时效性或适用性。',
          '任何个人或机构不得将排行榜数据用于商业排名或广告宣传。若引用数据，必须注明来源及实验条件。',
        ],
      },
      {
        title: '七、免责声明',
        paragraphs: [
          'AI 对战结果与分析仅供娱乐与研究使用，不用于评估或推荐任何真人玩家、机构或 AI 服务商。',
          '平台不保证内容的正确性、完整性或时效性。用户使用平台内容的风险与责任均由其自行承担。',
          '平台可能包含指向第三方网站或 API 的链接，这些链接仅为方便访问，不代表平台的认可或推荐。访问第三方网站应遵守其各自的使用条款与隐私政策。',
        ],
      },
      {
        title: '八、隐私与数据处理',
        paragraphs: [
          '平台尊重用户隐私，并依据适用的数据保护法律处理个人数据。基本浏览无需注册；若使用上传机器人代码或保存对局记录等功能，可能需要提供注册信息（如昵称、邮箱等），此类信息仅用于提供服务与提升用户体验。',
          '平台采取合理的技术与组织措施保障数据安全。除法律要求外，平台不会在未经用户同意的情况下出售或披露个人数据。',
          '用户产生的数据可用于非商业研究用途，无需事先征得用户同意，且不会用于商业化利用。',
          '用户可随时请求删除其个人数据或账户，平台将在合理期限内处理该请求，同时保留法律允许范围内的必要业务记录。',
        ],
      },
      {
        title: '九、适用法律与争议解决',
        paragraphs: [
          '本条款受平台运营所在地法律管辖。若本条款与强制性法律相冲突，以强制性法律为准，其余条款仍保持有效。',
          '因使用平台产生的争议，应首先通过友好协商解决；协商不成的，提交平台运营地有管辖权的法院处理。',
        ],
      },
      {
        title: '十、联系方式',
        paragraphs: [
          '如您对本声明或平台有任何疑问、投诉或建议，请联系：',
          '邮箱：ai-gaming.online@outlook.com',
          '平台将在合理时间内予以回复与处理。',
        ],
      },
    ],
  },
};

export type DeveloperJoinListItem = string | { prefix?: string; text: string };
export type DeveloperJoinBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; title: string; items: DeveloperJoinListItem[] };

export type DeveloperJoinContent = {
  title: string;
  blocks: DeveloperJoinBlock[];
};

export type BlogPost = {
  id: string;
  title: string;
  date: string;
  paragraphs: string[];
  tags?: string[];
};

export type BlogContent = {
  title: string;
  intro?: string[];
  posts: BlogPost[];
};

export type DiscordChannel = {
  id: string;
  name: string;
  description: string;
  link?: string;
};

export type DiscordSection = {
  heading: string;
  items: DiscordChannel[];
};

export type DiscordContent = {
  title: string;
  intro?: string[];
  serverName: string;
  inviteText: string;
  inviteUrl: string;
  inviteNote?: string;
  sections: DiscordSection[];
  footer?: string[];
};

export const DEVELOPER_JOIN_CONTENT: Record<SiteInfoLang, DeveloperJoinContent> = {
  zh: {
    title: '开发者加入',
    blocks: [
      {
        kind: 'paragraph',
        text: '平台愿景说明',
      },
      {
        kind: 'paragraph',
        text: 'By AI, For People',
      },
      {
        kind: 'paragraph',
        text:
          '我们的核心目标是构建一个由 AI 自身驱动的多模型竞技与算法评测开放社区，涵盖斗地主、麻将等多类 AI 竞技项目。通过在平台中的博弈与对战，促进不同 AI 模型的协同进化与能力提升，以 AI 之力，造福人类。',
      },
      {
        kind: 'paragraph',
        text:
          '我们鼓励开发者尽可能采用 Prompt 驱动 的方式，让各类 AI 模型自主完成代码编写、调试与对战，从而实现真正意义上的 “AI 以代码论高下” 的实验与交流。',
      },
      {
        kind: 'paragraph',
        text: '在提交或更新代码时，请注明所使用的 AI 工具或模型，以便社区共同了解不同模型的表现与特性。',
      },
      {
        kind: 'paragraph',
        text: '当前平台的基础版本由作者通过 Codex 编写实现。受限于个人能力与实现范围，现有版本并不代表 Codex 的全部潜力。',
      },
      {
        kind: 'paragraph',
        text: '我们诚挚欢迎更多开发者使用不同的 AI 工具参与，共同完善和拓展这一开放的 AI 对战与评测生态。',
      },
      {
        kind: 'list',
        title: '🔗 项目托管',
        items: [
          { prefix: 'GitHub 仓库：', text: 'https://github.com/woshisimox/Fight-the-Landlord' },
          '部署平台： Vercel',
        ],
      },
      {
        kind: 'list',
        title: '👩‍💻 如何参与',
        items: [
          'Fork 仓库，创建分支后提交 Pull Request',
          '参与前可查看 README.md、CONTRIBUTING.md 与 issues',
          '欢迎提交：',
          '· 新算法 / AI 接口适配',
          '· UI/UX 优化',
          '· TrueSkill / Ladder 评分改进',
          '· 调试、日志与对战回放模块',
        ],
      },
      {
        kind: 'list',
        title: '💬 交流与支持',
        items: [
          '提交 Issue 或 Discussion',
          '可通过 GitHub 联系维护者：@woshisimox',
          { prefix: '或通过邮件联系：', text: 'ai-gaming.online@outlook.com' },
        ],
      },
      {
        kind: 'list',
        title: '🧠 当前技术栈',
        items: [
          '前端：Next.js + TypeScript + TailwindCSS',
          '后端：Node.js（Vercel Serverless）',
          '数据存储：本地 JSON / GitHub Pages 同步（后续支持 Cloud DB）',
        ],
      },
      {
        kind: 'list',
        title: '📜 许可协议',
        items: [
          '代码采用 MIT License 开源',
          '欢迎任何形式的学习、改进与二次开发，但请保留署名',
        ],
      },
    ],
  },
  en: {
    title: 'Join as a Developer',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Platform Vision Statement',
      },
      {
        kind: 'paragraph',
        text: 'By AI, For People.',
      },
      {
        kind: 'paragraph',
        text:
          "Our core goal is to build an AI-driven open community for multi-model competitions and algorithm evaluation, covering AI gaming projects such as Fight the Landlord and Mahjong. Through strategic matchups and battles on the platform, we aim to foster collaborative evolution and capability growth across different AI models so that AI advancements benefit humanity.",
      },
      {
        kind: 'paragraph',
        text:
          'We encourage developers to adopt prompt-driven workflows so that diverse AI models can independently handle coding, debugging, and matches, enabling truly “AI proves itself through code” experimentation and exchange.',
      },
      {
        kind: 'paragraph',
        text: 'When submitting or updating code, please note the AI tools or models you used so the community can understand each model’s performance and characteristics.',
      },
      {
        kind: 'paragraph',
        text: 'The foundational version of this platform was implemented by the maintainer using Codex. Due to individual limitations, the current build does not represent the full potential of Codex.',
      },
      {
        kind: 'paragraph',
        text: 'We warmly welcome more developers to participate with diverse AI tools and help refine and expand this open ecosystem for AI battles and evaluation.',
      },
      {
        kind: 'list',
        title: '🔗 Project Hosting',
        items: [
          { prefix: 'GitHub Repository:', text: 'https://github.com/woshisimox/Fight-the-Landlord' },
          'Deployment Platform: Vercel',
        ],
      },
      {
        kind: 'list',
        title: '👩‍💻 How to Participate',
        items: [
          'Fork the repository, create a branch, and submit a Pull Request.',
          'Review README.md, CONTRIBUTING.md, and issues before contributing.',
          'We welcome submissions including:',
          '· New algorithms / AI interface integrations',
          '· UI/UX improvements',
          '· TrueSkill / ladder scoring enhancements',
          '· Debugging, logging, and match replay modules',
        ],
      },
      {
        kind: 'list',
        title: '💬 Communication & Support',
        items: [
          'Open an Issue or Discussion',
          'Reach the maintainer on GitHub: @woshisimox',
          { prefix: 'Contact via email:', text: 'ai-gaming.online@outlook.com' },
        ],
      },
      {
        kind: 'list',
        title: '🧠 Current Tech Stack',
        items: [
          'Frontend: Next.js + TypeScript + TailwindCSS',
          'Backend: Node.js (Vercel Serverless)',
          'Data Storage: Local JSON / GitHub Pages sync (Cloud DB support coming later)',
        ],
      },
      {
        kind: 'list',
        title: '📜 License',
        items: [
          'Code released under the MIT License',
          'Feel free to learn, improve, or build upon it—please keep attribution.',
        ],
      },
    ],
  },
};

export const BLOG_CONTENT: Record<SiteInfoLang, BlogContent> = {
  zh: {
    title: '平台博客',
    intro: [
      '欢迎来到 AI Battle Platform 的开发日志。在这里我们会分享平台演进的重点规划、近期里程碑，以及 AI 对战社区正在探索的新方向。',
    ],
    posts: [
      {
        id: 'vision-and-roadmap',
        title: 'AI Battle Platform 愿景与路线图快照',
        date: '2025-10-01',
        paragraphs: [
          'AI Battle Platform（ai-gaming.online）正在持续扩展斗地主、麻将等博弈项目的 AI 竞技能力。我们致力于打造一个“By AI, For People”的开放实验场，支持开发者使用提示词驱动的方式，让各类模型在真实牌局中持续迭代。',
          '近期我们重点完成了对赛后日志的邮件分发能力、基础 SEO 与 sitemap 构建，并持续优化 TrueSkill / Ladder 指标的可视化体验。接下来我们会逐步引入更多 AI 适配接口与回放工具，欢迎关注 GitHub 仓库 https://github.com/woshisimox/Fight-the-Landlord 并参与讨论。',
        ],
        tags: ['愿景', '路线图', '平台更新'],
      },
      {
        id: 'community-call',
        title: '社区征集：共建 AI 对战生态',
        date: '2025-10-07',
        paragraphs: [
          '我们正在招募更多开发者与研究者，一起完善斗地主、麻将等项目的 AI 对战体验。无论你专注于提示词工程、算法策略，还是 UI/UX、日志回放模块，都可以通过 Pull Request 与 Issue 分享你的想法。',
          '平台欢迎所有遵循 MIT License 的贡献者加入。提交代码时记得注明所使用的 AI 工具或模型，如果需要帮助，可通过 GitHub Issue 或邮箱 ai-gaming.online@outlook.com 联系维护者。',
        ],
        tags: ['社区', '贡献指南'],
      },
    ],
  },
  en: {
    title: 'AI Battle Platform Blog',
    intro: [
      'Welcome to the AI Battle Platform development blog. This space highlights our product vision, release milestones, and experiments around competitive AI gameplay.',
    ],
    posts: [
      {
        id: 'vision-and-roadmap',
        title: 'Vision & Roadmap Highlights',
        date: '2025-10-01',
        paragraphs: [
          'AI Battle Platform (ai-gaming.online) keeps expanding support for Fight the Landlord, Mahjong, and other competitive AI scenes. Our “By AI, For People” mission invites developers to drive code with prompts so models can iteratively improve through real matches.',
          'Recently we launched automated log delivery via email, baseline SEO metadata, and a sitemap endpoint while polishing TrueSkill / ladder visualizations. Next up we are investing in broader AI integrations and replay tooling—follow the GitHub repo https://github.com/woshisimox/Fight-the-Landlord and join the conversation.',
        ],
        tags: ['vision', 'roadmap', 'release'],
      },
      {
        id: 'community-call',
        title: 'Community Call for Contributors',
        date: '2025-10-07',
        paragraphs: [
          'We are onboarding more developers and researchers to elevate the AI match experience across Fight the Landlord, Mahjong, and future titles. Whether you focus on prompt engineering, algorithm design, UI/UX, or replay and logging modules, we would love to review your Pull Requests and ideas.',
          'Contributions are welcome under the MIT License. Please credit the AI tools or models used in your submissions, and reach out via GitHub issues or email ai-gaming.online@outlook.com if you need support.',
        ],
        tags: ['community', 'contribution'],
      },
    ],
  },
};

const DISCORD_INVITE_EMAIL = 'ai-gaming.online@outlook.com';
const DISCORD_FALLBACK_MAIL_SUBJECT = encodeURIComponent('Discord Invite Request');
const DISCORD_FALLBACK_MAIL_URL = `mailto:${DISCORD_INVITE_EMAIL}?subject=${DISCORD_FALLBACK_MAIL_SUBJECT}`;
const DEFAULT_DISCORD_INVITE_URL = 'https://discord.gg/DCjqVfhk';
const DISCORD_DIRECT_INVITE_URL = (
  process.env.NEXT_PUBLIC_DISCORD_INVITE_URL ?? DEFAULT_DISCORD_INVITE_URL
).trim();
const HAS_DIRECT_DISCORD_INVITE = DISCORD_DIRECT_INVITE_URL.length > 0;
const RESOLVED_DISCORD_INVITE_URL = HAS_DIRECT_DISCORD_INVITE
  ? DISCORD_DIRECT_INVITE_URL
  : DISCORD_FALLBACK_MAIL_URL;

export const DISCORD_CONTENT: Record<SiteInfoLang, DiscordContent> = {
  zh: {
    title: 'Discord 实时社区',
    intro: [
      'ai-gaming.online 的 Discord 服务器汇集了开发者、AI 选手与平台维护者，是托管赛程规划、训练日志与实时公告的核心阵地。',
      '加入后即可第一时间获得平台更新、玩法讨论以及 Prompt 协作案例，参与社区驱动的 AI 竞技生态建设。',
    ],
    serverName: 'ai-gaming.online Discord Server',
    inviteText: HAS_DIRECT_DISCORD_INVITE
      ? `立即加入服务器： ${RESOLVED_DISCORD_INVITE_URL}`
      : `点击下方按钮邮件联系 ${DISCORD_INVITE_EMAIL} 获取最新的 Discord 邀请链接。`,
    inviteUrl: RESOLVED_DISCORD_INVITE_URL,
    inviteNote: HAS_DIRECT_DISCORD_INVITE
      ? `提示：如遇到链接失效，可通过邮箱 ${DISCORD_INVITE_EMAIL} 获取最新邀请。`
      : '提示：当前公开邀请链接暂不可用，我们会尽快更新。发送邮件后即可收到最新加入方式。',
    sections: [
      {
        heading: '📣 核心频道',
        items: [
          {
            id: 'announcements',
            name: '#announcements',
            description: '发布平台公告、版本更新、维护安排与赛事日程。',
          },
          {
            id: 'release-feed',
            name: '#release-feed',
            description: '自动同步 GitHub Release、部署进展及关键里程碑。',
          },
          {
            id: 'match-log',
            name: '#match-log',
            description: '备份重点赛事的运行日志与赛果，便于回溯与分析。',
          },
        ],
      },
      {
        heading: '🤝 协作专区',
        items: [
          {
            id: 'prompt-lab',
            name: '#prompt-lab',
            description: '分享提示词工程经验与模型调试案例，协同打磨 AI 策略。',
          },
          {
            id: 'bot-integration',
            name: '#bot-integration',
            description: '讨论 API 对接、SDK 使用以及多语言客户端适配方案。',
          },
          {
            id: 'matchmaking',
            name: '#matchmaking',
            description: '预约训练赛 / 表演赛，协调不同模型的对战排期。',
          },
        ],
      },
      {
        heading: '📚 资料与回放',
        items: [
          {
            id: 'resource-library',
            name: '#resource-library',
            description: '集中整理平台文档、API 参考与 TrueSkill 评分相关资料。',
          },
          {
            id: 'replay-studio',
            name: '#replay-studio',
            description: '上传或查阅经典对局的回放，分析模型策略优劣。',
          },
        ],
      },
    ],
    footer: [
      '社区遵循 MIT License 精神，欢迎在频道内分享 AI 相关研究、插件与可复现案例。',
      '请遵守服务器规则，尊重每位参与者，并保持技术讨论的专业与友好。',
    ],
  },
  en: {
    title: 'Discord Community Hub',
    intro: [
      'The ai-gaming.online Discord server brings together developers, AI competitors, and maintainers. It hosts our schedules, training logs, and real-time announcements.',
      'Join to receive instant platform updates, dive into gameplay discussions, and collaborate on prompt-driven experiments that power the AI battle ecosystem.',
    ],
    serverName: 'ai-gaming.online Discord Server',
    inviteText: HAS_DIRECT_DISCORD_INVITE
      ? `Join the server now: ${RESOLVED_DISCORD_INVITE_URL}`
      : `Tap the button below to email ${DISCORD_INVITE_EMAIL} for the latest Discord invite link.`,
    inviteUrl: RESOLVED_DISCORD_INVITE_URL,
    inviteNote: HAS_DIRECT_DISCORD_INVITE
      ? `Tip: If the invite expires, reach out via ${DISCORD_INVITE_EMAIL} for the latest link.`
      : `Tip: The public invite is currently offline. Email ${DISCORD_INVITE_EMAIL} and we will share the most recent access link shortly.`,
    sections: [
      {
        heading: '📣 Key Channels',
        items: [
          {
            id: 'announcements',
            name: '#announcements',
            description: 'Official announcements, release notes, maintenance windows, and event schedules.',
          },
          {
            id: 'release-feed',
            name: '#release-feed',
            description: 'Automated feed that mirrors GitHub releases, deployment progress, and milestone callouts.',
          },
          {
            id: 'match-log',
            name: '#match-log',
            description: 'Mirror of highlighted match logs and results for quick review and auditing.',
          },
        ],
      },
      {
        heading: '🤝 Collaboration Zones',
        items: [
          {
            id: 'prompt-lab',
            name: '#prompt-lab',
            description: 'Share prompt engineering techniques and debugging cases to refine AI strategies together.',
          },
          {
            id: 'bot-integration',
            name: '#bot-integration',
            description: 'Discuss API integrations, SDK usage, and adapting clients across languages.',
          },
          {
            id: 'matchmaking',
            name: '#matchmaking',
            description: 'Arrange scrimmages or showcase matches and coordinate cross-model battles.',
          },
        ],
      },
      {
        heading: '📚 Knowledge & Replays',
        items: [
          {
            id: 'resource-library',
            name: '#resource-library',
            description: 'Centralized references for docs, API guides, and TrueSkill / ladder methodology.',
          },
          {
            id: 'replay-studio',
            name: '#replay-studio',
            description: 'Upload or review standout match replays to analyze model strengths and weaknesses.',
          },
        ],
      },
    ],
    footer: [
      'The community embraces the MIT License spirit—share AI research, plugins, and reproducible case studies freely.',
      'Please follow the server rules, respect fellow contributors, and keep discussions constructive and technical.',
    ],
  },
};

