import { defineConfig } from 'vitepress'

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'branch-schematic'
const siteBase = process.env.GITHUB_ACTIONS ? `/${repoName}/` : '/'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Branch Schematic",
  description: "A desktop project management application",
  base: siteBase,
  head: [
    ['link', { rel: 'icon', href: `${siteBase}favicon.svg`, type: 'image/svg+xml' }],
    ['link', { rel: 'shortcut icon', href: `${siteBase}favicon.ico` }],
    ['link', { rel: 'alternate icon', href: `${siteBase}favicon.ico`, type: 'image/x-icon' }],
  ],
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Documentation', link: '/docs/index' }
    ],

    sidebar: [
      {
        text: 'Documentation',
        items: [
          { text: 'Home', link: '/docs/' },
          { text: 'Dashboard', link: '/docs/dashboard' },
          { text: 'Branch Map', link: '/docs/branch-map' },
          { text: 'Releases', link: '/docs/releases' },
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ChefMooon/branch-schematic' }
    ]
  }
})
