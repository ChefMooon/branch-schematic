import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import { withBase } from 'vitepress'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      'nav-bar-title-before': () =>
        h('img', {
          class: 'site-header-logo',
          src: withBase('/favicon.svg'),
          alt: 'Branch Schematic logo',
          width: 24,
          height: 24,
        }),
    })
  },
}