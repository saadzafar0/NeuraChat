# Notification System for NeuraChat Backend

## Overview
This directory contains the implementation of the Notification System for the NeuraChat backend. It provides real-time and RESTful notification delivery for user events such as messages, group additions, and system alerts. The system is designed for extensibility, security, and seamless integration with the rest of the backend.

## Features
- **NotificationService**: Core logic for creating, fetching, and updating notifications.
- **REST API**: Endpoints for retrieving and marking notifications as read.
- **Real-Time Events**: Socket.IO integration for instant notification delivery.
- **Secure Access**: All endpoints require authentication; notifications are user-scoped.
- **Extensible**: Easily add new notification types (e.g., call invites, system alerts).

## File Structure
```
services/Notifications/
  NotificationService.ts   # Main service logic
controllers/
  notificationController.ts # Handles API requests
routes/
  notificationRoutes.ts     # Express routes for notifications
```

## API Endpoints
- `GET /api/notifications` — Fetch up to 50 latest notifications for the authenticated user.
- `PATCH /api/notifications/:id` — Mark a specific notification as read.
- `PATCH /api/notifications/read-all` — Mark all notifications as read.

## Real-Time Events
- Notifications are emitted to users via Socket.IO in real time.
- Users join a Socket.IO room based on their user ID for targeted delivery.

## Usage Example
1. **Receive Notifications**: Listen for `notification` events on the client Socket.IO connection.
2. **Fetch Notifications**: Use the REST API to retrieve unread or recent notifications.
3. **Mark as Read**: Call the PATCH endpoint to mark notifications as read (single or all).

## Extending the System
- To add new notification types, update the `NotificationService.ts` to handle new triggers and payloads.
- Integrate new triggers in relevant controllers (e.g., for calls, add logic in `callController.ts`).

## Testing
- Use the provided Postman collection (`NeuraChat-Postman-Collection.json`) to test all notification endpoints.
- Ensure you are authenticated when making API requests.

## Security
- All notification routes are protected by authentication middleware.
- Users can only access and modify their own notifications.

## Related Files
- `src/services/Notifications/NotificationService.ts`
- `src/controllers/notificationController.ts`
- `src/routes/notificationRoutes.ts`

---
For questions or contributions, please refer to the main project README or open an issue.
