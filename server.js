// index.js
import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import axios from "axios";

// Importing custom modules
import { user_info, user_statistic, user_words } from "./MOCKdata.js";
import { calculateXpForNextLevel } from "./funcs.js";
import getRandomWordAndTranslations from "./word_selector.js";


class AppError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
    }
  }

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8081;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Ensure tables are created on server start
async function initializeDatabase() {
  try {
    await createTables();
    console.log("Database setup complete");
  } catch (err) {
    console.error("Error setting up database:", err);
  }
}

// initializeDatabase();

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
        // let apiResp = await getUser(profile.emails[0].value);
        let apiResp = {
            user_name: "Den Ver",
            email: "den@ver.com",
            ava: "https://img-new.cgtrader.com/items/4519089/96a7e7a37b/large/mage-wizard-avatar-3d-icon-3d-model-96a7e7a37b.jpg",
        }
        if (!apiResp.email) {
        //   const newUser = await regUser({
        //     user_name: profile.name.givenName,
        //     email: profile.emails[0].value,
        //     ava: profile.photos[0].value,
        //   });
        const newUser = {
            user_name: profile.name.givenName,
            email: profile.emails[0].value,
            ava: profile.photos[0].value,
              }
          cb(null, newUser.data);
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

// Google OAuth routes
app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    // prompt: "consent", //uncomment for user login.
  })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
  }),
  (req, res) => {
    res.redirect("/");
  }
);

app.get("/auth/logout", (req, res) => {
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
});


app.get("/", async (req, res, next) => {
  try {
    if (req.isAuthenticated()) {
      const user = req.user;
      const total_exp = calculateXpForNextLevel(user_info.level)
      const {selectedWord, additionalWords} = await getRandomWordAndTranslations("words.csv");
      console.log(".......words:......\n",selectedWord, additionalWords);

      res.status(200).render("index.ejs", {user, user_info, user_statistic, user_words, total_exp, selectedWord, additionalWords});
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
