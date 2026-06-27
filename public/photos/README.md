# Grid photos

Real feed assets used by the demo Instagram-style grid (Overview page).
They're served from `/photos/<filename>` and referenced in
`src/lib/demoData.ts` (filenames are URL-encoded there, so spaces are fine).

Current feed (in grid order):
1. `15 JAN MIREYAA GRID-01.jpg` → "Mireyaa — look 01" (Post)
2. `15 JAN MIREYAA GRID-05.jpg` → "Mireyaa — look 05" (Post)
3. `15 JAN MIREYAA GRID-07.jpg` → "Mireyaa — look 07" (Post)
4. `1782300006428813-ezremove.mp4` → "Reel — the reveal" (Reel — plays in the tile)
5. `magnific_use-img1-as-the-sole-refe_mC2WOgEhJQ.jpeg` → "Editorial I" (Post)
6. `magnific_use-img1-as-the-sole-refe_nTlJ5s6YQD.jpeg` → "Editorial II" (Post)
7. `appleArtboard 1 copy 12.png` → "Brand frame" (Post)

To change the feed, edit the file constants and items at the top of
`src/lib/demoData.ts`. Add a new file here, then add an `asset('<filename>')`
entry. Videos (`.mp4`, `.webm`, `.mov`) render as playing Reel tiles.
