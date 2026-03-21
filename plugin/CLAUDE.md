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

To cut a release and publish to npm, make a release using the `gh` CLI tool. Be sure to bump the package version.
