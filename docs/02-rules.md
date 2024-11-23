# Rules

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
