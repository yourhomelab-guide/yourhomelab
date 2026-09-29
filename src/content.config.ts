/**
 * Content collections. All editable content lives in the top-level `content/` folder.
 * See CONTRIBUTING.md for the folder conventions.
 */
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { categories, homelabFacets } from './config/site';

/**
 * Every entry is a folder with one file per language: `01-basics/03-cloud-hybrid-local/de.mdx`.
 * The id keeps that path without extension: `01-basics/03-cloud-hybrid-local/de`.
 */
const pathId = ({ entry }: { entry: string }) => entry.replace(/\.(mdx?|ya?ml)$/, '');

/** 1 = Einsteiger, 2 = Fortgeschritten, 3 = Profi */
const level = z.union([z.literal(1), z.literal(2), z.literal(3)]);

/** URL slug in this language. Defaults to the (English) folder name without its number. */
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'lowercase letters, digits and dashes only').optional();

/** `stub` = placeholder that still needs to be written. Shown with a "help write this" note. */
const status = z.enum(['published', 'stub']).default('published');

const wiki = defineCollection({
  loader: glob({ base: './content/wiki', pattern: '[!_]*/[!_]*/{de,en}.{md,mdx}', generateId: pathId }),
  schema: z.object({
    slug,
    title: z.string(),
    description: z.string().optional(),
    level: level.default(1),
    status,
    /** Folder names (without number) of related wiki articles, e.g. `hardware-overview` */
    related: z.array(z.string()).default([]),
    /** Folder name of a guide that puts this article into practice */
    practice: z.string().optional(),
  }),
});

const stages = defineCollection({
  loader: glob({ base: './content/guides', pattern: '[!_]*/{de,en}.md', generateId: pathId }),
  schema: z.object({
    /** Anchor on the setup page in this language */
    slug,
    title: z.string(),
    description: z.string(),
  }),
});

const guides = defineCollection({
  loader: glob({ base: './content/guides', pattern: '[!_]*/[!_]*/{de,en}.{md,mdx}', generateId: pathId }),
  schema: z.object({
    slug,
    title: z.string(),
    description: z.string().optional(),
    level: level.default(1),
    /** Estimated time in minutes */
    minutes: z.number().int().positive().default(15),
    /** Free text prerequisites, e.g. "Docker Compose" */
    requires: z.array(z.string()).default([]),
    /** Service ids this guide relates to (shown on the service page) */
    services: z.array(z.string()).default([]),
    status,
  }),
});

const services = defineCollection({
  loader: glob({
    base: './content/services',
    pattern: '[!_]*/service.yaml',
    generateId: ({ entry }) => entry.split('/')[0],
  }),
  schema: z.object({
    name: z.string(),
    category: z.enum(categories),
    level: level.default(1),
    /** Optional badge: recommended, popular or new */
    tag: z.enum(['recommended', 'popular', 'new']).optional(),
    /** Show on the start page */
    popular: z.boolean().default(false),
    /** Name of the service in compose.yaml that serves the web UI. Defaults to the folder name. */
    main: z.string().optional(),
    /** Port the web UI listens on inside the container */
    port: z.number().int(),
    /** Port published on the host when no reverse proxy is used. Defaults to `port`. */
    hostPort: z.number().int().optional(),
    /** Subdomain (or path segment) the service is reachable under */
    subdomain: z.string(),
    /** Service only works on its own subdomain, never under a path */
    subdomainOnly: z.boolean().default(false),
    /** The service IS a reverse proxy: its compose.yaml is shown as-is (only placeholders are filled) */
    reverseProxy: z.boolean().default(false),
    /** Additional files in the service folder shown as tabs, e.g. `Caddyfile` */
    files: z.array(z.string()).default([]),
    /** Extra Traefik labels added when Traefik is the chosen proxy, e.g. middlewares */
    traefikLabels: z.array(z.string()).default([]),
    /** Logo id from https://selfh.st/icons (defaults to folder name). A `logo.svg` in the folder wins. */
    icon: z.string().optional(),
    links: z.object({
      /** `owner/repo` on GitHub, or a full URL for other forges */
      repo: z.string(),
      website: z.url(),
      docs: z.url(),
    }),
    /** Where the official compose file lives, shown as "Aus dem Repo" */
    upstream: z
      .object({
        /** Human readable location, e.g. `docker/docker-compose.yml` */
        label: z.string(),
        /** Link to the file */
        url: z.url(),
      })
      .optional(),
    /** Date the template was last tested (YYYY-MM-DD) */
    reviewed: z.coerce.date().optional(),
    /** Does a GPU help (transcoding, machine learning)? */
    gpu: z.enum(['no', 'optional', 'recommended']).default('no'),
    /**
     * Database of the stack, used for backup dumps (borgmatic generator, backup guide).
     * `service` is the database container's service name in compose.yaml; `user` / `name` may be literals or `${VAR}` from .env.
     */
    db: z
      .object({
        type: z.enum(['postgres', 'mariadb', 'mysql', 'sqlite']),
        service: z.string().optional(),
        user: z.string().optional(),
        name: z.string().optional(),
        /**
         * sqlite: path of the database file relative to the stack folder, as mounted in compose.yaml, e.g. `data/data/db.sqlite3`.
         * A leading `data/` is the stack's data folder, so tools map it to `__DATA(<id>)__` for the central data mode.
         */
        path: z.string().optional(),
      })
      .optional(),
    /** Ids of services that go well with this one ("Passt gut zu") */
    pairsWith: z.array(z.string()).default([]),
  }),
});

