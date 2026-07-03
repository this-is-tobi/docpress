import type { GlobalOpts } from '../schemas/global.js'
import type { FetchOpts } from '../schemas/fetch.js'
import { log } from '../utils/logger.js'
import type { getInfos as getGithubInfos } from './git.js'

/**
 * Base URL of the GitLab REST API
 */
export const GITLAB_API_URL = 'https://gitlab.com/api/v4'

type User = Awaited<ReturnType<typeof getGithubInfos>>['user']
type Repository = Awaited<ReturnType<typeof getGithubInfos>>['repos'][number]

/**
 * Performs a GET request against the GitLab API
 *
 * @param path - API path starting with '/'
 * @param token - Optional GitLab token
 * @returns Object containing the parsed JSON body and the response headers
 * @throws Error if the request fails
 */
async function gitlabGet(path: string, token?: GlobalOpts['token']) {
  const response = await fetch(`${GITLAB_API_URL}${path}`, {
    headers: token ? { 'PRIVATE-TOKEN': token } : {},
  })
  if (!response.ok) {
    throw new Error(`GitLab API request failed for '${path}' (status: ${response.status}).`)
  }
  return { data: await response.json(), headers: response.headers }
}

/**
 * Fetches all pages of a GitLab API collection
 *
 * @param path - API path starting with '/' (query params allowed)
 * @param token - Optional GitLab token
 * @returns Array containing all items from all pages
 */
async function gitlabGetAll(path: string, token?: GlobalOpts['token']) {
  const separator = path.includes('?') ? '&' : '?'
  const items: any[] = []
  let page: string | null = '1'

  while (page) {
    const { data, headers } = await gitlabGet(`${path}${separator}per_page=100&page=${page}`, token)
    items.push(...data)
    page = headers.get('x-next-page') || null
  }
  return items
}

/**
 * Maps a GitLab user or group to the internal user shape
 *
 * @param user - GitLab user or group object
 * @returns User object with the fields used by DocPress
 */
function mapUser(user: any) {
  return {
    login: user.username ?? user.path,
    name: user.name,
    bio: user.bio ?? user.description ?? null,
    avatar_url: user.avatar_url,
    html_url: user.web_url,
  } as unknown as User
}

/**
 * Maps a GitLab project to the internal repository shape
 *
 * @param project - GitLab project object
 * @param owner - Login of the user or group that owns the project
 * @returns Repository object with the fields used by DocPress
 */
function mapRepository(project: any, owner: string) {
  return {
    name: project.path,
    owner: { login: owner },
    fork: !!project.forked_from_project,
    private: project.visibility !== 'public',
    // An empty repository has no default branch
    size: project.default_branch ? 1 : 0,
    default_branch: project.default_branch,
    clone_url: project.http_url_to_repo,
    html_url: project.web_url,
    description: project.description,
    stargazers_count: project.star_count,
  } as unknown as Repository
}

/**
 * Fetches user and repository information from GitLab
 * Falls back to the groups API when no user matches the given name
 *
 * @param options - Options for retrieving GitLab data
 * @param options.username - GitLab username or group path
 * @param options.token - GitLab API token
 * @param options.branch - Branch to use for documentation
 * @returns Object containing user information, repositories, and branch
 */
export async function getInfos({ username, token, branch }: Pick<FetchOpts, 'branch'> & Pick<GlobalOpts, 'token'> & { username: GlobalOpts['usernames'][number] }) {
  log(`   Get infos for username '${username}'.`, 'info')

  const { data: users } = await gitlabGet(`/users?username=${encodeURIComponent(username)}`, token)

  if (users.length) {
    let user = users[0]
    if (token) {
      // The user detail endpoint requires authentication but provides extra fields (e.g. bio)
      user = await gitlabGet(`/users/${users[0].id}`, token).then(res => res.data).catch(() => users[0])
    }
    log(`   Get repositories infos.`, 'debug')
    const projects = await gitlabGetAll(`/users/${users[0].id}/projects`, token)
    return { user: mapUser(user), repos: projects.map(project => mapRepository(project, user.username)), branch }
  }

  log(`   No GitLab user '${username}' found, trying groups.`, 'debug')
  const group = await gitlabGet(`/groups/${encodeURIComponent(username)}?with_projects=false`, token)
    .then(res => res.data)
    .catch(() => {
      throw new Error(`No GitLab user or group found for '${username}'.`)
    })
  const projects = await gitlabGetAll(`/groups/${encodeURIComponent(username)}/projects`, token)
  return { user: mapUser(group), repos: projects.map(project => mapRepository(project, group.path)), branch }
}
