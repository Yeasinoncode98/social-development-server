// ................................3..................
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
require("dotenv").config();

// Encode is making issue i tried a lot took help from internet but still it was giving me error
// Thats why i keep it as it is

const serviceAccount = require("./social_development_key.json");

// Middleware used cors only and express json but its not middleware

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize Firebase Admin SDK command used (firebase admin)
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// ---------- Middleware: Verify Firebase Token ----------
const verifyFirebaseToken = async (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  if (!token) return res.status(401).send({ message: "Unauthorized access" });

  try {
    const userInfo = await admin.auth().verifyIdToken(token);
    req.token_email = userInfo.email;
    next();
  } catch (error) {
    console.error("❌ Token verification failed:", error);
    return res.status(401).send({ message: "Unauthorized access" });
  }
};

// MongoDB connection with connection pooling
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.pkimykw.mongodb.net/?appName=Cluster0`;

let client;
let clientPromise;

// Initialize MongoDB connection
if (!client) {
  client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });
  clientPromise = client.connect();
}

// Helper function to get database collections
async function getCollections() {
  try {
    await clientPromise;
    const db = client.db("client_db");
    return {
      eventsCollection: db.collection("developments"),
      registrationsCollection: db.collection("registrations"),
    };
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    throw error;
  }
}

// ---------------------- Routes ----------------------

// ✅ Root Route - API Info
app.get("/", (req, res) => {
  res.json({
    message: "Social Development API",
    status: "running",
    version: "1.0.0",
    endpoints: {
      events: {
        upcoming: "GET /api/events/upcoming?search=&type=",
        byId: "GET /api/events/:id",
        userEvents: "GET /api/events/user/:email (protected)",
        joinedEvents: "GET /api/events/joined/:email (protected)",
        create: "POST /api/events (protected)",
        join: "POST /api/events/:id/join (protected)",
        update: "PUT /api/events/:id (protected)",
        delete: "DELETE /api/events/:id (protected)",
      },
      registrations: {
        userRegistrations: "GET /api/registrations/user/:email (protected)",
      },
      utilities: {
        cleanup: "POST /api/migrate/cleanup-null-users (protected)",
      },
    },
  });
});

// ✅ Health Check Route
app.get("/api/health", async (req, res) => {
  try {
    await clientPromise;
    const isConnected = client.topology && client.topology.isConnected();
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      mongodb: isConnected ? "connected" : "disconnected",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      mongodb: "disconnected",
      error: error.message,
    });
  }
});

// ✅ Get upcoming events with search & filter
app.get("/api/events/upcoming", async (req, res) => {
  try {
    const { eventsCollection } = await getCollections();
    let { search, type } = req.query;
    const filter = {};

    // Process search for flexible matching
    if (search) {
      const searchPattern = search
        .trim()
        .split(/\s+/)
        .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join(".*");

      filter.title = { $regex: searchPattern, $options: "i" };
    }

    // Optional type filter here
    if (type) {
      const typePattern = type.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.type = { $regex: typePattern, $options: "i" };
    }

    const events = await eventsCollection.find(filter).toArray();
    res.json(events);
  } catch (err) {
    console.error("Error fetching events:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get event by ID
app.get("/api/events/:id", async (req, res) => {
  try {
    const { eventsCollection } = await getCollections();
    const event = await eventsCollection.findOne({
      _id: new ObjectId(req.params.id),
    });
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Protected: Get events created by a specific user
app.get("/api/events/user/:email", verifyFirebaseToken, async (req, res) => {
  const emailParam = req.params.email;
  const tokenEmail = req.token_email;
  if (tokenEmail !== emailParam)
    return res.status(403).json({ error: "Forbidden: email mismatch" });

  try {
    const { eventsCollection } = await getCollections();
    const events = await eventsCollection
      .find({ $or: [{ createdBy: tokenEmail }, { creatorEmail: tokenEmail }] })
      .toArray();
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Protected: Get joined events (only self)
app.get("/api/events/joined/:email", verifyFirebaseToken, async (req, res) => {
  const emailParam = req.params.email;
  const tokenEmail = req.token_email;
  if (tokenEmail !== emailParam)
    return res.status(403).json({ error: "Forbidden: email mismatch" });

  try {
    const { eventsCollection } = await getCollections();
    const events = await eventsCollection
      .find({ joinedUsers: tokenEmail })
      .toArray();
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Protected: Create event
app.post("/api/events", verifyFirebaseToken, async (req, res) => {
  try {
    const { eventsCollection } = await getCollections();
    const newEvent = req.body;
    newEvent.joinedUsers = [];
    newEvent.createdBy = req.token_email;
    newEvent.creatorEmail = req.token_email;
    const result = await eventsCollection.insertOne(newEvent);
    res.json({ ...newEvent, _id: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Protected: Join event
app.post("/api/events/:id/join", verifyFirebaseToken, async (req, res) => {
  try {
    const { eventsCollection, registrationsCollection } =
      await getCollections();
    const eventId = req.params.id;
    const userEmail = req.token_email;

    const { email, name, phone, photoURL, uid } = req.body || {};

    if (!userEmail) return res.status(401).json({ error: "Unauthorized" });

    const event = await eventsCollection.findOne({
      _id: new ObjectId(eventId),
    });
    if (!event) return res.status(404).json({ error: "Event not found" });

    if (!event.joinedUsers) event.joinedUsers = [];

    if (event.joinedUsers.includes(userEmail))
      return res.status(400).json({ error: "Already joined" });

    const existingRegistration = await registrationsCollection.findOne({
      eventId: new ObjectId(eventId),
      "user.email": userEmail,
    });
    if (existingRegistration)
      return res.status(400).json({ error: "Already registered" });

    const registration = {
      eventId: new ObjectId(eventId),
      eventDetails: {
        title: event.title,
        type: event.type,
        date: event.date,
        location: event.location,
        thumbnail: event.thumbnail,
      },
      user: {
        uid: uid || null,
        email: userEmail,
        name: name || null,
        phone: phone || null,
        photoURL: photoURL || null,
      },
      registeredAt: new Date(),
      status: "confirmed",
    };

    await registrationsCollection.insertOne(registration);
    await eventsCollection.updateOne(
      { _id: new ObjectId(eventId) },
      { $addToSet: { joinedUsers: userEmail } }
    );

    res.json({
      success: true,
      message: "Successfully joined event!",
      registration,
    });
  } catch (err) {
    console.error("Join Event Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Protected: Get user registrations
app.get(
  "/api/registrations/user/:email",
  verifyFirebaseToken,
  async (req, res) => {
    const emailParam = req.params.email;
    const tokenEmail = req.token_email;
    if (tokenEmail !== emailParam)
      return res.status(403).json({ error: "Forbidden: email mismatch" });

    try {
      const { registrationsCollection } = await getCollections();
      const registrations = await registrationsCollection
        .find({ "user.email": tokenEmail })
        .sort({ registeredAt: -1 })
        .toArray();
      res.json(registrations);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ✅ Protected: Update event (only owner)
app.put("/api/events/:id", verifyFirebaseToken, async (req, res) => {
  try {
    const { eventsCollection } = await getCollections();
    const eventId = req.params.id;
    const updates = req.body;
    delete updates._id;

    const event = await eventsCollection.findOne({
      _id: new ObjectId(eventId),
    });
    if (!event) return res.status(404).json({ error: "Event not found" });

    if (
      !(
        event.createdBy === req.token_email ||
        event.creatorEmail === req.token_email
      )
    )
      return res.status(403).json({ error: "Forbidden" });

    await eventsCollection.updateOne(
      { _id: new ObjectId(eventId) },
      { $set: updates }
    );
    const updatedEvent = await eventsCollection.findOne({
      _id: new ObjectId(eventId),
    });
    res.json(updatedEvent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Protected: Delete event (only owner)
app.delete("/api/events/:id", verifyFirebaseToken, async (req, res) => {
  try {
    const { eventsCollection, registrationsCollection } =
      await getCollections();
    const eventId = req.params.id;

    const event = await eventsCollection.findOne({
      _id: new ObjectId(eventId),
    });
    if (!event) return res.status(404).json({ error: "Event not found" });

    if (
      !(
        event.createdBy === req.token_email ||
        event.creatorEmail === req.token_email
      )
    )
      return res.status(403).json({ error: "Forbidden" });

    await registrationsCollection.deleteMany({
      eventId: new ObjectId(eventId),
    });
    await eventsCollection.deleteOne({ _id: new ObjectId(eventId) });

    res.json({ message: "Event deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Protected: Cleanup null joinedUsers
app.post(
  "/api/migrate/cleanup-null-users",
  verifyFirebaseToken,
  async (req, res) => {
    try {
      const { eventsCollection } = await getCollections();
      const result = await eventsCollection.updateMany(
        {},
        { $pull: { joinedUsers: null } }
      );
      res.json({
        message: "Cleanup complete",
        modifiedCount: result.modifiedCount,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Only run server locally, not on Vercel
if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
  });
}

// Export for Vercel serverless
module.exports = app;
