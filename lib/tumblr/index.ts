/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient as tumblrCreateClient, Client } from "tumblr.js";

function findRateLimitHeader(headers: any, name : string) {
  return Object.keys(headers).filter(header => header.match('ratelimit') && header.match(name)).map(header => headers[header])[0];
}

function tumblrPromisify(func : Function) : () => Promise<any> {
  return function (this: any, ...args: any[]) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return new Promise(function(resolve, reject) {
      let retries = 4;
      const rateLimiterFunction = function(err: any, data: any, dataDetailed: any) {
        if (err !== null) {
          retries -= 1;
          if (!dataDetailed) {
            // connection timeouts
            if (retries>0) {
              console.log(`Error occured. Retries left ${retries}`);
              setTimeout(() => func.apply(self, [...args, rateLimiterFunction]), 60000);
            } else {
              reject([err,dataDetailed]);
            }
          } else if (dataDetailed.statusCode == 429) {
            // it's a rate limit. let's retry once the limit is gone
            const limit = findRateLimitHeader(dataDetailed.headers, '-limit');
            const remaining = findRateLimitHeader(dataDetailed.headers, '-remaining');
            const reset = findRateLimitHeader(dataDetailed.headers, '-reset');

            let timeout = 10000;
            if (remaining == 0) {
              timeout = reset;
            }

            if (retries > 0){
              console.log(`API limit exceeded: L:${limit} / R:${remaining} / S:${reset}; waiting ${timeout}ms; Retries left ${retries}`);
              setTimeout(() => func.apply(self, [...args, rateLimiterFunction]), timeout);
            } else {
              reject([err, dataDetailed]);
            }
          } else {
             // 404s and other issues
            if (retries>0) {
              console.log(`Error occured. Retries left ${retries}`);
              setTimeout(() => func.apply(self, [...args, rateLimiterFunction]), 10000);
            } else {
              reject([err, dataDetailed]);
            }
          }
        } else {
          resolve([data, dataDetailed]);
        }
      };

      func.apply(self, [...args, rateLimiterFunction]);
    });
  }
}

let counter = -1;

function roundRobinCaller(clients: TumblrClientAsync[], functionName: keyof TumblrClientAsync) {
  function fn(this: any, ...args: any[]) {
    counter += 1;
    return (clients[counter % clients.length][functionName] as any)(...args);
  }

  return fn;
}

export interface TumblrClientAsync {
  userInfoAsync: () => Promise<any>
  userDashboardAsync: (params: any) => Promise<any>
  blogPostsAsync: (username: string, options: any) => Promise<any>
}

export const createClient = function(keys: any) : TumblrClientAsync {
  const clients = [];
  for (let i=0; i<keys.length; i++) {
    const client = tumblrCreateClient(keys[i]) as (Client & TumblrClientAsync);
    client.userInfoAsync = tumblrPromisify(client.userInfo);
    client.userDashboardAsync = tumblrPromisify(client.userDashboard);
    client.blogPostsAsync = tumblrPromisify(client.blogPosts);

    clients.push(client);
  }

  return {
    userInfoAsync: roundRobinCaller(clients, "userInfoAsync"),
    userDashboardAsync: roundRobinCaller(clients, "userDashboardAsync"),
    blogPostsAsync: roundRobinCaller(clients, "blogPostsAsync")
  }
}
