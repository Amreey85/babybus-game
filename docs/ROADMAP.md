# Roadmap: Stages 2–15

Each new stage = a layout file (`levels/stageN/layout.ts`), an entry point, an optional new
environment builder, and a `load` entry in `levels/registry.ts`. The `StageRuntime` already
provides movement, camera, stars, checkpoints, rescue mission flow, rewards and saving.

| # | Stage | World | New ideas to introduce |
| --- | --- | --- | --- |
| 2 | The Missing Kitten | Little Hero Academy | Follow paw-print clues; first "look and find" moment |
| 3 | Rainbow Playground | Little Hero Academy | Slides, swings as moving platforms, colour matching |
| 4 | Friendly Forest Rescue | Little Hero Academy | Bird in a tree; climbing vines; road-crossing safety |
| 5 | The Great Park Rescue | Little Hero Academy | World 1 finale; combine all skills; first mini-boss-free "chase" |
| 6 | The Secret Candy Trail | Junior Detective | Hidden doors; collect clue cards |
| 7 | River Bridge Adventure | Junior Detective | Floating logs, water safety tips |
| 8 | Mystery at the Zoo | Junior Detective | Help zookeeper; animal sounds puzzle |
| 9 | Magical Toy Factory | Junior Detective | Conveyor belts, switches |
| 10 | Mountain Rescue Mission | Junior Detective | Wind gusts, rope bridges |
| 11 | Sky Castle Adventure | Super Sheriff | Cloud jumping, vertical level |
| 12 | Underground Mystery | Super Sheriff | Torch light radius, simple maze |
| 13 | The Great Robot Mix-Up | Super Sheriff | Friendly robots, switch puzzles |
| 14 | Save the Animal Kingdom | Super Sheriff | Multi-rescue mission |
| 15 | The Ultimate Sheriff Challenge | Super Sheriff | Finale: every mechanic, celebration parade |

## Suggested next milestones

1. **Playtest Stage 1 with the children** and tune jump height, speed and star placement.
2. **Stage 2** using the same runtime; add a clue-collecting mission type.
3. **PWA offline mode** (service worker caching the built assets).
4. **Recorded voice lines** in English and Bahasa Melayu (replace optional speech synthesis).
5. **Optional GLB character models** if professionally modelled assets are commissioned.
