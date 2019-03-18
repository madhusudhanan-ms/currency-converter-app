const express = require('express');
const path = require('path');
const axios = require('axios');
var Redis = require('ioredis');
const app = express();

var client;

process.argv.forEach(function (val, index, array) {
  console.log(index + ': ' + val);
});

paramCheck();


function paramCheck() {
    if (process.argv[2] == "cluster") {
        if( process.argv[3] == undefined || process.argv[4] == undefined || process.argv[5] == undefined ) {
            console.log(`Error: Please mention Redis cluster node IPs`);
            process.exit(1);
        } else {
            const CLUSTER_IP_1 = process.argv[3];
            const CLUSTER_PORT_1 = 6379;

            const CLUSTER_IP_2 = process.argv[4];
            const CLUSTER_PORT_2 = 6379;

            const CLUSTER_IP_3 = process.argv[5];
            const CLUSTER_PORT_3 = 6379;

            client = new Redis.Cluster([{
              port: CLUSTER_PORT_1,
              host: CLUSTER_IP_1
            }, {
              port: CLUSTER_PORT_2,
              host: CLUSTER_PORT_2
            }, {
              port: CLUSTER_PORT_3,
              host: CLUSTER_IP_3
            }]);
        }
    } else if (process.argv[2] == "sentinel") {
        if( process.argv[3] == undefined || process.argv[4] == undefined ) {
            console.log(`Error: Please mention Redis Sentinel node IPs`);
            process.exit(1);
        } else {
            const SENTINEL_IP_1 = process.argv[3];
            const SENTINEL_PORT_1 = 26379;

            const SENTINEL_IP_2 = process.argv[4];
            const SENTINEL_PORT_2 = 26379;

            const MASTER_NODE = "master01"

            client = new Redis({
            sentinels: [{ host: SENTINEL_IP_1, port: SENTINEL_PORT_1 }, { host: SENTINEL_IP_2, port: SENTINEL_PORT_2 }],
            name: MASTER_NODE});
        }
    } else if ( process.argv[2] == "standalone" ) {
        if(process.argv[3] == undefined) {
            console.log(`Error: Please mention Redis Standalone node IP`);
            process.exit(1);
        } else {
            const REDIS_NODE_IP = process.argv[3];
            const REDIS_NODE_PORT = 6379

            client = new Redis({
              port: REDIS_NODE_PORT,
              host: REDIS_NODE_IP
            })
        }
    } else {
        console.log(`Error: Please mention Redis deployment type`);
        process.exit(1);
    }
}


client.on('connect', () => {
    console.log(`Connected to Redis`);
});
client.on('error', err => {
    console.log(`Error: ${err}`);
});


/*
 * Define app routes and reponses
 */

//const API_URL = 'http://api.fixer.io';
const API_URL = 'http://data.fixer.io/api';
const ACC_KEY = 'a1134e4074f11fef4221ee64894b7765';

app.get('/', (req, res) => {
    res.sendFile('index.html', {
        root: path.join(__dirname, 'views')
    });
});

app.get('/rate/:date', (req, res) => {
    const date = req.params.date;
    const url = `${API_URL}/${date}?access_key=${ACC_KEY}&EUR`;
    const countKey = `EUR:${date}:count`,
        ratesKey = `EUR:${date}:rates`;
    console.log('URL: ',url)
    console.log('CountKey: ',countKey)
    console.log('RatesKey: ',ratesKey)
	let count = 1;
	let count1 = 22;
	return client
	.incr(countKey)
	.then(result => {
		count = result;
		return count;
	})
	.then(() => client.get(ratesKey, (err, result) => {
    // If that key exist in Redis store
    if (result) {
      var rates = JSON.parse(result);
	  //console.log('madhu', rates);
      return res.json( {rates: rates.rates, count} );
    } else { // Key does not exist in Redis store
      // Fetch directly from Wikipedia API
      return axios.get(url)
        .then(response => {
          var rates = response.data.rates;
		  //console.log(rates);
          
		  // Save the Wikipedia API response in Redis store
		  client.setex(ratesKey, 3600, JSON.stringify({ rates }));
		  //client.setex(ratesKey, 3600, JSON.stringify({ source: 'Redis Cache', ...responseJSON, }));
		  
          // Send JSON response to client
          return res.json({ rates: response.data.rates, count });
        })
        .catch(err => {
          return res.json(err);
        });
    }
  }));
});


/*
 * Run app
 */
const port = process.env.port || 5000;
app.listen(port, () => {
    console.log(`App listening on port ${port}!`)
});
