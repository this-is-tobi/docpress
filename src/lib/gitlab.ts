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
 * Parsed GitLab API response paired with its HTTP headers (used for pagination)
 */
interface GitlabResponse<T> {
  data: T
  headers: Headers
}

/**
 * Subset of the GitLab user/group API response consumed by DocPress
 */
interface GitlabUser {
  id: number
  username?: string
  path?: string
  name?: string
  bio?: string | null
  description?: string | null
  avatar_url?: string
  web_url?: string
}

/**
 * Subset of the GitLab project API response consumed by DocPress
 */
interface GitlabProject {
  path: string
  forked_from_project?: unknown
  visibility?: string
  default_branch?: string
  http_url_to_repo?: string
  web_url?: string
  description?: string | null
  star_count?: number
}

/**
 * Performs a GET request against the GitLab API
 *
 * @param path - API path starting with '/'
 * @param token - Optional GitLab token
 * @returns Object containing the parsed JSON body and the response headers
 * @throws Error if the request fails
 */
async function gitlabGet<T>(path: string, token?: GlobalOpts['token']): Promise<GitlabResponse<T>> {
  const response = await fetch(`${GITLAB_API_URL}${path}`, {
    headers: token ? { 'PRIVATE-TOKEN': token } : {},
  })
  if (!response.ok) {
    throw new Error(`GitLab API request failed for '${path}' (status: ${response.status}).`)
  }
  return { data: await response.json() as T, headers: response.headers }
}

/**
 * Fetches all pages of a GitLab API collection
 *
 * @param path - API path starting with '/' (query params allowed)
 * @param token - Optional GitLab token
 * @returns Array containing all items from all pages
 */
async function gitlabGetAll<T>(path: string, token?: GlobalOpts['token']): Promise<T[]> {
  const separator = path.includes('?') ? '&' : '?'
  const items: T[] = []
  let page: string | null = '1'

  while (page) {
    const res: GitlabResponse<T[]> = await gitlabGet<T[]>(`${path}${separator}per_page=100&page=${page}`, token)
    items.push(...res.data)
    page = res.headers.get('x-next-page') || null
  }
  return items
}

/**
 * Maps a GitLab user or group to the internal (GitHub-derived) user shape
 *
 * @param user - GitLab user or group object
 * @returns User object with the fields used by DocPress
 */
function mapUser(user: GitlabUser) {
  return {
    login: user.username ?? user.path,
    name: user.name,
    bio: user.bio ?? user.description ?? null,
    avatar_url: user.avatar_url,
    html_url: user.web_url,
  } as unknown as User
}

/**
 * Maps a GitLab project to the internal (GitHub-derived) repository shape
 *
 * @param project - GitLab project object
 * @param owner - Login of the user or group that owns the project
 * @returns Repository object with the fields used by DocPress
 */
function mapRepository(project: GitlabProject, owner: string) {
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

  const { data: users } = await gitlabGet<GitlabUser[]>(`/users?username=${encodeURIComponent(username)}`, token)

  if (users.length) {
    let user = users[0]
    if (token) {
      // The user detail endpoint requires authentication but provides extra fields (e.g. bio)
      user = await gitlabGet<GitlabUser>(`/users/${users[0].id}`, token).then(res => res.data).catch(() => users[0])
    }
    log(`   Get repositories infos.`, 'debug')
    const projects = await gitlabGetAll<GitlabProject>(`/users/${users[0].id}/projects`, token)
    return { user: mapUser(user), repos: projects.map(project => mapRepository(project, user.username ?? username)), branch }
  }

  log(`   No GitLab user '${username}' found, trying groups.`, 'debug')
  const group = await gitlabGet<GitlabUser>(`/groups/${encodeURIComponent(username)}?with_projects=false`, token)
    .then(res => res.data)
    .catch(() => {
      throw new Error(`No GitLab user or group found for '${username}'.`)
    })
  const projects = await gitlabGetAll<GitlabProject>(`/groups/${encodeURIComponent(username)}/projects`, token)
  return { user: mapUser(group), repos: projects.map(project => mapRepository(project, group.path ?? username)), branch }
}