const serviceTexts = defineCollection({
  loader: glob({
    base: './content/services',
    pattern: '[!_]*/{de,en}.md',
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: z.object({
    /** One or two sentences shown on cards */
    description: z.string(),
    /** Short hints shown in the "Gut zu wissen" box */
    notes: z.array(z.string()).default([]),
  }),
});

const faq = defineCollection({
  loader: glob({ base: './content/faq', pattern: '[!_]*/{de,en}.md', generateId: pathId }),
  schema: z.object({ question: z.string() }),
});

const pages = defineCollection({
  loader: glob({ base: './content/pages', pattern: '[!_]*/{de,en}.{md,mdx}', generateId: pathId }),
  schema: z.object({
    title: z.string(),
    /** Optional highlighted summary box at the top */
    summary: z.string().optional(),
    updated: z.string().optional(),
  }),
});

/** Showcase: one folder per homelab with `homelab.md` (fields in frontmatter, free text in the body) */
const facet = <K extends keyof typeof homelabFacets>(k: K) => z.enum(homelabFacets[k]);
const homelabs = defineCollection({
  loader: glob({ base: './content/homelabs', pattern: '[!_]*/homelab.md', generateId: ({ entry }) => entry.split('/')[0] }),
  schema: z.object({
    /** Name of the homelab, e.g. "Keller-Rack" */
    name: z.string(),
    /** Display name of the person */
    author: z.string(),
    /** GitHub user name, links to the profile */
    github: z.string().regex(/^[A-Za-z0-9-]+$/, 'GitHub user name only').optional(),
    /** Optional blog post or repo about the setup */
    link: z.url().optional(),
    /** Language the texts are written in */
    lang: z.enum(['de', 'en']),
    /** Demo entry that ships with the site, shown with a badge */
    example: z.boolean().default(false),
    added: z.coerce.date(),
    /** One or two sentences for the card */
    summary: z.string(),
    location: facet('location'),
    platform: z.array(facet('platform')).min(1),
    management: z.array(facet('management')).min(1),
    proxy: z.array(facet('proxy')).default([]),
    access: z.array(facet('access')).default([]),
    /** Number of machines (physical or rented) */
    servers: z.number().int().positive(),
    /** Free text, e.g. "2× Lenovo M720q, 1× Synology DS920+" */
    hardware: z.string(),
    /** Idle power draw of everything in watts */
    watts: z.number().positive().optional(),
    /** Free text fields shown in the detail view */
    domain: z.string().optional(),
    auth: z.string().optional(),
    backup: z.string().optional(),
    monitoring: z.string().optional(),
    /** Service names; ids from content/services get linked */
    services: z.array(z.string()).default([]),
  }),
});

export const collections = { wiki, stages, guides, services, serviceTexts, faq, pages, homelabs };
