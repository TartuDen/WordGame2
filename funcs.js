import getRandomWordAndTranslations from "./word_selector.js";
import { less_struggle_word_interval, struggle_barrier } from "./settings.js";
import fs from 'fs/promises'


function calculateXpForNextLevel(level) {
    const base = 100;
    const exponent = 1.5;
    return Math.floor(base * Math.pow(level, exponent));
  }
  
  function addExperience(user_info, xpGained) {
    user_info.current_xp += xpGained;
  
    // Check if the user has enough XP to level up
    while (user_info.current_xp >= calculateXpForNextLevel(user_info.level)) {
      user_info.current_xp -= calculateXpForNextLevel(user_info.level);
      user_info.level += 1;
    }
  
    return user_info;
  }

  function subtractExperience(user_info, xpLost) {
    // Subtract XP from the user's current XP
    user_info.current_xp -= xpLost;
  
    // Ensure current XP does not fall below zero
    if (user_info.current_xp < 0) {
      user_info.current_xp = 0;
    }
  
    // Do not modify the level, even if XP falls below the level threshold
  
    return user_info;
  }

  function getRandomInt(max) {
    return Math.floor(Math.random() * max);
  }
  
  async function selectWordForUser(req) {
    try {
      let selectedWord, additionalWords;
  
      // Initialize word count if it doesn't exist
      if (!req.session.wordCount) {
        req.session.wordCount = 0;
      }
  
      // Increment word count for each call
      req.session.wordCount += 1;
  
      // Filter words where the user guessed wrongly > 20% of the time
      const struggledWords = req.session.userWordDetails.filter((wordDetail) => {
        const totalGuesses =
          wordDetail.guessed_correctly + wordDetail.guessed_wrong;
        const wrongPercentage = wordDetail.guessed_wrong / totalGuesses;
        return totalGuesses > 0 && wrongPercentage > struggle_barrier;
      });
  
      // Filter words where the user guessed wrongly <= 20% of the time
      const lessStruggledWords = req.session.userWordDetails.filter(
        (wordDetail) => {
          const totalGuesses =
            wordDetail.guessed_correctly + wordDetail.guessed_wrong;
          const wrongPercentage = wordDetail.guessed_wrong / totalGuesses;
          return totalGuesses > 0 && wrongPercentage <= struggle_barrier;
        }
      );
  
      if (req.session.wordCount % less_struggle_word_interval === 0 && lessStruggledWords.length > 0) {
        // Every 5th word: pick a word the user struggles with less
        const lessStruggledWordDetails =
          lessStruggledWords[getRandomInt(lessStruggledWords.length)];
        const lessStruggledWord = lessStruggledWordDetails.word;
        const totalGuesses =
          lessStruggledWordDetails.guessed_correctly +
          lessStruggledWordDetails.guessed_wrong;
        const wrongPercentage = (
          (lessStruggledWordDetails.guessed_wrong / totalGuesses) *
          100
        ).toFixed(2);
  
        console.log(
          `Selected less struggled word: ${lessStruggledWord}, Struggle %: ${wrongPercentage}%`
        );
  
        ({ selectedWord, additionalWords } = await getRandomWordAndTranslations(
          req.session.userSimpleWords,
          "words.csv",
          lessStruggledWord
        ));
      } else if (req.session.wordSelectionToggle) {
        // Toggle is true: Attempt to pick a word the user struggles with more
        if (struggledWords.length > 0) {
          const struggledWordDetails =
            struggledWords[getRandomInt(struggledWords.length)];
          const struggledWord = struggledWordDetails.word;
          const totalGuesses =
            struggledWordDetails.guessed_correctly +
            struggledWordDetails.guessed_wrong;
          const wrongPercentage = (
            (struggledWordDetails.guessed_wrong / totalGuesses) *
            100
          ).toFixed(2);
  
          console.log(
            `Selected struggled word: ${struggledWord}, Struggle %: ${wrongPercentage}%`
          );
  
          ({ selectedWord, additionalWords } = await getRandomWordAndTranslations(
            req.session.userSimpleWords,
            "words.csv",
            struggledWord
          ));
        } else {
          // No struggled words found, fallback to new word selection without specifying nextWord
          console.log("No struggled words found, selecting a new word.");
          ({ selectedWord, additionalWords } = await getRandomWordAndTranslations(
            req.session.userSimpleWords,
            "words.csv"
          ));
        }
      } else {
        // Toggle is false: Pick a completely new word
        console.log("Selected a completely new word.");
        ({ selectedWord, additionalWords } = await getRandomWordAndTranslations(
          req.session.userSimpleWords,
          "words.csv"
        ));
      }
  
      // Toggle the value for the next call
      req.session.wordSelectionToggle = !req.session.wordSelectionToggle;
  
      // Return the selected word and additional words
      return { selectedWord, additionalWords };
    } catch (error) {
      console.error("Error selecting word for user:", error);
      throw error;
    }
  }


  async function removeDuplicatesFromCSVFile(filePath) {
    try {
      // Read the file content as text
      const csvString = await fs.readFile(filePath, 'utf8');
    
      // Split the input CSV string into rows
      const rows = csvString.trim().split('\n');
    
      // Get the headers from the first row
      const headers = rows[0].split(',');
    
      // Create a set to track unique English words and Russian translations
      const uniqueWordsSet = new Set();
    
      // Create an array to store unique rows
      const uniqueRows = [rows[0]]; // Keep the headers
    
      // Loop through each row starting from the second one (skip headers)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i].split(',');
    
        const englishWord = row[0].trim();
        const russianTranslation = row[2].trim();
    
        // Create a unique key combining the English word and Russian translation
        const uniqueKey = englishWord + '|' + russianTranslation;
    
        // Check if the word pair is already in the set
        if (!uniqueWordsSet.has(uniqueKey)) {
          // Add to the set and uniqueRows if it's not already present
          uniqueWordsSet.add(uniqueKey);
          uniqueRows.push(rows[i]);
        }
      }
    
      // Join the unique rows back into a CSV string and return it
      return uniqueRows.join('\n');
    
    } catch (error) {
      console.error('Error reading or processing file:', error);
      throw error;
    }
  }
  

  export {calculateXpForNextLevel, addExperience, subtractExperience, selectWordForUser, removeDuplicatesFromCSVFile}