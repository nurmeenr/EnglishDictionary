const express = require('express')
const https = require('https')
const app = express()
const port = 3000

app.use(express.static('public'))
app.use('/css', express.static(__dirname + "public/css"))
app.use('/js', express.static(__dirname + "public/js"))
app.use('/images', express.static(__dirname + "public/images"))

app.use(express.json()); // to support JSON-encoded bodies
app.use(express.urlencoded({ // to support URL-encoded bodies
    extended: false
}));

app.set('views', './views')
app.set('view engine', 'ejs')

app.get('/', (req, res) => {
    res.render('index')
})

app.get('/dictionary', (req, res) => {
    res.render('main')
})

app.post('/logout', function(req, res) {
    res.redirect('/')
})

app.post('/request', function(req, res) {
    var MongoClient = require('mongodb').MongoClient;
    var url = "mongodb+srv://nurmeen:123@cluster0.i8inf.mongodb.net/test?authSource=admin&replicaSet=atlas-amnv72-shard-0&readPreference=primary&appname=MongoDB%20Compass&ssl=true";
    var client = new MongoClient(url)
    var date = new Date();
    var success = false;

    async function check() {
        try {
            await client.connect();
            const database = client.db("dictionary");
            const store_collection = database.collection("store");

            const cursor = store_collection.find();

            await cursor.forEach(function(item) {
                if (item.word == req.body.word && (date.getTime() - item.access_time) / 1000 / 60 < 10) {
                    success = true;
                    res.json({ definition: item.definition, visual: item.visual });
                    return;
                }
            });
        } finally {
            await client.close();
        }
    }

    check().then(response => {
        if (!success) {
            https.get('https://www.dictionaryapi.com/api/v3/references/collegiate/json/' + req.body.word + '?key=4ac9aa94-a6e0-4dff-a5d1-fd8e1fc0bf00', http_res => {
                let data = [];

                http_res.on('data', chunk => {
                    data.push(chunk);
                });

                http_res.on('end', () => {
                    const parsed_json = JSON.parse(Buffer.concat(data).toString());

                    var definiton_value = parseJSON(parsed_json, 'dt');
                    var visual_value = parseJSON(parsed_json, 'artid');

                    if (visual_value) {
                        visual_value = "https://www.merriam-webster.com/assets/mw/static/art/dict/" + visual_value + ".gif"
                    } else {
                        visual_value = "images/default.png"
                    }

                    if (definiton_value) {
                        async function insert() {
                            try {
                                await client.connect();

                                const database = client.db("dictionary");
                                const store_collection = database.collection("store");

                                var time = date.getTime();

                                var store = {
                                    'word': req.body.word,
                                    'definition': definiton_value[0][1],
                                    'visual': visual_value,
                                    'access_time': time
                                };

                                await store_collection.insertOne(store)
                            } finally {
                                await client.close();
                            }
                        }

                        insert().then(response => {
                            res.json({ definition: definiton_value[0][1], visual: visual_value });
                        });
                    }
                });
            }).on('error', err => {
                console.log('Error: ', err.message);
            });
        }
    });
})

app.post('/login', function(req, res) {
    var username = req.body.loginUser;
    var password = req.body.loginPassword;

    var MongoClient = require('mongodb').MongoClient;
    var url = "mongodb+srv://nurmeen:123@cluster0.i8inf.mongodb.net/test?authSource=admin&replicaSet=atlas-amnv72-shard-0&readPreference=primary&appname=MongoDB%20Compass&ssl=true";
    var success = false;

    const client = new MongoClient(url)

    async function run() {
        try {
            await client.connect();
            const database = client.db("dictionary");
            const accounts_collection = database.collection("accounts");

            const cursor = accounts_collection.find();

            await cursor.forEach(function(item) {
                if (item.username == username && item.password == password) {
                    success = true;
                }
            });
        } finally {
            await client.close();
        }
    }

    run().then(response => {
        if (success) {
            res.redirect('/dictionary')
        } else {
            res.json({ error: "Username or password is incorrect" });
        }
    });
})

app.post('/register', function(req, res) {
    var username = req.body.email2;
    var password = req.body.loginPassword2;

    if (password.length < 8) {
        res.json({ error: "Password should be atleast 8 characters" });
        return;
    }

    var MongoClient = require('mongodb').MongoClient;
    var url = "mongodb+srv://nurmeen:123@cluster0.i8inf.mongodb.net/test?authSource=admin&replicaSet=atlas-amnv72-shard-0&readPreference=primary&appname=MongoDB%20Compass&ssl=true";

    const client = new MongoClient(url)

    async function run() {
        try {
            await client.connect();

            const database = client.db("dictionary");
            const accounts_collection = database.collection("accounts");

            var account = {
                'username': username,
                'password': password
            };

            await accounts_collection.insertOne(account)
        } finally {
            await client.close();
        }
    }

    run().then(response => {
        res.redirect('/')
    });
})


app.listen(port, () => console.log("Listening on port 3000"))

function parseJSON(jsonObj, key) {
    var result = null;
    if (jsonObj instanceof Array) {
        for (var i = 0; i < jsonObj.length; i++) {
            result = parseJSON(jsonObj[i], key);
            if (result) {
                break;
            }
        }
    } else {
        for (var property in jsonObj) {
            if (property == key) {
                return jsonObj[property];
            }
            if (jsonObj[property] instanceof Object || jsonObj[property] instanceof Array) {
                result = parseJSON(jsonObj[property], key);
                if (result) {
                    break;
                }
            }
        }
    }
    return result;
}