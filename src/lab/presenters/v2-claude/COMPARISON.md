# Version 1 and version 2 (Claude), side by side

Version 1's column is from `docs/presenters/README.md`. Version 2's column is what is in this folder on 20 November 2026.

| | Version 1 | Version 2 (Claude) |
|---|---|---|
| Design size | 240 × 320 SVG | Any size; drawn by the GPU at the canvas's own pixels, checked at 1920 × 1080 |
| Views | Front only | Any angle: the model sheet shows six, the playground lets the camera walk round |
| Body | Half figure, one arm that points | Whole figure on a skeleton: spine, neck, two arms with fingers, two legs |
| State | 8 numbers | 69 channels |
| Actions | 6 (speak, blink, nod, look, point, emote) | 69 moves in `moves.json`, the same six among them with the same meaning |
| Locomotion | None | Walk, run, jump, hop, turn, spin, crouch; each body walks its own way (walk cycle, waddle, roll, glide) |
| Layering | One value per field | Moves layer by body part and cross-fade (wave while walking, talk while pointing) |
| Mouth | Opens with loudness | Nine shapes (Rhubarb A to H and X) from the sound, blended; loudness still works |
| Expressions | Smile | Eight, plus eyebrows and lids |
| Secondary motion | None | Springs on ties, hair, antennas, keys, ear tufts and the cube, on a fixed grid from t = 0 |
| Specials | None | One or more per character, 24 in all |
| Camera | Fixed | Shots in `choreography.json`: cuts, moves, framing on characters |
| Stage | One card each | Twelve on one stage, entering and leaving |
| Libraries | None | three.js 0.160.1, vendored |
| Frame = f(t) | Yes | Yes; three times rendered twice in separate launches gave identical PNGs |
| Render speed | 692 frames in 67 s (0.10 s a frame, 1280 × 720) | About 0.8 to 1.5 s a frame at 1920 × 1080 on one CPU with software WebGL: much slower |
| Label | "Synthetic presenter" on screen | The same, on every frame, with a name tag on every character |
