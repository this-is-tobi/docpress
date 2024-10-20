# Docpress :robot:

This project aims to automate the construction of documentation website based on a Github username and optionally a list of repositories.

## Explanation

The package will download the documentation files for the given repository list, to do this it will check if a `docs/` folder is present at root level and download this entire folder or only the `README.md` file if this is not the case.
After downloading all project documentation files, it will build a static website using [vitepress](https://vitepress.dev/).

> If a `docs/` folder is present, all files in it will be sorted and renamed without the prefix number so it will not appeared inside the generated website. Example: `docs/01-get-started.md` will become `get-started.md`.

## Quickstart

```sh
git clone https://github.com/this-is-tobi/docpress.git
cd ./docpress
docker build --tag robots/docpress --target prod .
docker run --publish 8080:8080 --name docpress --rm -v $(pwd)/docpress:/app/docpress:rw robots/docpress -u <username>
```

## Advanced usage

```txt
Usage: docpress [options] [command]

Build your doc website faster than light ⚡️⚡️⚡️

Options:
  -b, --branch <string>                Branch used to collect Git provider data. (default: "main")
  -c, --extra-public-content <string>  List of comma separated additional files or directories to process Vitepress public folder.
  -C, --config <string>                Path to the docpress configuration file.
  -g, --git-provider <string>          Git provider used to retrieve data. Values should be one of "github" or "gitlab". (default: "github")
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

## Development

### Prerequisites

To run the application in development mode, install :
- [nodejs](https://nodejs.org/) *- javascript runtime.*
- [pnpm](https://pnpm.io/) *- powerful, space efficient node package manager.*

### Use CLI

1. Install project nodejs dependencies.
    ```sh
    pnpm install
    ```
2. Fetch and build website.
    ```sh
    pnpm run dev -u <username>
    ```
3. Preview website.
    ```sh
    pnpm run vp:dev
    ```

Preview website is available at <http://localhost:8080>.

> [!TIP]
> Use command `pnpm run dev -h` to print options.
