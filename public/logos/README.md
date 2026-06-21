# Logos

The site currently uses **placeholder inline-SVG logos** (defined in
`src/components/Logo.tsx`) so it looks complete out of the box.

## To use the official Falcons logos

1. Add your optimized PNG files here, using these exact names:
   - `falcon-head.png`  — the falcon-head mascot (header / nav / favicon)
   - `badge-light.png`  — circular "LACROSSE" badge for **dark** backgrounds
   - `badge-dark.png`   — circular "LACROSSE" badge for **light** backgrounds

   Optimize them first (aim for < 100 KB each), e.g. https://squoosh.app
   Recommended: square, transparent PNG, ~512×512.

2. Open `src/components/Logo.tsx` and swap the inline SVGs for the image files.
   A ready-to-paste version using `next/image` is in the project README under
   **"Adding your real logos."**

3. For the favicon, replace `src/app/icon.svg` with `src/app/icon.png`
   (a 512×512 version of the falcon head). Next.js picks it up automatically.
