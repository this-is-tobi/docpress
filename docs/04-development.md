# Development

## Prerequisites

To successfully run the Docpress application in development mode, you'll need to install the following prerequisites:

- __[Node.js](https://nodejs.org/)__: A JavaScript runtime that allows you to execute JavaScript code server-side. Make sure you install a version that is compatible with the project requirements.
- __[pnpm](https://pnpm.io/)__: A fast, disk space-efficient package manager for Node.js that is used to manage the project's dependencies.

## Setting Up the Development Environment

Follow these steps to set up the development environment and start working with Docpress:

1. __Clone the repository__
    Start by cloning the Docpress repository to your local machine using Git:
    ```sh
    git clone https://github.com/this-is-tobi/docpress.git
    cd docpress
    ```
2. __Install project dependencies__
    Use pnpm to install all necessary Node.js dependencies:
    ```sh
    pnpm install
    ```
3. __Fetch and build the website__
    Run the following command to fetch documentation from the specified GitHub username and build the static website:
    ```sh
    pnpm run dev -U <github_username>
    ```
4. __Preview the website__
    Launch a local development server to preview your website:
    ```sh
    pnpm run vp:dev
    ```
    You can access the preview by navigating to [http://localhost:8080](http://localhost:8080) in your web browser.

> [!TIP]
> Use command `pnpm run dev -h` to print options.

## Contributions

All contributions to my repositories are welcome and must be made via Github with a pull request following the rules below.

### Conventions

Commits must follow the specification of [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), it is possible to add the [VSCode extension](https://github.com/vivaxy/vscode-conventional-commits) to facilitate the creation of commits.

A PR must be made with an updated branch with the `main` branch in rebase (and without merge) before requesting a merge, and the merge must be requested in `main`.

Check whether the repository has linting rules or tests to keep them clean and ensure that CI workflows pass (new features in repositories with tests should be accompanied by new tests to ensure that the new feature works properly).
