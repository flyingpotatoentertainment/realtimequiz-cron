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
admin.initializeApp(functions.config().firebase);
export const db = admin.firestore();

exports.minutely_job = functions.pubsub
  .topic("minutely-tick")
  .onPublish(async message => {
    console.log("The job is running");
    if (message.data) {
      const dataString = Buffer.from(message.data, "base64").toString();
      console.log(`Message Data: ${dataString}`);
    }
    const testRef = db.collection("testquizzes").doc();
    console.log(testRef.id);
    var setAda = testRef.set({
      question: "Where is Funkytown?",
      answers: [
        "Berlin",
        "In my head",
        "On my heaphones",
        "In Funkminston, Minessota"
      ]
    });

    // TODO post the question to the live quiz round:
    // TODO fetch a question from the api.
    const questions = await request(
      "https://opentdb.com/api.php?amount=3&type=multiple"
    );
    console.log(questions);

    // TODO write the old questions metadata
    // TODO kick quaraneened players

    return true;
  });
