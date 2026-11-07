<script setup lang="ts">
import { useData } from 'vitepress'
import { computed, ref } from 'vue'

interface Contribution {
  author: string
  owner: string
  name: string
  avatar_url?: string
  html_url: string
  description: string | null
  stargazers_count: number
  language: string | null
  archived?: boolean
  pull_requests: number
  last_merged_at?: string
  pull_requests_url: string
}

// GitHub's linguist colors for the languages most often met; others get a neutral dot
const languageColors: Record<string, string> = {
  C: '#555555',
  'C#': '#178600',
  'C++': '#f34b7d',
  CSS: '#663399',
  Dart: '#00b4ab',
  Dockerfile: '#384d54',
  Elixir: '#6e4a7e',
  Go: '#00add8',
  'Go Template': '#00add8',
  Groovy: '#4298b8',
  HCL: '#844fba',
  HTML: '#e34c26',
  Haskell: '#5e5086',
  Java: '#b07219',
  JavaScript: '#f1e05a',
  Jinja: '#a52a22',
  Jsonnet: '#0064bd',
  'Jupyter Notebook': '#da5b0b',
  Kotlin: '#a97bff',
  Lua: '#000080',
  Makefile: '#427819',
  Mustache: '#724b3b',
  Nix: '#7e7eff',
  PHP: '#4f5d95',
  PowerShell: '#012456',
  Python: '#3572a5',
  Ruby: '#701516',
  Rust: '#dea584',
  SCSS: '#c6538c',
  Scala: '#c22d40',
  Shell: '#89e051',
  Smarty: '#f0c040',
  Svelte: '#ff3e00',
  Swift: '#f05138',
  TypeScript: '#3178c6',
  Vue: '#41b883',
  Zig: '#ec915c',
}

const { frontmatter, lang } = useData()

const contributions = computed<Contribution[]>(() => Array.isArray(frontmatter.value.contributions) ? frontmatter.value.contributions : [])
const pullRequests = computed(() => contributions.value.reduce((sum, { pull_requests }) => sum + (pull_requests || 0), 0))
const showAuthors = computed(() => new Set(contributions.value.map(({ author }) => author)).size > 1)

type SortKey = 'stars' | 'pulls' | 'recent' | 'name'
type Compare = (a: Contribution, b: Contribution) => number

const sortOptions: { value: SortKey, label: string }[] = [
  { value: 'stars', label: 'Stars' },
  { value: 'pulls', label: 'Pull requests' },
  { value: 'recent', label: 'Latest merge' },
  { value: 'name', label: 'Name' },
]

// Names are compared without the locale, so the server render and the browser agree
const fullName = ({ owner, name }: Contribution) => `${owner}/${name}`.toLowerCase()
const mergedAt = ({ last_merged_at }: Contribution) => Date.parse(last_merged_at ?? '') || 0
const byStars: Compare = (a, b) => b.stargazers_count - a.stargazers_count
const byPulls: Compare = (a, b) => (b.pull_requests || 0) - (a.pull_requests || 0)
const byRecent: Compare = (a, b) => mergedAt(b) - mergedAt(a)
const byName: Compare = (a, b) => fullName(a) < fullName(b) ? -1 : Number(fullName(a) > fullName(b))

// Each order breaks its ties with the next comparisons
const comparisons: Record<SortKey, Compare[]> = {
  stars: [byStars, byPulls, byName],
  pulls: [byPulls, byStars, byName],
  recent: [byRecent, byStars, byName],
  name: [byName],
}

const sortKey = ref<SortKey>('stars')
const sorted = computed(() => [...contributions.value].sort((a, b) => {
  for (const compare of comparisons[sortKey.value]) {
    const result = compare(a, b)
    if (result) {
      return result
    }
  }
  return 0
}))

const numberFormat = computed(() => new Intl.NumberFormat(lang.value, { notation: 'compact', maximumFractionDigits: 1 }))
// Pinned to UTC so the server render and the browser agree on the month
const dateFormat = computed(() => new Intl.DateTimeFormat(lang.value, { month: 'short', year: 'numeric', timeZone: 'UTC' }))

/**
 * Keeps http(s) links only, so a `javascript:` scheme can never be rendered as a link
 */
function safeUrl(url?: string): string {
  try {
    const { protocol } = new URL(url ?? '')
    return protocol === 'https:' || protocol === 'http:' ? url! : '#'
  } catch {
    return '#'
  }
}

/**
 * Requests the avatar at twice its displayed size, rather than GitHub's full size
 */
function avatarUrl(url: string): string {
  try {
    const avatar = new URL(safeUrl(url))
    avatar.searchParams.set('s', '80')
    return avatar.toString()
  } catch {
    return ''
  }
}

function formatDate(date: string): string {
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? '' : dateFormat.value.format(parsed)
}
</script>

