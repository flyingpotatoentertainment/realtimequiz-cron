const express = require("express");
const PubSub = require("@google-cloud/pubsub");

// Create a new PubSub client using the GOOGLE_CLOUD_PROJECT
// environment variable. This is automatically set to the correct
// value when running on AppEngine.
const pubsubClient = new PubSub({
  projectId: process.env.GOOGLE_CLOUD_PROJECT
});

const app = express();
// For any request to /public/{some_topic}, push a simple
// PubSub message to that topic.

app.get("/publish/public-game", async (req, res) => {
  try {
    var x = 0;
    var intervalID = setInterval(async () => {
      var currentdate = new Date();
      // Your logic here
      await pubsubClient
        .topic("post-question")
        .publisher()
        .publish(Buffer.from("000000"));

        // after 12 seconds, evaluate the last question
        setTimeout(async () => {
          // Your logic here
          await pubsubClient
            .topic("evaluate-question")
            .publisher()
            .publish(Buffer.from("000000"));
        }, 12000);

      if (++x === 10) {
        clearInterval(intervalID);
      }
    }, 30000);
    res
      .status(200)
      .send("Published to public game channel" )
      .end();
  } catch (e) {
    res
      .status(500)
      .send("" + e)
      .end();
  }
});

// Index page, just to make it easy to see if the app is working.
app.get("/time", (req, res) => {
  var currentTime = new Date();
  res
    .status(200)
    .send(currentTime.getTime())
    .end();
});

// Index page, just to make it easy to see if the app is working.
app.get("/", (req, res) => {
  res
    .status(200)
    .send("[functions-cron]: Hello, world!")
    .end();
});

// Start the server
const PORT = process.env.PORT || 6060;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log("Press Ctrl+C to quit.");
});
