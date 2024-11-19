#!/bin/bash

set -e

# Colorize terminal
red='\e[0;31m'
no_color='\033[0m'
# Console step increment
i=1

# Get project directories
PROJECT_DIR="$(git rev-parse --show-toplevel)"

# Get versions
NODE_VERSION="$(node --version)"
PNPM_VERSION="$(pnpm --version)"
DOCKER_VERSION="$(docker --version)"
DOCKER_BUILDX_VERSION="$(docker buildx version)"

# Default
RUN_LINT="false"
RUN_UNIT_TESTS="false"
RUN_CLI_TESTS="false"
RUN_DOCKER_TESTS="false"

# Declare script helper
TEXT_HELPER="\nThis script aims to run application tests.
Following flags are available:

  -c    Run cli tests.

  -d    Run docker tests (optionally pass the docker image to test as argument).

  -l    Run lint.

  -u    Run unit tests.

  -h    Print script help.\n\n"

print_help() {
  printf "$TEXT_HELPER"
}

# Parse options
while getopts hcd:lu flag
do
  case "${flag}" in
    c)
      RUN_CLI_TESTS=true;;
    d)
      RUN_DOCKER_TESTS=true
      DOCKER_IMAGE=${OPTARG};;
    l)
      RUN_LINT=true;;
    u)
      RUN_UNIT_TESTS=true;;
    h | *)
      print_help
      exit 0;;
  esac
done


# Script condition
if [ "$RUN_LINT" == "false" ] && [ "$RUN_UNIT_TESTS" == "false" ] && [ "$RUN_CLI_TESTS" == "false" ] && [ "$RUN_DOCKER_TESTS" == "false" ]; then
  printf "\nArgument(s) missing, you don't specify any kind of test to run.\n"
  print_help
  exit 1
fi

if [ -z "$PNPM_VERSION" ]; then
  printf "\nThis script uses pnpm, and it isn't installed - please install pnpm and try again! (https://pnpm.io)\n"
  print_help
  exit 1
fi


checkDockerRunning() {
  if [ ! -x "$(command -v docker)" ]; then
    printf "\nThis script uses docker, and it isn't running - please start docker and try again!\n"
    exit 1
  fi
}

checkBuildxPlugin() {
  if [ ! "$DOCKER_BUILDX_VERSION" ]; then
    printf "\nThis script uses docker buildx plugin, and it isn't installed - please install docker buildx plugin and try again!\n"
    exit 1
  fi
}

checkDocsResult() {
  DOCS_DIR="$1/docs"
  NB_DOCS_DIR=$(find "$DOCS_DIR" -maxdepth 1 -type d -name "homelab" | wc -l)
  NB_INDEX_FILES=$(find "$DOCS_DIR" -maxdepth 1 -type f -name "index.md" | wc -l)
  NB_CONTENT=$(find "$DOCS_DIR" -maxdepth 1 -mindepth 1 | wc -l)
  if [[ $NB_DOCS_DIR -eq 1 && $NB_INDEX_FILES -eq 1 && $NB_CONTENT -eq 2 ]]; then
    printf "\n\nThe docs have been correctly generated.\n\n"
  else
    printf "\n\nThe directory does not meet the criteria.\n\n"
    exit 1
  fi
}


# Settings
printf "\nScript settings:
  -> node version: ${NODE_VERSION}
  -> pnpm version: ${PNPM_VERSION}
  -> docker version: ${DOCKER_VERSION}
  -> docker buildx version: ${DOCKER_BUILDX_VERSION}
  -> run lint: ${RUN_LINT}
  -> run unit tests: ${RUN_UNIT_TESTS}
  -> run cli tests: ${RUN_CLI_TESTS}
  -> run docker tests: ${RUN_DOCKER_TESTS}\n"


cd "$PROJECT_DIR"

# Run lint
if [ "$RUN_LINT" == "true" ]; then
  printf "\n${red}${i}.${no_color} Launch lint\n"
  i=$(($i + 1))

  pnpm run lint
fi


# Run unit tests
if [ "$RUN_UNIT_TESTS" == "true" ]; then
  printf "\n${red}${i}.${no_color} Launch unit tests\n"
  i=$(($i + 1))

  pnpm run test:cov
fi


# Run cli tests
if [ "$RUN_CLI_TESTS" == "true" ]; then
  printf "\n${red}${i}.${no_color} Launch cli tests\n"
  i=$(($i + 1))

  pnpm run build \
    && pnpm pack \
    && TGZ_PKG_NAME=$(ls -d $PWD/* | grep '.tgz')

  mkdir -p /tmp/docpress/cli/pnpm \
    && cd /tmp/docpress/cli/pnpm \
    && [ -f "./package.json" ] || pnpm init \
    && pnpm add $TGZ_PKG_NAME \
    && pnpm exec docpress -U this-is-tobi -r homelab \
    && cd - > /dev/null
  checkDocsResult /tmp/docpress/cli/pnpm/docpress

  mkdir -p /tmp/docpress/cli/npm \
    && cd /tmp/docpress/cli/npm \
    && [ -f "./package.json" ] || npm init -y \
    && npm install $TGZ_PKG_NAME \
    && npm exec docpress -- -U this-is-tobi -r homelab \
    && cd - > /dev/null
  checkDocsResult /tmp/docpress/cli/npm/docpress

  mkdir -p /tmp/docpress/cli/bun \
    && cd /tmp/docpress/cli/bun \
    && [ -f "./package.json" ] || bun init \
    && bun add $TGZ_PKG_NAME \
    && bunx docpress -U this-is-tobi -r homelab \
    && cd - > /dev/null
  checkDocsResult /tmp/docpress/cli/bun/docpress
fi


# Run docker tests
if [ "$RUN_DOCKER_TESTS" == "true" ]; then
  printf "\n${red}${i}.${no_color} Launch docker tests\n"
  i=$(($i + 1))

  checkDockerRunning

  if [ -n "$DOCKER_IMAGE" ]; then
    mkdir -p /tmp/docpress/docker/docpress \
      && docker run --name docpress --rm -v /tmp/docpress/docker/docpress:/app/docpress:rw --user root $DOCKER_IMAGE  -U this-is-tobi -r homelab
  else
    pnpm run build:docker && pnpm run start:docker -U this-is-tobi -r homelab
  fi

  checkDocsResult /tmp/docpress/docker/docpress
fi
