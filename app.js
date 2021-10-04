const axios = require('axios');
const express = require("express");
const app = express();

require("dotenv").config({ path: "./config/.env" });

//set rate limiting
const rateLimit = require('express-rate-limit')

const limiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, //15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

// pull in the required packages.
const {
  TextAnalyticsClient,
  AzureKeyCredential,
} = require("@azure/ai-text-analytics");

const endpoint = process.env["ENDPOINT"] || "<cognitive services endpoint>";
const apiKey = process.env["TEXT_ANALYTICS_API_KEY"] || "<api key>";

//Server Setup
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(limiter);

//Routes
app.get("/", (req, res) => {
  res.render("index.ejs");
});

app.post("/", async (req, res) => {
  const documents = [];
  const subreddit = req.body.subreddit.trim()
  try {
    //get subreddit posts
    await axios.get(`https://www.reddit.com/r/${subreddit}.json`)
    .then(response => {
      console.log(response.data.data.children[8].data.selftext)
      documents.push(String(response.data.data.children[8].data.selftext))
    })
    console.log(documents)
    //call get random post and add the text to documents for analysis
    if(documents.length < 1){
      res.render("error.ejs")
    }
    //console.log(documents)
    console.log("=== Analyze Sentiment Sample ===");

    const client = new TextAnalyticsClient(
      endpoint,
      new AzureKeyCredential(apiKey)
    );

    const results = await client.analyzeSentiment(documents);

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      console.log(`- Document ${result.id}`);
      if (!result.error) {
        console.log(`\tDocument text: ${documents[i]}`);
        console.log(`\tOverall Sentiment: ${result.sentiment}`);
        console.log("\tSentiment confidence scores: ", result.confidenceScores);
        console.log("\tSentences");
        for (const { sentiment, confidenceScores, text } of result.sentences) {
          console.log(`\t- Sentence text: ${text}`);
          console.log(`\t  Sentence sentiment: ${sentiment}`);
          console.log("\t  Confidence scores:", confidenceScores);
        }
      } else {
        console.error(`  Error: ${result.error}`);
      }
    }
    res.render("result.ejs", { result: results, text: documents });
  } catch (err) {
    console.log(err);
    res.render("error.ejs")
  }
});

app.listen(process.env.PORT || 4200);
