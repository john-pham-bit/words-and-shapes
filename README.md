# Words and Shapes

Words and Shapes is a Socket.IO (Node.js) web application for playing a multiplayer word game over web browser.
Built using standard CSS, HTML, and JavaScript.
Backend uses PostgreSQL to store the library of words.

This repository is Heroku-ready.

## Server Installation

To run the server, a PostgreSQL database must be set up with the following table:
words(word_id SERIAL PRIMARY KEY, word VARCHAR(40) NOT NULL);

If running locally, an environment variable file named .env must be created in the root directory.
The contents of the file is only one line:

```
DATABASE_URL=postgres://username:password@localhost:port/databasename
```

Then, run the server as a Node.js app.

## License
ISC
