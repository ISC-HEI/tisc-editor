import { FileCode, FileJson, Image, Book, Notebook, Terminal } from 'lucide';

const FILE_EXTENSIONS = {
  // Documents
  typ: {
    language: 'typst',
    color: '#8b5cf6',
    icon: Book,
    allowed: true,
    spellcheck: true,
  },
  md: {
    language: 'markdown',
    color: '#8b5cf6',
    icon: Notebook,
    allowed: true,
    spellcheck: true,
  },
  markdown: {
    language: 'markdown',
    color: '#8b5cf6',
    icon: Notebook,
    allowed: true,
    spellcheck: true,
  },
  txt: {
    language: 'plaintext',
    color: '#94a3b8',
    icon: FileCode,
    allowed: true,
    spellcheck: true,
  },
  tex: {
    language: 'latex',
    color: '#8b5cf6',
    icon: Book,
    allowed: true,
    spellcheck: true,
  },
  bib: {
    language: 'plaintext',
    color: '#8b5cf6',
    icon: Book,
    allowed: true,
    spellcheck: false,
  },

  // Configuration / data
  json: {
    language: 'json',
    color: '#f59e0b',
    icon: FileJson,
    allowed: true,
    spellcheck: false,
  },
  jsonc: {
    language: 'json',
    color: '#f59e0b',
    icon: FileJson,
    allowed: true,
    spellcheck: false,
  },
  yaml: {
    language: 'yaml',
    color: '#f59e0b',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  yml: {
    language: 'yaml',
    color: '#f59e0b',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  toml: {
    language: 'ini',
    color: '#f59e0b',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  ini: {
    language: 'ini',
    color: '#f59e0b',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  cfg: {
    language: 'ini',
    color: '#f59e0b',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  conf: {
    language: 'ini',
    color: '#f59e0b',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  env: {
    language: 'plaintext',
    color: '#f59e0b',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },

  // JavaScript / TypeScript
  js: {
    language: 'javascript',
    color: '#eab308',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  mjs: {
    language: 'javascript',
    color: '#eab308',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  cjs: {
    language: 'javascript',
    color: '#eab308',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  jsx: {
    language: 'javascript',
    color: '#eab308',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  ts: {
    language: 'typescript',
    color: '#3b82f6',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  mts: {
    language: 'typescript',
    color: '#3b82f6',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  cts: {
    language: 'typescript',
    color: '#3b82f6',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  tsx: {
    language: 'typescript',
    color: '#3b82f6',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },

  // Python
  py: {
    language: 'python',
    color: '#14b8a6',
    icon: Terminal,
    allowed: true,
    spellcheck: false,
  },
  pyw: {
    language: 'python',
    color: '#14b8a6',
    icon: Terminal,
    allowed: true,
    spellcheck: false,
  },
  pyi: {
    language: 'python',
    color: '#14b8a6',
    icon: Terminal,
    allowed: true,
    spellcheck: false,
  },

  // Shell
  sh: {
    language: 'shell',
    color: '#22c55e',
    icon: Terminal,
    allowed: true,
    spellcheck: false,
  },
  bash: {
    language: 'shell',
    color: '#22c55e',
    icon: Terminal,
    allowed: true,
    spellcheck: false,
  },
  zsh: {
    language: 'shell',
    color: '#22c55e',
    icon: Terminal,
    allowed: true,
    spellcheck: false,
  },
  fish: {
    language: 'shell',
    color: '#22c55e',
    icon: Terminal,
    allowed: true,
    spellcheck: false,
  },
  ksh: {
    language: 'shell',
    color: '#22c55e',
    icon: Terminal,
    allowed: true,
    spellcheck: false,
  },
  csh: {
    language: 'shell',
    color: '#22c55e',
    icon: Terminal,
    allowed: true,
    spellcheck: false,
  },

  // PowerShell / Windows
  ps1: {
    language: 'powershell',
    color: '#2563eb',
    icon: Terminal,
    allowed: true,
    spellcheck: false,
  },
  psm1: {
    language: 'powershell',
    color: '#2563eb',
    icon: Terminal,
    allowed: true,
    spellcheck: false,
  },
  psd1: {
    language: 'powershell',
    color: '#2563eb',
    icon: Terminal,
    allowed: true,
    spellcheck: false,
  },
  bat: {
    language: 'bat',
    color: '#22c55e',
    icon: Terminal,
    allowed: true,
    spellcheck: false,
  },
  cmd: {
    language: 'bat',
    color: '#22c55e',
    icon: Terminal,
    allowed: true,
    spellcheck: false,
  },

  // C / C++
  c: {
    language: 'c',
    color: '#64748b',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  h: {
    language: 'c',
    color: '#64748b',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  cpp: {
    language: 'cpp',
    color: '#64748b',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  cc: {
    language: 'cpp',
    color: '#64748b',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  cxx: {
    language: 'cpp',
    color: '#64748b',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  hpp: {
    language: 'cpp',
    color: '#64748b',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  hh: {
    language: 'cpp',
    color: '#64748b',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  hxx: {
    language: 'cpp',
    color: '#64748b',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },

  // JVM
  java: {
    language: 'java',
    color: '#ef4444',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  kt: {
    language: 'kotlin',
    color: '#a855f7',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  kts: {
    language: 'kotlin',
    color: '#a855f7',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  scala: {
    language: 'scala',
    color: '#dc2626',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  sc: {
    language: 'scala',
    color: '#dc2626',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  groovy: {
    language: 'groovy',
    color: '#22c55e',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },

  // Other languages
  rs: {
    language: 'rust',
    color: '#f97316',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  go: {
    language: 'go',
    color: '#06b6d4',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  swift: {
    language: 'swift',
    color: '#f97316',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  php: {
    language: 'php',
    color: '#8b5cf6',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  rb: {
    language: 'ruby',
    color: '#ef4444',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  rake: {
    language: 'ruby',
    color: '#ef4444',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },

  // Web
  html: {
    language: 'html',
    color: '#f97316',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  htm: {
    language: 'html',
    color: '#f97316',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  xml: {
    language: 'xml',
    color: '#f97316',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  css: {
    language: 'css',
    color: '#3b82f6',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  scss: {
    language: 'scss',
    color: '#ec4899',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  less: {
    language: 'less',
    color: '#3b82f6',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  svg: {
    language: null,
    type: 'image',
    color: '#f43f5e',
    icon: Image,
    allowed: true,
    spellcheck: false,
  },

  // Database / API
  sql: {
    language: 'sql',
    color: '#06b6d4',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  graphql: {
    language: 'graphql',
    color: '#e535ab',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  gql: {
    language: 'graphql',
    color: '#e535ab',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },

  // Docker / Git
  dockerfile: {
    language: 'dockerfile',
    color: '#2496ed',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  diff: {
    language: 'diff',
    color: '#22c55e',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },
  patch: {
    language: 'diff',
    color: '#22c55e',
    icon: FileCode,
    allowed: true,
    spellcheck: false,
  },

  // Themes
  tmtheme: {
    language: 'xml',
    color: '#ec4899',
    icon: Notebook,
    allowed: true,
    spellcheck: false,
  },

  // Images / binary files
  jpg: {
    language: null,
    type: 'image',
    color: '#f43f5e',
    icon: Image,
    allowed: true,
    spellcheck: false,
  },
  jpeg: {
    language: null,
    type: 'image',
    color: '#f43f5e',
    icon: Image,
    allowed: true,
    spellcheck: false,
  },
  png: {
    language: null,
    type: 'image',
    color: '#f43f5e',
    icon: Image,
    allowed: true,
    spellcheck: false,
  },
  gif: {
    language: null,
    type: 'image',
    color: '#f43f5e',
    icon: Image,
    allowed: true,
    spellcheck: false,
  },
  webp: {
    language: null,
    type: 'image',
    color: '#f43f5e',
    icon: Image,
    allowed: true,
    spellcheck: false,
  },

  // Fonts
  ttf: {
    language: null,
    color: '#94a3b8',
    icon: FileCode,
    allowed: false,
    spellcheck: false,
  },
  otf: {
    language: null,
    color: '#94a3b8',
    icon: FileCode,
    allowed: false,
    spellcheck: false,
  },

  // Archives
  zip: {
    language: null,
    color: '#94a3b8',
    icon: FileCode,
    allowed: false,
    spellcheck: false,
  },
  rar: {
    language: null,
    color: '#94a3b8',
    icon: FileCode,
    allowed: false,
    spellcheck: false,
  },
  '7z': {
    language: null,
    color: '#94a3b8',
    icon: FileCode,
    allowed: false,
    spellcheck: false,
  },
};

const DEFAULT_EXTENSION_CONFIG = {
  language: 'plaintext',
  type: 'code',
  color: '#94a3b8',
  icon: FileCode,
  allowed: null,
  spellcheck: false,
};

export function getExtensionConfig(extension) {
  if (!extension) return DEFAULT_EXTENSION_CONFIG;

  const ext = extension.toLowerCase().replace(/^\./, '');

  return FILE_EXTENSIONS[ext] ?? DEFAULT_EXTENSION_CONFIG;
}
