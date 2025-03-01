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

## Documentation

__Website:__ <https://this-is-tobi.com/docpress/introduction>.

__Table of Contents__ *- md sources*:
- [Rules](./docs/02-rules.md)
- [Advanced usage](./docs/03-advanced-usage.md)
- [Development](./docs/04-development.md)

## Quickstart

1. Generate website using the Docpress docker image.
    ```sh
    docker run --name docpress --rm -v $(pwd)/docpress:/app/docpress:rw \
      ghcr.io/this-is-tobi/docpress -U <github_username>
    ```
    > The dist folder is available at `./docpress/.vitepress/dist`, ready to be served by a web server like Nginx, Apache, etc...

2. Start an Nginx docker image using the generated static folder.
    ```sh
    docker run --name my-docs --rm -v ./docpress/.vitepress/dist:/usr/share/nginx/html:ro -p 8080:80 \
      docker.io/nginx
    ```

3. Access the website at the following address : <http://localhost:8080>.

## Options

CLI description :

```txt
Usage: docpress [options] [command]

Build your doc website faster than light ⚡️⚡️⚡️

Options:
  -b, --branch <string>                Branch used to collect Git provider data. (default: "main")
  -c, --extra-public-content <string>  List of comma separated additional files or directories to process Vitepress public folder.
  -C, --config <string>                Path to the docpress configuration file.
  -f, --forks                          Whether or not to create the dedicated fork page that aggregate external contributions.
  -g, --git-provider <string>          Git provider used to retrieve data. Values should be "github". (default: "github")
  -h, --help                           display help for command
  -p, --extra-header-pages <string>    List of comma separated additional files or directories to process Vitepress header pages.
  -r, --repos-filter <string>          List of comma separated repositories to retrieve from Git provider. Default to all user's public repositories.
  -t, --extra-theme <string>           List of comma separated additional files or directories to use as Vitepress theme.
  -T, --token <string>                 Git provider token used to collect data.
  -U, --username <string>              Git provider username used to collect data.
  -v, --vitepress-config <string>      Path to the vitepress configuration file.
  -V, --version                        output the version number

Commands:
  build [options]                      Build vitepress website.
  fetch [options]                      Fetch docs with the given username and git provider.
  prepare [options]                    Transform doc to the target vitepress format.
```

## Usage methods

Docpress is available through both [npm](https://www.npmjs.com/package/@tobi-or-not/docpress) and [Docker](https://github.com/this-is-tobi/docpress/pkgs/container/docpress), so you can choose the installation method that best suits your environment.

### Using npm (or other package managers)

If you prefer Node.js package managers like npm, pnpm, or bun, you can easily install and run Docpress without additional setup.

To run Docpress using npm:
```sh
npx @tobi-or-not/docpress -U <github_username>
```

> [!TIP]
> If you’re using a package manager like pnpm or bun, simply replace npx with the corresponding command (pnpx or bunx) to execute Docpress.

### Using Docker

Docpress also provides a Docker image, which is especially useful if you want to avoid installing dependencies directly on your system or if you’re working in a containerized environment. Using Docker ensures a consistent runtime environment.

To run Docpress with Docker:
```sh
docker run --rm -v $(pwd)/docpress:/app/docpress:rw ghcr.io/this-is-tobi/docpress -U <github_username>
```

In this command:
- `--rm` removes the container after it stops, keeping your environment clean.
- `-v $(pwd)/docpress:/app/docpress:rw` mounts the `docpress` directory in your current path to the container’s `/app/docpress` folder, allowing Docpress to store generated files locally.

> Ensure Docker is installed and running on your system before using this method.

Both methods provide the same functionality, so you can choose the one that fits your setup or use case.

## Rules

To ensure that the program functions correctly, please follow these conventions:

### Repository name and structure

- The script will only parse the `docs/` folder located at the root level of the repository. This folder is used to import advanced documentation features, such as multi-page documentation, embedded images, and files.
- Repositories whose name starts with a dot are processed, but the dot will be removed.

### File naming and sorting

- If a `docs/` folder is present, all files within it will be sorted and renamed by removing any prefix numbers. This ensures that files appear cleanly in the generated website. For example, `docs/01-get-started.md` will be renamed to `get-started.md`.

### Handling the root readme file

- The `README.md` file located at the root of the repository will only be imported if there is no `./docs/01-readme.md` file present. This allows you to differentiate between the general README and the advanced documentation introduction page.
- For instance, you might use the README file for a table of contents that is not relevant in the context of the documentation website.

### Link management

- Any inline link in the `./README.md` file that does not point to `./docs/**` will be replaced with the corresponding GitHub link.
- Similarly, any inline link in the `./docs/*.md` files that does not reference `./docs/**` will also be replaced with the appropriate GitHub link.

### Project descriptions

- The project description displayed on the home page of the generated website is extracted from the GitHub repository's description.

---

By adhering to these rules, you can ensure that your documentation is processed correctly and that it aligns with the intended structure and functionality of the generated site.
