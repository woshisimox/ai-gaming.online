'use client';

import { ReactNode, useMemo, useState } from 'react';

import styles from './SiteInfoButtons.module.css';
import {
  BLOG_CONTENT,
  DEVELOPER_JOIN_CONTENT,
  DISCLAIMER_CONTENT,
  DISCORD_CONTENT,
  type BlogContent,
  type DeveloperJoinContent,
  type SiteInfoLang,
} from './siteInfoContent';

type ModalType = 'disclaimer' | 'developer' | 'discord' | 'blog' | null;

const developerLinkStyle = { color: '#2563eb', textDecoration: 'underline', wordBreak: 'break-all' } as const;

function renderRichText(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const linkRegex = /(https?:\/\/[^\s]+|[\w.+-]+@[\w.-]+\.[\w.-]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(text)) !== null) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push(text.slice(lastIndex, index));
    }
    const value = match[0];
    if (value.includes('@') && !value.startsWith('http')) {
      nodes.push(
        <a key={`mail-${value}-${index}`} href={`mailto:${value}`} style={developerLinkStyle}>
          {value}
        </a>,
      );
    } else {
      nodes.push(
        <a key={`link-${value}-${index}`} href={value} target="_blank" rel="noreferrer" style={developerLinkStyle}>
          {value}
        </a>,
      );
    }
    lastIndex = linkRegex.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

function sortBlogPosts(content: BlogContent | undefined): BlogContent {
  if (!content) {
    return { title: '', posts: [] };
  }
  const posts = Array.isArray(content.posts)
    ? [...content.posts].sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        if (!Number.isFinite(timeA) && !Number.isFinite(timeB)) return 0;
        if (!Number.isFinite(timeA)) return 1;
        if (!Number.isFinite(timeB)) return -1;
        return timeB - timeA;
      })
    : [];
  return { ...content, posts };
}

function resolveLabels(lang: SiteInfoLang) {
  if (lang === 'en') {
    return {
      disclaimer: 'Disclaimer',
      developer: 'Join Developers',
      discord: 'Discord',
      blog: 'Blog',
      close: 'Close',
      discordCta: 'Open Discord',
    } as const;
  }
  return {
    disclaimer: '免责声明',
    developer: '开发者加入',
    discord: 'Discord 社区',
    blog: '平台博客',
    close: '关闭',
    discordCta: '进入 Discord',
  } as const;
}

type Props = {
  lang?: SiteInfoLang;
};