<template>
  <div class="DocpressContributions">
    <div class="container">
      <header class="intro">
        <Content class="vp-doc" />
      </header>

      <div v-if="contributions.length" class="toolbar">
        <p class="summary">
          <span><strong>{{ pullRequests }}</strong> merged pull requests</span>
          <span><strong>{{ contributions.length }}</strong> {{ contributions.length > 1 ? 'projects' : 'project' }}</span>
        </p>
        <label v-if="contributions.length > 1" class="sort">
          Sort by
          <span class="select">
            <select v-model="sortKey">
              <option v-for="option in sortOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </span>
        </label>
      </div>

      <!-- The cards glide to their new place when the order changes -->
      <TransitionGroup tag="ul" class="grid" move-class="moving">
        <li
          v-for="contribution in sorted"
          :key="`${contribution.author}/${contribution.owner}/${contribution.name}`"
          class="card"
        >
          <div class="head">
            <img
              v-if="contribution.avatar_url"
              class="avatar"
              :src="avatarUrl(contribution.avatar_url)"
              alt=""
              width="40"
              height="40"
              loading="lazy"
              decoding="async"
            >
            <h2 class="title">
              <a class="link" :href="safeUrl(contribution.html_url)" target="_blank" rel="noopener noreferrer">
                <span class="owner">{{ contribution.owner }}/</span><span class="name">{{ contribution.name }}</span>
              </a>
            </h2>
            <span v-if="contribution.archived" class="badge">Archived</span>
            <time v-if="contribution.last_merged_at" class="date" :datetime="contribution.last_merged_at" title="Latest merge">
              {{ formatDate(contribution.last_merged_at) }}
            </time>
          </div>

          <p v-if="contribution.description" class="description">
            {{ contribution.description }}
          </p>

          <div class="meta">
            <a
              class="pulls"
              :href="safeUrl(contribution.pull_requests_url)"
              target="_blank"
              rel="noopener noreferrer"
              :title="`See the pull requests merged into ${contribution.owner}/${contribution.name}`"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 3.25a.75.75 0 1 0 0 .005V3.25Z" /></svg>
              {{ contribution.pull_requests }} merged {{ contribution.pull_requests > 1 ? 'PRs' : 'PR' }}
            </a>
            <span class="stat" :title="`${contribution.stargazers_count} stars`">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Zm0 2.445L6.615 5.5a.75.75 0 0 1-.564.41l-3.097.45 2.24 2.184a.75.75 0 0 1 .216.664l-.528 3.084 2.769-1.456a.75.75 0 0 1 .698 0l2.77 1.456-.53-3.084a.75.75 0 0 1 .216-.664l2.24-2.183-3.096-.45a.75.75 0 0 1-.564-.41L8 2.694Z" /></svg>
              <span class="visually-hidden">Stars:</span>
              {{ numberFormat.format(contribution.stargazers_count) }}
            </span>
            <span v-if="contribution.language" class="stat">
              <span class="dot" :style="{ backgroundColor: languageColors[contribution.language] ?? 'var(--vp-c-text-3)' }" />
              {{ contribution.language }}
            </span>
          </div>

          <span v-if="showAuthors" class="author">by @{{ contribution.author }}</span>
        </li>
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped>
.DocpressContributions {
  padding: 32px 24px 96px;
}

@media (min-width: 640px) {
  .DocpressContributions {
    padding: 48px 48px 128px;
  }
}

@media (min-width: 960px) {
  .DocpressContributions {
    padding: 64px 64px 128px;
  }
}

.container {
  margin: 0 auto;
  max-width: 1152px;
}

.intro {
  max-width: 720px;
  margin-bottom: 20px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 16px 24px;
  margin-bottom: 32px;
}

.summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 28px;
  margin: 0;
  font-size: 14px;
  color: var(--vp-c-text-2);
}

.summary strong {
  margin-right: 6px;
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--vp-c-text-1);
}

.sort {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.select {
  position: relative;
  display: inline-flex;
}

.select select {
  padding: 5px 32px 5px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  font: inherit;
  font-weight: 500;
  color: var(--vp-c-text-1);
  background-color: var(--vp-c-bg);
  cursor: pointer;
  appearance: none;
  transition: border-color 0.25s;
}

.select select:hover {
  border-color: var(--vp-c-text-3);
}

.select select:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

/* Chevron drawn in the text colour, the native one being hidden with the appearance */
.select::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 11px;
  width: 12px;
  height: 12px;
  margin-top: -6px;
  background-color: currentColor;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E") center / contain no-repeat;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E") center / contain no-repeat;
  pointer-events: none;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.moving {
  transition: transform 0.5s cubic-bezier(0.2, 0, 0, 1);
}

@media (prefers-reduced-motion: reduce) {
  .moving {
    transition: none;
  }
}

.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 20px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background-color: var(--vp-c-bg-soft);
  transition: border-color 0.25s, box-shadow 0.25s, transform 0.25s;
}

.card:hover {
  border-color: var(--vp-c-brand-1);
  box-shadow: var(--vp-shadow-3);
  transform: translateY(-2px);
}

@media (prefers-reduced-motion: reduce) {
  .card,
  .card:hover {
    transition: none;
    transform: none;
  }
}

.head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}

.avatar {
  flex-shrink: 0;
  align-self: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background-color: var(--vp-c-default-soft);
}

.title {
  flex: 1;
  align-self: center;
  min-width: 0;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.link {
  color: inherit;
  text-decoration: none;
}

/* Stretches the repository link over the whole card */
.link::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 12px;
}

.link:focus-visible {
  outline: none;
}

.link:focus-visible::after {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.owner {
  font-weight: 500;
  color: var(--vp-c-text-2);
}

.name {
  color: var(--vp-c-text-1);
  transition: color 0.25s;
}

.card:hover .name {
  color: var(--vp-c-brand-1);
}

.badge {
  flex-shrink: 0;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  line-height: 22px;
  color: var(--vp-c-text-2);
  background-color: var(--vp-c-default-soft);
}

.description {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  font-size: 14px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 16px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.meta svg {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  fill: currentColor;
}

/* Raised above the stretched repository link, so it stays clickable */
.pulls {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.pulls:hover {
  text-decoration: underline;
}

.stat {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.date {
  flex-shrink: 0;
  font-size: 12px;
  line-height: 22px;
  white-space: nowrap;
  color: var(--vp-c-text-3);
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.author {
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
