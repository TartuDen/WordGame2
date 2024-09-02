import fs from 'fs';
import { parse } from 'csv-parse';

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

async function getRandomWordAndTranslations(userSimpleWords, filePath, nextWord = null) {
    try {
        // Step 1: Read the CSV file to get the complete word list
        const data = await fs.promises.readFile(filePath);
        const words = await new Promise((resolve, reject) => {
            parse(data, {
                columns: true,
                trim: true,
            }, (err, output) => {
                if (err) {
                    return reject('Error parsing CSV:', err);
                }
                resolve(output);
            });
        });

        let selectedWord;

        if (nextWord) {
            // If nextWord is provided, find it in the words array by matching against the English word
            selectedWord = words.find(word => word['English Word'] === nextWord);
            if (!selectedWord) {
                throw new Error('Provided nextWord not found in the word list.');
            }
        } else {
            // Step 2: Filter out words already known to the user based on their Russian translations
            const newWords = words.filter(word => 
                !userSimpleWords.includes(word['English Word'])
            );

            if (newWords.length === 0) {
                throw new Error('No new words available for the user.');
            }

            // Step 3: Randomly select a new word from the remaining words
            const selectedWordIndex = getRandomInt(newWords.length);
            selectedWord = newWords[selectedWordIndex];
        }

        // Step 4: Get the category of the selected word
        const category = selectedWord.Category;

        // Step 5: Select additional words from the same category
        let sameCategoryWords = words.filter(word =>
            word.Category === category && word['Russian Translation'] !== selectedWord['Russian Translation']
        );

        const additionalWords = [];
        while (additionalWords.length < Math.min(4, sameCategoryWords.length)) {
            const randomIndex = getRandomInt(sameCategoryWords.length);
            const word = sameCategoryWords.splice(randomIndex, 1)[0];
            additionalWords.push(word);
        }

        return { selectedWord, additionalWords };
    } catch (err) {
        console.error('Error selecting a word:', err);
        throw err;
    }
}



export default getRandomWordAndTranslations;
