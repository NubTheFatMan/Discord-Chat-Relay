// This simple bot will allow discord messages to appear in your Garry's Mod server,
// as well as the server chat to appear in a Discord channel.

// You may notice I only require the functions I actually use. That's because Discord has made it so you have to specify
// exactly what you need/are doing with your bot. So I said fuck it and I might as well do that with everything :^) 

// We need this to read and write the config file, and the connection log
const { readFileSync, writeFile, appendFile, writeFileSync, existsSync, unlink } = require('fs');

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
        let res = await get(`http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${config.SteamAPIKey}&steamids=${id}`);
        avatarCache[id] = {
            avatar: res.data.response.players[0].avatarfull,
            lastFetched: Date.now()
        };
    }
}

// I use a queueing system to stack up messages to be sent through the webhook. I wait for the previous webhook to send just in case they try to send out of order.
let queue = [];
let runningQueue = false;
let replyInteraction;
async function sendQueue() {
    if (!webhook || runningQueue)
        return; 

    runningQueue = true;

    for (let i = 0; i < queue.length; i++) {
        let packet = queue[i];
        switch (packet.type) {
            case "message": {
                if (packet.content.length > 0) {
                    let opts = {
                        content: packet.content,
                        username: `(Gmod) ${packet.from}`
                    }
                    
                    await getSteamAvatar(packet.fromSteamID);
                    if (avatarCache[packet.fromSteamID]) 
                        opts.avatarURL = avatarCache[packet.fromSteamID].avatar;
                    
                    await webhook.send(opts);
                }
            } break;

            case "join/leave": {
                let options = {
                    username: "Gmod Player Connected"
                }
                // 1 = join, 2 = spawn, 3 = leave
                switch (packet.messagetype) {
                    case 1: {
                        options.content = `${packet.username} (${packet.usersteamid}) has connected to the server.`;
                    } break;

                    case 2: {
                        let spawnText = '';

                        if (packet.userjointime) {
                            let spawnTime = Math.round(Date.now()/1000) - packet.userjointime;
                            let minutes = Math.floor(spawnTime / 60);
                            let seconds = spawnTime % 60;
                            spawnText = ` (took ${minutes}:${seconds < 10 ? `0${seconds}` : seconds})`;
                        }

                        options.content = `${packet.username} (${packet.usersteamid}) has spawned into the server${spawnText}.`
                    } break;

                    case 3: {
                        options.content = `${packet.username} (${packet.usersteamid}) has left the server (${packet.reason}).`
                    } break;
                }

                await webhook.send(options);
            } break;

            case "status": {
                if (!replyInteraction) return;

                let [name, steamid, joined, status] = ['Name', 'Steam ID', 'Time Connected', "Status"];

                let maxNameLength    = name.length;
                let maxSteamidLength = steamid.length;
                let maxJoinTimestamp = joined.length;
                let maxStatus        = status.length

                let rows = [];

                let now = Math.round(Date.now()/1000);
                for (let i = 0; i < packet.connectingPlayers.length; i++) {
                    let data = packet.connectingPlayers[i];

                    let timeString = 'Unknown';
                    if (data[2]) {
                        let timeOnServer = now - data[2];
                        let hours = Math.floor(timeOnServer / 60 / 60);
                        let minutes = Math.floor(timeOnServer / 60) % 60;
                        let seconds = timeOnServer % 60;

                        timeString = `${hours}:${minutes < 10 ? `0${minutes}` : minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
                    }

                    let currentStatus = "Connecting";
                    maxNameLength    = Math.max(maxNameLength, data[0].length);
                    maxSteamidLength = Math.max(maxSteamidLength, data[1].length);
                    maxJoinTimestamp = Math.max(maxJoinTimestamp, timeString.length);
                    maxStatus        = Math.max(maxStatus, currentStatus.length);

                    rows.push([data[0], data[1], timeString, currentStatus]);
                }

                for (let i = 0; i < packet.players.length; i++) {
                    let data = packet.players[i];

                    let timeString = 'Unknown';
                    if (data[2]) {
                        let timeOnServer = now - data[2];
                        let hours = Math.floor(timeOnServer / 60 / 60);
                        let minutes = Math.floor(timeOnServer / 60) % 60;
                        let seconds = timeOnServer % 60;

                        timeString = `${hours}:${minutes < 10 ? `0${minutes}` : minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
                    }

                    let currentStatus = "In Server";
                    maxNameLength    = Math.max(maxNameLength, data[0].length);
                    maxSteamidLength = Math.max(maxSteamidLength, data[1].length);
                    maxJoinTimestamp = Math.max(maxJoinTimestamp, timeString.length);
                    maxStatus        = Math.max(maxStatus, currentStatus.length);

                    rows.push([data[0], data[1], timeString, currentStatus]);
                }

                let linesOfText = [
                    `| ${name + ' '.repeat(maxNameLength - name.length)} | ${steamid + ' '.repeat(maxSteamidLength - steamid.length)} | ${joined + ' '.repeat(maxJoinTimestamp - joined.length)} | ${status + ' '.repeat(maxStatus - status.length)} |`,
                    `|${'-'.repeat(maxNameLength + 2)}|${'-'.repeat(maxSteamidLength + 2)}|${'-'.repeat(maxJoinTimestamp + 2)}|${'-'.repeat(maxStatus + 2)}|`
                ];

                for (let i = 0; i < rows.length; i++) {
                    let row = rows[i];
                    linesOfText.push(`| ${row[0] + ' '.repeat(maxNameLength - row[0].length)} | ${row[1] + ' '.repeat(maxSteamidLength - row[1].length)} | ${row[2] + ' '.repeat(maxJoinTimestamp - row[2].length)} | ${row[3] + ' '.repeat(maxStatus - row[3].length)} |`);
                }

                replyInteraction.editReply(`Playing on map ${packet.map}\`\`\`\n${linesOfText.join('\n')}\`\`\``).then(() => replyInteraction = undefined);
            }
        }
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
        .then(wh => {
            assignWebhook(wh);
            if (json == true) {
                let webhookOptions = {
                    username: "Websocket Status",
                    content: "Bot started. "
                }

                if (existsSync('./error.txt')) {
                    webhookOptions.content += `Bot has just restarted from a crash:\`\`\`\n${readFileSync('./error.txt')}\`\`\``;
                    unlink('./error.txt', error => {
                        if (error) {
                            console.log("Unable to delete error.txt. Previous crash report will reprint on next restart unless you manually delete the file");
                            console.error(error);
                        }
                    });
                }
                
                webhookOptions.content += "Awaiting server connection...";
                wh.send(webhookOptions);
            }
        })
        .catch(() => {
            // Make a new webhook
            if (config.ChannelID.length === 0)
                return console.log("Tried to create a webhook, but no channel has been set yet.");

            let guild = client.guilds.resolve(config.GuildID);
            if (guild) {
                guild.channels.createWebhook({
                    channel: config.ChannelID,
                    name: "Dickord Communication Relay"
                }).then(wh => {assignWebhook(wh); saveConfig();});
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

    if (webhook) {
        webhook.send({
            username: "Websocket Status",
            content: "Connection to server established."
        });
    }

    relaySocket.on('message', buf => {
        // console.log('Message received from Websocket connection to server.');
        
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

    relaySocket.on('error', error => {
        console.log("Error occured in relay socket")
        console.error(error);

        if (webhook) {
            webhook.send({
                username: "Error Reporting",
                content: `Error occured in the relay socket:\`\`\`\n${error.stack}\`\`\``
            });
        }
    });
    relaySocket.on('close', () => {
        console.log("Connection to server closed.");
        if (webhook) {
            webhook.send({
                username: "Websocket Status",
                content: "Connection to server closed. Awaiting reconnect..."
            });
        }
    });
});

wss.on('error', async err => {
    console.log('Error occured in websocket server:');
    console.error(err);

    if (webhook) {
        await webhook.send({
            username: "Error Reporting",
            content: `Error occured in websocket server:\`\`\`\n${err.stack}\`\`\`Restarting`
        });
    }
    process.exit();
});
wss.on('close', async () => {
    console.log("Websocket server closed. What the..");
    if (webhook) {
        await webhook.send({
            username: "Error Reporting",
            content: "Websocket server closed for an unknown reason. Restarting..."
        });
    }
    process.exit();
});


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
        if (message.channel.id === config.ChannelID && !message.system) {
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

client.on('interactionCreate', interaction => {
    if (interaction.isCommand() && interaction.commandName === "status") {
        if (relaySocket?.readyState !== 1) 
            return interaction.reply('There is currently no connection to the server. Unable to request status.');

        interaction.reply('Requesting server status...').then(() => {
            if (relaySocket?.readyState !== 1) return;

            replyInteraction = interaction;

            relaySocket.send(Buffer.from(JSON.stringify({requestStatus: true})));
        });
    }
});

client.on('ready', () => {
    console.log("Bot initialized");

    getWebhook(true);

    client.application.commands.set([{
        name: "status",
        description: "View how many players are on the server along with the map."
    }]);
});

process.on('unhandledRejection', async (reason, promise) => {
    console.error(reason);
    if (client.isReady() && webhook) {
        await webhook.send({
            username: "Error Reporting",
            content: `Unhandled promise rejection:\`\`\`\n${reason.stack}\`\`\``
        });
    }
});

process.on('uncaughtException', (error, origin) => {
    if (origin !== "uncaughtException") return;
    
    console.error(error);
    writeFileSync('./error.txt', error.stack);
    process.exit();
});

client.login(config.DiscordBotToken);