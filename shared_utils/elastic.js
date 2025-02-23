const { Client } = require('@elastic/elasticsearch');

const client = new Client({
  node: process.env.ELASTIC_URL,
  auth: {
    apiKey: process.env.ELASTIC_API_KEY
  },
});

client.ping()
  .then(response => console.log("Connected to Elastic"))
  .catch(error => console.error("Elasticsearch is not connected."));

module.exports = client; 