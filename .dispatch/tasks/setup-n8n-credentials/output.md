# n8n Credentials Setup Guide

This guide walks you through manually creating the **Postgres** and **Redis** credentials in the n8n UI and rebinding them to all workflow nodes that need them.

---

## 1. Open n8n

Navigate to: **http://localhost:5679**

Login if prompted (credentials are in `.env`: `N8N_BASIC_AUTH_USER` / `N8N_BASIC_AUTH_PASSWORD`).

---

## 2. Create the Postgres Credential

### Menu path
**Left sidebar → Credentials → + Add Credential → search "Postgres" → select PostgreSQL**

### Field values

| Field | Value |
|-------|-------|
| **Credential Name** | `Agency Postgres` |
| **Host** | `postgres` |
| **Port** | `5432` |
| **Database** | `agency_os` |
| **User** | `agency_user` |
| **Password** | `eyjMaGUDYdIR2wHGD9sP` |
| **SSL** | Disabled (toggle off) |

> **Important:** Use `postgres` as the host (Docker service name), **not** `localhost`. n8n runs inside the `agency-net` Docker network where `postgres` resolves correctly.

Click **Save** (or **Test & Save** — it will turn green if the DB is running).

---

## 3. Create the Redis Credential

### Menu path
**Left sidebar → Credentials → + Add Credential → search "Redis" → select Redis**

### Field values

| Field | Value |
|-------|-------|
| **Credential Name** | `Agency Redis` |
| **Host** | `redis` |
| **Port** | `6379` |
| **Password** | `s960DA6yBaWVdpab` |
| **DB Index** | `0` (default) |

> Same Docker network rule applies: use `redis`, not `localhost`.

Click **Save**.

---

## 4. Rebind Credentials to Workflow Nodes

After creating the credentials, open each workflow and rebind each affected node. The credential selector for each node is found in the node's **Settings / Credentials** tab (click the node to open it, then look for the credential dropdown).

### WF-01: Lead Scraper

Open: **Workflows → WF-01 Lead Scraper**

| Node Name | Credential Type | Set To |
|-----------|----------------|--------|
| `Postgres - Check Duplicate` | PostgreSQL | **Agency Postgres** |
| `Postgres - Insert Lead` | PostgreSQL | **Agency Postgres** |
| `Postgres - Log Insert Success` | PostgreSQL | **Agency Postgres** |
| `Postgres - Update Score` | PostgreSQL | **Agency Postgres** |
| `Postgres - Log Scrape Failed` | PostgreSQL | **Agency Postgres** |
| `Redis - Push Notify Queue` | Redis | **Agency Redis** |

**Total nodes to rebind in WF-01: 6**

### WF-02: Telegram Notifier

Open: **Workflows → WF-02 Telegram Notifier**

| Node Name | Credential Type | Set To |
|-----------|----------------|--------|
| `Redis - Get Notify Queue` | Redis | **Agency Redis** |
| `Postgres - Get Lead Details` | PostgreSQL | **Agency Postgres** |
| `Redis - Remove From Queue` | Redis | **Agency Redis** |
| `Redis - Set Session` | Redis | **Agency Redis** |
| `Postgres - Log Notified` | PostgreSQL | **Agency Postgres** |

**Total nodes to rebind in WF-02: 5**

---

## 5. Save Each Workflow

After rebinding credentials in each workflow, click **Save** (top-right) to persist the changes.

---

## 6. Verify

To confirm everything is working:

1. In WF-01, open the **Postgres - Check Duplicate** node → click **Test step** (or run the workflow manually with a test item). A green result means the Postgres connection is live.
2. In WF-02, open the **Redis - Get Notify Queue** node → click **Test step**. A `null` or empty result (not an error) means Redis is connected.

---

## Summary

| Credential | Name in n8n | Nodes Affected |
|-----------|-------------|----------------|
| PostgreSQL | `Agency Postgres` | 8 nodes (5 in WF-01, 2 in WF-02) |
| Redis | `Agency Redis` | 4 nodes (1 in WF-01, 3 in WF-02) |
