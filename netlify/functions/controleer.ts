import { Handler } from "@netlify/functions";

const GELDIG_TOKEN = "fearless_x9k2m";

const handler: Handler = async (event) => {
  const token = event.queryStringParameters?.t || "";

  const geldig = token === GELDIG_TOKEN;

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({ geldig }),
  };
};

export { handler };
