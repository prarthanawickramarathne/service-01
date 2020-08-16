const express = require("express");
const axios = require("axios");
const redis = require("redis");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();

const multer = require('multer');
const inMemoryStorage = multer.memoryStorage();
const uploadStrategy = multer({storage: inMemoryStorage}).single('image');

const app = express();
app.use(cors());
// setup redis client

const client = redis.createClient({
  port: process.env.REDIS_PORT,
  host: process.env.REDIS_HOST,
  password: process.env.REDIS_PASSWORD,
});

// redis store configs
const usersRedisKey = "store:users"; // cahce key for users
const dataExpireTime = 3600; // 1 hour cache expire time

// main endpoint
app.get("/", (req, res) =>
  res.send("Service 01.")
);

// users endpoint with caching
app.get("/users", (req, res) => {
  // try to fetch the result from redis
  return client.get(usersRedisKey, (err, users) => {
    if (users) {
      return res.json({ source: "cache", data: JSON.parse(users) });

      // if cache not available call API
    } else {
      // get data from remote API
      axios
        .get("https://service-2.azurewebsites.net/users")
        .then((res) => res.data)
        .then((users) => {
          // save the API response in redis store
          client.setex(usersRedisKey, dataExpireTime, JSON.stringify(users));

          // send JSON response to client
          return res.json({ source: "api", data: users });
        })
        .catch((error) => {
          // send error to the client
          return res.json(error.toString());
        });
    }
  });
});

app.post("/file/upload", uploadStrategy, (req, res) => {

  try {
    axios
        .post("https://rus95-functionapp.azurewebsites.net/api/HttpTrigger1", {
          filedata: req.file.buffer,
          filename: req.file.originalname
        })
        .then((Res) => {
          if (Res.status === 200) {
            return res.status(200).json({
              message: 'Image Uploaded!',
              statusCode: 200
            });
          } else {
            throw error;
          }
        })
        .catch(e => {
          return res.status(200).json({
            message: 'Image Upload failed!',
            statusCode: 400
          });
          console.error(e);
        });

  } catch (e) {
    console.error(e);
  }

});

// start express server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("Server listening on port:", PORT);
});
