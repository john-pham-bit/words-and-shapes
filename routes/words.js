const express = require('express');
const { Pool } = require('pg/lib');
const db = require('../db');
const router = express.Router();

// Getting all
router.get("/", async (req, res) => {
  try {
    const allWords = await db.query("SELECT * FROM words");
    res.json(allWords.rows);
  } catch (error) {
    // Status 500 = error on the server
    res.status(500).json({ message: error.message });
  }
});

// Getting one
router.get("/:id", getWordRow, (req, res) => {
  res.json(res.wordRow);
});

// Creating one
router.post("/", async (req, res) => {
  try {
    const word = req.body.word;
    const newWord = await db.query("INSERT INTO words (word) VALUES ($1) RETURNING *", [word]);
    // Status 201 = successfully created
    res.status(201).json(newWord.rows[0]);
  } catch (error) {
    // Status 400 = error on the client
    res.status(400).json({ message: error.message });
  }
});

// Updating one
router.patch("/:id", getWordRow, async (req, res) => {
  if (req.body.word != null) {
    res.wordRow.word = req.body.word;
  }
  try {
    const updatedWord = await db.query(
      "UPDATE words SET word = $1 WHERE word_id = $2 RETURNING *", 
      [res.wordRow.word, res.wordRow.word_id]
    );

    // Status 200 = request succeeded
    res.status(200).json(updatedWord.rows[0]);
  } catch (error) {
    // Status 400 = error on the client
    res.status(400).json({ message: error.message });
  }
});

// Deleting one
router.delete("/:id", getWordRow, async (req, res) => {
  try {
    // res.json({ message: "Deleted word" });
    const deletedWord = await db.query(
      "DELETE FROM words WHERE word_id = $1 RETURNING *", 
      [res.wordRow.word_id]
    );
    // Status 200 = request succeeded
    res.status(200).json(deletedWord.rows[0]);
  } catch (error) {
    // Status 500 = error on the server
    res.status(500).json({ message: err.message });
  }
});

async function getWordRow(req, res, next) {
  let wordRows;
  try {
    wordRows = await db.query("SELECT * FROM words WHERE word_id = $1", [req.params.id]);
    if (wordRows.rows.length == 0) {
      // Status 404 = could not find
      return res.status(404).json({ message: "Cannot find word" });
    }
  } catch (error) {
    // Status 500 = error on the server
    return res.status(500).json({ message: error.message });
  }

  res.wordRow = wordRows.rows[0];
  next();
}

module.exports = router;