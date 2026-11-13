'use client';
import React, { useEffect, useRef, useState } from 'react';
import { UiIcon } from './uiIcons';

export type CommentPlatform = 'instagram' | 'tiktok' | 'twitter' | 'youtube';
export type CommentVariant =
  | 'insta-post'
  | 'insta-reels'
  | 'tiktok-reply'
  | 'tiktok-video'
  | 'tw-post'
  | 'yt-video'
  | 'yt-shorts';

export type CommentConfig = {
  variant: CommentVariant;
  theme: 'light' | 'dark';
  displayName: string;
  username: string;
  text: string;
  timeAgo: string;
  likes: string;
  replies: string;
  retweets: string;
  views: string;
  verified: boolean;
  liked: boolean;
  rounded: boolean;
  avatar: string | null;
  transparent: boolean;
};

export const PLATFORMS_ORDER: CommentPlatform[] = ['instagram', 'tiktok', 'twitter', 'youtube'];

export const PLATFORM_LABEL: Record<CommentPlatform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  twitter: 'X / Twitter',
  youtube: 'YouTube',
};

export const PLATFORM_OF: Record<CommentVariant, CommentPlatform> = {
  'insta-post': 'instagram',
  'insta-reels': 'instagram',
  'tiktok-reply': 'tiktok',
  'tiktok-video': 'tiktok',
  'tw-post': 'twitter',
  'yt-video': 'youtube',
  'yt-shorts': 'youtube',
};

export const VARIANTS_PER_PLATFORM: Record<CommentPlatform, CommentVariant[]> = {
  instagram: ['insta-post', 'insta-reels'],
  tiktok: ['tiktok-reply', 'tiktok-video'],
  twitter: ['tw-post'],
  youtube: ['yt-video', 'yt-shorts'],
};

export const VARIANT_LABEL: Record<CommentVariant, string> = {
  'insta-post': 'Comentario de Post',
  'insta-reels': 'Respuesta en Reels',
  'tiktok-reply': 'Sticker de Respuesta',
  'tiktok-video': 'Comentario de Video',
  'tw-post': 'Post / Respuesta',
  'yt-video': 'Comentario de Video',
  'yt-shorts': 'Sticker de Shorts',
};

const VARIANT_META: Record<CommentVariant, { W: number; fs: number; cpl: number; base: number }> = {
  'tiktok-reply': { W: 560, fs: 24, cpl: 30, base: 165 },
  'tiktok-video': { W: 600, fs: 16, cpl: 48, base: 185 },
  'insta-post':   { W: 600, fs: 16, cpl: 48, base: 185 },
  'insta-reels':  { W: 480, fs: 19, cpl: 34, base: 150 },
  'yt-video':     { W: 620, fs: 16, cpl: 50, base: 230 },
  'yt-shorts':    { W: 490, fs: 19, cpl: 34, base: 150 },
  'tw-post':      { W: 620, fs: 17, cpl: 48, base: 205 },
};

const RANDOM_PROFILES = [
  { displayName: 'Sofi Tech', username: 'sofitech_', likes: '1,392', replies: '12', retweets: '18', views: '19K', timeAgo: '1 d' },
  { displayName: 'Mateo Edits', username: 'mateo.fx', likes: '12.4K', replies: '64', retweets: '210', views: '142K', timeAgo: '2 h' },
  { displayName: 'PixelStudio', username: 'pixelstudio.tv', likes: '842', replies: '7', retweets: '31', views: '9.4K', timeAgo: '5 h' },
  { displayName: 'Kaito Gaming', username: 'kaitogames', likes: '72', replies: '2', retweets: '5', views: '1.8K', timeAgo: '10 min' },
  { displayName: 'Luna Creativa', username: 'lunacreativa', likes: '319', replies: '5', retweets: '14', views: '6.1K', timeAgo: '2 sem' },
  { displayName: 'Alex Rivera', username: 'alexrivera', likes: '4.8K', replies: '23', retweets: '89', views: '54K', timeAgo: '3 h' },
];

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

function esc(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function PlatformLogo({ platform, className = 'h-4 w-4 shrink-0' }: { platform: CommentPlatform; className?: string }) {
  switch (platform) {
    case 'tiktok':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
        </svg>
      );
    case 'youtube':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    case 'twitter':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
  }
}

const svgIcon = (path: string, color: string, size = 18, sw = 1.9, fill = 'none') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex:none">${path}</svg>`;

const I_HEART = (c: string, s = 18, sw = 1.9, filled = false) =>
  svgIcon(
    '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
    c,
    s,
    sw,
    filled ? c : 'none'
  );

const I_BUBBLE = (c: string, s = 18) =>
  svgIcon(
    '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    c,
    s,
    1.85
  );

const I_RT = (c: string, s = 18) =>
  svgIcon(
    '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    c,
    s,
    1.85
  );

const I_UP = (c: string, s = 20, filled = false) =>
  svgIcon(
    '<path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3z"/><path d="M7 10l4.2-7a2 2 0 0 1 3.8 1v5h5a2 2 0 0 1 2 2.3l-1.4 7A2 2 0 0 1 18.6 21H7"/>',
    c,
    s,
    1.85,
    filled ? c : 'none'
  );

