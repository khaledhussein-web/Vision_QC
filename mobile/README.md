# VisionQC Mobile (Expo)

React Native mobile app for VisionQC with role-based flows:

- Operator
- Annotator
- Admin

## Current screen coverage

### Operator
- Login
- Register
- Forgot Password
- Reset Password
- Home
- Capture/Upload Image
- Prediction Result
- History
- AI Chat
- Bookmarks
- Profile
- Payment/Subscription (UI placeholder, backend not implemented)

### Annotator
- Queue/List screen
- Image detail + correction workflow screen

### Admin
- Dashboard
- User management
- Image management
- Image detail
- Reports
- Retraining queue

## Proposed folder structure

```text
mobile/
  App.js
  app.json
  package.json
  src/
    api/
      client.js
    components/
      PrimaryButton.js
      ScreenContainer.js
    constants/
      config.js
    context/
      AuthContext.js
    navigation/
      RootNavigator.js
    screens/
      auth/
        LoginScreen.js
        RegisterScreen.js
        ForgotPasswordScreen.js
        ResetPasswordScreen.js
      operator/
        OperatorHomeScreen.js
        CaptureUploadScreen.js
        PredictionResultScreen.js
        HistoryScreen.js
        AIChatScreen.js
        BookmarksScreen.js
        ProfileScreen.js
        SubscriptionScreen.js
      annotator/
        AnnotatorQueueScreen.js
        AnnotatorImageDetailScreen.js
      admin/
        AdminDashboardScreen.js
        AdminUsersScreen.js
        AdminImagesScreen.js
        AdminImageDetailScreen.js
        AdminReportsScreen.js
        AdminRetrainingQueueScreen.js
```

## Backend endpoints reused

- Auth:
  - `POST /api/login`
  - `POST /api/register`
  - `POST /api/auth/forgot-password`
  - `GET /api/auth/reset-password/validate`
  - `POST /api/auth/reset-password`
- Operator:
  - `POST /api/analyze`
  - `GET /api/users/:userId/history`
  - `GET /api/predictions/:predictionId`
  - `POST /api/predictions/:predictionId/bookmark`
  - `POST /api/predictions/:predictionId/flag-for-retraining`
  - `POST /api/chat`
- Admin:
  - `GET /api/admin/users`
  - `POST /api/admin/users`
  - `PATCH /api/admin/users/:userId`
  - `DELETE /api/admin/users/:userId`
  - `GET /api/admin/images`
  - `GET /api/admin/reports`
  - `POST /api/admin/reports/generate`
  - `GET /api/admin/retraining-queue`
  - `PATCH /api/admin/retraining-queue/:queueId`
  - `GET /api/admin/low-confidence-predictions`

## Missing backend requirements

- Payment/subscription:
  - No checkout/subscription endpoints exist yet.
  - Needed example endpoints:
    - `POST /api/subscriptions/checkout`
    - `GET /api/subscriptions/current`
    - `POST /api/subscriptions/webhook` (provider callback)
- Annotator correction workflow:
  - No annotator-specific queue access and correction submit API.
  - Mobile currently expects:
    - `POST /api/annotator/corrections`
  - Recommended to add:
    - `GET /api/annotator/queue`
    - `GET /api/annotator/queue/:id`
    - `POST /api/annotator/corrections`

## Local development run

1. From repository root:
   - `cd mobile`
2. Install dependencies:
   - `npm install`
3. Create env file:
   - copy `.env.example` to `.env`
4. Set backend base URL:
   - `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:5000` (Android emulator)
   - `EXPO_PUBLIC_API_BASE_URL=http://localhost:5000` (iOS simulator)
   - real device: use your computer LAN IP
5. Start app:
   - `npm run start`
   - then open in Expo Go / emulator

## Short next steps

1. Add backend annotator endpoints and permissions.
2. Add real payment provider integration (Stripe or similar).
3. Add pagination/filter/search controls on admin lists.
4. Add offline/error retry UX and toast notifications.
