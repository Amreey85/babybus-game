/** Inline SVG icon set (original artwork). */
const svg = (body: string, vb = '0 0 24 24') =>
  `<svg viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS = {
  play: svg('<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" fill="currentColor"/>'),
  pause: svg('<rect x="6" y="5" width="4.2" height="14" rx="1.6" fill="currentColor"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.6" fill="currentColor"/>'),
  star: svg('<path d="M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8Z" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>'),
  settings: svg('<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.3 2.2-1.9-.4a6.9 6.9 0 0 0-.7-1.7l1.1-1.6a.9.9 0 0 0-.1-1.1l-.9-.9a.9.9 0 0 0-1.1-.1l-1.6 1.1a6.9 6.9 0 0 0-1.7-.7l-.4-1.9a.9.9 0 0 0-.9-.7h-1.3a.9.9 0 0 0-.9.7l-.4 1.9a6.9 6.9 0 0 0-1.7.7L6.6 4.6a.9.9 0 0 0-1.1.1l-.9.9a.9.9 0 0 0-.1 1.1l1.1 1.6a6.9 6.9 0 0 0-.7 1.7l-1.9.4a.9.9 0 0 0-.7.9v1.3c0 .4.3.8.7.9l1.9.4c.2.6.4 1.2.7 1.7l-1.1 1.6a.9.9 0 0 0 .1 1.1l.9.9c.3.3.8.4 1.1.1l1.6-1.1c.5.3 1.1.5 1.7.7l.4 1.9c.1.4.5.7.9.7h1.3c.4 0 .8-.3.9-.7l.4-1.9c.6-.2 1.2-.4 1.7-.7l1.6 1.1c.4.3.8.2 1.1-.1l.9-.9c.3-.3.4-.8.1-1.1l-1.1-1.6c.3-.5.5-1.1.7-1.7l1.9-.4c.4-.1.7-.5.7-.9v-1.3a.9.9 0 0 0-.7-.9Z" fill="currentColor"/>'),
  home: svg('<path d="M3.5 11.2 12 4l8.5 7.2V20a1 1 0 0 1-1 1H15v-5.5H9V21H4.5a1 1 0 0 1-1-1Z" fill="currentColor"/>'),
  replay: svg('<path d="M12 5V2L7.5 6 12 10V7a5.5 5.5 0 1 1-5.5 5.5H4.4A7.6 7.6 0 1 0 12 5Z" fill="currentColor"/>'),
  lock: svg('<rect x="5" y="10.5" width="14" height="10" rx="2.4" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4"/>'),
  left: svg('<path d="M15.5 4.5 7.5 12l8 7.5" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>'),
  right: svg('<path d="m8.5 4.5 8 7.5-8 7.5" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>'),
  jump: svg('<path d="M12 4 4.5 12.5h5V20h5v-7.5h5Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'),
  hand: svg('<path d="M8 11V5.5a1.5 1.5 0 0 1 3 0V10m0-.5V4a1.5 1.5 0 0 1 3 0v6m0-1.5V5.5a1.5 1.5 0 0 1 3 0v8.5c0 4-2.6 7-6.5 7-2.8 0-4.4-1.4-5.7-3.6l-2.2-3.8a1.4 1.4 0 0 1 2.3-1.6L8 13.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  heart: svg('<path d="M12 20.5s-8-4.7-8-10.6A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8 2.9c0 5.9-8 10.6-8 10.6Z" fill="currentColor"/>'),
  flag: svg('<path d="M6 21V4m0 1h11l-2.5 4L17 13H6" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'),
  medal: svg('<path d="M8 2h3l1.5 5L14 2h3l-3 8H10Z" fill="#FF5D73"/><circle cx="12" cy="15" r="6" fill="currentColor"/><path d="m12 11.6 1.1 2.2 2.4.3-1.8 1.6.5 2.4L12 16.9l-2.2 1.2.5-2.4-1.8-1.6 2.4-.3Z" fill="#fff"/>'),
  badge: svg('<path d="M12 2 20 5v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5Z" fill="currentColor"/><path d="M12 15.8s-3.4-2-3.4-4.5a1.9 1.9 0 0 1 3.4-1.2 1.9 1.9 0 0 1 3.4 1.2c0 2.5-3.4 4.5-3.4 4.5Z" fill="#fff"/>'),
  trophy: svg('<path d="M7 3h10v5a5 5 0 0 1-10 0Z" fill="currentColor"/><path d="M7 5H4v1.5A3.5 3.5 0 0 0 7.5 10M17 5h3v1.5A3.5 3.5 0 0 1 16.5 10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10.5 13h3v3.5h2.5V20h-8v-3.5h2.5Z" fill="currentColor"/>'),
  music: svg('<path d="M9 18V6l11-2v12" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="6.5" cy="18" r="2.8" fill="currentColor"/><circle cx="17.5" cy="16" r="2.8" fill="currentColor"/>'),
  sound: svg('<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4Z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
  close: svg('<path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>'),
  bulb: svg('<path d="M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3Z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'),
  door: svg('<path d="M5 21V4.5A1.5 1.5 0 0 1 6.5 3H14v18Z" fill="currentColor"/><path d="M14 12h7m-3-3 3 3-3 3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="11" cy="12" r="1.1" fill="#fff"/>'),
  globe: svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3Z" fill="none" stroke="currentColor" stroke-width="2"/>'),
  sparkle: svg('<path d="M12 2.5c.6 4.6 2.9 6.9 7.5 7.5-4.6.6-6.9 2.9-7.5 7.5-.6-4.6-2.9-6.9-7.5-7.5 4.6-.6 6.9-2.9 7.5-7.5Z" fill="currentColor"/>'),
  paw: svg('<ellipse cx="12" cy="16" rx="5" ry="4" fill="currentColor"/><circle cx="6" cy="10.5" r="2.2" fill="currentColor"/><circle cx="10" cy="7" r="2.2" fill="currentColor"/><circle cx="14" cy="7" r="2.2" fill="currentColor"/><circle cx="18" cy="10.5" r="2.2" fill="currentColor"/>'),
  info: svg('<circle cx="12" cy="12" r="9.5" fill="currentColor"/><path d="M12 10.5v6M12 7.2v.1" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>'),
  splash: svg('<path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11Z" fill="currentColor"/>'),
  bounce: svg('<path d="M4 20h16M7 16c2-3 8-3 10 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M12 13V3m-4 4 4-4 4 4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'),
  kitten: svg('<path d="M5 4l3.5 4h7L19 4l1 8a8 8 0 0 1-16 0Z" fill="currentColor"/><circle cx="9" cy="12.5" r="1.3" fill="#fff"/><circle cx="15" cy="12.5" r="1.3" fill="#fff"/><path d="M11 15.5h2l-1 1Z" fill="#fff"/>'),
  party: svg('<path d="m3 21 5.5-14 8.5 8.5Z" fill="currentColor"/><path d="M14 3v2m5 0-1.5 1.5M21 10h-2M11 6l1 1M17 12l1 1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
};

export type IconName = keyof typeof ICONS;
