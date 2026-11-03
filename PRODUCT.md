# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Prospective clients commissioning architectural visualisation: architects, developers, and competition teams deciding whether this studio can render their project. They arrive with a project already in mind and no prior relationship, judge the work quickly in a browser, and then look for a way to start a conversation.

## Product Purpose

A single-page showcase for an architectural-visualisation practice, built around one winter pavilion study: five interactive camera views, an elevation that develops from structure into atmosphere, and a floor plan that assembles as the visitor scrolls. Success means a prospective client trusts the craft on sight and reaches the enquiry path.

## Positioning

The page argues for the practice by making the visualisation process legible rather than showing only finished stills. The same pavilion is read as structure, material, light, and atmosphere, and the drawing is shown assembling into a place. A neighbouring visualisation portfolio could show polished images; this one shows the reasoning between drawing and image.

## Operating Context

Evaluation happens on the web, on desktop and phone, before any conversation with the studio. The page therefore has to carry the argument on its own. The studio's stated offer is imagery, film, and interactive space, and its published services are architectural imagery, cinematic films, and interactive experiences. Clients are invited to bring a model, a set of drawings, or a paragraph about a project.

## Capabilities and Constraints

- One public surface: the single-page pavilion study. Static Vite build with vanilla JavaScript modules and Three.js r169; no backend, no accounts, no data collection.
- Interactive features: five camera stages driven by scroll, rail, and keyboard; hover inspection of architectural elements; procedural water and snow; ambient sound off by default; loading veil; layered elevation artwork; scroll-pinned plan assembly; mobile navigation; enquiry sheet.
- Performance is tiered by device capability, and a WebGL failure falls back to the stills below the hero.
- Contact fields are intentionally empty and render as "To be supplied"; the enquiry sheet explains this to the visitor.
- Open decision: how an enquiry should actually reach the studio. Real details, an external form, and removing the flow were all considered, and the current instruction is to leave the placeholders in place rather than invent contact information.
- All studio and project content in this repository is fictional; see Brand Commitments and Evidence on Hand.

## Brand Commitments

- Name: Forma Studio. The wordmark and mark live inline in `index.html`, with `public/favicon.svg` as the icon.
- The studio, its services, the pavilion, and the winter study are invented for this build. Future work must never present them as client work, commissions, built architecture, testimonials, press, or measured results.
- Date framing in the build is "Winter 2026" for the pavilion study.
- The existing voice is measured, architectural, and editorial: present tense, technical read-outs used as texture, no sales superlatives.

## Evidence on Hand

- The pavilion model at `public/models/forma-pagoda.glb`, the self-hosted fonts under `public/fonts/`, and all copy in `index.html`, `src/data/content.js`, and the section modules.
- No real client work, case studies, testimonials, press coverage, benchmarks, pricing, or studio biography exists. None may be fabricated.
- Contact details (email, telephone, studio address, hours) do not exist for this build.

## Product Principles

1. The work is the argument: demonstrate craft and process instead of describing capability.
2. Fiction stays legible as fiction: invented studio and project content must never read as a factual claim.
3. Every view must stand on its own, because the page is judged in glimpses, on phones, before anyone reads it in order.
4. Honest gaps beat invented detail: placeholders stay labelled rather than filled with plausible fakes.
5. Interaction exists to reveal structure; motion that does not aid inspection is decoration.
