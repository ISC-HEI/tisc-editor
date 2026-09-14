import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'TISC Editor',
  tagline: 'Documentation for TISC Editor',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://tisc-editor.isc-vs.ch',
  baseUrl: '/',

  organizationName: 'isc-hei',
  projectName: 'tisc-editor',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/isc-hei/tisc-editor/edit/main/',
          showLastUpdateTime: true,
          showLastUpdateAuthor: true,
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/banner.jpg',

    colorMode: {
      respectPrefersColorScheme: true,
    },

    navbar: {
      hideOnScroll: true,
      title: 'TISC Editor',

      logo: {
        alt: 'TISC Editor Logo',
        src: 'img/logo.png',
        width: 36,
        height: 36,
      },

      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'User Tutorial',
        },
        {
          type: 'docSidebar',
          sidebarId: 'techdocsSidebar',
          position: 'left',
          label: 'Technical Documentation',
        },
        {
          href: 'https://github.com/isc-hei/tisc-editor',
          position: 'right',
          className: 'header-github-link',
          'aria-label': 'GitHub repository',
        },
      ],
    },

    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
