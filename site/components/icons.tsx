// 少量内联图标（gravity-ui 风格的线性图标）
type P = React.SVGProps<SVGSVGElement>;
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 16 16", width: 16, height: 16 } as const;

export const LogoMark = (p: P) => (
  <svg {...base} {...p} viewBox="0 0 24 24" strokeWidth={2}>
    <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />
  </svg>
);
export const SunIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.4 3.4l.85.85M11.75 11.75l.85.85M3.4 12.6l.85-.85M11.75 4.25l.85-.85" />
  </svg>
);
export const MoonIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7z" />
  </svg>
);
export const ExternalIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M9 2.5h4.5V7M13.5 2.5L7 9M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" />
  </svg>
);
export const PlayIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4.5 3v10l8.5-5z" />
  </svg>
);
export const ChevronLeft = (p: P) => (
  <svg {...base} {...p}>
    <path d="M10 3.5L5.5 8l4.5 4.5" />
  </svg>
);
export const ChevronRight = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 3.5L10.5 8 6 12.5" />
  </svg>
);
export const ChevronDown = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3.5 6l4.5 4.5L12.5 6" />
  </svg>
);
export const BulbIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 12.5h4M6.5 14.5h3M8 1.5a4.5 4.5 0 0 0-2.6 8.2c.4.3.6.7.6 1.2v.1h4v-.1c0-.5.2-.9.6-1.2A4.5 4.5 0 0 0 8 1.5z" />
  </svg>
);
export const CodeIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 4.5L1.5 8 5 11.5M11 4.5L14.5 8 11 11.5M9.5 2.5l-3 11" />
  </svg>
);
export const HistoryIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M2 8a6 6 0 1 0 1.8-4.3L2 5.5M2 2v3.5h3.5M8 5v3l2 1.5" />
  </svg>
);
export const DocIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M9.5 1.5h-5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-9zM9.5 1.5v3h3M5.5 8.5h5M5.5 11h3.5" />
  </svg>
);
export const PinIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M8 1.5v3M3 6.5l10 0M4.5 6.5l1 4h5l1-4M8 10.5v4" />
  </svg>
);
export const EyeIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
    <circle cx="8" cy="8" r="2" />
  </svg>
);
export const SearchOffIcon = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L14 14M5.5 5.5l3 3M8.5 5.5l-3 3" />
  </svg>
);
