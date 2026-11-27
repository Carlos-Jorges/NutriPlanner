# NutriPlanner on Windows: setup guide

Two parts. Part 1 gets the app running in demo mode in about 15 minutes, with no Firebase account. Part 2 connects your own Firebase project so the whole family shares real data (about 30 minutes).

You never need a Mac. You write and run everything on Windows, and test on your iPhone with the free Expo Go app.

---

## Part 1: run the demo

### 1. Install the tools (once)

1. **Node.js**: go to https://nodejs.org and install the version marked **LTS**. Accept the defaults.
2. **Visual Studio Code** (recommended editor): https://code.visualstudio.com
3. **Expo Go** on your iPhone: search "Expo Go" in the App Store. Keep it up to date; this project uses Expo SDK 58.

Close and reopen any terminal window after installing Node, then check it worked. Open **Windows Terminal** or **PowerShell** and run:

```
node --version
```

You need version 22.13 or newer.

> **If PowerShell says "running scripts is disabled on this system"** when you run `npm`, run this once, then try again:
> ```
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```

### 2. Unzip the project

Unzip `NutriPlanner.zip` to a short path that OneDrive does not sync, for example `C:\dev\NutriPlanner`.
Avoid `Documents` and `Desktop` if OneDrive backs them up: syncing thousands of small library files slows everything down.

### 3. Install the project's libraries

```
cd C:\dev\NutriPlanner
npm install
```

This takes 3 to 5 minutes the first time.

### 4. Open it in your browser

```
npm run web
```

A browser tab opens. You will see **Demo mode**. Tap **Explore as Alex (admin)** to see the meal planner's view, or **Explore as Mia (member)** to see what other family members can do. Demo data stays on this computer; **Reset demo data** is in the Group tab.

Press `Ctrl + C` in the terminal to stop it.

### 5. Open it on your iPhone

1. Connect the iPhone and the PC to the **same WiFi network**.
2. Run:
   ```
   npm start
   ```
3. If Windows Firewall asks about Node.js, tick **Private networks** and choose **Allow**.
4. Open the iPhone **Camera** app and point it at the QR code in the terminal. Tap the banner: the app opens in Expo Go.

If the phone cannot connect (guest WiFi, work network, or a VPN), use the tunnel instead. It works across networks:

```
npm run start:tunnel
```

While `npm start` is running, saving any file in VS Code updates the app on your phone within a second or two.

---

## Part 2: connect Firebase

### 1. Create the project

1. Go to https://console.firebase.google.com and choose **Create a project**.
2. Name it, for example `nutriplanner`. Turn off Google Analytics (you can add it later).
3. You start on the free **Spark** plan. No card is needed, and NutriPlanner is built to stay inside it.

### 2. Register a web app

NutriPlanner uses Firebase's JavaScript library on every platform, so it uses **web app** settings, even on the iPhone. You do not need a `GoogleService-Info.plist` file.

1. In the project overview, click the **web** icon `</>`.
2. Nickname: `NutriPlanner app`. Leave **Firebase Hosting** unticked for now. Click **Register app**.
3. Keep this page open. You need the values inside `firebaseConfig`.

### 3. Turn on email sign in

**Build** > **Authentication** > **Get started** > **Sign in method** tab > **Email/Password** > enable the first switch > **Save**.

### 4. Create the database

**Build** > **Firestore Database** > **Create database**.

1. Location: choose **australia-southeast1 (Sydney)**, or the region closest to your family. **This cannot be changed later.**
2. Choose **Start in production mode**. The NutriPlanner rules replace the defaults in step 6.

### 5. Add your settings to the project

In the project folder:

```
Copy-Item .env.example .env.local
code .env.local
```

Paste each value from the `firebaseConfig` page into the matching line, for example:

```
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSy...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=nutriplanner-1234.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=nutriplanner-1234
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=nutriplanner-1234.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
EXPO_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abc123
```

Save the file. `.env.local` is ignored by git. These values identify your project; they are not passwords. What protects your family's data is the security rules from the next step.

### 6. Deploy the security rules

The Firebase command line tool is already part of the project, so there is nothing extra to install.

```
npx firebase login
npx firebase use --add
npm run deploy:rules
```

1. `login` opens a browser. Sign in with the Google account that owns the Firebase project.
2. `use --add` asks which project to use: pick yours, and type `default` as the alias.
3. Check it worked: Firebase console > **Firestore Database** > **Rules** shows the NutriPlanner rules.

### 7. Restart the app

Settings are only read at start up, so restart with a clean cache:

```
npm start -- --clear
```

The sign in screen no longer says **Demo mode**. Create your account, then **Start a group**: you become its admin.

### 8. Bring the family in

1. Group tab > **Create invite code** > **Share invite**.
2. Each person creates their own account, chooses **Join with a code**, and types the code. Codes work for 7 days.
3. Make other adults admins from the **People** list if they should manage fridges and approve meals.

---

## How the family uses it day to day

While you are developing, each phone loads the app from your PC, so `npm start` must be running. For everyday family use there are two options:

| Option | Cost | Reminders | How |
|---|---|---|---|
| **Web app on Firebase Hosting** | Free on Spark | No | `npm run deploy:web`, then each person opens the link it prints in Safari and taps **Share > Add to Home Screen**. If the deploy says Hosting is not set up, open **Hosting** in the Firebase console, click **Get started**, and run it again. |
| **Real iPhone app via TestFlight** | Apple Developer Program, US$99 a year | Yes | Built in the cloud with EAS, no Mac needed. A guided step for the next phase. |

---

## Optional: run the security rules tests

The rules tests prove that members cannot do admin actions, that invite codes work and expire, and so on. They need Java:

1. Install **Java 21**, for example Microsoft Build of OpenJDK: https://learn.microsoft.com/java/openjdk/download
2. Run:
   ```
   npm run test:rules
   ```

The first run downloads the Firestore emulator. You should see every test pass.

Other checks you can run at any time:

```
npm run check
```

This runs the type checker, the linter and the 46 unit tests.

---

## Troubleshooting

| What you see | What to do |
|---|---|
| `'npm' is not recognized` | Close and reopen the terminal after installing Node. |
| `running scripts is disabled on this system` | Run the `Set-ExecutionPolicy` line from Part 1, step 1. |
| The phone cannot reach the PC | Same WiFi for both, allow Node.js through the firewall, or use `npm run start:tunnel`. |
| Expo Go says the project needs a newer version | Update Expo Go from the App Store. |
| `auth/invalid-api-key` or the app still says Demo mode | Check `.env.local`, then restart with `npm start -- --clear`. |
| "You do not have permission to do that in this group" everywhere | The rules are not deployed: run `npm run deploy:rules`. |
| Sign up works but the screen spins | Firestore was not created (Part 2, step 4). |
