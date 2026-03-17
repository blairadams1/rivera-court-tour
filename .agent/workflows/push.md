---
description: how to push code changes to the remote repository
---
// turbo-all

1. Increment the `BUILD_NUMBER` in `version.ts` by 1.
2. Stage all changes: `git add .`
3. Commit with a descriptive message: `git commit -m "<message>"`
4. Push to remote: `git push`

**Important**: Always increment the build number BEFORE committing. The build number is displayed on the start page next to the version.
