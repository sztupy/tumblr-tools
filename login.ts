/* eslint-disable @typescript-eslint/no-explicit-any */
import { environment } from "./environment.js";
import express from 'express';
import session from "express-session";
import grant from "grant";
import { randomBytes } from "node:crypto";

function tokenGenerate(length=56) {
  return Buffer.from(randomBytes(length)).toString('hex');
}

const app = express();

app.use(session({
  secret: tokenGenerate()
}))

app.use((grant as any).express({
  "defaults": {
    "origin": environment.loginRootUrl,
    "transport": "session",
    "state": true
  },
  "tumblr": {
    "key": environment.tumblrKeys[0].consumer_key,
    "secret": environment.tumblrKeys[0].consumer_secret,
    "callback": "/tumblr",
    "overrides": environment.tumblrKeys.map((key, index) => {
      return {
        "key": key.consumer_key,
        "secret": key.consumer_secret,
        "callback": `/tumblr${index}`
      }
    }).reduce((a, v) => ({...a, [v.callback.split("/")[1]] : v}),{})
  }
}));

for (let i=0; i<environment.tumblrKeys.length; i++) {
  const fn = (req: any, res: any) => {
    console.log("Credentials:")
    console.log(JSON.stringify({
      consumer_key: environment.tumblrKeys[i].consumer_key,
      consumer_secret: environment.tumblrKeys[i].consumer_secret,
      token: (req.session as any).grant.response.access_token,
      token_secret: (req.session as any).grant.response.access_secret,
    }))

    res.send("Login successful");
  };

  app.get(`/tumblr${i}`, fn);

  if (i==0) {
    app.get(`/tumblr`, fn);
    console.log(`Go to ${environment.loginRootUrl}/connect/tumblr to start`)
  } else {
    console.log(`Go to ${environment.loginRootUrl}/connect/tumblr/tumblr${i} to start`)
  }
}

app.listen(3000, '0.0.0.0', () => {
  console.log("Server started");
});
