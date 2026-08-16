"""
Blast Radius — npm ingestion into HydraDB.

Fetches real package metadata from the public npm registry and builds a
dependency graph in HydraDB:

  (:Package {name})
  (:Version {name, version, published_at})   published_at = epoch seconds
  (:Maintainer {name})
  (:Service {name})                          synthetic internal apps (demo)

  (:Version)-[:VERSION_OF]->(:Package)
  (:Package)-[:DEPENDS_ON]->(:Package)        collapsed topology for traversal
  (:Maintainer)-[:MAINTAINS]->(:Package)
  (:Service)-[:INSTALLED {at}]->(:Version)    lockfile resolution events

Real npm data (names, versions, timestamps, maintainers). The Service layer is
a synthetic fictional company, clearly disclosed in the README.

Usage:
    python ingest.py --max-packages 800 --workers 12
    python ingest.py --reset            # wipe graph + id map first
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import json
import time
import urllib.request
import urllib.error
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

from hydra import Hydra, IdMap, DATA_DIR

REGISTRY = "https://registry.npmjs.org"
CACHE_DIR = DATA_DIR / "cache"
MAX_VERSIONS_PER_PKG = 6

# Curated seed set: popular, high-fan-in packages across the ecosystem.
SEEDS = [
    "react", "react-dom", "next", "vue", "svelte", "express", "koa", "fastify",
    "webpack", "vite", "rollup", "esbuild", "typescript", "eslint", "prettier",
    "jest", "mocha", "vitest", "axios", "lodash", "moment", "dayjs", "chalk",
    "commander", "yargs", "debug", "cross-env", "rimraf", "glob", "chokidar",
    "dotenv", "winston", "pino", "socket.io", "ws", "node-fetch", "got",
    "graphql", "apollo-server", "prisma", "sequelize", "mongoose", "redis",
    "ioredis", "pg", "mysql2", "knex", "jsonwebtoken", "bcrypt", "passport",
    "nodemailer", "sharp", "puppeteer", "playwright", "cheerio", "styled-components",
    "tailwindcss", "postcss", "autoprefixer", "babel-core", "@babel/core",
    "zod", "yup", "formik", "redux", "zustand", "react-router", "react-router-dom",
    "storybook", "cypress", "husky", "lint-staged", "nx", "turbo", "tsx",
    "nodemon", "concurrently", "uuid", "nanoid", "date-fns", "immer",
    # widen coverage: build/test/lint/util ecosystems
    "gulp", "grunt", "browserify", "parcel", "snowpack", "tsup", "microbundle",
    "ts-node", "ts-jest", "babel-jest", "@babel/preset-env", "@babel/preset-react",
    "@babel/preset-typescript", "@testing-library/react", "@testing-library/dom",
    "enzyme", "sinon", "chai", "ava", "tape", "supertest", "nock", "msw",
    "eslint-config-airbnb", "eslint-plugin-react", "eslint-plugin-import",
    "eslint-plugin-jsx-a11y", "@typescript-eslint/parser", "@typescript-eslint/eslint-plugin",
    "standard", "xo", "semistandard",
    "@angular/core", "@angular/common", "rxjs", "zone.js", "@nestjs/core",
    "@nestjs/common", "typeorm", "class-validator", "class-transformer",
    "vue-router", "vuex", "pinia", "nuxt", "gatsby", "remix", "astro",
    "solid-js", "preact", "lit", "alpinejs", "jquery", "d3", "three",
    "chart.js", "echarts", "leaflet", "mapbox-gl", "framer-motion", "gsap",
    "@emotion/react", "@emotion/styled", "sass", "less", "stylus", "less-loader",
    "css-loader", "style-loader", "sass-loader", "mini-css-extract-plugin",
    "html-webpack-plugin", "terser-webpack-plugin", "webpack-dev-server",
    "webpack-cli", "webpack-merge", "copy-webpack-plugin",
    "express-session", "cors", "helmet", "morgan", "compression", "multer",
    "body-parser", "cookie-parser", "express-validator", "http-proxy-middleware",
    "connect", "serve-static", "finalhandler",
    "aws-sdk", "@aws-sdk/client-s3", "firebase", "firebase-admin", "stripe",
    "twilio", "@sentry/node", "@sentry/react", "newrelic", "dd-trace",
    "kafkajs", "amqplib", "bull", "bullmq", "agenda", "node-cron",
    "inquirer", "ora", "boxen", "cli-progress", "figlet", "chalk-animation",
    "fs-extra", "globby", "execa", "cross-spawn", "shelljs", "which",
    "semver", "minimist", "commander", "meow", "arg",
    "handlebars", "ejs", "pug", "mustache", "marked", "markdown-it",
    "highlight.js", "prismjs", "dompurify", "sanitize-html", "validator",
    "joi", "ajv", "superstruct", "io-ts", "runtypes",
    "date-fns-tz", "luxon", "moment-timezone",
    "bcryptjs", "argon2", "crypto-js", "node-forge", "jose", "jsonwebtoken",
    "passport-jwt", "passport-local", "passport-google-oauth20",
    "@apollo/client", "graphql-tag", "apollo-server-express", "type-graphql",
    "mongodb", "mongoose", "typegoose", "@prisma/client", "drizzle-orm",
    "kysely", "objection", "bookshelf", "waterline",
    "react-query", "@tanstack/react-query", "swr", "recoil", "jotai", "xstate",
    "react-hook-form", "final-form", "react-final-form",
    "styled-jsx", "classnames", "clsx", "tailwind-merge", "cva",
    "react-select", "react-table", "@tanstack/react-table", "ag-grid-react",
    "react-dnd", "react-beautiful-dnd", "@dnd-kit/core",
]

# Known / documented typosquat-style lookalike names paired with a popular
# target. Disclosed in the README as an injected demonstration set — real
# supply-chain incidents used names exactly like these.
TYPOSQUAT_SEEDS = [
    ("crossenv", "cross-env"), ("cross-env.js", "cross-env"),
    ("iconv", "iconv-lite"), ("node-fetch", "node-fetch"),
    ("loadash", "lodash"), ("lodahs", "lodash"), ("lodash.js", "lodash"),
    ("momnet", "moment"), ("expres", "express"), ("expresss", "express"),
    ("reactt", "react"), ("axioss", "axios"), ("chai.js", "chai"),
    ("babelcli", "babel-cli"), ("d3.js", "d3"), ("discord.js-user", "discord.js"),
    ("jquerry", "jquery"), ("colours", "colors"), ("commnder", "commander"),
    ("debg", "debug"), ("dbug", "debug"), ("webpakc", "webpack"),
]


def iso_to_epoch(s: str) -> int:
    try:
        return int(datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp())
    except Exception:
        return 0


def fetch_doc(name: str, retries: int = 3) -> dict | None:
    """Fetch a package doc, caching raw JSON to disk."""
    safe = name.replace("/", "%2F")
    cache_path = CACHE_DIR / f"{safe}.json"
    if cache_path.exists():
        try:
            return json.loads(cache_path.read_text())
        except Exception:
            pass
    url = f"{REGISTRY}/{safe}"
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "blast-radius-hackathon"})
            with urllib.request.urlopen(req, timeout=20) as resp:
                doc = json.loads(resp.read().decode())
            CACHE_DIR.mkdir(parents=True, exist_ok=True)
            cache_path.write_text(json.dumps(doc))
            return doc
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(1 + attempt)
        except Exception:
            time.sleep(1 + attempt)
    return None


def parse_doc(doc: dict) -> dict:
    """Extract the fields we care about from a registry doc."""
    name = doc.get("name")
    dist_tags = doc.get("dist-tags", {}) or {}
    latest = dist_tags.get("latest")
    versions = doc.get("versions", {}) or {}
    times = doc.get("time", {}) or {}
    maintainers = [m.get("name") for m in (doc.get("maintainers") or []) if m.get("name")]

    # dependencies of the latest version (production deps)
    deps: list[str] = []
    dev_deps: list[str] = []
    if latest and latest in versions:
        deps = list((versions[latest].get("dependencies") or {}).keys())
        dev_deps = list((versions[latest].get("devDependencies") or {}).keys())

    # a handful of recent versions with publish timestamps
    ver_rows = []
    for ver, iso in times.items():
        if ver in ("created", "modified"):
            continue
        if ver in versions:
            ver_rows.append((ver, iso_to_epoch(iso)))
    ver_rows.sort(key=lambda x: x[1], reverse=True)
    ver_rows = ver_rows[:MAX_VERSIONS_PER_PKG]

    return {
        "name": name,
        "latest": latest,
        "deps": deps,
        "dev_deps": dev_deps,
        "maintainers": maintainers,
        "versions": ver_rows,
    }


def crawl(seeds: list[str], max_packages: int, workers: int) -> dict[str, dict]:
    """BFS the dependency graph from seeds up to max_packages."""
    parsed: dict[str, dict] = {}
    seen: set[str] = set()
    queue: deque[str] = deque(seeds)
    for s in seeds:
        seen.add(s)

    with cf.ThreadPoolExecutor(max_workers=workers) as ex:
        while queue and len(parsed) < max_packages:
            batch = []
            while queue and len(batch) < workers * 2:
                batch.append(queue.popleft())
            futures = {ex.submit(fetch_doc, n): n for n in batch}
            for fut in cf.as_completed(futures):
                name = futures[fut]
                doc = fut.result()
                if not doc or not doc.get("name"):
                    continue
                info = parse_doc(doc)
                parsed[info["name"]] = info
                if len(parsed) % 50 == 0:
                    print(f"  crawled {len(parsed)} packages...")
                # discover more of the ecosystem via prod + dev deps
                for dep in info["deps"] + info["dev_deps"]:
                    if dep not in seen and len(seen) < max_packages * 4:
                        seen.add(dep)
                        queue.append(dep)
    return parsed


def synthesize_services(parsed: dict, idm: IdMap):
    """Fictional company 'Northwind' with internal services whose lockfiles
    resolved specific versions at specific times. Disclosed as synthetic."""
    services = [
        "checkout-api", "payments-worker", "auth-gateway", "web-storefront",
        "inventory-svc", "notifications", "analytics-pipeline", "admin-dashboard",
        "search-api", "recommendation-engine", "mobile-bff", "fraud-detector",
    ]
    svc_nodes = [{"id": idm.get(f"svc:{s}"), "name": s} for s in services]

    # each service "installs" the latest version of a spread of packages
    names = list(parsed.keys())
    installed_rows = []
    import random
    rng = random.Random(1337)
    for s in services:
        picks = rng.sample(names, min(15, len(names)))
        for pkg in picks:
            vers = parsed[pkg]["versions"]
            if not vers:
                continue
            ver, published = vers[0]  # latest known
            vkey = f"ver:{pkg}@{ver}"
            if not idm.has(vkey):
                continue
            # install time: shortly after that version published
            at = published + rng.randint(3600, 60 * 60 * 24 * 30)
            installed_rows.append({
                "rid": idm.get(f"inst:{s}:{pkg}@{ver}"),
                "s": idm.get(f"svc:{s}"),
                "d": idm.get(vkey),
                "at": at,
            })
    return svc_nodes, installed_rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-packages", type=int, default=800)
    ap.add_argument("--workers", type=int, default=12)
    ap.add_argument("--reset", action="store_true")
    args = ap.parse_args()

    if args.reset:
        (DATA_DIR / "id_map.json").unlink(missing_ok=True)
        print("id map reset; wiping graph...")

    idm = IdMap()

    print(f"crawling npm registry from {len(SEEDS)} seeds (max {args.max_packages})...")
    parsed = crawl(SEEDS, args.max_packages, args.workers)
    print(f"crawled {len(parsed)} packages total.")

    # allocate ids
    pkg_nodes, ver_nodes, maint_nodes = [], [], []
    dep_edges, verof_edges, maintains_edges = [], [], []
    maint_seen = set()

    for name, info in parsed.items():
        pid = idm.get(f"pkg:{name}")
        pkg_nodes.append({"id": pid, "name": name})
        for ver, published in info["versions"]:
            vid = idm.get(f"ver:{name}@{ver}")
            ver_nodes.append({"id": vid, "name": name, "version": ver, "published_at": published})
            verof_edges.append({"rid": idm.get(f"verof:{name}@{ver}"), "s": vid, "d": pid})
        for m in info["maintainers"]:
            mid = idm.get(f"maint:{m}")
            if m not in maint_seen:
                maint_nodes.append({"id": mid, "name": m})
                maint_seen.add(m)
            maintains_edges.append({"rid": idm.get(f"maintains:{m}:{name}"), "s": mid, "d": pid})

    # dependency edges: only between packages we actually ingested
    for name, info in parsed.items():
        pid = idm.get(f"pkg:{name}")
        for dep in info["deps"]:
            if f"pkg:{dep}" and dep in parsed:
                did = idm.get(f"pkg:{dep}")
                dep_edges.append({"rid": idm.get(f"dep:{name}->{dep}"), "s": pid, "d": did})

    svc_nodes, installed_rows = synthesize_services(parsed, idm)

    # typosquat layer: inject documented lookalike names and link them to their
    # popular targets with TYPOSQUAT_OF edges (graph-native lookalike detection).
    typo_nodes, typo_edges = [], []
    for typo, target in TYPOSQUAT_SEEDS:
        if target not in parsed or typo == target:
            continue
        tid = idm.get(f"pkg:{typo}")
        typo_nodes.append({"id": tid, "name": typo, "suspicious": 1})
        typo_edges.append({
            "rid": idm.get(f"typo:{typo}->{target}"),
            "s": tid, "d": idm.get(f"pkg:{target}"),
        })
    # ensure typo names are in the catalog too
    for typo, _ in TYPOSQUAT_SEEDS:
        parsed.setdefault(typo, {"name": typo})

    print(f"loading into HydraDB: {len(pkg_nodes)} pkg, {len(ver_nodes)} ver, "
          f"{len(maint_nodes)} maint, {len(svc_nodes)} svc, {len(typo_nodes)} typo | "
          f"{len(dep_edges)} DEPENDS_ON, {len(verof_edges)} VERSION_OF, "
          f"{len(maintains_edges)} MAINTAINS, {len(installed_rows)} INSTALLED, "
          f"{len(typo_edges)} TYPOSQUAT_OF")

    with Hydra() as h:
        h.upsert_nodes("Package", pkg_nodes)
        h.upsert_nodes("Package", typo_nodes)
        h.upsert_nodes("Version", ver_nodes)
        h.upsert_nodes("Maintainer", maint_nodes)
        h.upsert_nodes("Service", svc_nodes)
        h.create_edges("DEPENDS_ON", "Package", "Package", dep_edges)
        h.create_edges("VERSION_OF", "Version", "Package", verof_edges)
        h.create_edges("MAINTAINS", "Maintainer", "Package", maintains_edges)
        h.create_edges("INSTALLED", "Service", "Version", installed_rows, props=["at"])
        h.create_edges("TYPOSQUAT_OF", "Package", "Package", typo_edges)

    idm.save()
    # persist a package-name catalog for fast typosquat scans + UI autocomplete
    catalog = {name: idm.get(f"pkg:{name}") for name in parsed}
    (DATA_DIR / "packages.json").write_text(json.dumps({
        "packages": catalog,
        "count": len(catalog),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }))
    print(f"done. id map size: {len(idm)}. catalog: {len(catalog)} packages.")


if __name__ == "__main__":
    main()
