import { defineConfig } from 'vitepress'

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'branch-schematic'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Branch Schematic",
  description: "A desktop project management application",
  base: process.env.GITHUB_ACTIONS ? `/${repoName}/` : '/',
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
