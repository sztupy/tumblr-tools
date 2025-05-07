/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient as tumblrCreateClient, Client } from "tumblr.js";

function findRateLimitHeaders(headers: any) {
  const result: Record<string, Record<string, number>> = {}

  for (const headerName in headers) {
    if (headerName.toLowerCase().match('ratelimit')) {
      const split = headerName.replace('_', '-').split('-');
      const value = +headers[headerName];
      const valueType = split[split.length - 1];
      const rateType = split[split.length - 2];
      result[rateType] ||= {};
      result[rateType][valueType] = value;
    }
  }

  return result
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
            const headers = findRateLimitHeaders(dataDetailed.headers);

            let type = 'unknown';
            let limit = 0;
            let remaining = 99999999;
            let reset = 10;

            for (const headerType in headers) {
              if (remaining > headers[headerType]['remaining']) {
                type = headerType;
                limit = headers[headerType]['limit'];
                remaining = headers[headerType]['remaining'];
                reset = headers[headerType]['reset'];
              }
            }

            let timeout = 10000;
            if (remaining == 0) {
              timeout = reset;
            }

            retries = 4;
            console.log("API limit exceeded");
            console.log(headers);
            console.log(`T:${type} / L:${limit} / R:${remaining} / W:${reset}; waiting ${timeout}s`);
            setTimeout(() => func.apply(self, [...args, rateLimiterFunction]), timeout * 1000);
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
