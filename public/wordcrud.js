export function readAllWords() {
  const readPromise = new Promise(async (resolve, reject) => {
    try {
      const apiResponse = await fetch(getApiUrl());
      if (apiResponse.ok) {
        const wordRows = await apiResponse.json();
        resolve(wordRows);
      } else {
        console.error("Error: failed to fetch word list");
        reject();
      }
    } catch (error) {
      console.error("Error: failed to fetch word list");
      console.error(error);
      reject();
    }
  });
  return readPromise;
}

export function createWord(newWord) {
  const createPromise = new Promise(async (resolve, reject) => {
    try {
      const apiResponse = await fetch(getApiUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          word: newWord
        })
      });

      if (apiResponse.ok) {
        const wordRow = await apiResponse.json();
        resolve(wordRow);
      } else {
        console.error(`Error: failed to create new word (${newWord})`)
        reject();
      }
    } catch (error) {
      console.error(`Error: failed to create new word (${newWord})`)
      console.error(error);
      reject();
    }
  });
  return createPromise;
}

export function deleteWord(wordId) {
  const deletePromise = new Promise(async (resolve, reject) => {
    try {
      const apiResponse = await fetch(getApiUrl(wordId), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
      });

      if (apiResponse.ok) {
          resolve();
      } else {
          console.error(`Error: failed to delete word (${wordId})`)
          reject();
      }
    } catch (error) {
        console.error(`Error: failed to delete word (${wordId})`)
        console.error(error);
        reject();
    }
  });
  return deletePromise;
}

function getApiUrl(wordId) {
  let apiUrl = window.location.href + "api/words";
  if (!isNaN(wordId)) {
    wordId = parseFloat(wordId);
  }
  if (Number.isInteger(wordId)) {
    apiUrl = apiUrl + "/" + wordId;
  }
  return apiUrl;
}
