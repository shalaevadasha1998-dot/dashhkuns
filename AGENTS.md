# Engineering rules — dashhkuns.com

## Source of truth

- Site: https://dashhkuns.com/; source: this repository, not an invented replacement.
- Stack: static HTML/CSS/JS with Vercel routes in `vercel.json`; selected functions and integrations use Supabase and server APIs.
- Approved visual language comes from the existing live site, its stylesheets and checked-in assets. This is a **personal** project: its approved lowercase tone is intentional. Do not transfer its colors or fonts to any client brand.
- Keep the Russian and English core pages in sync for relevant layout/navigation changes.
- Preserve functioning lead capture, booking, analytics and referral attribution. Do not make test submissions to production.

## Mandatory workflow

1. Read `README.md`, the affected files, relevant Vercel rewrites and existing tests before editing. Do not erase working site features.
2. Make the smallest reversible change in a dedicated branch. No direct pushes to `main`.
3. Keep secrets out of code, logs, screenshots and PRs. Do not change database schemas, production integrations or access without explicit authorization.
4. Run `node --test scripts/site-contract.test.mjs` for changes to public pages, navigation, assets or SEO. This check is offline, dependency-free and does not send leads.
5. For visual changes, additionally use the existing `scripts/qa-portfolio-typography.mjs` workflow where its Playwright dependencies and evidence scope are available; test mobile and desktop screenshots. **Do not claim browser QA ran unless evidence exists.**
6. Use a preview/PR for review. Production deployment, paid services, real outreach and destructive changes require separate approval.

## Definition of done

Give exact changed files, branch or PR link, executed tests with status, screenshot/preview only when verified, and any remaining risk. A code change alone is not a tested deployment.
