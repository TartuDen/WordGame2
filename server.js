// index.js
import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import axios from "axios";

// Importing custom modules
import { user_info, user_statistic, user_words } from "./MOCKdata.js";
import { calculateXpForNextLevel, addExperience } from "./funcs.js";
import getRandomWordAndTranslations from "./word_selector.js";
import { createTables, pool } from "./pgTables.js";
import { getUser,regUser } from "./apiCalls.js";

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}


// Middleware to start tracking user session
async function startSession(req, res, next) {
  if (req.isAuthenticated()) {
      const userId = req.user.id;

      try {
          // Start a new session record
          const { rows } = await pool.query(
              `INSERT INTO sessions (user_id, played_at, experience_gained, words_played, words_guessed_correctly, time_played) 
              VALUES ($1, NOW(), 0, 0, 0, 0) RETURNING id`,
              [userId]
          );

          // Store session ID in the user's session object
          req.session.sessionId = rows[0].id;
          req.session.startTime = Date.now();
          console.log(".......req.session......\n",req.session);

          next();
      } catch (err) {
          next(new AppError("Failed to start session", 500));
      }
  } else {
      next(); // Continue if not authenticated
  }
}

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8081;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Session middleware configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "someKeY",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 }, // 1-hour session duration
  })
);

// Initialize Passport.js for authentication
app.use(passport.initialize());
app.use(passport.session());

// Ensure tables are created on server start
async function initializeDatabase() {
  try {
    await createTables();
    console.log("Database setup complete");
  } catch (err) {
    console.error("Error setting up database:", err);
  }
}

initializeDatabase();

// Google OAuth 2.0 strategy for authentication
passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:8081/auth/google/callback",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        let apiResp = await getUser(profile.emails[0].value);

        if (!apiResp) {
            const newUser = await regUser({
              user_name: profile.name.givenName,
              email: profile.emails[0].value,
              ava: profile.photos[0].value,
            });
          cb(null, newUser);
        } else {
          cb(null, apiResp); // User already exists
        }
      } catch (err) {
        console.error("Error during fetching user: ", err.message);
        cb(new AppError("Error during fetching user", 500));
      }
    }
  )
);

// Session management
passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});


// Error handling middleware
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error(`[ERROR] ${statusCode} - ${message} - ${err.stack}`);
  res.status(statusCode).json({
    status: "error",
    statusCode,
    message,
  });
};

// ____________________Google OAuth routes
app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "consent", //uncomment for user login.
  })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
  }),
  startSession, // Start the session after successful authentication
  (req, res) => {
    res.redirect("/");
  }
);

async function endSession(req) {
  if (req.isAuthenticated() && req.session.sessionId) {
      const sessionId = req.session.sessionId;
      console.log("........logout.....: ",req.session);
      const endTime = Date.now();
      const timePlayed = Math.floor((endTime - req.session.startTime) / 60000); // in minutes
      // const experienceGained = calculateExperience(req.user); // Implement your logic here
      const experienceGained = 100;
      // const wordsPlayed = calculateWordsPlayed(req.user); // Implement your logic here
      const wordsPlayed = 50;
      // const wordsGuessedCorrectly = calculateWordsGuessedCorrectly(req.user); // Implement your logic here
      const wordsGuessedCorrectly = 40;

      try {
          await pool.query(
              `UPDATE sessions 
               SET experience_gained = $1, words_played = $2, words_guessed_correctly = $3, time_played = $4 
               WHERE id = $5`,
              [experienceGained, wordsPlayed, wordsGuessedCorrectly, timePlayed, sessionId]
          );
      } catch (err) {
          console.error("Failed to end session: ", err.message);
      }
  }
}

app.get("/auth/logout", async (req, res) => {
  try {
      await endSession(req);
      req.logout((err) => {
          if (err) {
              console.error(err);
              res.redirect("/");
          } else {
              req.session.destroy(() => {
                  res.redirect("/auth/google");
              });
          }
      });
  } catch (err) {
      res.redirect("/auth/google");
  }
});


//_______________________________________________

app.post("/correct_answer", async (req, res, next) => {
  try {
    if (req.isAuthenticated()) {
      console.log("correct guessed: ", req.body);
      res.redirect("/");
    } else {
      res.redirect("/auth/google");
    }
  } catch (err) {
    next(err);
  }
});

app.post("/wrong_answer", async (req, res, next) => {
  try {
    if (req.isAuthenticated()) {
      console.log("wrong guessed: ", req.body);
      res.redirect("/");
    } else {
      res.redirect("/auth/google");
    }
  } catch (err) {
    next(err);
  }
});

app.get("/", async (req, res, next) => {
  try {
    if (req.isAuthenticated()) {
      const user = req.user;
      const total_exp = calculateXpForNextLevel(user_info.level);
      const { selectedWord, additionalWords } =
        await getRandomWordAndTranslations("words.csv");

      res
        .status(200)
        .render("index.ejs", {
          user,
          user_info,
          user_statistic,
          user_words,
          total_exp,
          selectedWord,
          additionalWords,
        });
    } else {
      res.redirect("/auth/google");
    }
  } catch (err) {
    next(err);
  }
});

// Register the error handler middleware
app.use(errorHandler);

// Start the server
app.listen(PORT, (err) => {
  if (err) throw err;
  console.log(`Server is running on port ${PORT}`);
});
