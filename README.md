# scent-app

## Backend (Django)

### Setup

1. Create and activate a virtual environment:

   ```bash
   cd ascent-backend
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # macOS/Linux:
   # source venv/bin/activate
   ```

   Virtual Environment Start Command:

   source c:/Users/sanka/Scent_App/.venv/Scripts/activate

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

### Run the server

From the `ascent-backend` directory (with the venv activated):

```bash
python manage.py runserver
```

The app will be available at http://127.0.0.1:8000/

### Supabase (optional)

To use [Supabase](https://supabase.com) as the database and backend:

1. **Backend (Django → PostgreSQL)**  
   In `ascent-backend`, copy `.env.example` to `.env` and set:
   - `SUPABASE_DATABASE_URL` — from Supabase Dashboard → Project Settings → Database → Connection string (URI). Use **Session mode** for typical use or **Direct** for long-lived servers.

   Then run migrations: `python manage.py migrate`

2. **Expo app**  
   In the project root, copy `.env.example` to `.env` and set:
   - `EXPO_PUBLIC_SUPABASE_URL` — Project URL (API settings)
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` — anon public key

   Use the client in app code: `import { supabase } from '@/lib/supabase'`

# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
