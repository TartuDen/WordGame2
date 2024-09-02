import fs from 'fs';
import { parse } from 'csv-parse';

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

async function getRandomWordAndTranslations(knownWords, filePath) {
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

        // Step 2: Filter out words already known to the user
        const newWords = words.filter(word => 
            !knownWords.includes(word['Russian Translation'])
        );

        if (newWords.length === 0) {
            throw new Error('No new words available for the user.');
        }

        // Step 3: Randomly select a new word from the remaining words
        const selectedWordIndex = getRandomInt(newWords.length);
        const selectedWord = newWords[selectedWordIndex];
        const category = selectedWord.Category;

        // Step 4: Select additional words from the same category
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
        console.error('Error selecting a random word:', err);
        throw err;
    }
}

export default getRandomWordAndTranslations;
