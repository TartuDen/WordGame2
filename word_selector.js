import fs from 'fs';
import { parse } from 'csv-parse';

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

function getRandomWordAndTranslations(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
            if (err) {
                return reject('Error reading the file:', err);
            }

            parse(data, {
                columns: true,
                trim: true,
            }, (err, words) => {
                if (err) {
                    return reject('Error parsing CSV:', err);
                }

                const selectedWordIndex = getRandomInt(words.length);
                const selectedWord = words[selectedWordIndex];
                const category = selectedWord.Category;

                // Filter out words with the same category and different from the selected word
                let sameCategoryWords = words.filter(word => 
                    word.Category === category && word['Russian Translation'] !== selectedWord['Russian Translation']
                );

                const additionalWords = [];
                while (additionalWords.length < Math.min(4, sameCategoryWords.length)) {
                    const randomIndex = getRandomInt(sameCategoryWords.length);
                    const word = sameCategoryWords.splice(randomIndex, 1)[0];
                    additionalWords.push(word);
                }

                // The number of additional words may be less than 4 if there aren't enough unique words
                resolve({ selectedWord, additionalWords });
            });
        });
    });
}

export default getRandomWordAndTranslations;
