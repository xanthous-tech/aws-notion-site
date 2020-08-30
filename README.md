# AWS Notion Site

Deploy your Notion Site on AWS, with Serverless Technology.

## How it works

It uses AWS Lambda to proxy requests and inject necessary scripts to power the site, and the API Gateway runs behind CloudFront CDN, and it sets up both the apex domain and the `www` domain so all you have to do is to link the DNS to the CloudFront Distribution. The core mechanics is heavily inspired by [Fruition](https://github.com/stephenou/fruitionsite).

## How to use

First, copy `.env.example` to `.env` and fill in the environment variables based on the comments.

Then update the `edge.js` to set up the configuration section, the configuration code should be the same as Fruition.

At the end, just run the following command to deploy:

```shell
yarn
yarn deploy
```

## Why use AWS Lambda?

We are trying to deploy [our Notion site](https://x-tech.io), but we couldn't get it to link to our domain since it is not using Cloudflare, and when I tried to set up CloudFront in front of the Cloudflare workers (by setting up a CNAME to the Cloudflare domain that has the Fruition site), the Cloudflare worker routing has issues. So I had to improvise with Lambdas by mimicking the same logic.

## Why not use Lambda@Edge?

I actually have tried, and it would have worked well until the size of the request is larger than 1MB, which is the response size limit for Lambda@Edge. I wish we can eventually use edge lambdas because the performance would be better.

## License

[MIT](./LICENSE)