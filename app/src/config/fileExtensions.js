import { FileCode, FileJson, Image, Book, Notebook, Terminal } from 'lucide';

export const FILE_EXTENSIONS = {
  // Documents
  typ: {
    language: 'typst',
    color: '#8b5cf6',
    icon: Book,
    allowed: true,
  },
  md: {
    language: 'markdown',
    color: '#8b5cf6',
    icon: Notebook,
    allowed: true,
  },
  markdown: {
    language: 'markdown',
    color: '#8b5cf6',
    icon: Notebook,
    allowed: true,
  },
  txt: {
    language: 'plaintext',
    color: '#94a3b8',
    icon: FileCode,
    allowed: true,
  },
  tex: {
    language: 'latex',
    color: '#8b5cf6',
    icon: Book,
    allowed: true,
  },
  bib: {
    language: 'plaintext',
    color: '#8b5cf6',
    icon: Book,
    allowed: true,
  },

  // Configuration / data
  json: {
    language: 'json',
    color: '#f59e0b',
    icon: FileJson,
    allowed: true,
  },
  jsonc: {
    language: 'json',
    color: '#f59e0b',
    icon: FileJson,
    allowed: true,
  },
  yaml: {
    language: 'yaml',
    color: '#f59e0b',
    icon: FileCode,
    allowed: true,
  },
  yml: {
    language: 'yaml',
    color: '#f59e0b',
    icon: FileCode,
    allowed: true,
  },
  toml: {
    language: 'ini',
    color: '#f59e0b',
    icon: FileCode,
    allowed: true,
  },
  ini: {
    language: 'ini',
    color: '#f59e0b',
    icon: FileCode,
    allowed: true,
  },
  cfg: {
    language: 'ini',
    color: '#f59e0b',
    icon: FileCode,
    allowed: true,
  },
  conf: {
    language: 'ini',
    color: '#f59e0b',
    icon: FileCode,
    allowed: true,
  },
  env: {
    language: 'plaintext',
    color: '#f59e0b',
    icon: FileCode,
    allowed: true,
  },

  // JavaScript / TypeScript
  js: {
    language: 'javascript',
    color: '#eab308',
    icon: FileCode,
    allowed: true,
  },
  mjs: {
    language: 'javascript',
    color: '#eab308',
    icon: FileCode,
    allowed: true,
  },
  cjs: {
    language: 'javascript',
    color: '#eab308',
    icon: FileCode,
    allowed: true,
  },
  jsx: {
    language: 'javascript',
    color: '#eab308',
    icon: FileCode,
    allowed: true,
  },
  ts: {
    language: 'typescript',
    color: '#3b82f6',
    icon: FileCode,
    allowed: true,
  },
  mts: {
    language: 'typescript',
    color: '#3b82f6',
    icon: FileCode,
    allowed: true,
  },
  cts: {
    language: 'typescript',
    color: '#3b82f6',
    icon: FileCode,
    allowed: true,
  },
  tsx: {
    language: 'typescript',
    color: '#3b82f6',
    icon: FileCode,
    allowed: true,
  },

  // Python
  py: {
    language: 'python',
    color: '#14b8a6',
    icon: Terminal,
    allowed: true,
  },
  pyw: {
    language: 'python',
    color: '#14b8a6',
    icon: Terminal,
    allowed: true,
  },
  pyi: {
    language: 'python',
    color: '#14b8a6',
    icon: Terminal,
    allowed: true,
  },

  // Shell
  sh: {
    language: 'shell',
    color: '#22c55e',
    icon: Terminal,
    allowed: true,
  },
  bash: {
    language: 'shell',
    color: '#22c55e',
    icon: Terminal,
    allowed: true,
  },
  zsh: {
    language: 'shell',
    color: '#22c55e',
    icon: Terminal,
    allowed: true,
  },
  fish: {
    language: 'shell',
    color: '#22c55e',
    icon: Terminal,
    allowed: true,
  },
  ksh: {
    language: 'shell',
    color: '#22c55e',
    icon: Terminal,
    allowed: true,
  },
  csh: {
    language: 'shell',
    color: '#22c55e',
    icon: Terminal,
    allowed: true,
  },

  // PowerShell / Windows
  ps1: {
    language: 'powershell',
    color: '#2563eb',
    icon: Terminal,
    allowed: true,
  },
  psm1: {
    language: 'powershell',
    color: '#2563eb',
    icon: Terminal,
    allowed: true,
  },
  psd1: {
    language: 'powershell',
    color: '#2563eb',
    icon: Terminal,
    allowed: true,
  },
  bat: {
    language: 'bat',
    color: '#22c55e',
    icon: Terminal,
    allowed: true,
  },
  cmd: {
    language: 'bat',
    color: '#22c55e',
    icon: Terminal,
    allowed: true,
  },

  // C / C++
  c: {
    language: 'c',
    color: '#64748b',
    icon: FileCode,
    allowed: true,
  },
  h: {
    language: 'c',
    color: '#64748b',
    icon: FileCode,
    allowed: true,
  },
  cpp: {
    language: 'cpp',
    color: '#64748b',
    icon: FileCode,
    allowed: true,
  },
  cc: {
    language: 'cpp',
    color: '#64748b',
    icon: FileCode,
    allowed: true,
  },
  cxx: {
    language: 'cpp',
    color: '#64748b',
    icon: FileCode,
    allowed: true,
  },
  hpp: {
    language: 'cpp',
    color: '#64748b',
    icon: FileCode,
    allowed: true,
  },
  hh: {
    language: 'cpp',
    color: '#64748b',
    icon: FileCode,
    allowed: true,
  },
  hxx: {
    language: 'cpp',
    color: '#64748b',
    icon: FileCode,
    allowed: true,
  },

  // JVM
  java: {
    language: 'java',
    color: '#ef4444',
    icon: FileCode,
    allowed: true,
  },
  kt: {
    language: 'kotlin',
    color: '#a855f7',
    icon: FileCode,
    allowed: true,
  },
  kts: {
    language: 'kotlin',
    color: '#a855f7',
    icon: FileCode,
    allowed: true,
  },
  scala: {
    language: 'scala',
    color: '#dc2626',
    icon: FileCode,
    allowed: true,
  },
  sc: {
    language: 'scala',
    color: '#dc2626',
    icon: FileCode,
    allowed: true,
  },
  groovy: {
    language: 'groovy',
    color: '#22c55e',
    icon: FileCode,
    allowed: true,
  },

  // Other languages
  rs: {
    language: 'rust',
    color: '#f97316',
    icon: FileCode,
    allowed: true,
  },
  go: {
    language: 'go',
    color: '#06b6d4',
    icon: FileCode,
    allowed: true,
  },
  swift: {
    language: 'swift',
    color: '#f97316',
    icon: FileCode,
    allowed: true,
  },
  php: {
    language: 'php',
    color: '#8b5cf6',
    icon: FileCode,
    allowed: true,
  },
  rb: {
    language: 'ruby',
    color: '#ef4444',
    icon: FileCode,
    allowed: true,
  },
  rake: {
    language: 'ruby',
    color: '#ef4444',
    icon: FileCode,
    allowed: true,
  },

  // Web
  html: {
    language: 'html',
    color: '#f97316',
    icon: FileCode,
    allowed: true,
  },
  htm: {
    language: 'html',
    color: '#f97316',
    icon: FileCode,
    allowed: true,
  },
  xml: {
    language: 'xml',
    color: '#f97316',
    icon: FileCode,
    allowed: true,
  },
  css: {
    language: 'css',
    color: '#3b82f6',
    icon: FileCode,
    allowed: true,
  },
  scss: {
    language: 'scss',
    color: '#ec4899',
    icon: FileCode,
    allowed: true,
  },
  less: {
    language: 'less',
    color: '#3b82f6',
    icon: FileCode,
    allowed: true,
  },
  svg: {
    language: 'xml',
    color: '#f43f5e',
    icon: Image,
    allowed: true,
  },

  // Database / API
  sql: {
    language: 'sql',
    color: '#06b6d4',
    icon: FileCode,
    allowed: true,
  },
  graphql: {
    language: 'graphql',
    color: '#e535ab',
    icon: FileCode,
    allowed: true,
  },
  gql: {
    language: 'graphql',
    color: '#e535ab',
    icon: FileCode,
    allowed: true,
  },

  // Docker / Git
  dockerfile: {
    language: 'dockerfile',
    color: '#2496ed',
    icon: FileCode,
    allowed: true,
  },
  diff: {
    language: 'diff',
    color: '#22c55e',
    icon: FileCode,
    allowed: true,
  },
  patch: {
    language: 'diff',
    color: '#22c55e',
    icon: FileCode,
    allowed: true,
  },

  // Themes
  tmtheme: {
    language: 'xml',
    color: '#ec4899',
    icon: Notebook,
    allowed: true,
  },

  // Images / binary files
  jpg: {
    language: null,
    color: '#f43f5e',
    icon: Image,
    allowed: false,
  },
  jpeg: {
    language: null,
    color: '#f43f5e',
    icon: Image,
    allowed: false,
  },
  png: {
    language: null,
    color: '#f43f5e',
    icon: Image,
    allowed: false,
  },
  gif: {
    language: null,
    color: '#f43f5e',
    icon: Image,
    allowed: false,
  },
  webp: {
    language: null,
    color: '#f43f5e',
    icon: Image,
    allowed: false,
  },

  // Fonts
  ttf: {
    language: null,
    color: '#94a3b8',
    icon: FileCode,
    allowed: false,
  },
  otf: {
    language: null,
    color: '#94a3b8',
    icon: FileCode,
    allowed: false,
  },

  // Archives
  zip: {
    language: null,
    color: '#94a3b8',
    icon: FileCode,
    allowed: false,
  },
  rar: {
    language: null,
    color: '#94a3b8',
    icon: FileCode,
    allowed: false,
  },
  '7z': {
    language: null,
    color: '#94a3b8',
    icon: FileCode,
    allowed: false,
  },
};

export const DEFAULT_EXTENSION_CONFIG = {
  language: 'plaintext',
  color: '#94a3b8',
  icon: FileCode,
  allowed: null,
};

export function getExtensionConfig(extension) {
  if (!extension) return DEFAULT_EXTENSION_CONFIG;

  const ext = extension.toLowerCase().replace(/^\./, '');

  return FILE_EXTENSIONS[ext] ?? DEFAULT_EXTENSION_CONFIG;
}

export function getEditorLanguage(extension) {
  return getExtensionConfig(extension).language;
}

export function getExtensionColor(extension) {
  return getExtensionConfig(extension).color;
}

export function getExtensionIcon(extension) {
  return getExtensionConfig(extension).icon;
}

export function isExtensionAllowed(extension) {
  return getExtensionConfig(extension).allowed;
}
