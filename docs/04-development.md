# Development

## Prerequisites

To successfully run the Docpress application in development mode, you'll need to install the following prerequisites:

- __[Bun](https://bun.com/)__: The JavaScript runtime and package manager used to install dependencies and run the project's scripts.

## Setting Up the Development Environment

Follow these steps to set up the development environment and start working with Docpress:

1. __Clone the repository__
    Start by cloning the Docpress repository to your local machine using Git:
    ```sh
    git clone https://github.com/this-is-tobi/docpress.git
    cd docpress
    ```
2. __Install project dependencies__
    Use bun to install all necessary dependencies:
    ```sh
    bun install
    ```
3. __Fetch and build the website__
    Run the following command to fetch documentation from the specified username and build the static website:
    ```sh
    bun run dev -U <username>
    ```
4. __Preview the website__
    Launch a local development server to preview your website:
    ```sh
    bun run vp:dev
    ```
    You can access the preview by navigating to [http://localhost:8080](http://localhost:8080) in your web browser.

> [!TIP]
> Use command `bun run dev -h` to print options.

## Testing

Docpress uses [Vitest](https://vitest.dev/) for unit tests. Before opening a pull request, make sure the suite and the linter pass:

```sh
# Run the unit test suite
bun run test

# Run the suite with a coverage report (coverage thresholds are enforced)
bun run test:cov

# Lint the codebase (use `bun run format` to auto-fix)
bun run lint
```

New features should be accompanied by tests, and existing tests must keep passing.

## Architecture

Docpress runs as a three-stage pipeline, exposed both as the default command and as individual sub-commands (`fetch`, `prepare`, `build`):

1. __fetch__ ([src/lib/fetch.ts](../src/lib/fetch.ts), [src/lib/git.ts](../src/lib/git.ts), [src/lib/gitlab.ts](../src/lib/gitlab.ts)) — resolves the user/group and repositories from the Git provider, then clones the documentation of each eligible repository (sparse checkout of `docs/` or the root `README.md`). User and repository metadata are written to `docpress/user-<login>.json` and `docpress/repos-<login>.json` so the next stage can run independently.
2. __prepare__ ([src/lib/prepare.ts](../src/lib/prepare.ts), [src/lib/vitepress.ts](../src/lib/vitepress.ts)) — reads that metadata, rewrites links, renames files, builds the sidebar/navigation, optionally generates the forks page, and emits the VitePress config, index and theme files.
3. __build__ ([src/commands/build.ts](../src/commands/build.ts)) — runs the VitePress build to produce the static site.

Configuration is validated with [Zod](https://zod.dev/) in [src/schemas/global.ts](../src/schemas/global.ts), which also drives the CLI help text. Values are merged with the precedence **CLI options > config file > defaults**.

## Contributions

All contributions to my repositories are welcome and must be made via Github with a pull request following the rules below.

### Conventions

Commits must follow the specification of [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), it is possible to add the [VSCode extension](https://github.com/vivaxy/vscode-conventional-commits) to facilitate the creation of commits.

A PR must be made with an updated branch with the `main` branch in rebase (and without merge) before requesting a merge, and the merge must be requested in `main`.

Check whether the repository has linting rules or tests to keep them clean and ensure that CI workflows pass (new features in repositories with tests should be accompanied by new tests to ensure that the new feature works properly).
