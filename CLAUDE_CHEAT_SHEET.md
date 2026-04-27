# 🧠 My Claude Cheat Sheet
### How to get help without wasting tokens (for OutdoorAdvisor)

---

## ⚡ The Golden Rules

1. **One problem at a time** — don't dump the whole app on Claude
2. **Name the file** — always say which file the problem is in
3. **Give line numbers** — tell Claude where to look
4. **Fresh chat = fresh memory** — start a new conversation for each new topic
5. **Let Claude read files directly** — never paste a whole file

---

## 📁 My App's File Map (quick reference)

| If my problem is about... | The file to mention |
|--------------------------|-------------------|
| The main home weather screen | `src/screens/HomeScreen.js` |
| The travel/route planner | `src/screens/TravelScreen.js` |
| Weather alerts | `src/screens/AlertsScreen.js` |
| Activities list | `src/screens/ActivitiesScreen.js` |
| Buttons that look like glass | `src/components/glass/GlassButton.js` |
| Cards that show live conditions | `src/components/cards/LiveConditionsCard.js` |
| Weather data fetching | `src/hooks/useWeather.js` |
| Location / GPS | `src/hooks/useLocation.js` |
| Air quality data | `src/hooks/useAQI.js` |
| Pollen data | `src/hooks/usePollen.js` |
| Login / accounts | `src/context/AuthContext.js` |
| App colors & design | `src/design/colors.js` |
| Database connection | `src/lib/supabase.js` |
| App settings & startup | `App.js` |

---

## 💬 Copy-Paste Phrases (just fill in the blanks)

### To make Claude read a file (without you pasting anything):
> "Please read `[filename]` in my connected folder and tell me what it does."

**Example:**
> "Please read `src/hooks/useWeather.js` in my connected folder and tell me what it does."

---

### To report a bug:
> "In `[filename]`, around line [number], [describe what's broken]. Can you fix just that part?"

**Example:**
> "In `src/screens/HomeScreen.js`, around line 200, the temperature isn't showing correctly. Can you fix just that part?"

---

### To add a new feature to one screen:
> "I want to add [feature] to `[filename]`. Please read that file first, then suggest where to add it."

**Example:**
> "I want to add a 'refresh' button to `src/screens/HomeScreen.js`. Please read that file first, then suggest where to add it."

---

### To understand how something works:
> "Please read `[filename]` and explain what it does in simple English. I'm not a coder."

---

### To fix something that looks wrong:
> "Something looks wrong on my [screen name] screen. Please read `[filename]` and look for problems."

---

### To change the design/colors:
> "I want to change the [color/font/size] of [element]. Please read `src/design/colors.js` and `[the screen file]` first."

---

## 🚫 Things That Waste Tokens — Avoid These

| ❌ Don't do this | ✅ Do this instead |
|-----------------|------------------|
| Paste an entire file | Say "please read [filename] in my folder" |
| "Fix my whole app" | "Fix this one thing in HomeScreen.js" |
| Ask about everything at once | One problem per conversation |
| Continue a very long chat | Start fresh when switching topics |
| "Why is my app broken?" | "On the home screen, the weather card crashes when I tap it" |

---

## 🔢 How to Find Line Numbers

If Claude asks you for line numbers and you don't know them:
1. Open the file in your code editor (VS Code, etc.)
2. Line numbers appear on the left side of the screen
3. Or just describe the section: "the part where it fetches weather data"

---

## 🆕 How to Start a New Chat Efficiently

When you open a fresh conversation with Claude, start with this template:

> "I'm working on OutdoorAdvisor, a React Native iPhone app. My project folder is connected so you can read files directly. Today I want help with: [one specific thing]. The relevant file is: [filename]."

This gives Claude all the context it needs in just 2-3 sentences.

---

## 📏 My Biggest Files (be careful with these!)

These files are LARGE — never paste them in full. Always ask Claude to read them directly.

| File | Size | Warning |
|------|------|---------|
| `HomeScreen.js` | 1,899 lines | 🔴 Very large — always let Claude read it |
| `TravelScreen.js` | 1,084 lines | 🔴 Large — let Claude read it |
| `AlertsScreen.js` | 754 lines | 🟡 Medium — let Claude read it |
| `ActivitiesScreen.js` | 527 lines | 🟡 Medium — let Claude read it |

---

## ✅ My Project Is Already Clean

- `node_modules/` folder → NOT in GitHub ✅
- `ios/Pods/` folder → NOT in GitHub ✅
- Only my real code is on GitHub ✅

---

*Last updated: April 2026*
