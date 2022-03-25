import { readAllWords, createWord, deleteWord } from "./wordcrud.js";
import { getRandomShapeImage } from "./shapes.js";

window.addEventListener("load", onLoad);

function onLoad() {

//#region Floating shapes

  const shapeSubContainers = document.querySelectorAll(".shape-sub-container");
  let spawnShapeID = null;

  startSpawningShapes();

  function startSpawningShapes() {
    stopSpawningShapes();
    spawnShape();
    spawnShapeID = setInterval(spawnShape, 400);
  }
  
  function stopSpawningShapes() {
    if (spawnShapeID != null) {
      clearInterval(spawnShapeID);
      spawnShapeID = null;
    }
  }

  function spawnShape() {
    let shapeSubContainer = getRandom(shapeSubContainers);

    let newShape = document.createElement("img");
    newShape.src = getRandomShapeImage();
    newShape.classList.add("shape");

    let animDuration = (Math.random() * 3.5) + 5.0; // 5.0 to 8.5
    newShape.style.setProperty("--anim-duration", animDuration.toFixed(2) + "s");

    let translateFactor = (Math.random() * 6.0) - 3.0; // -3.0 to 3.0
    newShape.style.setProperty("--translate-factor", translateFactor.toFixed(2));

    let turnFactor = (Math.random() * 1.25) + 0.75; // 0.75 to 2.0
    turnFactor *= getRandomInt(2) == 0 ? 1 : -1;
    newShape.style.setProperty("--turn-factor", turnFactor);

    shapeSubContainer.append(newShape);

    setTimeout(() => { newShape.remove() }, animDuration * 1000);
  }

  function getRandom(collection) {
    return collection[Math.floor(Math.random()*collection.length)];
  }

  function getRandomInt(maxPlusOne) {
    return Math.floor(Math.random() * maxPlusOne);
  }

//#endregion Floating shapes

//#region Navigation

  const landingPage = document.querySelector("#landing-page");

  const createGameBtn = document.querySelector("#create-game-btn");

  const joinGamePage = document.querySelector("#join-game-page");
  const joinGameBtn = document.querySelector("#join-game-btn");

  const editWordsPage = document.querySelector("#edit-words-page");
  const editWordsBtn = document.querySelector("#edit-words-btn");

  const goBackBtnList = document.querySelectorAll(".go-back-btn");

  createGameBtn.addEventListener("click", () => {
    applyPageTransitionAnimation(landingPage, "left", false);

    setTimeout(() => {
      window.location.href += "game.html"
    }, getPageTransitionTime());
  });

  joinGameBtn.addEventListener("click", () => {
    applyPageTransitionAnimation(landingPage, "left", false);
    applyPageTransitionAnimation(joinGamePage, "right", true);
  });

  editWordsBtn.addEventListener("click", () => {
    populateWordList();

    applyPageTransitionAnimation(landingPage, "left", false);
    applyPageTransitionAnimation(editWordsPage, "right", true);
  });

  goBackBtnList.forEach(goBackBtn => {
    goBackBtn.addEventListener("click", () => {
      let currentPage = document.querySelector(".page:not(.hidden)");
      applyPageTransitionAnimation(currentPage, "right", false);
      applyPageTransitionAnimation(landingPage, "left", true);
    })
  });

  function applyPageTransitionAnimation(page, direction, isNewPage) {
    let transitionTime = getPageTransitionTime();

    if (page == landingPage) {
      if (isNewPage) {
        startSpawningShapes();
      } else {
        stopSpawningShapes();
      }
    }

    let transitionClassName = "fly-out";
    if (isNewPage) {
      transitionClassName = "fly-in";
    }
    if (direction != "left") {
      direction = "right";
    }
    transitionClassName = transitionClassName + "-" + direction;

    page.classList.add(transitionClassName);

    if (isNewPage) {
      page.classList.remove("hidden");

      setTimeout(() => {
        page.classList.remove(transitionClassName);
      }, transitionTime);
    } else {
      setTimeout(() => {
        page.classList.add("hidden");
        page.classList.remove(transitionClassName);
      }, transitionTime);
    }
  }

  function getPageTransitionTime() {
    let transitionTime = getComputedStyle(document.documentElement).getPropertyValue("--page-transition-time");
    transitionTime = parseFloat(transitionTime);
    transitionTime *= 1000; // convert to milliseconds
    return transitionTime;
  }

//#region Join Game page

  const roomIdInput = document.querySelector("#room-id-input");
  const attemptJoinBtn = document.querySelector("#attempt-join-btn");

  roomIdInput.addEventListener("input", (e) => {
    if (roomIdInput.value.length == 5) {
      attemptJoinBtn.classList.remove("disabled");
    } else {
      attemptJoinBtn.classList.add("disabled");
    }
  });

  attemptJoinBtn.addEventListener("click", () => {
    if (attemptJoinBtn.classList.contains("disabled")) { return; }
    window.location.href = window.location.origin + "/game.html?room=" + roomIdInput.value;
  });

//#endregion Join Game page

//#region Edit Words page

  const wordInput = document.querySelector("#word-input");
  const submitBtn = document.querySelector("#submit-btn");
  const deleteBtn = document.querySelector("#delete-btn");

  const wordListContainer = document.querySelector("#word-list-container");
  const wordArray = [];

  wordInput.addEventListener("input", (e) => {
    checkIfWordInputHasValue();
  });

  wordInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      submitNewWord();
    }
  });

  submitBtn.addEventListener("click", () => {
    submitNewWord();
  });

  function submitNewWord() {
    if (submitBtn.classList.contains("disabled")) { return; }

    // Delay by 100ms so mobile keyboard has a chance to get off the screen
    setTimeout(async () => {
      let newWord = wordInput.value;
      wordInput.value = "";
      // Call to disable the Submit button
      checkIfWordInputHasValue();
      let wordItemElement = addWordToWordList(newWord, -1);
      // Scroll to the bottom
      wordListContainer.scrollTop = wordListContainer.scrollHeight;
      try {
        const createdWord = await createWord(newWord);
        // Remove pending style since request was successful
        wordItemElement.classList.remove("pending");
        wordItemElement.dataset.wordId = createdWord.word_id;
      } catch (error) {
        deleteElementFromLocalWordList(wordItemElement);
        console.error(`Error: failed to submit new word (${newWord})`);
        console.error(error);
      }
    }, 100);
  }

  function checkIfWordInputHasValue() {
    if (wordInput.value != "") {
      submitBtn.classList.remove("disabled");
    } else {
      submitBtn.classList.add("disabled");
    }
  }

  deleteBtn.addEventListener("click", () => {
    if (deleteBtn.classList.contains("disabled")) { return; }

    let elementsMarked = checkForDeletableWords();

    elementsMarked.forEach((element) => {
      toggleMarkForDeletion(element, "unmark");
    });
    // This call is to disable the delete button
    checkForDeletableWords();

    elementsMarked.forEach(async (element) => {
      let wordToDelete = element.querySelector(".word-item-content").textContent;
      let wordIdToDelete = element.dataset.wordId;
      if (wordIdToDelete == -1) { return; }

      element.classList.add("pending");

      try {
        await deleteWord(wordIdToDelete);

        deleteElementFromLocalWordList(element);
      } catch (error) {
        console.error(`Error: failed to delete word (${wordToDelete}, id: ${wordIdToDelete})`);
        console.error(error);
      } finally {
        // Remove pending style since request was completed
        element.classList.remove("pending");
      }
    });
  });

  function deleteElementFromLocalWordList(wordItemElement) {
    let deleteAnimTime = getComputedStyle(document.documentElement).getPropertyValue("--delete-anim-time");
    deleteAnimTime = parseFloat(deleteAnimTime);
    deleteAnimTime *= 1000; // convert to milliseconds

    wordItemElement.classList.add("deleted");
    setTimeout(() => {
      wordItemElement.remove();
    }, deleteAnimTime);
  }

  async function populateWordList() {
    clearWordListDisplay();

    try {
      const wordRows = await readAllWords();
      wordRows.forEach(wordRow => {
        addWordToWordList(wordRow.word, wordRow.word_id);
      });
    } catch (error) {
      console.error("Error: failed to populate word list.");
      console.error(error);
    }
  }

  function clearWordListDisplay() {
    while (wordListContainer.firstChild) {
      wordListContainer.firstChild.remove();
    }
  }

  function addWordToWordList(word, word_id = -1) {
    wordArray.push(word);

    let wordItem = document.createElement("div");
    wordItem.classList.add("word-item");
    // an ID of -1 means it has not been assigned an ID yet
    if (word_id == -1) {
      wordItem.classList.add("pending");
    }
    wordItem.dataset.wordId = word_id;
    wordListContainer.append(wordItem);

    // Add Delete event listener
    wordItem.addEventListener("click", () => {
      toggleMarkForDeletion(wordItem);
    });

    let heightLimit = wordItem.clientHeight;

    let wordItemContent = document.createElement("div");
    wordItemContent.classList.add("word-item-content");
    wordItemContent.innerHTML = word;

    wordItem.append(wordItemContent);

    // Scale content font size to fit
    let fontSize = window.getComputedStyle(wordItemContent).getPropertyValue("font-size");
    fontSize = parseInt(fontSize);

    let currentHeight = wordItemContent.clientHeight;
    let minFontSize = 21; // Smallest size that looks good for mobile
    while ((fontSize > minFontSize) && (currentHeight > heightLimit)) {
      fontSize -= 1;
      wordItemContent.style.fontSize = fontSize + "px";
      currentHeight = wordItemContent.clientHeight;
    }

    return wordItem;
  }

  function toggleMarkForDeletion(wordItemElement, forceValue) {
    // Mark/unmark for deletion
    if (forceValue == "mark") {
      wordItemElement.classList.add("marked-for-delete");
    } else if (forceValue == "unmark") {
      wordItemElement.classList.remove("marked-for-delete");
    } else {
      wordItemElement.classList.toggle("marked-for-delete");
    }
    if (wordItemElement.classList.contains("marked-for-delete")) {
      let deleteMarkImage = document.createElement("img");
      deleteMarkImage.classList.add("delete-mark");
      deleteMarkImage.src = "./images/deletemark.png";
      wordItemElement.append(deleteMarkImage);
    } else {
      wordItemElement.querySelectorAll(".delete-mark").forEach(deleteMarkImage => {
        deleteMarkImage.remove();
      });
    }

    // Enable/disable the Delete button
    checkForDeletableWords();
  }

  function checkForDeletableWords() {
    let elementsMarked = wordListContainer.querySelectorAll(".marked-for-delete");
    if (elementsMarked.length > 0) {
      deleteBtn.classList.remove("disabled");
    } else {
      deleteBtn.classList.add("disabled");
    }
    return elementsMarked;
  }

//#endregion Edit Words page

//#endregion Navigation

}