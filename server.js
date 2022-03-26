const express = require('express');
const path = require('path');
const http = require('http');
const PORT = process.env.PORT || 3000;
const socketio = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = socketio(server);  
const fetch = require('node-fetch');
const fs = require('fs');

app.use(express.json());

// Set static folder
app.use(express.static(path.join(__dirname, "public")));

// Start server
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Routes for API to interact with word database
let wordsRoutePath = "/api/words";
const wordsRouter = require("./routes/words");
const { init } = require('express/lib/application');
app.use(wordsRoutePath, wordsRouter);

var apiRequest = {
  getWordList: function() {
    const readPromise = new Promise(async (resolve, reject) => {
      try {
        const apiResponse = await fetch(`http://localhost:${PORT}${wordsRoutePath}`, { method: "GET" });
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
};

const roomIdToBaseWordList = new Map(); // The pool of words the room can draw from
const roomIdToWordList = new Map(); // The actual words used in a specific game session
const roomIdToSettings = new Map();
const gamesInProgress = [];

// Listen for Socket.IO connections
io.on("connection", bindEvents);

function bindEvents(socket) {
  socket.on("disconnecting", () => onDisconnecting(socket));
  socket.on("disconnect", () => onDisconnect(socket));
  socket.on("createRoom", (event) => createRoom(socket, event));
  socket.on("joinRoom", (event) => joinRoom(socket, event));
  socket.on("updateName", (event) => updateName(socket, event));
  socket.on("settings", (event) => syncSettings(socket, event));
  socket.on("mousePositions", (event) => syncMousePositions(socket, event));
  socket.on("startGame", (event) => startGame(socket, event));
  socket.on("moveCardPile", (event) => moveCardPile(socket, event));
  socket.on("drawCard", () => drawCard(socket));
  socket.on("stealCard", (event) => stealCard(socket, event))
  socket.on("scoreGame", () => scoreGame(socket))
  socket.on("playAgain", () => playAgain(socket))
}

function onDisconnecting(socket) {
  let roomId = getRoomId(socket);
  socket.leave(roomId);
  cleanUpRoom(roomId);
  notifyUpdatedPlayerList(roomId);
}

function onDisconnect(socket) {
  
}

function createRoom(socket, event) {
  if (getRoomId(socket) != null) {
    leaveAllRooms(socket);
  }
  let roomId = generateRoomId();
  joinRoom_internal(socket, roomId);
  assignRoomWordList(roomId);
}

function joinRoom(socket, event) {
  if (getRoomId(socket) != null) {
    leaveAllRooms(socket);
  }
  let roomId = event.roomId;
  if (typeof roomId !== 'string') { return createRoom(socket); }
  if (roomId.length < 5) { return createRoom(socket); }
  if (roomId.length > 5) { roomId = roomId.substring(0, 5); }
  if (!roomExists(roomId)) {
    socket.emit("invalidRoom", { roomId: roomId });
    return ;
  }
  if (gamesInProgress.includes(roomId)) {
    socket.emit("failedToJoin", { roomId: roomId });
    return;
  }
  joinRoom_internal(socket, roomId);
}

function joinRoom_internal(socket, roomId) {
  socket.join(roomId);
  assignPlayerNameAndId(socket, roomId);
  socket.emit("roomId", { roomId: roomId });
  notifyUpdatedPlayerList(roomId);
  notifyWordCount(roomId);
}

async function assignRoomWordList(roomId) {
  if (roomIdToWordList.has(roomId)) { return; }
  try {
    const wordRows = await apiRequest.getWordList();
    // Remove the word_id from each row leaving only the word
    const wordList = wordRows.map(row => row.word);
    roomIdToBaseWordList.set(roomId, wordList);
    roomIdToWordList.set(roomId, wordList);
    notifyWordCount(roomId);
  } catch (error) {
    console.error(error);
  }
}

function cleanUpRoom(roomId) {
  if (!roomIdToWordList.has(roomId)) { return; }
  if (!roomExists(roomId)) {
    roomIdToWordList.delete(roomId);
    roomIdToBaseWordList.delete(roomId);
    removeElement(gamesInProgress, roomId);
  }
}

function notifyWordCount(roomId) {
  // The word list may not have been fetched from the database yet
  if (!roomIdToWordList.has(roomId)) { return; }
  let wordCount = roomIdToWordList.get(roomId).length;
  io.to(roomId).emit("wordCount", { wordCount: wordCount });
}

function notifyUpdatedPlayerList(roomId) {
  let playerList = [];
  getRoomPlayerSockets(roomId).forEach((socket) => {
    playerList.push({ playerName: socket.playerName, playerId: socket.playerId });
  });
  io.to(roomId).emit("playerList", { playerList: playerList });
}

function updateName(socket, event) {
  socket.playerName = event.playerName.substring(0, 16);
  notifyUpdatedPlayerList(getRoomId(socket));
}

let minWordCount = 5;
let maxWordCountDefault = 5;
let minShapeCount = 2;
let maxShapeCount = 8;
function syncSettings(socket, event) {
  let roomId = getRoomId(socket);
  let maxWordCount = maxWordCountDefault;
  if (roomIdToBaseWordList.has(roomId)) {
    maxWordCount = roomIdToBaseWordList.get(roomId).length;
  }
  let newSettings = {
    wordCount: clamp(event.wordCount, minWordCount, maxWordCount),
    shapeCount: clamp(event.shapeCount, minShapeCount, maxShapeCount),
    wildcards: event.wildcards ? true : false
  }
  io.to(roomId).emit("settings", newSettings);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function syncMousePositions(socket, event) {
  let mousePositions = event.mousePositions;
  if (!Array.isArray(mousePositions)) { return; }
  // Clean input
  let badInput = false;
  let cleanedPositions = mousePositions.map((pos) => {
    if (isNaN(pos.x) || isNaN(pos.y) || isNaN(pos.timeSinceLastPos)) { badInput = true; }
    return { x: clamp(pos.x, 0.0, 1.0), y: clamp(pos.y, 0.0, 1.0), timeSinceLastPos: Math.round(pos.timeSinceLastPos) };
  });
  if (badInput) { return; }

  let roomId = getRoomId(socket);
  socket.to(roomId).emit("mousePositions", { playerId: socket.playerId, mousePositions: cleanedPositions });
}

function startGame(socket, event) {
  let roomId = getRoomId(socket);

  gamesInProgress.push(roomId);

  let maxWordCount = maxWordCountDefault;
  if (roomIdToWordList.has(roomId)) {
    maxWordCount = roomIdToWordList.get(roomId).length;
  }

  let wordCount = event.wordCount;
  let shapeCount = event.shapeCount;
  let wildcards = event.wildcards;

  // Clean input
  if (isNaN(wordCount)) {
    wordCount = maxWordCount;
  }
  if (isNaN(shapeCount)) {
    shapeCount = maxShapeCount;
  }
  if (typeof wildcards != "boolean") {
    wildcards = true;
  }

  wordCount = clamp(wordCount, minWordCount, maxWordCount);
  shapeCount = clamp(shapeCount, minShapeCount, maxShapeCount);
  
  roomIdToSettings.set(roomId, { wordCount: wordCount, shapeCount: shapeCount, wildcards: wildcards });

  initGame(roomId);

  io.to(roomId).emit("startGame");

  generateCardPiles(roomId);
}

function generateWildcards(roomId, shapeCount) {
  let wildcardRatio = 0.08;
  let wordCount = roomIdToBaseWordList.get(roomId).length;
  let wildcardCount = Math.max(Math.round(wordCount * wildcardRatio), 1);
  let generatedWildcards = [];
  for (let i = 0; i < wildcardCount; ++i) {
    let newWildcard = generateNewWildcard(shapeCount, generatedWildcards);
    if (newWildcard != null) {
      generatedWildcards.push(newWildcard);
    }
  }
  roomIdToWordList.set(roomId, roomIdToWordList.get(roomId).concat(generatedWildcards));
}

function generateNewWildcard(shapeCount, existingWildcards) {
  let newWildcard = null;
  // Too lazy to figure out how to ensure all permutations of wildcards have been exhausted
  // so just give up after 100 attempts
  for (let i = 0; i < 100; ++i) {
    let potentialCard = generateTwoUniqueShapes(shapeCount);

    let wildcardExists = false;
    existingWildcards.forEach((card) => {
      if ((card.shape1 == potentialCard.shape1) && (card.shape2 == potentialCard.shape2)) {
        wildcardExists = true;
      }
      if ((card.shape1 == potentialCard.shape2) && (card.shape2 == potentialCard.shape1)) {
        wildcardExists = true;
      }
    });

    if (!wildcardExists) {
      newWildcard = potentialCard;
      newWildcard.wildcard = true;
      break;
    }
  }
  return newWildcard;
}

function generateTwoUniqueShapes(shapeCount) {
  let shape1 = Math.floor(Math.random() * shapeCount);
  let shape2 = null;
  while (shape2 == null) {
    let newShape = Math.floor(Math.random() * shapeCount);
    if (newShape != shape1) {
      shape2 = newShape;
    }
  }
  return { shape1: shape1, shape2: shape2 };
}

function generateCardPiles(roomId) {
  getRoomPlayerSockets(roomId).forEach((socket) => {
    let percentX = (Math.random() * 0.7) + 0.1; // 0.1 to 0.8
    let percentY = (Math.random() * 0.3) + 0.5; // 0.5 to 0.8
    io.to(roomId).emit("cardPile", { playerId: socket.playerId, x: percentX, y: percentY });
  });
}

function moveCardPile(socket, event) {
  let roomId = getRoomId(socket);
  let percentX = event.percentX;
  let percentY = event.percentY;
  if (isNaN(percentX)) { return; }
  if (isNaN(percentY)) { return; }
  percentX = clamp(percentX, 0.0, 1.0);
  percentY = clamp(percentY, 0.0, 1.0);
  socket.to(roomId).emit("moveCardPile", { playerId: socket.playerId, x: percentX, y: percentY });
}

function drawCard(socket) {
  let roomId = getRoomId(socket);
  let wordCount = roomIdToWordList.get(roomId).length;
  if (wordCount <= 0) { return; }
  let word = roomIdToWordList.get(roomId)[Math.floor(Math.random() * wordCount)];
  // Remove the word from the word list
  removeWordFromWordList(roomId, roomIdToWordList.get(roomId).indexOf(word));

  if (word.wildcard == true) {
    io.to(roomId).emit("wildcard", { shape1: word.shape1, shape2: word.shape2 });
  } else {
    let shapeCount = roomIdToSettings.get(roomId).shapeCount;
    let shape = Math.floor(Math.random() * shapeCount);
    // Track the cards on the socket
    socket.currentCards.push({ word: word, shape: shape });
    io.to(roomId).emit("drawCard", { playerId: socket.playerId, word: word, shape: shape });
  }

  if (roomIdToWordList.get(roomId).length <= 0) {
    io.to(roomId).emit("outOfWords");
  }
}

function stealCard(socket, event) {
  let roomId = getRoomId(socket);
  let playerToStealFrom = event.playerId;

  if (typeof playerToStealFrom !== "string") { return; }
  if (!getRoomPlayerIds(roomId).includes(playerToStealFrom)) { return; }
  let socketToStealFrom = getSocketFromPlayerId(roomId, event.playerId);
  if (socketToStealFrom == null) { return; }
  if (socketToStealFrom.currentCards.length <= 0) { return; }

  let cardToSteal = socketToStealFrom.currentCards.pop();

  socket.playerScore++;

  io.to(roomId).emit("stealCard", { thief: socket.playerId, victim: event.playerId, word: cardToSteal.word, shape: cardToSteal.shape });
}

function scoreGame(socket) {
  let roomId = getRoomId(socket);
  if (roomIdToWordList.get(roomId).length > 0) { return; }

  let playerScores = [];
  getRoomPlayerSockets(roomId).forEach((socket) => {
    playerScores.push({ playerId: socket.playerId, score: socket.playerScore });
  });
  io.to(roomId).emit("scoreboard", { scoreboard: playerScores });
}

function playAgain(socket) {
  let roomId = getRoomId(socket);
  if (roomIdToWordList.get(roomId).length > 0) { return; }

  resetGame(roomId);
}

function resetGame(roomId) {
  initGame(roomId);
  io.to(roomId).emit("resetGame");
}

function initGame(roomId) {
  getRoomPlayerSockets(roomId).forEach((socket) => {
    socket.playerScore = 0;
    socket.currentCards = [];
  });

  roomIdToWordList.set(roomId, roomIdToBaseWordList.get(roomId));

  let roomSettings = roomIdToSettings.get(roomId);
  let wordCount = roomSettings.wordCount;
  let shapeCount = roomSettings.shapeCount;
  let wildcards = roomSettings.wildcards;

  // Shrink the word list to match the set word count
  let currentWordCount = roomIdToWordList.get(roomId).length;
  let wordsToRemove = Math.max(currentWordCount - wordCount, 0);
  for (let i = 0; i < wordsToRemove; ++i) {
    // Remove one word
    let randomIndex = Math.floor(Math.random() * roomIdToWordList.get(roomId).length);
    removeWordFromWordList(roomId, randomIndex);
  }

  if (wildcards) {
    generateWildcards(roomId, shapeCount);
  }
}

function removeWordFromWordList(roomId, index) {
  roomIdToWordList.get(roomId).splice(index, 1);
}

function getSocketFromPlayerId(roomId, playerId) {
  let playerSocket = null;
  getRoomPlayerSockets(roomId).forEach((socket) => {
    if (socket.playerId == playerId) {
      playerSocket = socket;
    }
  });
  return playerSocket;
}

function getRoomPlayerIds(roomId) {
  let roomPlayerSocketIds = io.sockets.adapter.rooms.get(roomId);
  let roomPlayerIds = [];
  if (roomPlayerSocketIds != null) {
    roomPlayerSocketIds.forEach((socketId) => {
      roomPlayerIds.push(io.sockets.sockets.get(socketId).playerId);
    });
  }
  return roomPlayerIds;
}

function getRoomPlayerSockets(roomId) {
  let roomPlayerSocketIds = io.sockets.adapter.rooms.get(roomId);
  let roomPlayerSockets = [];
  if (roomPlayerSocketIds != null) {
    roomPlayerSocketIds.forEach((socketId) => {
      roomPlayerSockets.push(io.sockets.sockets.get(socketId));
    });
  }
  return roomPlayerSockets;
}

function leaveAllRooms(socket) {
  socket.rooms.forEach(roomId => {
    if (roomId != socket.id) {
      socket.leave(roomId);
      notifyUpdatedPlayerList(roomId);
    }
  });
}

// Players will only be able to join one Socket.IO room at a time
function getRoomId(socket) {
  let currentRoomId = null;
  socket.rooms.forEach(roomId => {
    if (roomId != socket.id) {
      currentRoomId = roomId;
    }
  });
  return currentRoomId;
}

// Generate a unique room ID
function generateRoomId(idLength = 5) {
  let roomId = generateId(idLength);
  if (roomExists(roomId)) {
    return generateRoomId(idLength);
  }
  return roomId;
}

function roomExists(roomId) {
  return getActiveRooms().includes(roomId);
}

function getActiveRooms() {
  let rooms = Array.from(io.sockets.adapter.rooms);
  // Filter socket rooms
  let filteredRooms = rooms.filter(room => {
    return !room[1].has(room[0]);
  });
  let roomIds = filteredRooms.map((room) => room[0]);
  return roomIds;
}

function generateId(idLength = 5) {
  let id = "";
  let validCharacters = "abcdefghijklmnopqrstuvwxyz" +
                        "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
                        "0123456789";
  for (let i = 0; i < idLength; ++i) {
    let randomCharacter = validCharacters.charAt(Math.floor(Math.random() * validCharacters.length));
    id = id + randomCharacter;
  }
  return id;
}

// Load name parts
let nameParts = JSON.parse(fs.readFileSync("nameParts.json"));
// Generate a random player name
function generatePlayerName() {
    let firstPart = nameParts[Math.floor(Math.random() * nameParts.length)];
    let secondPart = nameParts[Math.floor(Math.random() * nameParts.length)];
    let randomNum = Math.floor(Math.random() * 100);
    return firstPart + secondPart + randomNum;
}

function assignPlayerNameAndId(socket, roomId) {
  let playerName = generatePlayerName();
  socket.playerName = playerName;
  let playerId = generatePlayerId(roomId);
  socket.playerId = playerId;
  socket.emit("playerId", { playerName: playerName, playerId: playerId });
}

function generatePlayerId(roomId) {
  let playerIdLength = 10;
  let playerId = generateId(playerIdLength);
  getRoomPlayerSockets(roomId).forEach((socket) => {
    if (socket.playerId == playerId) {
      return generatePlayerId(socket, roomId);
    }
  });
  return playerId;
}

function removeElement(array, element) {
  let elementIndex = array.indexOf(element);
  if (elementIndex > -1) {
    array.splice(elementIndex, 1);
  }
}
