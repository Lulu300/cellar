#!/bin/sh
# Starts a Docker image of Cellar and waits until its own healthcheck reports it healthy. Fails, with
# the container's logs, when the container stops, turns unhealthy or is not healthy within 2
# minutes. CI runs it on every pull request, and release.yml before it pushes an image.
# Usage: scripts/check-image.sh <image>
set -eu

image="$1"
# Writes are not tested here, but the image is meant to run with ORIGIN set.
container="$(docker run --detach --env ORIGIN=http://localhost:3000 "$image")"
trap 'docker rm --force "$container" > /dev/null' EXIT

deadline=$(($(date +%s) + 120))
while [ "$(date +%s)" -lt "$deadline" ]; do
    state="$(docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}no healthcheck{{end}}' "$container")"
    case "$state" in
        'running healthy')
            echo "$image is healthy"
            exit 0
            ;;
        'running starting') sleep 2 ;;
        *) break ;;
    esac
done

echo "::error::$image did not become healthy (state: $state)"
docker logs "$container"
# The healthcheck's own output: an app that runs but answers / wrongly logs nothing.
docker inspect --format '{{if .State.Health}}{{json .State.Health.Log}}{{end}}' "$container"
exit 1
