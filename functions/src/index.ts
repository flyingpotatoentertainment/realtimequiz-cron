// Copyright 2017 Google Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as request from "request-promise";
import { Result } from "range-parser";

admin.initializeApp(functions.config().firebase);
export const db = admin.firestore();

exports.new_round = functions.pubsub
  .topic("new-round")
  .onPublish(async message => {
    var channel = "000000";
    if (message.data) {
      channel = Buffer.from(message.data, "base64").toString();
    }
    const channelRef = db.collection("channels").doc(channel);
    const data = await channelRef.get();

    // DONE set the number of active player to the number of players where score != 0;

    channelRef.set({
      metadata: {
        round: 1,
        playerCount: (await channelRef
          .collection("players")
          .where("score", ">", 0)
          .get()).docs.length
      }
    });
    (await channelRef.collection("players").get()).forEach(player => {
      player.ref.set({ score: 0 });
    });

    return true;
  });

exports.evaluate_question = functions.pubsub
  .topic("evaluate-question")
  .onPublish(async message => {
    var channel = "000000";
    if (message.data) {
      channel = Buffer.from(message.data, "base64").toString();
    }
    const channelRef = db.collection("channels").doc(channel);

    const round = await channelRef.get();

    const guesses = await channelRef.collection("guesses").get();

    const correctGuesses = guesses.docs.filter(
      doc => doc.data().guess == round.data().correctAnswerIndex
    );

    // TODO check if theres a winner
    if (correctGuesses.length == 1) {
      // display current winner
      channelRef.update({
        winner: correctGuesses[0].id
      });
    }

    // There is no winner- nockout model?
    else if (correctGuesses.length == 1) {
    }
    // increment all correct guesser players score by 1
    correctGuesses.forEach(guess => {
      console.log(guess.toString());
      channelRef
        .collection("players")
        .doc(guess.id)
        .update({ score: round.data().metadata.round });
    });

    channelRef.update({
      result: {
        answer: round.data().correctAnswerIndex,
        guesses: {
          0: guesses.docs.filter(doc => doc.data().guess == 0).length,
          1: guesses.docs.filter(doc => doc.data().guess == 1).length,
          2: guesses.docs.filter(doc => doc.data().guess == 2).length,
          3: guesses.docs.filter(doc => doc.data().guess == 3).length
        }
      }
    });

    deleteCollection(guesses);

    return true;
  });
exports.post_question = functions.pubsub
  .topic("post-question")
  .onPublish(async message => {
    var channel = "000000";
    if (message.data) {
      channel = Buffer.from(message.data, "base64").toString();
    }
    const channelRef = db.collection("channels").doc(channel);

    // update metadata
    const data = await channelRef.get();
    channelRef.update({
      metadata: {
        ...data.data().metadata,
        round: data.data().metadata.round + 1,
        reports: 0
      }
    });

    // get question
    var question = await getFallbackQuestion();
    console.log(question);
    const answers = [question.correct_answer, ...question.incorrect_answers];

    // Shuffle the answers array
    for (let i = 0; i < answers.length; i++) {
      const randomChoiceIndex = Math.floor(Math.random() * answers.length);
      // place our random choice in the spot by swapping
      [answers[i], answers[randomChoiceIndex]] = [
        answers[randomChoiceIndex],
        answers[i]
      ];
    }
    const correctAnswerIndex = answers.indexOf(question.correct_answer);
    //const roundRef = channelRef.collection("rounds").doc();

    channelRef.update({
      question: question.question,
      answers: answers,
      correctAnswerIndex: correctAnswerIndex,
      active: true,
      result: {
        answer: -1
      }
    });
    return true;
  });

exports.minutely_job = functions.pubsub
  .topic("minutely-tick")
  .onPublish(async message => {
    if (message.data) {
      const dataString = Buffer.from(message.data, "base64").toString();
      // console.log(`Message Data: ${dataString}`);
    }

    // get question
    var question = await getFallbackQuestion();
    console.log(question);
    const answers = [question.correct_answer, ...question.incorrect_answers];

    // Shuffle the answers array
    for (let i = 0; i < answers.length; i++) {
      const randomChoiceIndex = Math.floor(Math.random() * answers.length);
      // place our random choice in the spot by swapping
      [answers[i], answers[randomChoiceIndex]] = [
        answers[randomChoiceIndex],
        answers[i]
      ];
    }
    const correctAnswerIndex = answers.indexOf(question.correct_answer);
    //const roundRef = channelRef.collection("rounds").doc();

    const channelRef = db.collection("channels").doc("en");

    channelRef.set({
      question: question.question,
      answers: answers,
      correctAnswerIndex: -1
    });

    // TODO set correct answer index some time in the future

    setTimeout(() => {
      channelRef.update({
        correctAnswerIndex
      });
    }, 15000);

    return true;
  });

