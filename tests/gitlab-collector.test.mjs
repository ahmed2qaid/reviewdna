import assert from 'node:assert/strict';
import test from 'node:test';
import { GitLabCollector, createGitLabCollectorPlugin } from '@reviewdna/gitlab';

function jsonResponse(body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...headers }
  });
}

function fixtureFetch(calls) {
  return async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, headers: init.headers ?? {} });
    if (url.includes('/projects/group%2Fproject/merge_requests?')) {
      return jsonResponse([
        {
          iid: 7,
          title: 'Harden request validation',
          web_url: 'https://gitlab.example/group/project/-/merge_requests/7',
          merged_at: '2026-08-01T10:00:00Z',
          updated_at: '2026-08-01T11:00:00Z',
          author: { username: 'author1' }
        }
      ]);
    }
    if (url.includes('/projects/group%2Fproject/merge_requests/7/discussions?')) {
      return jsonResponse([
        {
          id: 'discussion-1',
          notes: [
            {
              id: 101,
              body: 'Validate the payload before calling the repository.',
              system: false,
              created_at: '2026-08-01T10:10:00Z',
              author: { username: 'reviewer1' },
              resolvable: true,
              resolved: true,
              position: { new_path: 'src/controller.ts', old_path: null }
            },
            {
              id: 102,
              body: 'Please add a regression test for this behavior.',
              system: false,
              created_at: '2026-08-01T10:12:00Z',
              author: { username: 'reviewer2' },
              resolvable: false,
              resolved: false,
              position: null
            },
            {
              id: 103,
              body: 'changed title',
              system: true,
              created_at: '2026-08-01T10:13:00Z',
              author: { username: 'gitlab' },
              position: null
            }
          ]
        }
      ]);
    }
    return new Response('not found', { status: 404 });
  };
}

test('GitLabCollector normalizes merged MR discussions into ReviewRecord values', async () => {
  const calls = [];
  const collector = new GitLabCollector({
    token: 'secret-token',
    baseUrl: 'https://gitlab.example/api/v4/',
    maxMergeRequests: 10,
    fetchImpl: fixtureFetch(calls)
  });

  const records = await collector.collect('group/project');
  assert.equal(records.length, 2);
  assert.deepEqual(records[0], {
    id: 'gl-note-7-101',
    repo: 'group/project',
    prNumber: 7,
    prTitle: 'Harden request validation',
    author: 'author1',
    reviewer: 'reviewer1',
    body: 'Validate the payload before calling the repository.',
    path: 'src/controller.ts',
    createdAt: '2026-08-01T10:10:00Z',
    url: 'https://gitlab.example/group/project/-/merge_requests/7#note_101',
    resolved: true,
    source: 'review-comment'
  });
  assert.equal(records[1].source, 'issue-comment');
  assert.equal(records[1].reviewer, 'reviewer2');
  assert.equal(calls.some(call => call.url.includes('group%2Fproject')), true);
  assert.equal(calls.every(call => call.headers['PRIVATE-TOKEN'] === 'secret-token'), true);
});

test('GitLabCollector can include system notes explicitly', async () => {
  const calls = [];
  const collector = new GitLabCollector({ includeSystemNotes: true, fetchImpl: fixtureFetch(calls) });
  const records = await collector.collect('group/project');
  assert.equal(records.length, 3);
  assert.equal(records.some(record => record.id === 'gl-note-7-103'), true);
});

test('GitLab collector plugin honors maxItems and returns provider metadata', async () => {
  const calls = [];
  const plugin = createGitLabCollectorPlugin({
    baseUrl: 'https://gitlab.example/api/v4',
    fetchImpl: fixtureFetch(calls)
  });
  const result = await plugin.collect(
    { repository: 'group/project', maxItems: 1 },
    { repository: 'group/project', generatedAt: '2026-08-30T00:00:00Z' }
  );
  assert.equal(result.records.length, 2);
  assert.equal(result.metadata.provider, 'gitlab');
  assert.equal(result.metadata.mergeRequestsRequested, 1);
});

test('GitLabCollector rejects malformed repository identifiers', async () => {
  const collector = new GitLabCollector({ fetchImpl: async () => jsonResponse([]) });
  await assert.rejects(() => collector.collect('project-only'), /namespace\/project/);
});
