### Environment
Use .env and make sure you update .env.template as needed.

### Typecheck Always
Typecheck on each task list completion before finishing.

### Testing
We have tests now for the plugin source code. When you add new features to the plugin: 
 - Consider creating a failing test first
 - Always run the tests after the feature is completed

 ### Keep Docs Updated
 For all changes we make check both the README.md and site/index.html (docs) for anything that may require updating since last changes


### Releases

**IMPORTANT: NEVER run `npm publish` directly.** Publishing is handled by GitHub Actions triggered by a GitHub release.

To cut a release:
1. Bump the version in `plugin/package.json` and `sdk/package.json`
2. Commit and push to main
3. Create a GitHub release using the `gh` CLI tool:
   ```
   gh release create v0.X.Y --title "v0.X.Y" --notes "release notes here"
   ```
   This triggers the CI pipeline which builds and publishes both packages to npm.