export default function SiteInfoButtons({ lang = 'zh' }: Props) {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const labels = useMemo(() => resolveLabels(lang), [lang]);
  const disclaimerContent = useMemo(() => DISCLAIMER_CONTENT[lang] ?? DISCLAIMER_CONTENT.zh, [lang]);
  const developerContent = useMemo<DeveloperJoinContent>(() => {
    return DEVELOPER_JOIN_CONTENT[lang] ?? DEVELOPER_JOIN_CONTENT.zh;
  }, [lang]);
  const blogContent = useMemo(() => sortBlogPosts(BLOG_CONTENT[lang] ?? BLOG_CONTENT.zh), [lang]);
  const discordContent = useMemo(() => DISCORD_CONTENT[lang] ?? DISCORD_CONTENT.zh, [lang]);

  const closeModal = () => setActiveModal(null);

  const modalNode = activeModal ? (
    <div className={styles.backdrop} role="dialog" aria-modal="true" onClick={closeModal}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            {activeModal === 'disclaimer'
              ? disclaimerContent.title
              : activeModal === 'developer'
              ? developerContent.title
              : activeModal === 'discord'
              ? discordContent.title
              : blogContent.title || labels.blog}
          </h3>
          <button type="button" className={styles.closeButton} onClick={closeModal} aria-label={labels.close}>
            ×
          </button>
        </div>
        {activeModal === 'disclaimer' && (
          <div className={styles.sectionList}>
            {disclaimerContent.sections.map((section) => (
              <div key={section.title} className={styles.listBlock}>
                <p className={styles.sectionTitle}>{section.title}</p>
                {section.paragraphs.map((text, index) => (
                  <p key={`${section.title}-${index}`} className={styles.sectionParagraph}>
                    {renderRichText(text)}
                  </p>
                ))}
              </div>
            ))}
          </div>
        )}
        {activeModal === 'developer' && (
          <div className={styles.sectionList}>
            {developerContent.blocks.map((block, index) => {
              if (block.kind === 'paragraph') {
                return (
                  <p key={`dev-paragraph-${index}`} className={styles.sectionParagraph}>
                    {renderRichText(block.text)}
                  </p>
                );
              }
              return (
                <div key={`dev-list-${block.title}-${index}`} className={styles.listBlock}>
                  <p className={styles.sectionTitle}>{block.title}</p>
                  <ul>
                    {block.items.map((item, itemIndex) => {
                      if (typeof item === 'string') {
                        return <li key={`dev-item-${index}-${itemIndex}`}>{renderRichText(item)}</li>;
                      }
                      return (
                        <li key={`dev-item-${index}-${itemIndex}`}>
                          {item.prefix ? <strong>{item.prefix}</strong> : null}
                          {item.prefix ? ' ' : null}
                          {renderRichText(item.text)}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
        {activeModal === 'discord' && (
          <div>
            {discordContent.intro?.map((text, idx) => (
              <p key={`discord-intro-${idx}`} className={styles.sectionParagraph}>
                {renderRichText(text)}
              </p>
            ))}
            <div className={styles.discordBadge}># {discordContent.serverName}</div>
            <p className={styles.sectionParagraph}>{renderRichText(discordContent.inviteText)}</p>
            <button
              type="button"
              className={`${styles.button} ${styles.discordButton}`}
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.open(discordContent.inviteUrl, '_blank', 'noopener,noreferrer');
                }
              }}
            >
              {labels.discordCta}
            </button>
            {discordContent.sections.map((section) => (
              <div key={section.heading} className={styles.discordSection}>
                <p className={styles.sectionTitle}>{section.heading}</p>
                <ul>
                  {section.items.map((item) => (
                    <li key={item.id} className={styles.sectionParagraph}>
                      <strong>{item.name}</strong> — {renderRichText(item.description)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {discordContent.footer?.map((text, idx) => (
              <p key={`discord-footer-${idx}`} className={styles.sectionParagraph}>
                {renderRichText(text)}
              </p>
            ))}
          </div>
        )}
        {activeModal === 'blog' && (
          <div>
            {blogContent.intro?.map((text, idx) => (
              <p key={`blog-intro-${idx}`} className={styles.sectionParagraph}>
                {renderRichText(text)}
              </p>
            ))}
            {blogContent.posts.map((post) => (
              <div key={post.id} className={styles.blogPost}>
                <h4 className={styles.sectionTitle}>{post.title}</h4>
                <div className={styles.blogMeta}>
                  <span>{post.date}</span>
                  {post.tags?.map((tag) => (
                    <span key={`${post.id}-${tag}`} className={styles.tagChip}>
                      {tag}
                    </span>
                  ))}
                </div>
                {post.paragraphs.map((text, idx) => (
                  <p key={`blog-${post.id}-${idx}`} className={styles.sectionParagraph}>
                    {renderRichText(text)}
                  </p>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className={styles.buttonRow}>
        <button type="button" className={`${styles.button} ${styles.disclaimer}`} onClick={() => setActiveModal('disclaimer')}>
          {labels.disclaimer}
        </button>
        <button type="button" className={`${styles.button} ${styles.developer}`} onClick={() => setActiveModal('developer')}>
          {labels.developer}
        </button>
        <button type="button" className={`${styles.button} ${styles.discord}`} onClick={() => setActiveModal('discord')}>
          {labels.discord}
        </button>
        <button type="button" className={`${styles.button} ${styles.blog}`} onClick={() => setActiveModal('blog')}>
          {labels.blog}
        </button>
      </div>
      {modalNode}
    </>
  );
}
