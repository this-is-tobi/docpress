import { appendFileSync } from 'node:fs'
import { basename } from 'node:path'
import type { getUserInfos } from '../utils/functions.js'
import { prettifyName } from '../utils/functions.js'

export interface Page {
  text: string
  link: string
}

export interface SidebarProject {
  text: string
  collapsed: boolean
  items: Page[]
}

export interface Feature {
  title: string
  details: string
  link: string
}

export interface Index {
  layout: string
  hero: {
    name: string
    tagline: string
  }
  features: Feature[]
}

export function addSources(repoUrl: string, outputPath: string) {
  const fileName = basename(outputPath)
  const title = fileName === 'readme.md' ? '\n## Sources' : '# Sources'

  const sourcesContent = `${title}\n\nTake a look at the [project sources](${repoUrl}).\n`

  appendFileSync(outputPath, sourcesContent, 'utf8')
}

// export function addContribution(outputPath: string) {
//   const sourcesContent = `
// If you'd like to improve or fix the code, check out the [contribution guidelines](/contribute).
// `

//   appendFileSync(outputPath, sourcesContent, 'utf8')
// }

export function generateIndex(features: Feature[], user: ReturnType<typeof getUserInfos>) {
  const { name, login, bio } = user
  return {
    layout: 'home',
    hero: {
      name: name ? `${name}'s projects` : `${login}'s projects`,
      tagline: bio ?? 'Robots are everywhere 🤖', // \U0001F916
    },
    features,
  }
}

export function generateFeatures(repoName: string, description: string, features?: Feature[]) {
  const content = {
    title: prettifyName(repoName),
    details: description,
    link: `/${repoName}/readme`,
  }

  return features ? [...features, content] : [content]
}

export function generateSidebar(repoName: string, sidebarProjects: SidebarProject[]) {
  const content = {
    text: prettifyName(repoName),
    collapsed: true,
    items: sidebarProjects,
  }

  return sidebarProjects ? [...sidebarProjects, content] : [content]
}

export function generateSidebarProject(repoName: string, sidebarPages: Page[]) {
  return {
    text: prettifyName(repoName),
    collapsed: true,
    items: sidebarPages,
  }
}

export function generateSidebarPages(repoName: string, fileName: string, sidebarPages?: Page[]) {
  const content = {
    text: fileName === 'readme' ? 'Introduction' : prettifyName(fileName),
    link: `/${repoName}/${fileName}`,
  }

  return sidebarPages ? [...sidebarPages, content] : [content]
}
