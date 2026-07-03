import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getInfos, GITLAB_API_URL } from './gitlab.js'

vi.mock('../utils/logger.js', () => ({ log: vi.fn() }))

const mockGitlabUser = {
  id: 42,
  username: 'testUser',
  name: 'Test User',
  avatar_url: 'https://gitlab.com/avatar.png',
  web_url: 'https://gitlab.com/testUser',
}

const mockGitlabProject = {
  path: 'my-repo',
  visibility: 'public',
  default_branch: 'main',
  http_url_to_repo: 'https://gitlab.com/testUser/my-repo.git',
  web_url: 'https://gitlab.com/testUser/my-repo',
  description: 'A test repo',
  star_count: 3,
}

function jsonResponse(data: any, headers: Record<string, string> = {}) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(headers),
    json: async () => data,
  }
}

describe('getInfos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should fetch a user and map projects to the internal repository shape', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([mockGitlabUser]))
      .mockResolvedValueOnce(jsonResponse([mockGitlabProject]))
    vi.stubGlobal('fetch', fetchMock)

    const result = await getInfos({ username: 'testUser', branch: 'main' })

    expect(fetchMock).toHaveBeenCalledWith(`${GITLAB_API_URL}/users?username=testUser`, { headers: {} })
    expect(result.user).toMatchObject({ login: 'testUser', name: 'Test User' })
    expect(result.branch).toBe('main')
    expect(result.repos).toEqual([
      expect.objectContaining({
        name: 'my-repo',
        owner: { login: 'testUser' },
        fork: false,
        private: false,
        size: 1,
        default_branch: 'main',
        clone_url: 'https://gitlab.com/testUser/my-repo.git',
        html_url: 'https://gitlab.com/testUser/my-repo',
        description: 'A test repo',
        stargazers_count: 3,
      }),
    ])
  })

  it('should mark forks, private and empty repositories', async () => {
    const projects = [
      { ...mockGitlabProject, forked_from_project: { id: 1 } },
      { ...mockGitlabProject, path: 'private-repo', visibility: 'private' },
      { ...mockGitlabProject, path: 'empty-repo', default_branch: null },
    ]
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([mockGitlabUser]))
      .mockResolvedValueOnce(jsonResponse(projects))
    vi.stubGlobal('fetch', fetchMock)

    const { repos } = await getInfos({ username: 'testUser', branch: 'main' })

    expect(repos[0]).toMatchObject({ fork: true })
    expect(repos[1]).toMatchObject({ name: 'private-repo', private: true })
    expect(repos[2]).toMatchObject({ name: 'empty-repo', size: 0 })
  })

  it('should paginate the project list using the x-next-page header', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([mockGitlabUser]))
      .mockResolvedValueOnce(jsonResponse([mockGitlabProject], { 'x-next-page': '2' }))
      .mockResolvedValueOnce(jsonResponse([{ ...mockGitlabProject, path: 'repo-page-2' }]))
    vi.stubGlobal('fetch', fetchMock)

    const { repos } = await getInfos({ username: 'testUser', branch: 'main' })

    expect(repos).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledWith(`${GITLAB_API_URL}/users/42/projects?per_page=100&page=1`, { headers: {} })
    expect(fetchMock).toHaveBeenCalledWith(`${GITLAB_API_URL}/users/42/projects?per_page=100&page=2`, { headers: {} })
  })

  it('should send the token as PRIVATE-TOKEN header and fetch user details', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([mockGitlabUser]))
      .mockResolvedValueOnce(jsonResponse({ ...mockGitlabUser, bio: 'My bio' }))
      .mockResolvedValueOnce(jsonResponse([mockGitlabProject]))
    vi.stubGlobal('fetch', fetchMock)

    const { user } = await getInfos({ username: 'testUser', token: 'secret', branch: 'main' })

    expect(fetchMock).toHaveBeenCalledWith(`${GITLAB_API_URL}/users/42`, { headers: { 'PRIVATE-TOKEN': 'secret' } })
    expect(user).toMatchObject({ login: 'testUser', bio: 'My bio' })
  })

  it('should fall back to the groups API when no user matches', async () => {
    const group = {
      id: 7,
      path: 'test-group',
      name: 'Test Group',
      description: 'A group',
      avatar_url: null,
      web_url: 'https://gitlab.com/groups/test-group',
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(group))
      .mockResolvedValueOnce(jsonResponse([mockGitlabProject]))
    vi.stubGlobal('fetch', fetchMock)

    const result = await getInfos({ username: 'test-group', branch: 'main' })

    expect(fetchMock).toHaveBeenCalledWith(`${GITLAB_API_URL}/groups/test-group?with_projects=false`, { headers: {} })
    expect(fetchMock).toHaveBeenCalledWith(`${GITLAB_API_URL}/groups/test-group/projects?per_page=100&page=1`, { headers: {} })
    expect(result.user).toMatchObject({ login: 'test-group', name: 'Test Group', bio: 'A group' })
    expect(result.repos[0]).toMatchObject({ owner: { login: 'test-group' } })
  })

  it('should throw a clear error when the API request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))

    await expect(getInfos({ username: 'ghost', branch: 'main' }))
      .rejects
      .toThrow(`GitLab API request failed for '/users?username=ghost' (status: 500).`)
  })

  it('should throw a clear error when neither a user nor a group matches', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce({ ok: false, status: 404 })
    vi.stubGlobal('fetch', fetchMock)

    await expect(getInfos({ username: 'ghost', branch: 'main' }))
      .rejects
      .toThrow(`No GitLab user or group found for 'ghost'.`)
  })
})
