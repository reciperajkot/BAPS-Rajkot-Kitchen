# BAPS Rajkot Rasoi Seva — Supabase login baseline

This is the first real login step for the app. A user signs in with the email and password created in Supabase. The app then reads that user's `profiles` row and opens the matching dashboard automatically:

- `admin` → Super Admin
- `counter` → Cash Counter / Seva
- `production` → Production
- `dispatch` → Dispatch / Seva Provider

There is deliberately no role selector on the login screen.

## Easiest way (recommended)

Double-click `START_APP.bat`. It asks for the Project URL and Publishable/anon key, creates the safe local `.env` file, installs the app, and starts Expo for you.

## Manual setup

1. In this folder, make a copy of `.env.example` and name the copy `.env`.
2. In Supabase, open **Project Settings → API**.
3. Copy the **Project URL** into `EXPO_PUBLIC_SUPABASE_URL`.
4. Copy the **Publishable key** into `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
   - If the dashboard only has a legacy **anon** key, it can be used in this field.
   - Do **not** copy a `service_role` key or any secret key. Those must never be in a mobile app.
5. Save `.env`.

The `.env` file is ignored by Git. Do not send it to anyone or upload it to a public repository.

## 2. Install packages

Open a terminal in this folder and run:

```powershell
npm.cmd install
```

`@supabase/supabase-js` is already included. The install also adds Async Storage so a signed-in user stays signed in safely on their device.

## 3. Run the app

```powershell
npx.cmd expo start
```

Use Expo Go to scan the QR code, or choose Android in the Expo terminal.

## 4. First login test

Use the email and password for the Auth user that was changed to `admin` in Supabase. You should land on **Super Admin Dashboard**.

For later role tests, create an Auth user and its matching active profile through an admin-safe workflow. The phone app must not create users with a service-role key.

## What the app checks after login

1. Supabase Auth verifies the email and password.
2. The app reads only the matching `public.profiles` row.
3. If the profile is missing or inactive, it signs the user out.
4. If active, `profiles.role` selects the dashboard.

This relies on the RLS policies already configured in Supabase. Changing the screen on the phone cannot change the database role.

## Booking module: one Supabase step

Before using the booking screens, open `BOOKING_SETUP.sql`, copy everything in it, then in Supabase open **SQL Editor → New query**, paste it, and click **Run** once. This creates the bookings table and its security rules.
