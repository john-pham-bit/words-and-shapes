import { animateSpritesheet, drawSprite } from "./spritesheet.js";
import { getRandomShapeImage, getShapeImage } from "./shapes.js";

window.addEventListener("load", onLoad);

function onLoad() {
  const socket = io();

  let playerName;
  let playerId;

  var IO = {
    createRoom: function() {
      socket.emit("createRoom");
    },
    joinRoom: function(roomId) {
      socket.emit("joinRoom", { roomId: roomId });
    },
    updateName: function(newName) {
      socket.emit("updateName", { playerName: newName });
    },
    notifySettingsUpdate: function(wordCount, shapeCount, wildcards) {
      socket.emit("settings", { wordCount: wordCount, shapeCount: shapeCount, wildcards: wildcards });
    },
    sendMousePositions: function(mousePositions) {
      socket.emit("mousePositions", { mousePositions: mousePositions });
    },
    startGame: function(wordCount, shapeCount, wildcards) {
      socket.emit("startGame", { wordCount: wordCount, shapeCount: shapeCount, wildcards: wildcards });
    },
    moveCardPile: function(percentX, percentY) {
      socket.emit("moveCardPile", { percentX: percentX, percentY: percentY });
    },
    drawCard: function() {
      socket.emit("drawCard");
    },
    stealCard: function(otherPlayerId) {
      socket.emit("stealCard", { playerId: otherPlayerId });
    },
    scoreGame: function() {
      socket.emit("scoreGame");
    },
    playAgain: function() {
      socket.emit("playAgain");
    }
  };

  let url = new URL(window.location.href);
  let roomId = url.searchParams.get("room");
  if (roomId == null) {
    IO.createRoom();
  } else {
    IO.joinRoom(roomId);
  }

  socket.on("playerId", (event) => assignPlayerNameAndId(event));
  function assignPlayerNameAndId(event) {
    playerName = event.playerName;
    playerId = event.playerId;
    addPlayerAvatar(playerName, playerId, true);
  }

  socket.on("playerList", (event) => updatePlayerList(event));
  function updatePlayerList(event) {
    let newPlayerList = event.playerList;
    let oldPlayerAvatars = getPlayerAvatars(false);
    // Update any existing avatars with new names if applicable
    oldPlayerAvatars.forEach((playerAvatar) => {
      let playerId = playerAvatar.dataset.playerId;
      newPlayerList.forEach((updatedPlayer) => {
        if (updatedPlayer.playerId == playerId) {
          updatePlayerAvatarName(playerAvatar, updatedPlayer.playerName);
        }
      })
    });
    // Delete any old avatars that do not appear in the updated player list
    let playerIdsToDelete = [];
    oldPlayerAvatars.forEach((playerAvatar) => {
      let otherPlayerId = playerAvatar.dataset.playerId;
      if (!playerExistsInUpdatedList(playerAvatar.dataset.playerName, otherPlayerId)) {
        playerIdsToDelete.push(otherPlayerId);
      }
    });
    playerIdsToDelete.forEach((otherPlayerId) => { deletePlayer(otherPlayerId); });
    oldPlayerAvatars = getPlayerAvatars(false);
    // Add avatars for any remaining (new) player names
    newPlayerList.forEach((player) => {
      if (!playerAvatarExists(player.playerName, player.playerId)) {
        addPlayerAvatar(player.playerName, player.playerId);
      }
    });

    function playerExistsInUpdatedList(name, id) {
      let playerFound = false;
      newPlayerList.forEach((player) => {
        if (player.playerName == name && player.playerId == id) {
          playerFound = true;
        }
      });
      return playerFound;
    }

    function playerAvatarExists(name, id) {
      let playerFound = false;
      oldPlayerAvatars.forEach((playerAvatar) => {
        if (playerAvatar.dataset.playerName == name && playerAvatar.dataset.playerId == id) {
          playerFound = true;
        }
      });
      return playerFound;
    }

    spreadPlayerAvatars();
  }

  function deletePlayer(playerId) {
    document.querySelectorAll(`[data-player-id="${playerId}"]`).forEach((element) => {
      element.remove();
    });
  }

  socket.on("roomId", (event) => onReceivedRoomId(event));
  let inviteLink = document.querySelector("#invite-link");
  let inviteLinkText = inviteLink.querySelector(".button-text");
  function onReceivedRoomId(event) {
    inviteLinkText.innerHTML = window.location.origin + window.location.pathname + "?room=" + event.roomId;
  }

  let tooltipTimerId = null;
  inviteLink.addEventListener("click", () => {
    inviteLink.classList.remove("tooltip-appear");

    setTimeout(() => {
      inviteLink.classList.add("tooltip-appear");
  
      navigator.clipboard.writeText(inviteLinkText.innerHTML);

      if (tooltipTimerId != null) {
        clearTimeout(tooltipTimerId);
      }
  
      let tooltipTime = getComputedStyle(document.documentElement).getPropertyValue("--tooltip-time");
      tooltipTime = parseFloat(tooltipTime);
      tooltipTime *= 1000; // convert to milliseconds
      tooltipTimerId = setTimeout(() => {
        inviteLink.classList.remove("tooltip-appear");
        tooltipTimerId = null;
      }, tooltipTime);
    }, 10);
  });

  socket.on("wordCount", (event) => onReceivedWordCount(event));
  function onReceivedWordCount(event) {
    let wordCountRange = document.querySelector("#word-count-range");
    let wordCountNumber = document.querySelector("#word-count-number");
    wordCountRange.max = event.wordCount;
    wordCountNumber.max = event.wordCount;
    let currentValue = wordCountRange.value;
    wordCountRange.value = Math.min(event.wordCount, currentValue);
    wordCountNumber.value = Math.min(event.wordCount, currentValue);
  }

  let allowClick = true;
  let startButton = document.querySelector("#start-button");
  startButton.addEventListener("click", () => {
    // Flag to prevent accidentally clicking on the game screen too early
    allowClick = false;

    let wordCount = document.querySelector("#word-count-range").value;
    let shapeCount = document.querySelector("#shape-count-range").value;
    let wildcards = document.querySelector("#wildcards").checked;
    IO.startGame(wordCount, shapeCount, wildcards);
  });

//#region Game

  let playerIdToCards;

  socket.on("startGame", () => startGame());
  function startGame() {
    setTimeout(() => {
      allowClick = true;
    }, 500);

    let game = document.querySelector("#game");
    document.querySelector("#pre-game-lobby").classList.add("hidden");
    game.classList.remove("hidden");
    centerDeck();

    initPlayerCards();
  }

  function initPlayerCards() {
    playerIdToCards = new Map();
    getPlayerAvatars().forEach((avatar) => {
      playerIdToCards.set(avatar.dataset.playerId, []);
    });
  }

  function addPlayerCard(playerId, word, shape) {
    let currentCards = playerIdToCards.get(playerId);
    currentCards.push({ word: word, shape: shape });
    playerIdToCards.set(playerId, currentCards);
  }

  function removePlayerCard(playerId, word) {
    let currentCards = playerIdToCards.get(playerId);
    let mostRecentCard = currentCards.pop();

    if (mostRecentCard.word != word) {
      currentCards.push(mostRecentCard);

      let wordIndex = -1;
      for (let i = 0; i < currentCards.length; ++i) {
        if (currentCards[i].word == word) {
          wordIndex = i;
          break;
        }
      }
      if (wordIndex == -1) { return; }
      currentCards.splice(wordIndex, 1);
    }

    playerIdToCards.set(playerId, currentCards);
  }

  socket.on("cardPile", (event) => addCardPile(event));
  function addCardPile(event) {
    let game = document.querySelector("#game");
    let cardPile = document.createElement("div");
    cardPile.classList.add("card-pile");
    cardPile.dataset.playerId = event.playerId;
    if (event.playerId == playerId) {
      cardPile.classList.add("local");
    }
    game.append(cardPile);

    let avatar = getPlayerAvatar(event.playerId);
    let avatarContainer = document.createElement("div");
    avatarContainer.classList.add("player-avatar-container");
    avatarContainer.append(avatar);
    cardPile.append(avatarContainer);

    avatar.style.transform = "translateX(0)";

    moveCardPile(event.playerId, event.x, event.y);
  }

  socket.on("moveCardPile", (event) => moveCardPile(event.playerId, event.x, event.y));
  function moveCardPile(playerId, percentX, percentY) {
    let cardPile = getCardPile(playerId);

    if (cardPile == null) { return; }

    cardPile.dataset.percentX = percentX;
    cardPile.dataset.percentY = percentY;

    let gameViewportBox = getGameViewportBoundingBox();
    let x = gameViewportBox.width * percentX;
    let y = gameViewportBox.height * percentY;

    cardPile.style.transform = `translate(${x}px, ${y}px) translateX(-50%)`;
  }

  function refreshCardPilePositions() {
    document.querySelectorAll(".card-pile").forEach((cardPile) => {
      moveCardPile(cardPile.dataset.playerId, cardPile.dataset.percentX, cardPile.dataset.percentY);
    });
  }

  document.documentElement.addEventListener("click", (e) => {
    if (!allowClick) { return; }
    if (clickedOnDeck(e)) { return; }
    if (clickedOnCardPile(e)) { return; }

    let x = e.x;
    let y = e.y;
    let gameViewportBox = getGameViewportBoundingBox();

    x = clamp(x, gameViewportBox.x, gameViewportBox.x + gameViewportBox.width);
    y = clamp(y, gameViewportBox.y, gameViewportBox.y + gameViewportBox.height);
    x -= gameViewportBox.x;
    y -= gameViewportBox.y;

    let percentX = x / gameViewportBox.width;
    let percentY = y / gameViewportBox.height;
    moveCardPile(playerId, percentX, percentY);

    IO.moveCardPile(percentX, percentY);
  });

  function getCardPile(playerId) {
    return document.querySelector(`.card-pile[data-player-id="${playerId}"]`);
  }

  function clickedOnDeck(e) {
    let deck = document.querySelector(".deck");
    if (deck.classList.contains("deck-disabled")) { return false; }
    let deckBox = deck.getBoundingClientRect();
    if (!isBoxClickedOn(e.x, e.y, deckBox)) { return false; }

    IO.drawCard();
    return true;
  }

  function clickedOnCardPile(e) {
    let cardPiles = Array.from(document.querySelectorAll(".card-pile"));
    if (cardPiles.length <= 0) { return false; }

    let cardPilePlayerId = null;
    cardPiles.forEach((cardPile) => {
      let cardPileBox = cardPile.getBoundingClientRect();
      if (cardPile.classList.contains("local")) { return; }
      if (cardPile.querySelector(".card") == null) { return; }
      if (isBoxClickedOn(e.x, e.y, cardPileBox)) {
        cardPilePlayerId = cardPile.dataset.playerId;
      }
    });

    if (cardPilePlayerId == null) { return false; }

    IO.stealCard(cardPilePlayerId);
    return true;
  }

  socket.on("stealCard", (event) => stealCard(event));
  function stealCard(event) {
    let thiefPile = getCardPile(event.thief);
    let victimPile = getCardPile(event.victim);

    victimPile.querySelectorAll(".card").forEach((existingCard) => {
      existingCard.remove();
    });

    let cardToSteal = constructCard(event.word, event.shape);
    removePlayerCard(event.victim, event.word);

    if (event.nextWord != null) {
      let nextCard = constructCard(event.nextWord, event.nextShape);
      victimPile.append(nextCard);
    }

    animateCardFlip(cardToSteal, victimPile, thiefPile, true);
  }

  function isBoxClickedOn(x, y, box) {
    let isMouseInBox = (x >= box.x) &&
      (x <= box.x + box.width) &&
      (y >= box.y) &&
      (y <= box.y + box.height);
    return isMouseInBox;
  }

  function centerDeck() {
    let deck = document.querySelector(".deck");
    let deckWidth = deck.clientWidth;
    let viewportWidth = getGameViewportWidth();
    let centeredPos = viewportWidth / 2;
    centeredPos -= (deckWidth / 2);
    deck.style.setProperty("--deck-position-x", centeredPos + "px");

    let wildcardDrawLocation = document.querySelector(".wildcard-draw-location");
    wildcardDrawLocation.style.setProperty("--deck-position-x", centeredPos + "px");
  }

  socket.on("drawCard", (event) => drawCard(event))
  function drawCard(event) {
    let deck = document.querySelector(".deck");
    let cardPile = getCardPile(event.playerId);

    let card = constructCard(event.word, event.shape);

    animateCardFlip(card, deck, cardPile);

    addPlayerCard(event.playerId, event.word, event.shape);
  }

  function constructCard(word, shape) {
    let card = document.createElement("div");
    card.classList.add("card");
    card.dataset.word = word;

    let cardContents = document.createElement("div");
    cardContents.classList.add("card-contents");
    cardContents.dataset.word = word;
    card.append(cardContents);

    let cardShape = document.createElement("img");
    cardShape.classList.add("card-shape");
    cardShape.src = getShapeImage(shape);
    cardContents.append(cardShape);

    return card;
  }

  function animateCardFlip(card, start, end, steal = false) {
    let gameViewportBox = getGameViewportBoundingBox();
    let drawCardAnimTime = getDrawCardAnimTime();

    let drawnCard = document.createElement("div");
    drawnCard.classList.add("drawn-card");
    let drawnCardSub = document.createElement("div");
    drawnCardSub.classList.add("drawn-card-sub");
    drawnCard.append(drawnCardSub);
    let startPosX = start.getBoundingClientRect().x - gameViewportBox.x;
    let startPosY = start.getBoundingClientRect().y - gameViewportBox.y;
    drawnCard.style.setProperty("--drawn-card-start-pos-x", startPosX + "px");
    drawnCard.style.setProperty("--drawn-card-start-pos-y", startPosY + "px");
    let endPosX = end.getBoundingClientRect().x - gameViewportBox.x;
    let endPosY = end.getBoundingClientRect().y - gameViewportBox.y;
    drawnCard.style.setProperty("--drawn-card-end-pos-x", endPosX + "px");
    drawnCard.style.setProperty("--drawn-card-end-pos-y", endPosY + "px");
    if (steal) {
      drawnCard.style.setProperty("--final-opacity", 0);
    }
    document.querySelector("#game").append(drawnCard);

    let cardBack = document.createElement("div");
    cardBack.classList.add("card-back");

    let preFlip = steal ? card : cardBack;
    let postFlip = steal ? cardBack : card;

    drawnCardSub.append(preFlip);

    setTimeout(() => {
      preFlip.remove();
      drawnCardSub.append(postFlip);
    }, drawCardAnimTime / 2);

    setTimeout(() => {
      if (steal) {
        postFlip.remove();
      } else {
        end.querySelectorAll(".card").forEach((existingCard) => {
          existingCard.remove();
        })
        end.append(postFlip);
      }
      drawnCard.remove();
    }, drawCardAnimTime);
  }

  socket.on("wildcard", (event) => drawWildcard(event));
  function drawWildcard(event) {
    let wildcard = document.createElement("div");
    wildcard.classList.add("wildcard");
    // Note that the card is flipped upside-down because of the CSS flip-card animation
    // This means top-shape is actually on the bottom and vice versa
    let wildcardShapeTop = document.createElement("img");
    let wildcardShapeBottom = document.createElement("img");
    wildcardShapeTop.classList.add("card-shape", "top-shape");
    wildcardShapeBottom.classList.add("card-shape", "bottom-shape");
    wildcardShapeTop.src = getShapeImage(event.shape1);
    wildcardShapeBottom.src = getShapeImage(event.shape2);
    wildcard.append(wildcardShapeTop);
    wildcard.append(wildcardShapeBottom);
    
    let deck = document.querySelector(".deck");
    let wildcardDrawLocation = document.querySelector(".wildcard-draw-location");
    animateCardFlip(wildcard, deck, wildcardDrawLocation);

    // Slide back to the deck
    let drawCardAnimTime = getDrawCardAnimTime();
    setTimeout(() => {
      wildcard.classList.add("back-to-deck");
      setTimeout(() => {
        removeCardShapesFromDeck();

        // Flip the shapes because of the CSS flip-card animation
        wildcardShapeTop.classList.remove("top-shape");
        wildcardShapeTop.classList.add("bottom-shape");
        wildcardShapeBottom.classList.remove("bottom-shape");
        wildcardShapeBottom.classList.add("top-shape");
        deck.append(wildcardShapeTop);
        deck.append(wildcardShapeBottom);
        wildcard.remove();
      }, drawCardAnimTime);
    }, drawCardAnimTime + 0.5);
  }

  function getDrawCardAnimTime() {
    let drawCardAnimTime = getComputedStyle(document.documentElement).getPropertyValue("--draw-card-anim-time");
    drawCardAnimTime = parseFloat(drawCardAnimTime) * 1000; // milliseconds
    return drawCardAnimTime;
  }

  let endGameButtons = document.querySelector(".end-game-button-container");
  let scoreGameBtn = document.querySelector("#score-game-btn");
  let playAgainBtn = document.querySelector("#play-again-btn");

  socket.on("outOfWords", (event) => outOfWords(event));
  function outOfWords(event) {
    let deck = document.querySelector(".deck");
    deck.classList.add("deck-disabled");

    endGameButtons.classList.remove("hidden");
    scoreGameBtn.classList.remove("hidden");
    playAgainBtn.classList.add("hidden");
  }

  scoreGameBtn.addEventListener("click", () => {
    if (scoreGameBtn.classList.contains("hidden")) { return; }

    IO.scoreGame();
  });

  playAgainBtn.addEventListener("click", () => {
    if (playAgainBtn.classList.contains("hidden")) { return; }
    
    IO.playAgain();
  });

  socket.on("scoreboard", (event) => scoreboard(event));
  function scoreboard(event) {
    scoreGameBtn.classList.add("hidden");
    playAgainBtn.classList.remove("hidden");

    deleteAllcards();

    event.scoreboard.forEach((scoreRow) => {
      let scoreDisplay = document.createElement("div");
      scoreDisplay.classList.add("score");
      scoreDisplay.innerHTML = "Score: " + scoreRow.score;
      getCardPile(scoreRow.playerId).append(scoreDisplay);
    });
  }

  socket.on("resetGame", (event) => resetGame(event));
  function resetGame(event) {
    endGameButtons.classList.add("hidden");
    scoreGameBtn.classList.add("hidden");
    playAgainBtn.classList.add("hidden");

    deleteAllcards();

    initPlayerCards();

    let deck = document.querySelector(".deck");
    deck.classList.remove("deck-disabled");
    removeCardShapesFromDeck();
    document.querySelectorAll(".score").forEach((scoreDisplay) => {
      scoreDisplay.remove();
    });
  }

  function deleteAllcards() {
    document.querySelectorAll(".card").forEach((card) => {
      card.remove();
    });
    document.querySelectorAll(".drawn-card").forEach((card) => {
      card.remove();
    });
  }

  function removeCardShapesFromDeck() {
    let deck = document.querySelector(".deck");
    deck.querySelectorAll(".card-shape").forEach((cardShape) => {
      cardShape.remove();
    });
  }

  socket.on("failedToJoin", (event) => failedToJoin(event, "#game-in-progress"));
  socket.on("invalidRoom", (event) => failedToJoin(event, "#game-invalid"));
  function failedToJoin(event, pageId) {
    let preGameLobby = document.querySelector("#pre-game-lobby");
    preGameLobby.classList.add("hidden");
    let game = document.querySelector("#game");
    game.classList.add("hidden");
    let failedToJoinPage = document.querySelector(pageId);
    failedToJoinPage.classList.remove("hidden");
    let roomIdSpan = failedToJoinPage.querySelector("#room-id");
    roomIdSpan.innerHTML = event.roomId;

    document.body.style.cursor = "auto";

    setTimeout(() => {
      window.location.href = window.location.origin;
    }, 5000);
  }

//#endregion Game

//#region Sync settings

  let wordCountRange = document.querySelector("#word-count-range");
  let wordCountNumber = document.querySelector("#word-count-number");
  let shapeCountRange = document.querySelector("#shape-count-range");
  let shapeCountNumber = document.querySelector("#shape-count-number");
  let wildcardsInput = document.querySelector("#wildcards");

  wordCountRange.addEventListener("input", () => {
    notifySettingsUpdate();
  });
  wordCountNumber.addEventListener("change", () => {
    notifySettingsUpdate();
  });
  shapeCountRange.addEventListener("input", () => {
    notifySettingsUpdate();
  });
  shapeCountNumber.addEventListener("change", () => {
    notifySettingsUpdate();
  });
  wildcardsInput.addEventListener("input", () => {
    notifySettingsUpdate();
  });

  function notifySettingsUpdate() {
    let wordCount = wordCountRange.value;
    let shapeCount = shapeCountRange.value;
    let wildcards = wildcardsInput.checked;
    IO.notifySettingsUpdate(wordCount, shapeCount, wildcards);
  }

  socket.on("settings", (event) => onSettingsUpdate(event));
  function onSettingsUpdate(event) {
    wordCountRange.value = event.wordCount;
    wordCountNumber.value = event.wordCount;
    shapeCountRange.value = event.shapeCount;
    shapeCountNumber.value = event.shapeCount;
    wildcardsInput.checked = event.wildcards;
  }

//#endregion Sync settings

//#region Sync mouse

  function normalizeMousePosition(x, y) {
    let gameViewportBox = getGameViewportBoundingBox();
    let isMouseInGameViewportBox = (x >= gameViewportBox.x) &&
      (x <= gameViewportBox.x + gameViewportBox.width) &&
      (y >= gameViewportBox.y) &&
      (y <= gameViewportBox.y + gameViewportBox.height);

    return normalizeMousePositionToBox(x, y, gameViewportBox);
  }

  function unnormalizeMousePosition(x, y) {
    let gameViewportBox = getGameViewportBoundingBox();
    return unnormalizeMousePositionToBox(x, y, gameViewportBox);
  }

  function normalizeMousePositionToBox(x, y, boundingBox) {
    // Clamp to bounding box
    x = clamp(x, boundingBox.x, boundingBox.x + boundingBox.width);
    y = clamp(y, boundingBox.y, boundingBox.y + boundingBox.height);

    x -= boundingBox.x;
    y -= boundingBox.y;

    let normalizedX = x / boundingBox.width;
    let normalizedY = y / boundingBox.height;

    return { x: normalizedX, y: normalizedY };
  }

  function unnormalizeMousePositionToBox(x, y, boundingBox) {
    let unnormalizedX = x * boundingBox.width;
    let unnormalizedY = y * boundingBox.height;

    unnormalizedX += boundingBox.x;
    unnormalizedY += boundingBox.y;

    return { x: unnormalizedX, y: unnormalizedY };
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  let mousePositions = [];
  let prevMouseTimestamp = performance.now();
  let mousePositionInterval = 50; // milliseconds
  let mouseServerUpdateInterval = 200; // milliseconds
  function storeMousePosition(x, y) {
    let currentTimestamp = performance.now();
    let timeSinceLastPos = 0;
    if (prevMouseTimestamp != null) {
      timeSinceLastPos = currentTimestamp - prevMouseTimestamp;
    }

    if (timeSinceLastPos >= mousePositionInterval) {
      // Store the most recent mouse position   
      prevMouseTimestamp = performance.now();
      let normalizedPos = normalizeMousePosition(x, y, getGameViewportBoundingBox());
      let newMousePosition = {
        x: normalizedPos.x,
        y: normalizedPos.y,
        timeSinceLastPos: Math.round(timeSinceLastPos)
      };
      mousePositions.push(newMousePosition);
    }
  }

  // Periodically send mouse positions to server
  setInterval(() => {
    if (mousePositions.length > 0) {
      IO.sendMousePositions(mousePositions);
      mousePositions = [];
    }
  }, mouseServerUpdateInterval);

  socket.on("mousePositions", (event) => replayMousePositions(event));
  const playerIdToMouseObj = new Map();
  function replayMousePositions(event) {
    let otherPlayerId = event.playerId;
    let mousePositions = event.mousePositions;
    if (playerIdToMouseObj.has(otherPlayerId)) {
      let mouseObj = playerIdToMouseObj.get(otherPlayerId);
      mouseObj.posQueue = mouseObj.posQueue.concat(mousePositions);
      // Start position replay timer events if one does not exist
      if (mouseObj.currentTimerId == null) {
        processMousePosQueue(otherPlayerId);
      }
    }
  } 

  function processMousePosQueue(otherPlayerId) {
    let mouseObj = playerIdToMouseObj.get(otherPlayerId);
    mouseObj.currentTimerId = null;
    let currentPos = mouseObj.posQueue.shift();
    let mouseAvatar = mouseObj.avatar;
    let unnormalizedCurrentPos = unnormalizeMousePosition(currentPos.x, currentPos.y, getGameViewportBoundingBox());
    mouseAvatar.style.setProperty("--mouse-position-x", unnormalizedCurrentPos.x + "px");
    mouseAvatar.style.setProperty("--mouse-position-y", unnormalizedCurrentPos.y + "px");

    let nextPos = mouseObj.posQueue[0];
    if (nextPos != null) {
      mouseAvatar.style.setProperty("--mouse-avatar-transition-time", (nextPos.timeSinceLastPos / 1000) + "s");
      let unnormalizedNextPos = unnormalizeMousePosition(nextPos.x, nextPos.y, getGameViewportBoundingBox());
      mouseAvatar.style.setProperty("--mouse-position-x", unnormalizedNextPos.x + "px");
      mouseAvatar.style.setProperty("--mouse-position-y", unnormalizedNextPos.y + "px");

      mouseObj.currentTimerId = setTimeout(() => {
        processMousePosQueue(otherPlayerId);
      }, nextPos.timeSinceLastPos);
    }
  }

  function addMouseAvatarToMap(playerId, mouseAvatar) {
    playerIdToMouseObj.set(playerId, { avatar: mouseAvatar, posQueue: [], currentTimerId: null });
  }

//#endregion Sync mouse

//#region Cosmetic

  window.addEventListener("resize", onWindowResize);
  function onWindowResize() {
    let gameScreen = document.querySelector("#game");
    let onGameScreen = !gameScreen.classList.contains("hidden");
    if (onGameScreen) {
      centerDeck();
      refreshCardPilePositions();
    } else {
      spreadPlayerAvatars();
    }
  }

  function addPlayerAvatar(name, playerId, local = false) {
    let playerList = document.querySelector(".player-list");
    let newPlayerAvatar = document.createElement("div");
    newPlayerAvatar.classList.add("player-avatar");

    newPlayerAvatar.dataset.playerName = name;
    newPlayerAvatar.dataset.playerId = playerId;

    let playerAvatarElements = document.createElement("div");
    playerAvatarElements.classList.add("player-avatar-elements");
    let animDelay = (Math.random() * 5.0); // 0.0 to 5.0
    playerAvatarElements.style.setProperty("--anim-delay", animDelay.toFixed(2) + "s");
    newPlayerAvatar.append(playerAvatarElements);

    let canvasContainer = document.createElement("div");
    canvasContainer.classList.add("canvas-container");
    playerAvatarElements.append(canvasContainer);
    let playerCanvas = document.createElement("canvas");
    canvasContainer.append(playerCanvas);
    animateSpritesheet(playerCanvas, true, playerId);

    let playerNameContainer = document.createElement("div");
    playerNameContainer.classList.add("player-name-container");
    playerAvatarElements.append(playerNameContainer);

    let playerNameLabel = document.createElement("div");
    playerNameLabel.classList.add("player-name-label");
    playerNameLabel.innerHTML = name;
    playerNameContainer.append(playerNameLabel);
    
    if (local) {
      newPlayerAvatar.classList.add("local");

      let playerNameInput = document.createElement("input");
      playerNameInput.classList.add("input-text");
      playerNameInput.classList.add("hidden");
      playerNameInput.type = "text";
      playerNameInput.name = "name";
      playerNameInput.id = "name-input";
      playerNameInput.placeholder = "Name";
      playerNameInput.maxLength = 16;
      playerNameInput.spellcheck = false;
      playerNameInput.value = name;
      playerNameContainer.append(playerNameInput);

      // Edit name
      let canClick = true;
      newPlayerAvatar.addEventListener("click", () => {
        if (canClick) {
          playerNameLabel.classList.add("hidden");
          playerNameInput.classList.remove("hidden");
          playerNameInput.select();
        }
      });

      playerNameInput.addEventListener("change", changeName);
      playerNameInput.addEventListener("blur", changeName);
      function changeName() {
        playerNameLabel.classList.remove("hidden");
        playerNameInput.classList.add("hidden");
        updatePlayerAvatarName(newPlayerAvatar, playerNameInput.value, true);
  
        canClick = false;
        setTimeout(() => {
          canClick = true;
        }, 100);
      }
    }

    playerList.append(newPlayerAvatar);
    spreadPlayerAvatars();

    initPlayerMouseAvatar(playerId, local);
  }

  function initPlayerMouseAvatar(playerId, local) {
    let mouseAvatar = document.createElement("div");
    mouseAvatar.classList.add("mouse-avatar");
    mouseAvatar.dataset.playerId = playerId;
    document.body.append(mouseAvatar);

    let mouseAvatarCanvas = document.createElement("canvas");
    mouseAvatar.append(mouseAvatarCanvas);
    
    let sWidth = 94;
    let sHeight = 94;
    let dWidth = 48;
    let dHeight = 48;

    if (local) {
      drawSprite(mouseAvatarCanvas, "./images/mouse-local.png", playerId, sWidth, sHeight, dWidth, dHeight);
      mouseAvatar.classList.add("local");
      window.addEventListener("mousemove", (e) => {
        mouseAvatar.style.setProperty("--mouse-position-x", e.x + "px");
        mouseAvatar.style.setProperty("--mouse-position-y", e.y + "px");

        storeMousePosition(e.x, e.y);
      });
    }
    else {
      drawSprite(mouseAvatarCanvas, "./images/mouse.png", playerId, sWidth, sHeight, dWidth, dHeight);
      addMouseAvatarToMap(playerId, mouseAvatar);
    }
  }

  function getPlayerMouseAvatars() {
    let playerAvatars = Array.from(document.querySelectorAll(".mouse-avatar"));
    return playerAvatars;
  }

  function getPlayerAvatar(playerId) {
    return document.querySelector(`.player-avatar[data-player-id="${playerId}"]`);
  }

  function getPlayerAvatars(sorted = true) {
    let playerAvatars = Array.from(document.querySelectorAll(".player-avatar"));
    if (sorted) {
      let sortedPlayerAvatars = [];
      while (playerAvatars.length > 0) {
        let smallestIdAvatar = playerAvatars[0];
        let smallestId = smallestIdAvatar.dataset.playerId;
        playerAvatars.forEach((playerAvatar) => {
          if (playerAvatar.dataset.playerId < smallestId) {
            smallestId = playerAvatar.dataset.playerId;
            smallestIdAvatar = playerAvatar;
          }
        });
        sortedPlayerAvatars.push(smallestIdAvatar);
        removeElement(playerAvatars, smallestIdAvatar);
      }
      return sortedPlayerAvatars;
    }
    return playerAvatars;
  }

  function updatePlayerAvatarName(avatar, name, notifyServer = false) {
    let oldName = avatar.dataset.playerName;
    if (oldName == name) { return; }

    avatar.dataset.playerName = name;
    let nameLabel = avatar.querySelector(".player-name-label");
    nameLabel.innerHTML = name;
    nameLabel.classList.add("updated");
    setTimeout(() => {
      nameLabel.classList.remove("updated");
    }, 50);

    if (notifyServer) {
      IO.updateName(name);
    }
  }

  function spreadPlayerAvatars() {
    // Do not spread if the game has already started
    if (!document.querySelector("#game").classList.contains("hidden")) { return; }

    let playerAvatars = getPlayerAvatars();
    let playerCount = playerAvatars.length;
    if (playerCount == 0) { return; }
    let widthPerAvatar = getGameViewportWidth() / playerCount;
    let translateAmt = widthPerAvatar / 2;
    playerAvatars.forEach((playerAvatar) => {
      // subtract half of the avatar's width to center
      let offsetTranslateAmt = translateAmt - (playerAvatar.clientWidth / 2);
      playerAvatar.style.transform = `translateX(${offsetTranslateAmt}px)`;
      translateAmt += widthPerAvatar;
    });
  }

  function getGameViewportWidth() {
    return getGameViewportBoundingBox().width;
  }

  function getGameViewportBoundingBox() {
    return document.querySelector(".game-viewport").getBoundingClientRect();
  }

//#endregion Cosmetic

  function removeElement(array, element) {
    let elementIndex = array.indexOf(element);
    if (elementIndex > -1) {
      array.splice(elementIndex, 1);
    }
  }
}
