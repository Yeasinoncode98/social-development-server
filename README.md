# social-development-server
## Social Development Events Server
Backend server for the Social Development Events platform.
Built with Node.js, Express, MongoDB, Firebase Authentication, and various modern npm packages. This server powers event management, user registration, and social development activities.

## Features

1.CRUD operations for social development events – Create, Read, Update, and Delete events easily.

2.Event search and filtering – Find events by type or title with flexible search functionality.

3.User registration and management – Manage event registrations for each user efficiently.

4.Secure endpoints – All protected routes are secured using Firebase Admin authentication.

5.Event participation – Users can join events, and event creators can update or delete their events.

6.User-specific data handling – Retrieve events and registrations specific to a logged-in user.

7.Automatic cleanup – Remove null or invalid entries in joined users to maintain database integrity.

8.Optimized MongoDB queries – Fast and efficient data retrieval for large datasets.


## API Endpoints
Events
Method	Endpoint	Description	Protected
GET	/api/events/upcoming	Get upcoming events (supports search and type query)	No
GET	/api/events/:id	Get details of a single event by ID	No
GET	/api/events/user/:email	Get events created by a user	Yes
GET	/api/events/joined/:email	Get events joined by a user	Yes
POST	/api/events	Create a new event	Yes
PUT	/api/events/:id	Update an event (owner only)	Yes
DELETE	/api/events/:id	Delete an event (owner only)	Yes
POST	/api/events/:id/join	Join an event	Yes
POST	/api/migrate/cleanup-null-users	Cleanup null joined users	Yes
Registrations
Method	Endpoint	Description	Protected
GET	/api/registrations/user/:email	Get all registrations of a user	Yes

## Authentication & Security
--> Authorization: Bearer <firebase-id-token>

## Folder Structure

backend/
├── social_development_key.json   # Firebase service account
├── server.js                     # Main Express server
├── package.json                  # npm dependencies
├── visitus.json                  # Optional JSON for testing gallery
└── README.md