const I_DOWN = (c: string, s = 20) =>
  svgIcon(
    '<path d="M17 14V3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-3z"/><path d="M17 14l-4.2 7a2 2 0 0 1-3.8-1v-5H4a2 2 0 0 1-2-2.3l1.4-7A2 2 0 0 1 5.4 3H17"/>',
    c,
    s,
    1.85
  );

const I_YT_COMMENT = (c: string, s = 20) =>
  svgIcon(
    '<path d="M20 3H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12l4 4V4a1 1 0 0 0-1-1z"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="14" y2="12"/>',
    c,
    s,
    1.75
  );

const I_VIEWS = (c: string, s = 18) =>
  svgIcon(
    '<line x1="6" y1="20" x2="6" y2="14"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="10"/>',
    c,
    s,
    2
  );

const I_BM = (c: string, s = 18) =>
  svgIcon('<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>', c, s, 1.85);

const I_SHARE = (c: string, s = 18) =>
  svgIcon(
    '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>',
    c,
    s,
    1.85
  );

const I_GROK = (c: string, s = 19) =>
  svgIcon('<circle cx="12" cy="12" r="7.5"/><line x1="4.5" y1="19.5" x2="19.5" y2="4.5"/>', c, s, 2);

const I_DOTS_V = (c: string, s = 20) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="${c}" style="display:block;flex:none"><circle cx="12" cy="5.5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="18.5" r="1.8"/></svg>`;

const I_DOTS_H = (c: string, s = 19) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="${c}" style="display:block;flex:none"><circle cx="5.5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18.5" cy="12" r="1.8"/></svg>`;

const I_CHEV_R = (c: string, s = 18) =>
  svgIcon('<polyline points="9 6 15 12 9 18"/>', c, s, 2.3);

const I_CHEV_D = (c: string, s = 15) =>
  svgIcon('<polyline points="6 9 12 15 18 9"/>', c, s, 2.2);

function badgeFor(platform: CommentPlatform, size = 15): string {
  const color =
    platform === 'instagram'
      ? '#3897f0'
      : platform === 'twitter'
      ? '#1d9bf0'
      : platform === 'youtube'
      ? '#8a939b'
      : '#20d5ec';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" style="display:inline-block;vertical-align:-2px;margin-left:4px"><circle cx="12" cy="12" r="10" fill="${color}"/><path d="M8.5 12.2l2.3 2.3 4.7-5" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>`;
}

