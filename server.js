// 1. Environment Setup
import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import axios from "axios";

// Custom modules
import { user_statistic, user_words } from "./MOCKdata.js";
import {
  calculateXpForNextLevel,
  addExperience,
  subtractExperience,
} from "./funcs.js";
import getRandomWordAndTranslations from "./word_selector.js";
import { createTables, pool, showUserStats } from "./pgTables.js";
import {
  getUser,
  regUser,
  getUserInfo,
  updateUserInfo,
  updateCorrectAnswer,
  updateWrongAnswer,
  userKnownWords,
} from "./apiCalls.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8081;

// 2. Database and Error Handling
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

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

// 3. Middleware Setup
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

// Middleware to start tracking user session
async function startSession(req, res, next) {
  if (req.isAuthenticated()) {
    const userId = req.user.id;
    await showUserStats(userId);
    const {userSimpleWords, userWordDetails} = await userKnownWords(userId);
    req.session.userSimpleWords=userSimpleWords;
    req.session.userWordDetails=userWordDetails;
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
      req.session.experienceGained = 0;
      req.session.wordsPlayed = 0;
      req.session.wordsGuessedCorrectly = 0;
      req.session.user_info = await getUserInfo(userId);
      next();
    } catch (err) {
      next(new AppError("Failed to start session", 500));
    }
  } else {
    next(); // Continue if not authenticated
  }
}

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

// 4. Passport.js Strategies and Session Management
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

// Function to end a session and record stats
async function endSession(req) {
  if (req.isAuthenticated() && req.session.sessionId) {
    const sessionId = req.session.sessionId;
    const endTime = Date.now();
    const timePlayed = Math.floor((endTime - req.session.startTime) / 60000); // in minutes

    const experienceGained = req.session.experienceGained; // Example value; replace with actual logic
    const wordsPlayed = req.session.wordsPlayed; // Example value; replace with actual logic
    const wordsGuessedCorrectly = req.session.wordsGuessedCorrectly; // Example value; replace with actual logic

    try {
      await pool.query(
        `UPDATE sessions 
         SET experience_gained = $1, words_played = $2, words_guessed_correctly = $3, time_played = $4 
         WHERE id = $5`,
        [
          experienceGained,
          wordsPlayed,
          wordsGuessedCorrectly,
          timePlayed,
          sessionId,
        ]
      );
    } catch (err) {
      console.error("Failed to end session: ", err.message);
    }
  }
}

// 5. Route Definitions
// ____________________Google OAuth routes
app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "consent",
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

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

async function selectWordForUser(req) {
  try {
    let selectedWord, additionalWords;

    // Filter words where the user guessed wrongly > 20% of the time
    const struggledWords = req.session.userWordDetails.filter((wordDetail) => {
      const totalGuesses = wordDetail.guessed_correctly + wordDetail.guessed_wrong;
      const wrongPercentage = wordDetail.guessed_wrong / totalGuesses;
      return totalGuesses > 0 && wrongPercentage > 0.2;
    });

    if (req.session.wordSelectionToggle) {
      // Toggle is true: Attempt to pick a word the user struggles with
      if (struggledWords.length > 0) {
        const struggledWord = struggledWords[getRandomInt(struggledWords.length)].word;
        ({ selectedWord, additionalWords } = await getRandomWordAndTranslations(
          req.session.userSimpleWords,
          "words.csv",
          struggledWord
        ));
      } else {
        // No struggled words found, fallback to new word selection without specifying nextWord
        ({ selectedWord, additionalWords } = await getRandomWordAndTranslations(
          req.session.userSimpleWords,
          "words.csv"
        ));
      }
    } else {
      // Toggle is false: Pick a completely new word
      ({ selectedWord, additionalWords } = await getRandomWordAndTranslations(
        req.session.userSimpleWords,
        "words.csv"
      ));
    }

    // Toggle the value for the next call
    req.session.wordSelectionToggle = !req.session.wordSelectionToggle;

    return { selectedWord, additionalWords };
  } catch (error) {
    console.error('Error selecting word for user:', error);
    throw error;
  }
}


app.get("/", async (req, res, next) => {
  try {
    if (req.isAuthenticated()) {
      const user = req.user;
      const user_info = req.session.user_info;
      const total_exp = calculateXpForNextLevel(user_info.level);
      const { selectedWord, additionalWords } =
        await selectWordForUser(req);

      res.status(200).render("index.ejs", {
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

app.post("/correct_answer", async (req, res, next) => {
  try {
    if (req.isAuthenticated()) {
      const userId = req.user.id;
      const user_info = req.session.user_info;
      const selectedWord = req.body;
      const wordDetails = JSON.parse(selectedWord.selectedWord);
      const difficulty = parseInt(wordDetails.Difficulty, 10);
      const word = wordDetails["English Word"];

      req.session.wordsPlayed += 1;
      req.session.experienceGained += difficulty;
      req.session.wordsGuessedCorrectly += 1;
      req.session.user_info = addExperience(user_info, difficulty);

      // Update user_info
      await updateUserInfo(
        userId,
        req.session.user_info.level,
        req.session.user_info.current_xp
      );

      // Update the user_words table for the correct answer
      await updateCorrectAnswer(userId, word);

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
      const userId = req.user.id;
      const user_info = req.session.user_info;
      const selectedWord = req.body;
      const wordDetails = JSON.parse(selectedWord.selectedWord);
      const word = wordDetails["English Word"];

      req.session.wordsPlayed += 1;
      req.session.experienceGained -= 1;
      req.session.user_info = subtractExperience(user_info, 1);

      // Update user_info
      await updateUserInfo(
        userId,
        req.session.user_info.level,
        req.session.user_info.current_xp
      );

      // Update the user_words table for the wrong answer
      await updateWrongAnswer(userId, word);

      res.redirect("/");
    } else {
      res.redirect("/auth/google");
    }
  } catch (err) {
    next(err);
  }
});

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

// 6. Server Initialization
app.listen(PORT, (err) => {
  if (err) throw err;
  console.log(`Server is running on port ${PORT}`);
});

// Use the error handler middleware
app.use(errorHandler);
