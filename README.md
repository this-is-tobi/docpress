# Docpress :zap:

This project aims to automate the construction of documentation website based on a Github username and optionally a list of repositories.

## Explanation

Docpress automates the process of downloading documentation files from specified GitHub repositories. Here's how it works:

1. __Repository Documentation Retrieval__:
    - The program checks if a `docs/` folder is present at the root level of each specified repository.
    - If the `docs/` folder exists, the entire folder will be downloaded, including all its contents.
    - If the `docs/` folder is not found, only the `README.md` file will be downloaded.

2. __Static Website Generation__:
    - After retrieving the documentation files, Docpress generates a static website using [VitePress](https://vitepress.dev/). This framework allows for the creation of fast and customizable documentation sites.

For optimal use of Docpress, please check the [rules section](#rules) to understand the conventions and guidelines that will ensure that everything works correctly. By following these rules, you can maximize the effectiveness of the documentation process.

## Quickstart

1. Generate website using the Docpress docker image.
    ```sh
    docker run --name docpress --rm -v $(pwd)/docpress:/app/docpress:rw \
      ghcr.io/this-is-tobi/docpress -u <github_username>
    ```
    > The dist folder is available at `./docpress/.vitepress/dist`, ready to be served by a web server like Nginx, Apache, etc...

2. Start an Nginx docker image using the generated static folder.
    ```sh
    docker run --name my-docs --rm -v ./docpress/.vitepress/dist:/usr/share/nginx/html:ro -p 8080:80 \
      docker.io/nginx
    ```

3. Access the website at the following address : <http://localhost:8080>.

## Rules

To ensure that the program functions correctly, please follow these conventions:

1. __Documentation folder structure__:
    - The script will only parse the `docs/` folder located at the root level of the repository. This folder is used to import advanced documentation features, such as multi-page documentation, embedded images, and files.

2. __File naming and sorting__:
    - If a `docs/` folder is present, all files within it will be sorted and renamed by removing any prefix numbers. This ensures that files appear cleanly in the generated website. For example, `docs/01-get-started.md` will be renamed to `get-started.md`.

3. __Handling the root readme file__:
    - The `README.md` file located at the root of the repository will only be imported if there is no `./docs/01-readme.md` file present. This allows you to differentiate between the general README and the advanced documentation introduction page.
    - For instance, you might use the README file for a table of contents that is not relevant in the context of the documentation website.

4. __Link management__:
    - Any inline link in the `./README.md` file that does not point to `./docs/**` will be replaced with the corresponding GitHub link.
    - Similarly, any inline link in the `./docs/*.md` files that does not reference `./docs/**` will also be replaced with the appropriate GitHub link.

5. __Project descriptions__:
    - The project description displayed on the home page of the generated website is extracted from the GitHub repository's description.

By adhering to these rules, you can ensure that your documentation is processed correctly and that it aligns with the intended structure and functionality of the generated site.

## Advanced usage

All CLI options are available with the helper flag `docker run ghcr.io/this-is-tobi/docpress -h` :

```txt
Usage: docpress [options] [command]

Build your doc website faster than light ⚡️⚡️⚡️

Options:
  -b, --branch <string>                Branch used to collect Git provider data. (default: "main")
  -c, --extra-public-content <string>  List of comma separated additional files or directories to process Vitepress public folder.
  -C, --config <string>                Path to the docpress configuration file.
  -g, --git-provider <string>          Git provider used to retrieve data. Values should be "github". (default: "github")
  -h, --help                           display help for command
  -p, --extra-header-pages <string>    List of comma separated additional files or directories to process Vitepress header pages.
  -r, --repos-filter <string>          List of comma separated repositories to retrieve from Git provider. Default to all user's public repositories.
  -t, --extra-theme <string>           List of comma separated additional files or directories to process Vitepress public folder.
  -T, --token <string>                 Git provider token used to collect data.
  -u, --username <string>              Git provider username used to collect data.
  -v, --vitepress-config <string>      Path to the vitepress configuration file.
  -V, --version                        output the version number

Commands:
  build [options]                      Build vitepress website.
  fetch [options]                      Fetch docs with the given username and git provider.
  prepare [options]                    Transform doc to the target vitepress format.
```

### Usage methods

Docpress is available through both [npm](https://www.npmjs.com/package/@tobi-or-not/docpress) and [Docker](https://github.com/this-is-tobi/docpress/pkgs/container/docpress), so you can choose the installation method that best suits your environment.

#### Using npm (or other package managers)

If you prefer Node.js package managers like npm, pnpm, or bun, you can easily install and run Docpress without additional setup.

To run Docpress using npm:
```sh
npx @tobi-or-not/docpress -u <github_username>
```

> [!TIP]
> If you’re using a package manager like pnpm or bun, simply replace npx with the corresponding command (pnpx or bunx) to execute Docpress.

#### Using Docker

Docpress also provides a Docker image, which is especially useful if you want to avoid installing dependencies directly on your system or if you’re working in a containerized environment. Using Docker ensures a consistent runtime environment.

To run Docpress with Docker:
```sh
docker run --rm -v $(pwd)/docpress:/app/docpress:rw ghcr.io/this-is-tobi/docpress -u <github_username>
```

In this command:
- `--rm` removes the container after it stops, keeping your environment clean.
- `-v $(pwd)/docpress:/app/docpress:rw` mounts the `docpress` directory in your current path to the container’s `/app/docpress` folder, allowing Docpress to store generated files locally.

> Ensure Docker is installed and running on your system before using this method.

Both methods provide the same functionality, so you can choose the one that fits your setup or use case.

### Filter repositories

The `-r` or `--repos-filter` option allows you to specify which repositories to include or exclude when generating documentation. This option accepts a comma-separated list of repository names and can include exclusions by prefixing a repository name with `!`.

- __Including specific repositories__: To generate documentation for specific repositories, provide their names separated by commas. For example, `-r 'repo1,repo2'` will retrieve documentation only for `repo1` and `repo2`.
- __Excluding repositories__: To exclude certain repositories, prefix their names with `!`. For instance, `-r '!repo1,!repo2'` will retrieve all public repositories except `repo1` and `repo2`.

> Only public, non-fork repositories are fetched.

### Docpress configuration

Docpress can be configured with an external configuration file specified by the `-C` or `--config` option. This file, which should be in JSON or YAML format, allows you to set Docpress parameters to automate and customize the documentation fetching and generation process. Key options that can be configured include:

- `username`: Git provider username (usually GitHub) to fetch repositories (equivalent to the `-u` CLI option).
- `reposFilter`: List of repositories to include or exclude (equivalent to the `-r` CLI option).
- `branch`: Default branch from which documentation will be fetched.
- `extraHeaderPages`: Additional pages to include in the website header (equivalent to `-p`).
- `extraPublicContent`: Additional content for the Vitepress public folder (equivalent to `-c`).
- `extraTheme`: Files or folders to customize the Vitepress theme (equivalent to `-t`).

Example JSON configuration:

```json
{
  "username": "my-github-username",
  "reposFilter": ["!repo1", "!repo2"],
  "branch": "main",
  "extraHeaderPages": ["header1.md", "header2.md"],
  "extraPublicContent": ["favicon.ico", "logo.png"],
  "extraTheme": ["custom-theme.css"]
}
```

### Vitepress configuration

Vitepress configuration can be customized via a vitepress.config.js file, specified with the `-v` or `--vitepress-config` option. This file lets you adjust Vitepress options like the site title, navigation structure, footer, and plugins.

Key configurable options include:

- `title`: The title of the generated site.
- `description`: A description of the site (used for SEO).
- `themeConfig`: The theme configuration, including navigation and header links.
- `markdown`: Options to customize Markdown rendering.

Basic Vitepress configuration example:

```json
{
  "title": "My Project Documentation",
  "description": "A site generated by Docpress",
  "themeConfig": {
    "socialLinks": [
      { "icon": "github", "link": "https://github.com/this-is-tobi" }
    ],
    "outline": [2, 4]
  }
}
```

### Vitepress theme

Docpress allows you to customize the Vitepress theme by adding files or directories specified with the `-t` or `--extra-theme` option. This flexibility enables you to adjust the look and feel of your documentation site by adding custom CSS, modifying components, or even creating an entirely custom theme.

You can approach theme customization in two main ways:

1. __Extending the Default Theme__:
  Vitepress offers options to extend its built-in default theme, which includes configuration for the layout, sidebar, and header. Extending the default theme is a good choice if you want to make minor tweaks to colors, fonts, or layout without changing the overall structure. To do this, you can:
    - Add custom CSS or SCSS files for style adjustments.
    - Override default theme components to change the behavior of certain sections (like headers or footers).
    - Introduce new Vue components if needed.

    For more details on extending the default theme, visit the [Vitepress guide on extending the default theme](https://vitepress.dev/guide/extending-default-theme).

2. __Creating a Custom Theme__:
   If your project requires a unique design or a complete overhaul of the site layout, you can create a fully custom theme. Vitepress allows you to replace its default theme entirely by creating a custom theme directory structure. With this approach, you gain full control over every part of the site, from page structure to individual components.

   To implement a custom theme:
   - Create a `theme/index.js` file where you export custom components.
   - Organize components like headers, footers, and layout in the theme directory.
   - Add global styles to `theme/style.css` or other preferred CSS files.

   For a comprehensive guide on creating a custom theme, refer to the [Vitepress documentation on using a custom theme](https://vitepress.dev/guide/custom-theme#using-a-custom-theme).

> For either method, keep in mind that customizations should be tested across different pages to ensure they integrate smoothly with your content.

With these approaches, you can create a distinct look and feel for your documentation site while keeping it aligned with your project’s branding and user experience requirements.

### Extra header pages

With the `-p` or `--extra-header-pages` option, you can add additional pages to the Vitepress website header, such as privacy policies, advanced user guides, or links to external resources.

This option accepts a comma-separated list of Markdown files or directories containing Markdown files. These pages will be included as-is in the final website and automatically added to the navigation bar at the top of each page on the generated site.

> All specified extra-header-pages must be in Markdown format and can include any Vitepress-compatible content, such as links, images, and other documentation elements.

### Extra public content

The `-c` or `--extra-public-content` option allows you to include additional static assets in the Vitepress `public` folder. This is useful for adding content that needs to be accessible across all pages of the documentation, such as custom icons, logos, or other assets.

These files or directories will be copied directly into the `public` folder and will be available as static resources on the final website.

Common use cases for `extra-public-content` include:
- __Adding branding assets__: For example, including a custom favicon (`favicon.ico`) or logo (`logo.png`) that will display on every page.
- __Providing downloadable files__: Such as PDF guides, policy documents, or downloadable images that users may need quick access to.
- __Supplementing media files__: Including additional images, icons, or background files that you may want to reference across different parts of your documentation.

This option accepts a comma-separated list of file or directory paths.

> Ensure that any files you add are optimized for the web, as large or uncompressed files may impact site performance.

> All files and directories specified with extra-public-content are directly accessible at the root of the final site, making it easy to link to them within your Markdown files (e.g., using /logo.png in an img tag).

### GitHub Token Option

When using the Docpress tool to fetch data from GitHub, you have the option to provide a personal access token using the `-T` flag. This token is important as it allows you to authenticate your requests, which can help increase your request limits on the GitHub API.

Utilizing a personal access token not only helps you avoid rate limiting issues but also enhances the reliability of data retrieval for your documentation projects.

For further details on how authentication affects rate limits and other considerations, please refer to the official GitHub documentation on [Rate limits for the REST API](https://docs.github.com/en/rest/overview/rate-limits-for-the-rest-api).

## Development

### Prerequisites

To successfully run the Docpress application in development mode, you'll need to install the following prerequisites:

- __[Node.js](https://nodejs.org/)__: A JavaScript runtime that allows you to execute JavaScript code server-side. Make sure you install a version that is compatible with the project requirements.
- __[pnpm](https://pnpm.io/)__: A fast, disk space-efficient package manager for Node.js that is used to manage the project's dependencies.

### Setting Up the Development Environment

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
    pnpm run dev -u <github_username>
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