function bodyHtml(cfg: CommentConfig): string {
  const light = cfg.theme === 'light';
  const CARD = light ? '#ffffff' : '#161823';
  const TX = light ? '#0f1419' : '#f1f2f6';
  const SUB = light ? '#656c75' : '#8a939b';
  const IC = light ? '#0f1419' : '#e1e4e8';
  const ICG = light ? '#656c75' : '#8a939b';
  const BD = light ? '#d8dde2' : '#333a41';
  const W = VARIANT_META[cfg.variant].W;

  const badge = cfg.verified ? badgeFor(PLATFORM_OF[cfg.variant]) : '';

  const av = (size: number): string => {
    if (cfg.avatar) {
      return `<img src="${cfg.avatar}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;display:block;flex:none"/>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" style="flex:none;display:block;border-radius:50%"><clipPath id="avc"><circle cx="12" cy="12" r="12"/></clipPath><g clip-path="url(#avc)"><rect width="24" height="24" fill="#c9d3dd"/><circle cx="12" cy="9.5" r="4.2" fill="#63707e"/><ellipse cx="12" cy="21.5" rx="8.6" ry="7.2" fill="#63707e"/></g></svg>`;
  };

  switch (cfg.variant) {
    case 'tiktok-reply': {
      const tail = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="26" viewBox="0 0 32 26" style="position:absolute;left:0px;bottom:-21px;display:block"><path d="M0 0 L0 18 Q0 26 8 20 L26 0 Z" fill="${CARD}"/></svg>`;
      return `<div style="padding-bottom:24px"><div style="position:relative;width:fit-content;min-width:300px;max-width:${W}px;box-sizing:border-box;background:${CARD};border-radius:16px;border-bottom-left-radius:4px;padding:20px 26px 22px 20px;display:flex;gap:16px;align-items:center">
        ${av(58)}
        <div style="min-width:0;flex:1">
          <div style="color:${SUB};font-size:15px;font-weight:600;margin-bottom:4px;white-space:nowrap">Reply to ${esc(cfg.username || cfg.displayName)}${badge}'s comment</div>
          <div style="color:${TX};font-size:23px;font-weight:800;line-height:1.28;white-space:pre-wrap;word-break:break-word">${esc(cfg.text)}</div>
        </div>
        ${tail}
      </div></div>`;
    }

    case 'tiktok-video': {
      const userLabel = cfg.username || cfg.displayName;
      const heartColor = cfg.liked ? '#fe2c55' : ICG;
      const radius = cfg.rounded ? 16 : 0;
      return `<div style="width:${W}px;box-sizing:border-box;background:${CARD};border-radius:${radius}px;padding:18px 22px;display:flex;gap:14px;align-items:flex-start">
        ${av(44)}
        <div style="min-width:0;flex:1">
          <div style="color:${SUB};font-size:14px;font-weight:700">${esc(userLabel)}${badge}</div>
          <div style="color:${TX};font-size:15px;font-weight:500;line-height:1.38;margin-top:4px;white-space:pre-wrap">${esc(cfg.text)}</div>
          <div style="display:flex;align-items:center;gap:16px;margin-top:8px;color:${SUB};font-size:13px;font-weight:600">
            <span>${esc(cfg.timeAgo)}</span>
            <span>Reply</span>
            <span style="margin-left:auto;display:flex;align-items:center;gap:5px;color:${heartColor}">
              ${I_HEART(heartColor, 17, 2, cfg.liked)}
              <span style="color:${SUB};font-size:13px;font-weight:600">${esc(cfg.likes)}</span>
            </span>
            <span style="display:flex;align-items:center">${I_DOWN(ICG, 17)}</span>
          </div>
          ${
            cfg.replies && cfg.replies !== '0'
              ? `<div style="display:flex;align-items:center;gap:8px;margin-top:10px;color:${SUB};font-size:13px;font-weight:700">
                  <span style="width:24px;height:1.5px;background:${BD};display:inline-block"></span>
                  <span>View ${esc(cfg.replies)} replies</span>
                  ${I_CHEV_D(SUB, 14)}
                </div>`
              : ''
          }
        </div>
      </div>`;
    }

    case 'insta-post': {
      const userLabel = cfg.username || cfg.displayName;
      const heartColor = cfg.liked ? '#ff3040' : ICG;
      const radius = cfg.rounded ? 16 : 0;
      return `<div style="width:${W}px;box-sizing:border-box;background:${CARD};border-radius:${radius}px;padding:18px 22px;display:flex;gap:14px;align-items:flex-start">
        ${av(48)}
        <div style="min-width:0;flex:1">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="color:${TX};font-size:15px;font-weight:700">${esc(userLabel)}${badge}</span>
            <span style="color:${SUB};font-size:15px;font-weight:600">${esc(cfg.timeAgo)}</span>
          </div>
          <div style="color:${TX};font-size:16px;font-weight:400;line-height:1.38;margin-top:5px;white-space:pre-wrap">${esc(cfg.text)}</div>
          <div style="color:${SUB};font-size:14px;font-weight:600;margin-top:10px">Reply</div>
          ${
            cfg.replies && cfg.replies !== '0'
              ? `<div style="display:flex;align-items:center;gap:12px;margin-top:14px;color:${SUB};font-size:14px;font-weight:600">
                  <span style="width:32px;height:1.5px;background:${BD};display:inline-block"></span>
                  <span>View ${esc(cfg.replies)} more replies</span>
                </div>`
              : ''
          }
        </div>
        <div style="flex:none;display:flex;flex-direction:column;align-items:center;gap:6px;padding-top:12px;margin-left:8px">
          ${I_HEART(heartColor, 20, 2, cfg.liked)}
          <span style="color:${SUB};font-size:13px;font-weight:600">${esc(cfg.likes)}</span>
        </div>
      </div>`;
    }

    case 'insta-reels': {
      return `<div style="width:fit-content;min-width:280px;max-width:${W}px;box-sizing:border-box;background:${CARD};border-radius:14px;padding:18px 22px;display:flex;gap:16px;align-items:flex-start">
        ${av(54)}
        <div style="min-width:0;flex:1">
          <div style="color:${TX};font-size:19px;font-weight:500;line-height:1.32;white-space:pre-wrap;word-break:break-word">${esc(cfg.text)}</div>
          <div style="color:${SUB};font-size:15px;font-weight:500;margin-top:6px;white-space:nowrap">Replying to ${esc(cfg.username || cfg.displayName)}${badge}</div>
        </div>
      </div>`;
    }

    case 'yt-video': {
      const radius = cfg.rounded ? 16 : 4;
      const likeColor = cfg.liked ? TX : IC;
      return `<div style="width:${W}px;box-sizing:border-box;background:${CARD};border-radius:${radius}px;padding:18px 20px;display:flex;gap:14px;align-items:stretch">
        <div style="display:flex;flex-direction:column;align-items:center;flex:none;width:46px">
          ${av(46)}
          <div style="flex:1;width:26px;margin-left:22px;margin-top:4px;margin-bottom:11px;border-left:2px solid ${BD};border-bottom:2px solid ${BD};border-bottom-left-radius:20px;box-sizing:border-box"></div>
        </div>
        <div style="min-width:0;flex:1;display:flex;flex-direction:column">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="color:${TX};font-size:15px;font-weight:700">${esc(cfg.username || cfg.displayName)}${badge}</span>
            <span style="color:${SUB};font-size:14px;font-weight:500">• ${esc(cfg.timeAgo)}</span>
          </div>
          <div style="color:${TX};font-size:16px;font-weight:400;line-height:1.4;margin-top:5px;white-space:pre-wrap">${esc(cfg.text)}</div>
          <div style="display:flex;align-items:center;gap:22px;margin-top:14px">
            <span style="display:flex;align-items:center;gap:8px">
              ${I_UP(likeColor, 20, cfg.liked)}
              <span style="color:${cfg.liked ? TX : SUB};font-size:14px;font-weight:${cfg.liked ? 700 : 500}">${esc(cfg.likes)}</span>
            </span>
            ${I_DOWN(IC, 20)}
            <span style="margin-left:14px">${I_YT_COMMENT(IC, 20)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:22px;color:${SUB};font-size:16px;font-weight:600">
            <span>${esc(cfg.replies)} replies</span>
            ${I_CHEV_R(SUB, 18)}
          </div>
        </div>
        <div style="flex:none;padding-top:2px">${I_DOTS_V(IC, 20)}</div>
      </div>`;
    }

    case 'yt-shorts': {
      return `<div style="width:fit-content;min-width:290px;max-width:${W}px;box-sizing:border-box;background:${CARD};border-radius:24px;padding:18px 22px;display:flex;gap:16px;align-items:center">
        ${av(54)}
        <div style="min-width:0;flex:1">
          <div style="color:${SUB};font-size:15px;font-weight:500;margin-bottom:3px;white-space:nowrap">Comment from @${esc(cfg.username || cfg.displayName)}${badge}</div>
          <div style="color:${TX};font-size:19px;font-weight:700;line-height:1.3;white-space:pre-wrap;word-break:break-word">${esc(cfg.text)}</div>
        </div>
      </div>`;
    }

    case 'tw-post': {
      const radius = cfg.rounded ? 16 : 0;
      const heartColor = cfg.liked ? '#f91880' : ICG;
      return `<div style="width:${W}px;box-sizing:border-box;background:${CARD};border-radius:${radius}px;padding:18px 22px;display:flex;gap:14px;align-items:flex-start">
        ${av(52)}
        <div style="min-width:0;flex:1">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span style="color:${TX};font-size:16px;font-weight:800">${esc(cfg.displayName)}${badge}</span>
            <span style="color:${SUB};font-size:16px;font-weight:400">@${esc(cfg.username)} · ${esc(cfg.timeAgo)}</span>
            <span style="margin-left:auto;display:flex;gap:10px;align-items:center">
              ${I_GROK(IC, 19)}
              ${I_DOTS_H(IC, 19)}
            </span>
          </div>
          <div style="color:${TX};font-size:17px;font-weight:400;line-height:1.38;margin-top:4px;white-space:pre-wrap">${esc(cfg.text)}</div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:16px;color:${ICG};font-size:14px;font-weight:600">
            <span style="display:flex;gap:8px;align-items:center">${I_BUBBLE(ICG, 18)}<span>${esc(cfg.replies)}</span></span>
            <span style="display:flex;gap:8px;align-items:center">${I_RT(ICG, 18)}<span>${esc(cfg.retweets)}</span></span>
            <span style="display:flex;gap:8px;align-items:center;color:${heartColor}">${I_HEART(heartColor, 18, 1.9, cfg.liked)}<span>${esc(cfg.likes)}</span></span>
            <span style="display:flex;gap:8px;align-items:center">${I_VIEWS(ICG, 18)}<span>${esc(cfg.views)}</span></span>
            <span style="display:flex;gap:14px;align-items:center">
              ${I_BM(ICG, 18)}
              ${I_SHARE(ICG, 18)}
            </span>
          </div>
        </div>
      </div>`;
    }
  }
}

function buildSvg(cfg: CommentConfig): { svg: string; w: number; h: number } {
  const meta = VARIANT_META[cfg.variant];
  const pad = 28;
  const explicitLines = (cfg.text || '').split('\n').reduce((acc, line) => {
    return acc + Math.max(1, Math.ceil((line.length || 1) / meta.cpl));
  }, 0);
  const lines = Math.max(1, explicitLines) + 1;
  const w = meta.W + pad * 2;
  const h = meta.base + lines * Math.round(meta.fs * 1.45) + pad * 2;
  const body = bodyHtml(cfg);
  const bg = cfg.transparent ? 'transparent' : '#0d0d12';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject x="0" y="0" width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml" style="box-sizing:border-box;width:${w}px;height:${h}px;padding:${pad}px;background:${bg};display:flex;align-items:flex-start;justify-content:center;font-family:${FONT}">${body}</div></foreignObject></svg>`;
  return { svg, w, h };
}

function cropCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = src.getContext('2d');
  if (!ctx) return src;
  const { width, height } = src;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width,
    minY = height,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return src;
  const p = 4;
  minX = Math.max(0, minX - p);
  minY = Math.max(0, minY - p);
  maxX = Math.min(width - 1, maxX + p);
  maxY = Math.min(height - 1, maxY + p);
  const out = document.createElement('canvas');
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext('2d')!.drawImage(src, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

export async function renderCommentPng(cfg: CommentConfig, scale = 2): Promise<Blob | null> {
  const { svg, w, h } = buildSvg(cfg);
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('no se pudo rasterizar el SVG'));
    img.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, w, h);
  const cropped = cropCanvas(canvas);
  return new Promise((resolve) => cropped.toBlob((b) => resolve(b), 'image/png'));
}

const DEFAULT_TEXT = 'Escribí cualquier comentario y mirá cómo queda ';

const PLATFORM_ACTIVE_STYLE: Record<CommentPlatform, string> = {
  instagram: 'border-fuchsia-500/80 bg-gradient-to-r from-fuchsia-500/25 to-purple-500/20 text-fuchsia-200 shadow-sm shadow-fuchsia-500/20',
  tiktok: 'border-cyan-400/80 bg-gradient-to-r from-cyan-500/20 to-rose-500/15 text-cyan-200 shadow-sm shadow-cyan-500/20',
  twitter: 'border-sky-400/80 bg-sky-500/15 text-sky-200 shadow-sm shadow-sky-500/20',
  youtube: 'border-rose-500/80 bg-rose-500/20 text-rose-200 shadow-sm shadow-rose-500/20',
};

export function CommentStudioModal({
  onCancel,
  onDownload,
  onInsert,
}: {
  onCancel: () => void;
  onDownload: (blob: Blob, name: string) => void;
  onInsert: (blob: Blob) => void;
}) {
  const [cfg, setCfg] = useState<CommentConfig>({
    variant: 'insta-post',
    theme: 'light',
    displayName: 'Clipedia Studio',
    username: 'clipedia',
    text: DEFAULT_TEXT,
    timeAgo: '2 h',
    likes: '1,392',
    replies: '5',
    retweets: '12',
    views: '12K',
    verified: false,
    liked: false,
    rounded: false,
    avatar: null,
    transparent: true,
  });
  const [preview, setPreview] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const blobRef = useRef<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const set = (patch: Partial<CommentConfig>) => setCfg((c) => ({ ...c, ...patch }));

  const randomizeIdentity = () => {
    const pick = RANDOM_PROFILES[Math.floor(Math.random() * RANDOM_PROFILES.length)];
    set({
      displayName: pick.displayName,
      username: pick.username,
      likes: pick.likes,
      replies: pick.replies,
      retweets: pick.retweets,
      views: pick.views,
      timeAgo: pick.timeAgo,
    });
  };

  const handleCopyClipboard = async () => {
    if (!blobRef.current || !navigator.clipboard?.write) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobRef.current })]);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback silencioso si el navegador bloquea ClipboardItem
    }
  };

  useEffect(() => {
    const t = window.setTimeout(() => {
      renderCommentPng(cfg).then((b) => {
        if (!b) return;
        blobRef.current = b;
        const url = URL.createObjectURL(b);
        setPreview((old) => {
          if (old) URL.revokeObjectURL(old);
          return url;
        });
        const im = new Image();
        im.onload = () => setDims({ w: im.naturalWidth, h: im.naturalHeight });
        im.src = url;
      });
    }, 120);
    return () => window.clearTimeout(t);
  }, [cfg]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const platform = PLATFORM_OF[cfg.variant];
  const isFullComment =
    cfg.variant === 'tiktok-video' ||
    cfg.variant === 'insta-post' ||
    cfg.variant === 'yt-video' ||
    cfg.variant === 'tw-post';

  return (
    <div
      className="fixed inset-0 z-[180] flex items-center justify-center bg-black/80 p-2 sm:p-3 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="flex max-h-[95vh] w-[min(98vw,56rem)] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0b0d14] shadow-2xl shadow-cyan-500/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera Responsive */}
        <div className="border-b border-slate-800/90 bg-slate-950/60 px-3.5 py-2.5 sm:px-5 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900 text-sm shadow-inner"><UiIcon name="comment" className="inline h-[1.15em] w-[1.15em] shrink-0 align-[-0.18em]" /> 
              </span>
              <div>
                <h2 className="text-sm font-black tracking-wide text-white">Estudio de Comentarios</h2>
                <p className="text-[11px] text-slate-400">Generador de stickers para redes sociales</p>
              </div>
            </div>

            {/* Selector en Desktop (con ícono + texto) */}
            <div className="hidden md:flex items-center gap-1.5 rounded-xl border border-slate-800/90 bg-slate-900/90 p-1">
              {PLATFORMS_ORDER.map((p) => (
                <button
                  key={p}
                  onClick={() => set({ variant: VARIANTS_PER_PLATFORM[p][0] })}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                    platform === p
                      ? PLATFORM_ACTIVE_STYLE[p]
                      : 'border-transparent text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                  }`}
                >
                  <PlatformLogo platform={p} className="h-3.5 w-3.5 shrink-0" />
                  <span>{PLATFORM_LABEL[p]}</span>
                </button>
              ))}
            </div>

            <button
              onClick={onCancel}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              title="Cerrar"
            ><UiIcon name="x" className="inline h-[1.15em] w-[1.15em] shrink-0 align-[-0.18em]" /> 
            </button>
          </div>

          {/* Barra de Redes en Móvil: Solo íconos y centrados en la barra */}
          <div className="mt-2.5 flex md:hidden items-center justify-center gap-3 border-t border-slate-800/70 pt-2.5">
            {PLATFORMS_ORDER.map((p) => (
              <button
                key={p}
                onClick={() => set({ variant: VARIANTS_PER_PLATFORM[p][0] })}
                title={PLATFORM_LABEL[p]}
                aria-label={PLATFORM_LABEL[p]}
                className={`flex h-9 w-14 items-center justify-center rounded-full border transition ${
                  platform === p
                    ? PLATFORM_ACTIVE_STYLE[p]
                    : 'border-slate-800 bg-slate-900/90 text-slate-400 hover:text-white'
                }`}
              >
                <PlatformLogo platform={p} className="h-4 w-4 shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Cuerpo Principal Scrolleable */}
        <div className="grid flex-1 gap-3.5 overflow-y-auto p-3.5 sm:gap-5 sm:p-5 md:grid-cols-[1.15fr_22rem]">
          {/* MONITOR DE PREVISUALIZACIÓN */}
          <div className="flex flex-col gap-2">
            {/* Barra de Variantes a ancho completo (50% / 50%) + Dimensiones abajo a la derecha en móvil */}
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex w-full sm:w-auto items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/90 p-1">
                {VARIANTS_PER_PLATFORM[platform].map((v) => (
                  <button
                    key={v}
                    onClick={() => set({ variant: v })}
                    className={`flex-1 sm:flex-initial rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      cfg.variant === v
                        ? 'border border-cyan-400/60 bg-cyan-500/20 text-cyan-200 shadow-sm'
                        : 'border border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {VARIANT_LABEL[v]}
                  </button>
                ))}
              </div>

              <span className="self-end sm:self-auto text-[11px] font-medium text-slate-400">
                {dims ? `${dims.w} × ${dims.h} px` : ''}
              </span>
            </div>

            {/* Lienzo con fondo cuadriculado cuando PNG está activo */}
            <div
              className={`relative flex min-h-[175px] sm:min-h-[270px] flex-1 items-center justify-center overflow-hidden rounded-xl border border-slate-800 p-3.5 sm:p-6 transition-colors ${
                cfg.transparent
                  ? 'bg-[repeating-conic-gradient(#1e293b_0%_25%,#0f172a_0%_50%)] bg-[length:20px_20px]'
                  : 'bg-[#0d0d12]'
              }`}
            >
              {preview ? (
                <img
                  src={preview}
                  alt="Vista previa del comentario"
                  className="max-h-[220px] sm:max-h-[310px] max-w-full transition-all"
                />
              ) : (
                <p className="text-xs text-slate-500">Renderizando comentario…</p>
              )}
            </div>

            {/* Barra de Apariencia: En móvil sin título y con los botones centrados; en Desktop con título a la izquierda */}
            <div className="flex items-center justify-center sm:justify-between gap-1.5 rounded-xl border border-slate-800/90 bg-slate-900/60 px-2.5 py-2 sm:px-3">
              <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
                Apariencia
              </span>
              <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => set({ theme: cfg.theme === 'dark' ? 'light' : 'dark' })}
                  className={`flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                    cfg.theme === 'dark'
                      ? 'border-violet-400/60 bg-violet-500/20 text-violet-200'
                      : 'border-slate-700 bg-slate-800/80 text-slate-200 hover:border-slate-600'
                  }`}
                >
                  <UiIcon name={cfg.theme === 'dark' ? 'moon' : 'sun'} className="h-3.5 w-3.5 shrink-0" />
                  <span>{cfg.theme === 'dark' ? 'Modo Oscuro' : 'Modo Claro'}</span>
                </button>

                {isFullComment && (
                  <button
                    type="button"
                    onClick={() => set({ rounded: !cfg.rounded })}
                    className={`flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                      cfg.rounded
                        ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                        : 'border-slate-700 bg-slate-800/80 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span><UiIcon name="roundedSquare" className="inline h-[1.15em] w-[1.15em] shrink-0 align-[-0.18em]" /> </span>
                    <span>Redondeado</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => set({ transparent: !cfg.transparent })}
                  className={`flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                    cfg.transparent
                      ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
                      : 'border-slate-700 bg-slate-800/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span><UiIcon name="checkerboard" className="inline h-[1.15em] w-[1.15em] shrink-0 align-[-0.18em]" /> </span>
                  <span>Fondo PNG</span>
                </button>
              </div>
            </div>
          </div>

          {/* INSPECTOR: Tarjeta de Usuario + Comentario + Interacciones */}
          <div className="flex flex-col gap-3">
            {/* 1. TARJETA DE PERFIL DEL AUTOR */}
            <div className="rounded-xl border border-slate-800/90 bg-slate-900/60 p-3 sm:p-3.5">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400"><UiIcon name="user" className="inline h-[1.15em] w-[1.15em] shrink-0 align-[-0.18em]" /> Perfil del Autor
                </span>
                <button
                  type="button"
                  onClick={randomizeIdentity}
                  className="flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-800/90 px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-fuchsia-400/60 hover:bg-fuchsia-500/15 hover:text-fuchsia-200"
                  title="Generar usuario y números al azar"
                >
                  <span><UiIcon name="shuffle" className="inline h-[1.15em] w-[1.15em] shrink-0 align-[-0.18em]" /> </span>
                  <span>Al azar</span>
                </button>
              </div>

              <div className="flex items-center gap-2.5 sm:gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const r = new FileReader();
                    r.onload = () => set({ avatar: String(r.result) });
                    r.readAsDataURL(f);
                  }}
                />
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Subir imagen de avatar"
                    className="group relative flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center overflow-hidden rounded-full border-2 border-slate-700 bg-slate-800 text-slate-300 transition hover:border-cyan-400"
                  >
                    {cfg.avatar ? (
                      <img src={cfg.avatar} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <svg className="h-6 w-6 sm:h-7 sm:w-7 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="9" r="4" />
                        <path d="M4 20c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
                      </svg>
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs opacity-0 transition-opacity group-hover:opacity-100"><UiIcon name="camera" className="inline h-[1.15em] w-[1.15em] shrink-0 align-[-0.18em]" /> 
                    </span>
                  </button>
                  {cfg.avatar && (
                    <button
                      type="button"
                      onClick={() => set({ avatar: null })}
                      title="Quitar foto"
                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-[10px] text-slate-300 hover:bg-rose-500 hover:text-white"
                    ><UiIcon name="x" className="inline h-[1.15em] w-[1.15em] shrink-0 align-[-0.18em]" /> 
                    </button>
                  )}
                </div>

                {/* Inputs de Identidad + Botón Verificado */}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  {platform === 'twitter' && (
                    <input
                      placeholder="Nombre visible"
                      className="h-9 w-full rounded-lg border border-slate-800 bg-slate-950/90 px-2.5 text-xs font-semibold text-slate-200 outline-none focus:border-cyan-400"
                      value={cfg.displayName}
                      onChange={(e) => set({ displayName: e.target.value })}
                    />
                  )}

                  <div className="flex items-center gap-1.5">
                    <div className="flex h-9 min-w-0 flex-1 items-center rounded-lg border border-slate-800 bg-slate-950/90 px-2.5 focus-within:border-cyan-400">
                      <span className="mr-1 text-xs font-bold text-slate-500">@</span>
                      <input
                        placeholder={
                          cfg.variant === 'tiktok-reply' ||
                          cfg.variant === 'insta-reels' ||
                          cfg.variant === 'yt-shorts'
                            ? 'usuario_respondido'
                            : 'usuario'
                        }
                        className="w-full bg-transparent text-xs font-medium text-slate-200 outline-none"
                        value={cfg.username}
                        onChange={(e) => set({ username: e.target.value })}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => set({ verified: !cfg.verified })}
                      title="Insignia de cuenta verificada"
                      className={`flex h-9 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-[11px] font-bold transition ${
                        cfg.verified
                          ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                          : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span><UiIcon name="badgeCheck" className="inline h-[1.15em] w-[1.15em] shrink-0 align-[-0.18em]" /> </span>
                      <span>Verificado</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. MENSAJE DEL COMENTARIO (Área más alta y cómoda) */}
            <div className="rounded-xl border border-slate-800/90 bg-slate-900/60 p-3 sm:p-3.5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-fuchsia-400"><UiIcon name="pen" className="inline h-[1.15em] w-[1.15em] shrink-0 align-[-0.18em]" /> Mensaje del Comentario
                </span>
                <button
                  type="button"
                  onClick={() => set({ text: DEFAULT_TEXT })}
                  className="text-[11px] font-semibold text-slate-400 transition hover:text-slate-200"
                  title="Restaurar texto de ejemplo"
                ><UiIcon name="reset" className="inline h-[1.15em] w-[1.15em] shrink-0 align-[-0.18em]" /> Restaurar
                </button>
              </div>

              <textarea
                rows={4}
                placeholder="Escribí el comentario acá..."
                className="min-h-[96px] sm:min-h-[110px] w-full resize-none rounded-lg border border-slate-800 bg-slate-950/90 p-3 text-xs leading-relaxed text-slate-200 outline-none focus:border-fuchsia-400"
                value={cfg.text}
                onChange={(e) => set({ text: e.target.value })}
              />
              <div className="mt-1.5 text-right text-[10px] font-medium text-slate-400">
                {cfg.text.length} caracteres
              </div>
            </div>

            {/* 3. MÉTRICAS E INTERACCIÓN */}
            {isFullComment && (
              <div className="rounded-xl border border-slate-800/90 bg-slate-900/60 p-3 sm:p-3.5">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300"><UiIcon name="chart" className="inline h-[1.15em] w-[1.15em] shrink-0 align-[-0.18em]" /> Métricas e Interacción
                  </span>
                  <button
                    type="button"
                    onClick={() => set({ liked: !cfg.liked })}
                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${
                      cfg.liked
                        ? 'border-rose-500 bg-rose-500/20 text-rose-300'
                        : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white'
                    }`}
                  >
                    <span><UiIcon name="heartFilled" className="inline h-[1.15em] w-[1.15em] shrink-0 align-[-0.18em]" /> </span>
                    <span>{cfg.liked ? 'Con Like' : 'Dar Like'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold text-slate-400">Tiempo</span>
                    <div className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/90 px-2 focus-within:border-cyan-400">
                      <span className="text-[11px] text-slate-400"><UiIcon name="clock" className="inline h-[1.15em] w-[1.15em] shrink-0 align-[-0.18em]" /> </span>
                      <input
                        className="w-full bg-transparent text-xs text-slate-200 outline-none"
                        value={cfg.timeAgo}
                        onChange={(e) => set({ timeAgo: e.target.value })}
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold text-slate-400">Likes</span>
                    <div className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/90 px-2 focus-within:border-cyan-400">
                      <span className="text-[11px] text-slate-400"><UiIcon name="heart" className="inline h-[1.15em] w-[1.15em] shrink-0 align-[-0.18em]" /> </span>
                      <input
                        className="w-full bg-transparent text-xs text-slate-200 outline-none"
                        value={cfg.likes}
                        onChange={(e) => set({ likes: e.target.value })}
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold text-slate-400">Respuestas</span>
                    <div className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/90 px-2 focus-within:border-cyan-400">
                      <span className="text-[11px] text-slate-400"><UiIcon name="comment" className="inline h-[1.15em] w-[1.15em] shrink-0 align-[-0.18em]" /> </span>
                      <input
                        className="w-full bg-transparent text-xs text-slate-200 outline-none"
                        value={cfg.replies}
                        onChange={(e) => set({ replies: e.target.value })}
                      />
                    </div>
                  </label>

                  {platform === 'twitter' && (
                    <>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-semibold text-slate-400">Retweets</span>
                        <div className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/90 px-2 focus-within:border-cyan-400">
                          <span className="text-[11px] text-slate-400"><UiIcon name="repeat" className="inline h-[1.15em] w-[1.15em] shrink-0 align-[-0.18em]" /> </span>
                          <input
                            className="w-full bg-transparent text-xs text-slate-200 outline-none"
                            value={cfg.retweets}
                            onChange={(e) => set({ retweets: e.target.value })}
                          />
                        </div>
                      </label>

                      <label className="col-span-2 block">
                        <span className="mb-1 block text-[10px] font-semibold text-slate-400">Visualizaciones</span>
                        <div className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/90 px-2 focus-within:border-cyan-400">
                          <span className="text-[11px] text-slate-400"><UiIcon name="chart" className="inline h-[1.15em] w-[1.15em] shrink-0 align-[-0.18em]" /> </span>
                          <input
                            className="w-full bg-transparent text-xs text-slate-200 outline-none"
                            value={cfg.views}
                            onChange={(e) => set({ views: e.target.value })}
                          />
                        </div>
                      </label>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pie del Modal Responsive */}
        <div className="flex flex-col gap-2 border-t border-slate-800/90 bg-slate-950/90 px-3.5 py-3 sm:flex-row sm:items-center sm:gap-2.5 sm:px-5 sm:py-3.5">
          <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-2.5">
            <button
              onClick={onCancel}
              className="flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs font-bold text-slate-300 transition hover:border-slate-600 hover:text-white sm:px-4"
            >
              Cancelar
            </button>

            <button
              onClick={handleCopyClipboard}
              disabled={!preview}
              className="flex items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-2.5 text-xs font-bold text-slate-200 transition hover:border-slate-500 disabled:opacity-50 sm:px-4"
            >
              <UiIcon name={copied ? 'check' : 'copy'} className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{copied ? 'Copiado' : 'Copiar PNG'}</span>
            </button>

            <button
              onClick={() =>
                blobRef.current && onDownload(blobRef.current, `comentario_${platform}_${Date.now()}.png`)
              }
              disabled={!preview}
              className="flex items-center justify-center gap-1 rounded-xl border border-cyan-400/50 bg-cyan-500/10 px-2.5 py-2.5 text-xs font-black text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-50 sm:px-4"
            >
              <span><UiIcon name="download" className="inline h-[1.15em] w-[1.15em] shrink-0 align-[-0.18em]" /> </span>
              <span className="truncate">Descargar PNG</span>
            </button>
          </div>

          <button
            onClick={() => blobRef.current && onInsert(blobRef.current)}
            disabled={!preview}
            className="flex w-full sm:w-auto sm:ml-auto items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-5 py-3 sm:py-2.5 text-xs font-black text-white shadow-lg shadow-fuchsia-500/25 transition hover:scale-[1.01] active:scale-95 disabled:opacity-50"
          >
            <span><UiIcon name="plus" className="inline h-[1.15em] w-[1.15em] shrink-0 align-[-0.18em]" /> </span>
            <span>Agregar a la timeline</span>
          </button>
        </div>
      </div>
    </div>
  );
}