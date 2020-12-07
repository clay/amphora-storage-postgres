# Environment Setup

To define where Postgres and Redis clients will connect to you can define the following environment variables:

- [`CLAY_STORAGE_POSTGRES_USER`](#clay_storage_postgres_user)
- [`CLAY_STORAGE_POSTGRES_PASSWORD`](#clay_storage_postgres_password)
- [`CLAY_STORAGE_POSTGRES_HOST`](#clay_storage_postgres_host)
- [`CLAY_STORAGE_POSTGRES_PORT`](#clay_storage_postgres_port)
- [`CLAY_STORAGE_POSTGRES_DB`](#clay_storage_postgres_db)
- [`CLAY_STORAGE_POSTGRES_CACHE_ENABLED`](#clay_storage_postgres_cache_enabled)
- [`CLAY_STORAGE_POSTGRES_CACHE_HOST`](#clay_storage_postgres_cache_host)
- [`CLAY_STORAGE_PAGE_SIZE`](#clay_storage_page_size)

---
## Postgres

The following values are all used in the configuration of how to connect to your Postgres instance. These values default to a local setup but should be updated for production environments.

### `CLAY_STORAGE_POSTGRES_USER`

**Default:** `postgres` _(String)_

### `CLAY_STORAGE_POSTGRES_PASSWORD`

**Default:** `example` _(String)_

The password to use when connecting to Postgres

### `CLAY_STORAGE_POSTGRES_HOST`

**Default:** `localhost` _(String)_

The host where your Postgres instance resides.

### `CLAY_STORAGE_POSTGRES_PORT`

**Default:** `5432` _(Number)_

The port where your Postgres instance resides on its host.

### `CLAY_STORAGE_POSTGRES_DB`

**Default:** `clay` _(String)_

The database within Postgres to connect to.

### `CLAY_STORAGE_PAGE_SIZE`

**Default:** `null` _(Number)_

Default page size for list queries. Enables pagination by default on list endpoints. Setting a page size of `0` will disable pagination.

---

## Redis

The following values pertain to the configuration of the Redis cashing layer within the module. If not configured, all values will be read from Postgres directly.

### `CLAY_STORAGE_POSTGRES_CACHE_ENABLED`

**Default:** `false` _(Boolean)_

If set to `true` the module will leverage Redis as a cache for published data, uris, and user data to enable faster rendering of reader facing pages.

### `CLAY_STORAGE_POSTGRES_CACHE_HOST`

**Default:** `redis://localhost:6379` _(String)_

The Redis host to connect to. Should be [Redis Protocol](https://redis.io/topics/protocol) and include the port.

### `CLAY_STORAGE_POSTGRES_CACHE_TTL`

**Default:** `86400` _(Number)_

This determines how long items will remain in the query cache (in seconds). The default is 24 hours.
