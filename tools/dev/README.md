# Local resource preview

Run from `site/`:

```powershell
npm run build
npm run preview:local
```

The preview opens on `http://127.0.0.1:8788`. Its read-only resource adapter listens on `127.0.0.1:8790` and serves the current checkout's `studyplan/`, `problems/`, `illustrations/`, and `tools/illustrations/data/`. Local viewing does not consume GitHub's unauthenticated API quota. The binding only applies to this preview process; production settings and GitHub login/progress routes are unchanged. Stop the command with Ctrl+C to stop its own server and child process.

`npm run dev:resources` runs the resource adapter separately when required. It supports only GET requests, excludes hidden files and paths outside the resource allowlist, and rejects traversal and symlink escapes. It never writes files.
