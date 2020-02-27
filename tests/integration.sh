#!/bin/bash

TESTDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
REPOROOT="$TESTDIR/../"

cd "$TESTDIR"
docker-compose up -d \
    && cd "$REPOROOT" \
    && npm run integration-ci

cd "$TESTDIR"
docker-compose down
