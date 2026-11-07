<script setup lang="ts">
import { useSidebar } from 'vitepress/theme'
import { onMounted, ref } from 'vue'

const COLLAPSED_CLASS = 'docpress-sidebar-collapsed'
const ANIMATING_CLASS = 'docpress-sidebar-animating'

const { hasSidebar } = useSidebar()
// Every page load starts with the sidebar shown. Once hidden, it stays hidden while the
// visitor browses: client-side navigation keeps the class on the root element
const collapsed = ref(false)

onMounted(() => {
  // Stays in sync when the component mounts again during the visit (hot reload)
  collapsed.value = document.documentElement.classList.contains(COLLAPSED_CLASS)
})

function toggle() {
  const root = document.documentElement
  collapsed.value = !collapsed.value
  // The content only slides while toggling, not when a page with a sidebar opens
  root.classList.add(ANIMATING_CLASS)
  root.classList.toggle(COLLAPSED_CLASS, collapsed.value)
  window.setTimeout(() => root.classList.remove(ANIMATING_CLASS), 300)
}
</script>

<template>
  <button
    v-if="hasSidebar"
    class="DocpressSidebarToggle"
    type="button"
    aria-label="Toggle sidebar"
    aria-controls="VPSidebarNav"
    :aria-expanded="!collapsed"
    :title="collapsed ? 'Show sidebar' : 'Hide sidebar'"
    @click="toggle"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M9.5 4.5v15" />
      <path v-if="collapsed" d="m13.5 9.5 2.5 2.5-2.5 2.5" />
      <path v-else d="m16 9.5-2.5 2.5 2.5 2.5" />
    </svg>
  </button>
</template>

<style scoped>
/* Below 960px Vitepress opens the sidebar from its own menu button */
.DocpressSidebarToggle {
  display: none;
}

@media (min-width: 960px) {
  .DocpressSidebarToggle {
    display: flex;
    flex-shrink: 0;
    justify-content: center;
    align-items: center;
    width: 36px;
    height: 36px;
    margin-left: 16px;
    border-radius: 6px;
    color: var(--vp-c-text-2);
    transition: color 0.25s, background-color 0.25s;
  }

  .DocpressSidebarToggle:hover {
    color: var(--vp-c-text-1);
    background-color: var(--vp-c-default-soft);
  }

  .DocpressSidebarToggle svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
}
</style>

<style>
/* Collapsed state, set on the root element: the sidebar slides out and the content takes
   its room back. The navigation bar keeps its layout, minus the gap the sidebar left */
@media (min-width: 960px) {
  html.docpress-sidebar-collapsed .VPSidebar {
    opacity: 0;
    visibility: hidden;
    transform: translateX(-100%);
  }

  html.docpress-sidebar-collapsed .VPContent.has-sidebar {
    padding-left: 0;
  }

  html.docpress-sidebar-collapsed .VPNavBar.has-sidebar .title {
    background-color: var(--vp-nav-bg-color);
  }

  html.docpress-sidebar-collapsed .VPNavBar.has-sidebar .divider {
    padding-left: 0;
  }

  /* The title underline only lines up with the sidebar */
  html.docpress-sidebar-collapsed .VPNavBarTitle.has-sidebar .title {
    border-bottom-color: transparent;
  }

  /* The page is then laid out as one without sidebar: content and outline centred together */
  html.docpress-sidebar-collapsed .VPDoc.has-sidebar .container {
    display: flex;
    justify-content: center;
    max-width: 992px;
  }

  html.docpress-sidebar-collapsed .VPDoc.has-sidebar .content {
    max-width: 752px;
  }

  html.docpress-sidebar-animating .VPContent.has-sidebar {
    transition: padding-left 0.25s ease;
  }
}

@media (min-width: 1440px) {
  html.docpress-sidebar-collapsed .VPContent.has-sidebar {
    padding-left: calc((100vw - var(--vp-layout-max-width)) / 2);
  }

  html.docpress-sidebar-collapsed .VPDoc.has-sidebar .container {
    max-width: 1104px;
  }

  html.docpress-sidebar-collapsed .VPDoc.has-sidebar .content {
    max-width: 784px;
  }
}

@media (prefers-reduced-motion: reduce) {
  html.docpress-sidebar-animating .VPContent.has-sidebar {
    transition: none;
  }
}
</style>
