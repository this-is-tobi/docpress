<script setup>
import { useData } from 'vitepress'

const { frontmatter } = useData()
const repositories = frontmatter.value.repoList || []
</script>

<template>
  <div class="container">
    <Content class="vp-doc" />
    <div class="github-repo-cards">
      <div class="repo-grid">
        <a
          v-for="repo in repositories"
          :key="repo.name"
          :href="repo.html_url"
          target="_blank"
          rel="noopener noreferrer"
          class="repo-card VPFeature link"
        >
          <div class="repo-content">
            <span class="repo-name">{{ repo.owner }}/{{ repo.name }}</span>
            <p class="repo-description">{{ repo.description }}</p>
            <div class="repo-stats">
              <span class="repo-stars">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" class="repo-star-icon"><path fill-rule="evenodd" d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25zm0 2.445L6.615 5.5a.75.75 0 01-.564.41l-3.097.45 2.24 2.184a.75.75 0 01.216.664l-.528 3.084 2.769-1.456a.75.75 0 01.698 0l2.77 1.456-.53-3.084a.75.75 0 01.216-.664l2.24-2.183-3.096-.45a.75.75 0 01-.564-.41L8 2.694v.001z" /></svg>
                {{ repo.stargazers_count }}
              </span>
            </div>
          </div>
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  padding-left: 110px;
  padding-right: 110px;
  padding-top: 50px;
}

.github-repo-cards {
  margin: 2rem 0;
}

.repo-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 480px) and (max-width: 639px) {
  .repo-grid {
    grid-template-columns: repeat(1, 1fr);
  }

  .container {
    padding-left: 5%;
    padding-right: 5%;
    padding-top: 25px;
  }
}

@media (min-width: 640px) and (max-width: 959px) {
  .repo-grid {
    grid-template-columns: repeat(1, 1fr);
  }
}

@media (min-width: 960px) {
  .repo-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.repo-card {
  display: block;
  background-color: var(--vp-c-bg-alt);
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.3s ease, background-color 0.3s ease;
  text-decoration: none;
}

.repo-content {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.repo-name {
  font-size: x-large;
  font-weight: bold;
  color: var(--vp-c-brand-ligther);
  margin-top: 5px;
  margin-bottom: 15px;
}

.repo-description {
  font-size: 0.875rem;
  color: var(--vp-c-text-1);
  margin-bottom: 0;
  flex-grow: 1;
  line-height: 1.6;
}

.repo-stats {
  display: flex;
  align-items: center;
  font-size: 0.875rem;
  color: var(--vp-c-text-1);
  padding-top: 25px;
}

.repo-stars {
  display: flex;
  align-items: center;
}

.repo-star-icon {
  margin-right: 0.25rem;
  fill: currentColor;
}

.dark .repo-stats {
  color: var(--vp-c-text-2);
}
</style>
