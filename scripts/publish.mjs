import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, mkdtempSync, rmSync, openSync, closeSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', timeout: 15 * 60_000, ...options })
const git = (args, options = {}) => run('git', args, options).trim()
const root = git(['rev-parse', '--show-toplevel'])
assert.equal(resolve(process.cwd()), root, 'Run publish from the repository root.')
assert.equal(git(['symbolic-ref', '--short', 'HEAD']), 'main', 'Publish requires the main branch.')
const origins = git(['remote', 'get-url', '--push', '--all', 'origin']).split('\n')
assert.equal(origins.length, 1, 'Exactly one origin push URL is required.')
const origin = origins[0]
assert(/^https:\/\/dev\.agents\.house\/app\/a_[A-Za-z0-9._-]+\.git$/.test(origin), 'origin must be an authenticated House App HTTPS Git remote, without embedded credentials.')
const source = git(['rev-parse', 'HEAD'])
const assertClean = () => {
  assert.equal(git(['status', '--porcelain', '--untracked-files=all']), '', 'Commit or remove source changes before publishing; nothing was pushed.')
  assert.equal(git(['rev-parse', 'HEAD']), source, 'Source HEAD changed during verification.')
  assert(git(['remote', 'get-url', '--push', '--all', 'origin']) === origin, 'Origin changed during verification.')
  assert.equal(git(['symbolic-ref', '--short', 'HEAD']), 'main', 'Branch changed during verification.')
}
assertClean()
const lock = join(git(['rev-parse', '--absolute-git-dir']), 'template-publish.lock')
const lockFd = openSync(lock, 'wx')
let temporary
try {
  run('npm', ['run', 'verify'], { stdio: 'inherit' })
  assertClean()
  assert(existsSync('dist/app.json') && existsSync('dist/schema.yaml'), 'Verification must build a complete dist release.')
  for (const filename of ['app.json', 'schema.yaml']) {
    assert(readFileSync(join(root, filename)).equals(readFileSync(join(root, 'dist', filename))), `Built ${filename} differs from committed source.`)
  }
  temporary = mkdtempSync(join(tmpdir(), 'house-release-'))
  const env = { ...process.env, GIT_INDEX_FILE: join(temporary, 'index') }
  git(['--work-tree=.', 'add', '--all', '--force', '.'], { cwd: join(root, 'dist'), env })
  const tree = git(['write-tree'], { env })
  const release = git(['commit-tree', tree, '-m', `Release of ${source}`])
  assertClean()
  run('git', ['push', '--atomic', 'origin', `${source}:refs/heads/main`, `+${release}:refs/heads/release`], { stdio: 'inherit' })
  const published = git(['ls-remote', origin, 'refs/heads/main']).split(/\s+/)[0]
  assert.equal(published, source, 'Push returned but the advertised main does not match; inspect House before retrying.')
  git(['update-ref', 'refs/heads/release', release])
  console.log(JSON.stringify({ main: source, release, verified: 'Atomic House push accepted; advertised main matched. House does not advertise release refs; check the App published revision for admission.' }, null, 2))
} finally {
  if (temporary) rmSync(temporary, { recursive: true, force: true })
  closeSync(lockFd)
  rmSync(lock, { force: true })
}
