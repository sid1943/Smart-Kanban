# Smart Task Hub 🎯

An intelligent task management app that adapts its behavior based on task categories.

## Features

### Currently Available
- **🥬 Groceries** - Tell the app what ingredients you have, get recipe suggestions, and auto-generate shopping lists

### Coming Soon
- **📚 Learning** - Get personalized learning roadmaps with daily topic reminders
- **✈️ Travel/Visa** - Break down complex processes into deadline-driven checklists  
- **⏰ Reminders** - Smart recurring reminders

## Quick Start

### Prerequisites
- Node.js 18+
- Claude API key from [console.anthropic.com](https://console.anthropic.com/settings/keys)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Enter API Key
On first launch, enter your Claude API key. It's stored locally in your browser.

## How It Works

### Grocery Flow
1. Select "Groceries" category
2. List what ingredients you have at home
3. Claude suggests recipes you can make
4. Select a recipe → get a shopping list for missing items
5. Check off items as you shop

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS |
| AI | Claude API (Sonnet) |
| Storage | localStorage |
| Build | Vite |

## Project Structure

```
src/
├── components/        # React UI components
├── categories/        # Category-specific handlers
│   └── grocery/      # Grocery planning logic
├── services/         # API & storage services
├── hooks/            # Custom React hooks
├── types/            # TypeScript types
└── App.tsx           # Main app component
```

## Adding New Categories

1. Create a new folder in `src/categories/`
2. Implement a handler following the pattern in `grocery/GroceryHandler.ts`
3. Add the category to the sidebar in `components/Sidebar.tsx`
4. Handle the category in `App.tsx`

## Mobile Support (Future)

The app is built with Capacitor compatibility in mind. To wrap for iOS/Android:

```bash
npm install @capacitor/core @capacitor/cli
npx cap init
npx cap add ios
npx cap add android
```

## License

MIT
