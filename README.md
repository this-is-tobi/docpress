# Docpress :robot:

This project aims to automate the construction of documentation website based on a list of repositories.

## Explanation

The package will download the documentation files for the given repository list, to do this it will check if a `docs/` folder is present at root level and download this entire folder or only the `README.md` file if this is not the case.
After downloading all project documentation files, it will build a static website using [vitepress](https://vitepress.dev/).

> If a `docs/` folder is present, all files in it will be sorted and renamed without the prefix number so it will not appeared inside the generated website. Example: `01-get-started.md` will become `get-started.md`.

## Prerequisites

To run the application in development mode, install :
- [nodejs](https://nodejs.org/) *- javascript runtime.*
- [pnpm](https://pnpm.io/) *- powerful, space efficient node package manager.*

## Development

2. Install project nodejs dependencies.
    ```sh
    pnpm install
    ```
3. Fetch docs.
    ```sh
    pnpm run dev fetch -u <username>
    ```
4. Build vitepress website.
    ```sh
    pnpm run dev build
    ```
