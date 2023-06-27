// This simple bot will allow discord messages to appear in your Garry's Mod server,
// as well as the server chat to appear in a Discord channel.

// You may notice I only require the functions I actually use. That's because Discord has made it so you have to specify
// exactly what you need/are doing with your bot. So I said fuck it and I might as well do that with everything :^) 

// We need this to read and write the config file, and the connection log
const { readFileSync, writeFile, appendFile } = require('fs');

// Allows for the gmod server and the bot to communicate
// At the time of writing this, I'm running ws version 8.5.0
const { WebSocketServer } = require('ws');

// Making a bot (duh)
// At the time of making this, I'm running discord.js version 14.11.0
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js'); 

// We use http.get to get Steam avatars. If you don't want avatars, you can comment this out and not install axios from npm.
// At the time of making this, I'm running axios version 1.4.0
const { get } = require('axios');

let config = JSON.parse(readFileSync("./config.json"));

// Constants
const wss = new WebSocketServer({host: '0.0.0.0', port: config.PortNumber}); // We set the host to '0.0.0.0' to tell the server we want to run IPv4 instead of IPv6
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.GuildWebhooks, 
        GatewayIntentBits.MessageContent
    ]
});



// logConnection - Called when someone attempts to connect to the websocket server. Logs it to ./connection_log.txt
function logConnection(ip, status) {
    let date = new Date();
    let timestamp = `[${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()} @ ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}]`;

    let message = `${timestamp} ${status ? 'Accepting' : 'Denying'} websocket connection request from ${ip}`;

    console.log(message);

    if (config.LogConnections) 
        appendFile('./connection_log.txt', message, err => {if (err) console.err(err);});
}

// assignWebhook takes a webhook object and stores it for later
function assignWebhook(wh) {
    webhook = wh; 
    config.Webhook.ID = webhook.id;
    config.Webhook.Token = webhook.token;
}

function saveConfig() {
    writeFile("./config.json", JSON.stringify(config, null, 4), err => {if (err) console.error(err);});
}

// getSteamAvatar checks the avatar cache and refreshes them when needed.
let avatarCache = {};
async function getSteamAvatar(id) {
    if (config.SteamAPIKey.length === 0) // If there is no API key specified, they must not want avatars.
        return;

    let needsRefresh = false;
    if (avatarCache[id]) {
        if (Date.now() - avatarCache[id].lastFetched >= config.SteamAvatarRefreshTime * 60000) {
            needsRefresh = true;
        }
    } else {
        needsRefresh = true;
    }

    if (needsRefresh) {
        let res = await get(`http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${config.SteamAPIKey}&steamids=${id}`).catch(console.error);
        avatarCache[id] = {
            avatar: res.data.response.players[0].avatarfull,
            lastFetched: Date.now()
        };
    }
}

// I use a queueing system to stack up messages to be sent through the webhook. I wait for the previous webhook to send just in case they try to send out of order.
let queue = [];
let runningQueue = false;
async function sendQueue() {
    if (!webhook || runningQueue)
        return; 

    runningQueue = true;

    let i = 0;
    while (i < queue.length) {
        let packet = queue[i];
        if (packet.content.length > 0) {
            let opts = {
                content: packet.content,
                username: `(Gmod) ${packet.from}`
            }
            
            await getSteamAvatar(packet.fromSteamID);
            if (avatarCache[packet.fromSteamID]) 
                opts.avatarURL = avatarCache[packet.fromSteamID].avatar;
            
            await webhook.send(opts).catch(console.error);
            // console.log(opts)
        }
        i++;
    }

    // Made it to the end of the queue, clear it
    queue = [];
    runningQueue = false;
}

// getWebhook creates a webhook object if it can't find one that was stored.
function getWebhook(json) {
    if (!client.isReady()) 
        return;

    client.fetchWebhook(config.Webhook.ID, config.Webhook.Token)
        .then(assignWebhook)
        .catch(() => {
            // Make a new webhook
            if (config.ChannelID.length === 0)
                return console.log("Tried to create a webhook, but no channel has been set yet.");

            let guild = client.guilds.resolve(config.GuildID);
            if (guild) {
                guild.channels.createWebhook({
                    channel: config.ChannelID,
                    name: "Dickord Communication Relay"
                })
                    .then(wh => {assignWebhook(wh); saveConfig()})
                    .catch(console.error);
                // let channel = guild.channels.resolve(config.ChannelID);
                // if (channel) {
                //     channel.createWebhook({name: "Discord Communication Relay", reason: "Opening communication with a Garry's Mod server"})
                //         .then(wh => {assignWebhook(wh); saveConfig();})
                //         .catch(console.error);
                // }
            }
        });

    if (webhook && json) {
        if (json instanceof Array) { // When the gmod server loses connection to the websocket, it stores them in an array and sends them all when connection is reestablished
            for (let i = 0; i < json.length; i++) {
                queue.push(json[i]);
            }
            sendQueue();
        } else if (json instanceof Object) {
            queue.push(json);
            sendQueue();
        }
    }
}

// Websocket server stuff
let webhook;

let relaySocket;
wss.shouldHandle = req => {
    let ip = req.socket.remoteAddress;
    if (ip === "127.0.0.1") 
        ip = "localhost";

    let accepting = ip === config.ServerIP;

    logConnection(ip, accepting);
    
    return accepting;
};

wss.on('connection', async ws => {
    relaySocket = ws;

    relaySocket.on('message', buf => {
        console.log('Message received from Websocket connection to server.');
        
        let json;
        try {
            json = JSON.parse(buf.toString());
        } catch(err) {
            console.log("Invalid JSON received from server.");
        }

        if (!webhook) {
            getWebhook(json);
        } else {
            if (json instanceof Array) { // From a queue of message from a lost connection
                for (let i = 0; i < json.length; i++) {
                    queue.push(json[i]);
                }
                sendQueue();
            } else if (json instanceof Object) {
                queue.push(json);
                sendQueue();
            }
        }
    });
});

wss.on('close', () => console.log('Websocket server connection closed.'));
wss.on('error', err => console.log('Error occured in websocket server:\n' + err.stack));


// Discord stuff
client.on('messageCreate', message => {
    if (message.author.bot)
        return; // Do nothing for bots

    if (message.member.permissions.has(PermissionsBitField.Flags.ManageGuild, true) && message.content.toLowerCase() === "--setgmodchannel") {
        config.ChannelID = message.channel.id;
        config.GuildID   = message.guild.id;
        saveConfig();
        message.react('✅');
    } else { 
        if (message.channel.id === config.ChannelID) {
            if (relaySocket) {
                if (relaySocket.readyState == 1) { // 1 means open, we can communicate to the server
                    let data = {};
                    data.color = message.member.displayHexColor;
                    data.author = (typeof message.member.nickname === "string" ? message.member.nickname : (typeof message.author.displayName === "string" ? message.author.displayName : message.author.username));
                    data.content = message.content;
                    if (data.content.length === 0)
                        data.content = "[attachment]";
                    relaySocket.send(Buffer.from(JSON.stringify(data)));
                }
            }
        }
    }
});

client.on('ready', () => {
    console.log("Bot initialized");

    // Get a webhook object
    getWebhook();
});

client.login(config.DiscordBotToken);