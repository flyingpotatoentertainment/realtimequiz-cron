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

exports.minutely_job = functions.pubsub
  .topic("minutely-tick")
  .onPublish(async message => {
    if (message.data) {
      const dataString = Buffer.from(message.data, "base64").toString();
      // console.log(`Message Data: ${dataString}`);
    }
    // TODO post the question to the live quiz round:
    // TODO fetch a question from the api.

    // TODO catch errors
    var questionRequest = await request(
      "https://opentdb.com/api.php?amount=1&type=multiple&encode=url3986"
    );

    const questionResponse = JSON.parse(unescape(questionRequest));
    const question = questionResponse.results[0]
    console.log(question);

    const answers = [question.correct_answer, ...question.incorrect_answers];

    // // TODO check question uniqueness
    // questionRef.set({
    //     category: question.category, 
    //     difficulty: question.difficulty, 
    //     question: question.question, 
    //     answers: answers, 
    //     meta: {
    //       upvote: 0, 
    //       downvote: 0, 
    //       warning: 0,
    //     }, 
    //     language: "en"
    // })

    const channelRef = db.collection("channel_test").doc("en");
    
    // TODO evaluate & delete the last round
    // TODO extract string paths
    evaluateRound()



    // Shuffle the answers array
    for (let i = 0; i < answers.length; i++) {
      const randomChoiceIndex = Math.floor(Math.random()* answers.length);
      // place our random choice in the spot by swapping
      [answers[i], answers[randomChoiceIndex]] = [answers[randomChoiceIndex], answers[i]];
    }
    const correctAnswerIndex = answers.indexOf(question.correct_answer); 
    //const roundRef = channelRef.collection("rounds").doc(); 


    channelRef.set({
        category: question.category, 
        difficulty: question.difficulty, 
        question: question.question, 
        answers: answers,
        correctAnswerIndex: -1, 
    })

    // TODO set correct answer index some time in the future
    
    setTimeout(() => {
      channelRef.update({
        correctAnswerIndex, 
      })
    }, 10000);
    


    // TODO generate translations and question collection supertype.

    // TODO increase 


    // TODO write the old questions metadata
    // TODO kick quaraneened players

    return true;
  });

  async function evaluateRound(){
    const channelRef = db.collection("channel_test").doc("en");

    const question = await channelRef.get();

    const upvotes =  await channelRef.collection("upvotes").get(); 
    const downvotes =  await channelRef.collection("downvotes").get(); 
    const issues =  await channelRef.collection("issues").get(); 
    const guesses =  await channelRef.collection("guesses").get(); 
    channelRef.update({results: {
      upvotesCoung: upvotes.docs.length, 
      downvotesCount: downvotes.docs.length, 
      issuesCount: issues.docs.length, 
      guessesCount: guesses.docs.length, 
      guesses: {
        0: guesses.docs.filter((doc) => {doc["index"] == 0}).length,
        1: guesses.docs.filter((doc) => {doc["index"] == 1}).length,
        2: guesses.docs.filter((doc) => {doc["index"] == 2}).length,
        3: guesses.docs.filter((doc) => {doc["index"] == 3}).length,
      }
    }})

    if(upvotes.docs.length + downvotes.docs.length > 0){
      // check if the question allready exists
      // TODO check if this works
      const questionExists = await db.collection("questions_test").where('question', '==', question['question']).get();

      if(questionExists.docs.length > 0){
        // TODO test
        questionExists.docs.forEach((item) => {
          item.ref.update({
            upvotesCount: item["upvotesCount"] + upvotes.docs.length, 
            downvotesCount: item["downvotesCount"] + downvotes.docs.length, 
            issuesCount: item["issuesCount"] + issues.docs.length, 
            guessesCount: guesses.docs.length, 
            correctGuesseCount: guesses.docs.filter((doc) => {doc["index"] == question["correctAnswerIndex"]}).length,
          });
        })
      }
      else{
        const questionRef = db.collection("questions_test").doc(); 
        questionRef.set({
            category: question["category"],
            difficulty: question["difficulty"],
            question: question["question"],
            correctAnswer: question["answers"][question["correctAnswerIndex"]],
            answers: question["answers"].filter((item) => item != question["answers"][question["correctAnswerIndex"]]),
            upvotesCount: upvotes.docs.length, 
            downvotesCount: downvotes.docs.length, 
            issuesCount: issues.docs.length, 
            guessesCount: guesses.docs.length, 
            correctGuesseCount: guesses.docs.filter((doc) => {doc["index"] == question["correctAnswerIndex"]}).length,
        })
      }
    }

    deleteCollection(upvotes);
    deleteCollection(downvotes);
    deleteCollection(issues);
    deleteCollection(guesses);
  }
  function deleteCollection(snapshot){
    snapshot.forEach((doc) => {
      doc.ref.delete();
    });
  }