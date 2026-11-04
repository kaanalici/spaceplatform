# 🚀 Whirlybird — Neon Sky

**A neon-themed vertical climbing arcade game inspired by Google's classic Whirlybird.**

Whirlybird — Neon Sky is a lightweight, single-page browser game built with pure HTML, CSS, and JavaScript. Climb through an ever-changing neon universe, avoid deadly obstacles, collect rewards, defeat powerful bosses, and customize your drone.

No installation, external libraries, or internet connection required.

## 🎮 Features

- **Endless Vertical Climbing:** Keep climbing as the difficulty gradually increases.
- **Dynamic Platforms:** Jump across normal, moving, fragile, cloud, and spring platforms.
- **Power-Ups:** Collect shields, magnets, jetpacks, crystals, feathers, and double-score boosts.
- **Deadly Obstacles:** Avoid dangerous spinning saws.
- **Eight Sky Regions:** Explore unique atmospheric environments with smoothly transitioning colors and effects.
- **Boss Battles:** Encounter one of 20 randomly selected boss types at 1,000 meters.
- **NEON Economy:** Earn in-game currency through gameplay.
- **Loot Chests:** Unlock cosmetic items with different rarity levels.
- **16 Cosmetic Items:** Customize your drone with 10 character skins and 6 particle trails.
- **Persistent Progress:** High scores, cosmetics, and currency are saved locally.
- **Adaptive Graphics:** Three graphics quality levels help maintain performance across devices.

## 🌌 Sky Regions

Discover eight different atmospheric zones as you climb higher:

| Height | Region |
|---|---|
| 0m | Neon Dawn |
| 700m | Pink Horizon |
| 1,500m | Emerald Ring |
| 2,400m | Purple Nebula |
| 3,300m | Crimson Satellite |
| 4,300m | Golden Eclipse |
| 5,400m | Frozen Night |
| 6,800m | Zero Point |

Each region features its own color palette, atmospheric effects, planets, meteors, and visual elements.

## 👾 Boss Battles

At 1,000 meters, the Sky Guardian awakens.

- 20 unique boss variations.
- Six hits required to defeat a boss.
- Collect falling energy cores to damage the boss.
- Different attack patterns depending on the boss type.
- Earn 300 points, 60 NEON, a shield, and restored health after victory.

Each run features only one boss encounter.

## 🕹️ Controls

### Desktop

| Action | Control |
|---|---|
| Move left / right | Arrow Keys or A / D |
| Mouse movement | Hold and drag the left mouse button |
| Pause | P / Esc |
| Toggle sound | M |
| Jump | Automatic |

### Mobile

| Action | Control |
|---|---|
| Move left | Touch and hold the left half of the screen |
| Move right | Touch and hold the right half of the screen |
| Change direction | Slide your finger to the opposite half |
| Jump | Automatic |

Both control styles can be selected from the main menu.

## 💎 NEON Economy & Cosmetics

Earn NEON by collecting items and progressing through the game.

- Starting balance: 150 NEON.
- Loot chest cost: 100 NEON.
- New high score bonus: 50 NEON.
- Boss victory reward: 60 NEON.

### Cosmetic Collection

**Characters (10):** Classic, Coral, Lemon, Ice, Emerald, Rose, Purple, Gold, Ghost, and Dragon.

**Trails (6):** Neon, Pink, Green, Golden Dust, Rainbow, and Stardust.

Cosmetics are purely visual and do not affect gameplay performance or difficulty.

## ⚙️ Settings

Customize your experience with:

- Desktop / Mobile control selection.
- Sound on / off.
- Screen shake on / off.
- Graphics quality: Auto, High, Medium, and Low.
- Two-step progress reset.

## ⚡ Performance & Technology

Whirlybird uses a lightweight rendering architecture designed for smooth gameplay.

- **Rendering:** HTML5 Canvas.
- **World Resolution:** 420 × 720.
- **Physics:** Fixed timestep at 60 updates per second.
- **Audio:** Real-time sound generation using Web Audio API.
- **Storage:** Browser LocalStorage.
- **Graphics:** Adaptive quality system with three performance levels.
- **Optimization:** Cached sky rendering and reduced visual effects on mobile devices.

The game automatically adjusts graphics quality in Auto mode when frame times remain high.

## 📂 Project Structure

```text
Whirlybird/
│
├── index.html      # Game interface and UI
├── style.css       # Neon visual design and styling
├── game.js         # Game engine and mechanics
├── oyna.bat        # Windows launcher
├── sunucu.bat      # Local server for mobile devices
└── README.md       # Project documentation
```

## ▶️ How to Play

### Windows

1. Download or clone this repository.
2. Double-click `oyna.bat`, or open `index.html` directly in your browser.
3. Select your preferred control style.
4. Press **PLAY** and start climbing!

### Mobile Devices

1. Run `sunucu.bat` on your Windows computer.
2. Connect your phone to the same Wi-Fi network.
3. Open the local address displayed by the server in your mobile browser.

You can also host the project on a web server, such as GitHub Pages.

## 📜 License

No license has been specified for this project yet. All rights are reserved by the project author unless a license is added.

## 👨‍💻 Author

**Created by Kaan Alıcı**

Whirlybird — Neon Sky is an independent browser game project inspired by classic vertical climbing arcade games.

---

*Keep climbing. The sky is not the limit.* ✨