async function evaluateRound(channelRef) {
  let roundSnapshot = await channelRef.get();
  // console.log(roundSnapshot.data());

  const upvotes = await channelRef.collection("upvotes").get();
  const downvotes = await channelRef.collection("downvotes").get();
  const issues = await channelRef.collection("issues").get();
  const guesses = await channelRef.collection("guesses").get();

  // console.log("Documents length")
  // console.log(upvotes.docs.length)
  // console.log(downvotes.docs.length)
  if (upvotes.docs.length > downvotes.docs.length) {
    // check if the question allready exists
    // TODO check if this works
    const questionExists = await db
      .collection("questions_test")
      .where("question", "==", roundSnapshot.data()["question"])
      .get();
    // console.log("question snap")
    // console.log(questionExists.docs)
    if (questionExists.docs.length > 0) {
      // TODO test
      questionExists.docs.forEach(item => {
        item.ref.update({
          upvotesCount: item["upvotesCount"] + upvotes.docs.length,
          downvotesCount: item["downvotesCount"] + downvotes.docs.length,
          issuesCount: item["issuesCount"] + issues.docs.length,
          guessesCount: item["guessesCount"] + guesses.docs.length,
          correctGuessesCount:
            item["correctGuessesCount"] +
            guesses.docs.filter(doc => {
              doc["index"] == roundSnapshot.data()["correctAnswerIndex"];
            }).length
        });
      });
    } else {
      const questionRef = db.collection("questions_test").doc();
      questionRef.set({
        category: roundSnapshot.data()["category"],
        difficulty: roundSnapshot.data()["difficulty"],
        question: roundSnapshot.data()["question"],
        correctAnswer: roundSnapshot.data()["answers"][
          roundSnapshot.data()["correctAnswerIndex"]
        ],
        answers: roundSnapshot
          .data()
          ["answers"].filter(
            item =>
              item !=
              roundSnapshot.data()["answers"][
                roundSnapshot.data()["correctAnswerIndex"]
              ]
          ),
        upvotesCount: upvotes.docs.length,
        downvotesCount: downvotes.docs.length,
        issuesCount: issues.docs.length,
        guessesCount: guesses.docs.length,
        correctGuessesCount: guesses.docs.filter(doc => {
          doc["index"] == roundSnapshot.data()["correctAnswerIndex"];
        }).length
      });
    }
  }

  deleteCollection(upvotes);
  deleteCollection(downvotes);
  deleteCollection(issues);
  deleteCollection(guesses);
}
async function evaluateGuesses(channelRef) {
  const guesses = await channelRef.collection("guesses").get();

  console.log(guesses.docs);
  guesses.docs.forEach(item => console.log(item.data().index));
  channelRef.update({
    results: {
      // upvotesCoung: upvotes.docs.length,
      // downvotesCount: downvotes.docs.length,
      // issuesCount: issues.docs.length,
      guessesCount: guesses.docs.length,
      guesses: {
        0: guesses.docs.filter(doc => doc.data().index == 0).length,
        1: guesses.docs.filter(doc => doc.data().index == 1).length,
        2: guesses.docs.filter(doc => doc.data().index == 2).length,
        3: guesses.docs.filter(doc => doc.data().index == 3).length
      }
    }
  });
}
function deleteCollection(snapshot) {
  snapshot.forEach(doc => {
    doc.ref.delete();
  });
}
async function getFallbackQuestion() {
  var question;
  while (!question) {
    try {
      var questionRequest = await request(
        "https://opentdb.com/api.php?amount=1&category=9&type=multiple&encode=url3986"
      );
      console.log(questionRequest);
      questionRequest = questionRequest.replace(/&quot;/g, '\\"');
      questionRequest = questionRequest.replace(/&#039;/g, "\\`");
      const questionResponse = JSON.parse(unescape(questionRequest));
      question = questionResponse.results[0];
    } catch {}
  }
  return question;
}
