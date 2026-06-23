// This simple bot will allow discord messages to appear in your Garry's Mod server,
// as well as the server chat to appear in a Discord channel.

// You may notice I only require the functions I actually use. That's because Discord has made it so you have to specify
// exactly what you need/are doing with your bot. So I said fuck it and I might as well do that with everything :^) 

// We need this to read and write the config file, and the connection log
const { readFileSync, writeFile, appendFile, writeFileSync, existsSync, unlink, lstatSync } = require('fs');

// Allows for the gmod server and the bot to communicate
// At the time of writing this, I'm running ws version 8.5.0
const { WebSocketServer } = require('ws');

// Making a bot (duh)
// At the time of making this, I'm running discord.js version 14.11.0
const { Client, GatewayIntentBits, User, GuildMember } = require('discord.js'); 

// We use http.get to get Steam avatars. If you don't want avatars, you can comment this out and not install axios from npm.
// At the time of making this, I'm running axios version 1.4.0
const { get } = require('axios');

let config = require("./config.js");
let webhookData = JSON.parse(readFileSync("./ids.json"));

// Constants
const wss = new WebSocketServer({host: '0.0.0.0', port: config.PortNumber, clientTracking: true}); // We set the host to '0.0.0.0' to tell the server we want to run IPv4 instead of IPv6
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.GuildWebhooks, 
        GatewayIntentBits.MessageContent
    ]
});

let pingMissed = 0;
// let pingSent = 0;
let pingReceived = false;
function pingServer() {
    if (relaySocket?.readyState !== 1) {
        pingMissed = 0;
        pingSent = 0;
        pingReceived = false;
        return;   
    }

    if (!pingReceived)
        pingMissed++

    if (pingMissed >= config.PingTimeout) {
        relaySocket.close();
        if (webhook) {
            webhook.send({
                username: config.Language.NameWebsocketStatus,
                content: config.Language.ConnectionClosedNoPing
            });
        }
        return;
    }

    pingReceived = false;

    relaySocket.send(Buffer.from('{"type":"ping"}'));
    // pingSent = Date.now();
}


// logConnection - Called when someone attempts to connect to the websocket server. Logs it to ./connection_log.txt
function logConnection(ip, status) {
    let date = new Date();
    let timestamp = `[${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()} @ ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}]`;

    let message = `\n${timestamp} ${status ? 'Accepting' : 'Denying'} websocket connection request from ${ip}`;

    console.log(message);

    if (config.LogConnections) 
        appendFile('./connection_log.txt', message, err => {if (err) console.err(err);});
}

// assignWebhook takes a webhook object and stores it for later
function assignWebhook(wh) {
    webhook = wh; 
    webhookData.Webhook.ID = webhook.id;
    webhookData.Webhook.Token = webhook.token;
}

function saveIds() {
    writeFile("./ids.json", JSON.stringify(webhookData, null, 4), err => {if (err) console.error(err);});
}

let stringVarRegex = /\$[a-zA-Z]+/g;

// getSteamAvatar checks the avatar cache and refreshes them when needed.
let avatarCache = {};
async function getSteamAvatar(id, name) {
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
        try {
            let res = await get(`http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${config.SteamAPIKey}&steamids=${id}`);
            avatarCache[id] = {
                avatar: res.data.response.players[0].avatarfull,
                lastFetched: Date.now()
            };
        } catch (error) {
            // let errMsg = `Unabled to get Steam avatar for ${name} (${id}): Steam API responded with ${error.status}`;
            let statusCode = error.message.match(/[0-9]+/);

            if (statusCode) 
                statusCode = statusCode[0];
            else
                statusCode = error.message;

            let errMsg = config.Language.ErrorAxiosGet.replace(stringVarRegex, match => {
                switch (match.substring(1)) {
                    case "name": return name;
                    case "id":   return id;
                    case "code": return statusCode;
                    default:     return match;
                }
            });

            if (statusCode == 429) errMsg += config.Language.ErrorAxios429;
            console.log(errMsg);

            if (client.isReady() && webhook) {
                await webhook.send({
                    username: config.Language.NameErrorReporting,
                    content: errMsg
                });
            }
        }
    }
}

// Removes formatting from text.
function removeFormatting(str) {
    let escapeCharacters = /(```|[*_#|>`])/g;
    return str.replace(escapeCharacters, match => {
        switch (match) {
            case "*": return "\\*";
            case "_": return "\\_";
            case "#": return "\\#";
            case "|": return "\\|";
            case ">": return "\\>";
            case "```": return "\\```";
            case "`": return "\\`";
            default: return match;
        }
    });
}

/*
    Formats an object for printing on Discord
    obj format: {"Key 1": ["Value 1", "Value 2"], "Key 2": ["Value 3", "Value 4"]}. Arrays must be same length
    alignment format: {"Key 2": 1} where any key that == 1 is aligned to the right, otherwise aligned to the left

    Example: tablePrint({test1: ["1", "2"], test2: ["123456", "789"]}, {test2: 1}) prints the following:
    | test1 | test2  |
    |-------|--------|
    | 1     | 123456 |
    | 2     |    789 |
*/
function tablePrint(obj, alignment = {}) {
    let keys = Object.keys(obj);
    let maxLength = {};
    for (let key of keys) {
        maxLength[key] = key.length;
        for (let value of obj[key]) {
            maxLength[key] = Math.max(maxLength[key], value.length);
        }
    }

    let rows = [];

    let firstRow = [];
    let secondRow = [];
    for (let key of keys) {
        firstRow.push(key + ' '.repeat(Math.max(0, maxLength[key] - key.length)));
        secondRow.push('-'.repeat(Math.max(0, maxLength[key])));
    }
    rows.push(`| ${firstRow.join(' | ')} |`);
    rows.push(`|-${secondRow.join('-|-')}-|`);

    // Each obj[key] is expected to have the same length
    for (let i = 0; i < obj[keys[0]].length; i++) {
        let line = [];
        for (let key of keys) {
            let val = obj[key][i];
            line.push(alignment[key] === 1 ? ' '.repeat(Math.max(0, maxLength[key] - val.length)) + val : val + ' '.repeat(Math.max(0, maxLength[key] - val.length)));
        }
        rows.push(`| ${line.join(' | ')} |`);
    }

    return rows.join('\n')
}

function formatTime(timeInSeconds = 0) {
    let hours = Math.floor(timeInSeconds / 60 / 60);
    let minutes = Math.floor(timeInSeconds / 60) % 60;
    let seconds = Math.floor(timeInSeconds % 60);

    let timeArray = [];
    if (hours > 0) timeArray.push(hours);
    timeArray.push(minutes < 10 && hours > 0 ? `0${minutes}` : minutes);
    timeArray.push(seconds < 10 ? `0${seconds}` : seconds);
    return timeArray.join(':');
}

// I use a queueing system to stack up messages to be sent through the webhook. I wait for the previous webhook to send just in case they try to send out of order.
let queue = [];
let runningQueue = false;
let replyInteraction;
let statusTimeout;
let waitingForReply = false;
let statsInteraction;
let statsTimeout;
let waitingForStats = false;
async function sendQueue() {
    if (!webhook || runningQueue)
        return; 

    runningQueue = true;

    // Any message from the server indicates it's connected, count it as a ping so it doesn't disconnect.
    pingReceived = true;
    pingMissed = 0;

    for (let i = 0; i < queue.length; i++) {
        let packet = queue[i];
        switch (packet.type) {
            case "message": {
                if (packet.content.trim().length > 0) {
                    let name = packet.from.replaceAll('```', ''); // Omit code block starters. Discord doesn't allow them in names
                    if (name.length > 32) 
                        name = name.substring(0, 29) + '...';

                    let opts = {
                        content: removeFormatting(packet.content.trim()),
                        username: name
                    }
                    
                    await getSteamAvatar(packet.fromSteamID, packet.from);
                    if (avatarCache[packet.fromSteamID]) 
                        opts.avatarURL = avatarCache[packet.fromSteamID].avatar;
                    
                    await webhook.send(opts);
                }
            } break;

            case "join/leave": {
                let options = {
                    username: config.Language.NamePlayerConnectionStatus
                }
                // 1 = join, 2 = spawn, 3 = leave
                switch (packet.messagetype) {
                    case 1: {
                        options.content = config.Language.PlayerConnected.replace(stringVarRegex, match => {
                            switch (match.substring(1)) {
                                case "name":    return removeFormatting(packet.username);
                                case "steamid": return packet.usersteamid;
                                default:        return match;
                            }
                        });
                    } break;

                    case 2: {
                        let timeTaken;
                        if (packet.userjointime) {
                            let spawnTime = Math.round(Date.now()/1000) - packet.userjointime;
                            let minutes = Math.floor(spawnTime / 60);
                            let seconds = spawnTime % 60;
                            let time = `${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
                            timeTaken = config.Language.TimeTaken.replace(stringVarRegex, match => {
                                switch (match.substring(1)) {
                                    case "time": return time;
                                    default:     return match;
                                }
                            });
                        }

                        let lastJoined;
                        if (packet.lastplay) {
                            let timeSinceLastPlayed = Math.round(Date.now()/1000) - packet.lastplay;
                            let hours = Math.floor(timeSinceLastPlayed / 60 / 60);
                            let minutes = Math.floor(timeSinceLastPlayed / 60) % 60;
                            let seconds = timeSinceLastPlayed % 60
                            
                            let timeArray = [];
                            if (hours > 0) timeArray.push(hours);
                            timeArray.push(minutes < 10 && hours > 0 ? `0${minutes}` : minutes);
                            timeArray.push(seconds < 10 ? `0${seconds}` : seconds);

                            let lastName;
                            if (packet.lastname != packet.username) {
                                lastName = config.Language.LastName.replace(stringVarRegex, match => {
                                    switch(match.substring(1)) {
                                        case "previousname": return removeFormatting(packet.lastname);
                                        default:             return match;
                                    }
                                });
                            }

                            lastJoined = config.Language.LastJoined.replace(stringVarRegex, match => {
                                switch(match.substring(1)) {
                                    case "timesince": return timeArray.join(':');
                                    case "date":      return `<t:${packet.lastplay}:F>`;
                                    case "LastName":  return lastName ?? "";
                                    default:          return match;
                                }
                            });
                        }

                        options.content = config.Language.PlayerSpawned.replace(stringVarRegex, match => {
                            switch (match.substring(1)) {
                                case "name":       return removeFormatting(packet.username);
                                case "steamid":    return packet.usersteamid;
                                case "TimeTaken":  return timeTaken ?? "";
                                case "LastJoined": return lastJoined ?? "";
                                default:           return match;
                            }
                        });
                        // options.content += '```json\n' + JSON.stringify(packet, null, 2) + '```';
                    } break;

                    case 3: {
                        options.content = config.Language.PlayerLeft.replace(stringVarRegex, match => {
                            switch (match.substring(1)) {
                                case "name":    return removeFormatting(packet.username);
                                case "steamid": return packet.usersteamid;
                                case "reason":  return removeFormatting(packet.reason);
                                default:        return match;
                            }
                        });
                    } break;
                }

                options.content = options.content;
                await webhook.send(options);
            } break;

            case "autostatus":
            case "status": {
                if (statusTimeout) 
                    clearTimeout(statusTimeout);

                if (packet.type === "status" && (!replyInteraction || !waitingForReply)) return;

                let [name, steamid, joined, status] = config.Language.StatusTable;

                let maxNameLength    = name.length;
                let maxSteamidLength = steamid.length;
                let maxJoinTimestamp = joined.length;
                let maxStatus        = status.length

                let rows = [];
                let now = Math.round(Date.now()/1000);
                
                packet.players.sort((a, b) => {
                    if (a.jointime && b.jointime)
                        return b.jointime - a.jointime;
                    return 0;
                });

                for (let i = 0; i < packet.players.length; i++) {
                    let data = packet.players[i];
                    let timeString = config.Language.StatusUnknownTime;
                    if (data.jointime) {
                        let timeOnServer = Math.round(data.jointime);
                        let hours = Math.floor(timeOnServer / 60 / 60);
                        let minutes = Math.floor(timeOnServer / 60) % 60;
                        let seconds = timeOnServer % 60;

                        let timeArray = [];
                        if (hours > 0) timeArray.push(hours);
                        timeArray.push(minutes < 10 && hours > 0 ? `0${minutes}` : minutes);
                        timeArray.push(seconds < 10 ? `0${seconds}` : seconds);
                        timeString = timeArray.join(':');
                    }

                    let currentStatus = config.Language.StatusActive;
                    if (data.afktime) {
                        let timeAFK = now - data.afktime;
                        let hours = Math.floor(timeAFK / 60 / 60);
                        let minutes = Math.floor(timeAFK / 60) % 60;
                        let seconds = timeAFK % 60;

                        let timeArray = [];
                        if (hours > 0) timeArray.push(hours);
                        timeArray.push(minutes < 10 && hours > 0 ? `0${minutes}` : minutes);
                        timeArray.push(seconds < 10 ? `0${seconds}` : seconds);
                        let afkTimeString = timeArray.join(':');
                    
                        currentStatus = config.Language.StatusAFK.replace(stringVarRegex, match => {
                            switch (match.substring(1)) {
                                case "time": return afkTimeString;
                                default:     return match;
                            }
                        });
                    }

                    data.name = data.name.replaceAll('```', '`\u2063`\u2063`');

                    maxNameLength    = Math.max(maxNameLength,    data.name.length);
                    maxSteamidLength = Math.max(maxSteamidLength, data.steamid.length);
                    maxJoinTimestamp = Math.max(maxJoinTimestamp, timeString.length);
                    maxStatus        = Math.max(maxStatus,        currentStatus.length);

                    rows.push([data.name, data.steamid, timeString, currentStatus]);
                }

                packet.connectingPlayers.sort((a, b) => {
                    if (a[2] && b[2])
                        return b[2] - a[2];
                    return 0;
                });
                for (let i = 0; i < packet.connectingPlayers.length; i++) {
                    let data = packet.connectingPlayers[i];

                    let timeString = config.Language.StatusUnknownTime;
                    if (data[2]) {
                        let timeOnServer = now - data[2];
                        let hours = Math.floor(timeOnServer / 60 / 60);
                        let minutes = Math.floor(timeOnServer / 60) % 60;
                        let seconds = timeOnServer % 60;

                        let timeArray = [];
                        if (hours > 0) timeArray.push(hours);
                        timeArray.push(minutes < 10 && hours > 0 ? `0${minutes}` : minutes);
                        timeArray.push(seconds < 10 ? `0${seconds}` : seconds);
                        timeString = timeArray.join(':');
                    }

                    data[0] = data[0].replaceAll('```', '`\u2063`\u2063`');

                    let currentStatus = config.Language.StatusConnecting;
                    maxNameLength     = Math.max(maxNameLength,    data[0].length);
                    maxSteamidLength  = Math.max(maxSteamidLength, data[1].length);
                    maxJoinTimestamp  = Math.max(maxJoinTimestamp, timeString.length);
                    maxStatus         = Math.max(maxStatus,        currentStatus.length);

                    rows.push([data[0], data[1], timeString, currentStatus]);
                }

                let linesOfText = [
                    `| ${name + ' '.repeat(maxNameLength - name.length)} | ${steamid + ' '.repeat(maxSteamidLength - steamid.length)} | ${joined + ' '.repeat(maxJoinTimestamp - joined.length)} | ${status + ' '.repeat(maxStatus - status.length)} |`,
                    `|${'-'.repeat(maxNameLength + 2)}|${'-'.repeat(maxSteamidLength + 2)}|${'-'.repeat(maxJoinTimestamp + 2)}|${'-'.repeat(maxStatus + 2)}|`
                ];

                for (let i = 0; i < rows.length; i++) {
                    let row = rows[i];
                    let mn = Math.max(0, maxNameLength - row[0].length);
                    let msi = Math.max(0, maxSteamidLength - row[1].length);
                    let mj = Math.max(0, maxJoinTimestamp - row[2].length);
                    let ms = Math.max(0, maxStatus - row[3].length);
                    
                    // Add spaces for empty characters
                    let matches = row[0].match(/\u2063/g);
                    if (matches) mn += matches.length;

                    linesOfText.push(`| ${row[0] + ' '.repeat(mn)} | ${row[1] + ' '.repeat(msi)} | ${' '.repeat(mj) + row[2]} | ${row[3] + ' '.repeat(ms)} |`);
                }

                let firstLine = config.Language.StatusResponse.replace(stringVarRegex, match => {
                    switch (match.substring(1)) {
                        case "connectingPlayers": return packet.connectingPlayers.length;
                        case "spawnedPlayers":    return packet.players.length;
                        case "allPlayers":        return packet.connectingPlayers.length + packet.players.length;
                        case "playerLimit":       return packet.playerlimit;
                        case "map":               return packet.map;
                        default:                  return match;
                    }
                });
                
                let msgContent = firstLine + '```\n' + linesOfText.join('\n') + '```';
                let minified = false;

                // Message is to long, rebuild the lines of text to have reduced detail.
                if (msgContent.length >= 2000) {
                    minified = true;
                    msgContent = firstLine + "\n" + config.Language.StatusTooLongMinify;

                    let minLinesOfText = [
                        `| ${name + ' '.repeat(maxNameLength - name.length)} | ${joined + ' '.repeat(maxJoinTimestamp - joined.length)} |`,
                        `|${'-'.repeat(maxNameLength + 2)}|${'-'.repeat(maxJoinTimestamp + 2)}|`
                    ];
    
                    for (let i = 0; i < rows.length; i++) {
                        let row = rows[i];
                        let mn = Math.max(0, maxNameLength - row[0].length);
                        let mj = Math.max(0, maxJoinTimestamp - row[2].length);
                        minLinesOfText.push(`| ${row[0] + ' '.repeat(mn)} | ${row[2] + ' '.repeat(mj)} |`);
                    }

                    msgContent += '```\n' + minLinesOfText.join('\n') + '```';
                }

                if (msgContent.length >= 2000) {
                    minified = true;
                    msgContent = firstLine + "\n" + config.Language.StatusStillTooLong;
                }

                if (packet.type === "status") {
                    await replyInteraction.editReply(msgContent);
    
                    if (minified)
                        await replyInteraction.channel.send({content: config.Language.StatusTooLongFullReport, files: [{name: "status-report.txt", attachment: Buffer.from(linesOfText.join('\n'))}]});
                } else {
                    let toSend = {}
                    toSend.username = config.Language.NameAutoStatus;
                    toSend.content = firstLine + '```\n' + linesOfText.join('\n') + '```';
                    if (toSend.content.length >= 2000) {
                        toSend.content = firstLine;
                        toSend.files = [{name: "status-report.txt", attachment: Buffer.from(linesOfText.join('\n'))}];
                    }

                    webhook.send(toSend);
                }

                if (packet.type === "status") {
                    waitingForReply = false;
                    replyInteraction = undefined;
                }
            } break;

            case "plystats": {
                if (statsTimeout) 
                    clearTimeout(statsTimeout);

                if (!statsInteraction || !waitingForStats) return;

                writeFile('./playerstats.json', JSON.stringify(packet.stats), err => {if (err) console.error(err);});
                
                let [name, playtime, kd] = ["Name", "Playtime (actual/AFK)", "K/D Ratio (Kills/Deaths)"];
                let statsTable = {}
                statsTable[name] = [];
                statsTable[playtime] = [];
                statsTable[kd] = [];

                let players = [];
                if (packet.connectedPlayers) {
                    for (let id of packet.connectedPlayers) {
                        if (packet.stats[id])
                            players.push(packet.stats[id]);
                    }
                } else {

                }

                switch(packet.sort) {
                    // actual playtime
                    case 0: players.sort((a, b) => b.playtime - a.playtime); break;
                        
                    // afk playtime
                    case 1: players.sort((a, b) => b.afktime - a.afktime); break;

                    // total playtime
                    case 2: players.sort((a, b) => (b.playtime + b.afktime) - (a.playtime + a.afktime)); break;

                    // kills
                    case 3: players.sort((a, b) => b.kills - a.kills); break;
                    
                    // deaths
                    case 4: players.sort((a, b) => b.deaths - a.deaths); break;
                    
                    // k/d ratio
                    case 5: players.sort((a, b) => (b.kills/Math.max(b.deaths, 1)) - (a.kills/Math.max(a.deaths, 1))); break;
                }

                for (let i = 0; i < packet.connectedPlayers?.length ?? 10; i++) {
                    let ply = players[i];
                    if (!(ply instanceof Object)) break;

                    statsTable[name].push(removeFormatting(ply.lastname));
                    statsTable[playtime].push(`${formatTime(ply.playtime + ply.afktime)} total (${formatTime(ply.playtime)} actual/${formatTime(ply.afktime)} AFK)`);
                    statsTable[kd].push(`${(ply.kills/Math.max(ply.deaths, 1)).toFixed(4)} (${ply.kills}/${ply.deaths})`);
                }

                let sortedBy = "unknown";
                switch (packet.sort) {
                    case 0: sortedBy = "actual playtime"; break;
                    case 1: sortedBy = "afk playtime"; break;
                    case 2: sortedBy = "total playtime"; break;
                    case 3: sortedBy = "kills"; break;
                    case 4: sortedBy = "deaths"; break;
                    case 5: sortedBy = "k/d ratio"; break;
                }

                let firstLine = packet.connectedPlayers instanceof Array ? 'Showing the stats of connected players ' : 'Showing the top player stats ';
                firstLine += `sorted by __**${sortedBy}**__.`;

                statsInteraction.editReply(firstLine + '```\n' + tablePrint(statsTable) + '```');

                waitingForStats = false;
                statsInteraction = undefined;
            } break;
        
            case "hybernation": {
                webhook.send({
                    username: config.Language.NameWebsocketStatus,
                    content: config.Language.Hybernating
                });
                relaySocket?.close();
            } break;

            // case "replyPing": {
            //     if (Date.now() - pingSent <= config.ReplyPingTimeout * 1000) {
            //         pingReceived = true;
            //         pingMissed = 0;
            //     }
            // } break;
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

    client.fetchWebhook(webhookData.Webhook.ID, webhookData.Webhook.Token)
        .then(wh => {
            assignWebhook(wh);
            if (json == true) {
                let webhookOptions = {
                    username: config.Language.NameWebsocketStatus,
                    content: config.Language.BotStarted
                }

                if (existsSync('./error.txt')) {
                    webhookOptions.content += `\n${config.Language.ErrorRestartedFromCrash}\`\`\`\n${readFileSync('./error.txt')}\`\`\``;
                    unlink('./error.txt', error => {
                        if (error) {
                            console.log("Unable to delete error.txt. Previous crash report will reprint on next restart unless you manually delete the file");
                            console.error(error);
                        }
                    });
                }
                
                wh.send(webhookOptions);
            }
        })
        .catch(() => {
            // Make a new webhook
            if (webhookData.ChannelID.length === 0)
                return console.log("Tried to create a webhook, but no channel has been set yet.");

            let channel = client.channels.resolve(webhookData.ChannelID);
            if (channel) {
                channel.createWebhook({
                    name: "Gmod Communication Relay"
                }).then(wh => {assignWebhook(wh); saveIds();});
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
            username: config.Language.NameWebsocketStatus,
            content: config.Language.ConnectionEstablished
        });
    }

    relaySocket.on('message', buf => {
        // console.log('Message received from Websocket connection to server.');
        
        let json;
        try {
            json = JSON.parse(buf.toString());
        } catch(err) {
            return console.log("Invalid JSON received from server.");
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
        console.log("Error occured in relay socket");
        console.error(error);

        if (webhook) {
            webhook.send({
                username: config.Language.NameErrorReporting,
                content: `${config.Language.ErrorRelaySocket}\`\`\`\n${error.stack}\`\`\``
            });
        }
    });
    relaySocket.on('close', () => {
        console.log("Connection to server closed.");
        if (webhook) {
            webhook.send({
                username: config.Language.NameWebsocketStatus,
                content: config.Language.ConnectionClosed
            });
        }
    });
});

wss.on('error', async err => {
    console.log('Error occured in websocket server:');
    console.error(err);

    if (webhook) {
        await webhook.send({
            username: config.Language.NameErrorReporting,
            content: `${config.Language.ErrorWebsocketServer}\`\`\`\n${err.stack}\`\`\`Restarting...`
        });
    }
    process.exit();
});
wss.on('close', async () => {
    console.log("Websocket server closed. What the..");
    if (webhook) {
        await webhook.send({
            username: config.Language.NameErrorReporting,
            content: config.Language.ErrorWebsocketServerClosed
        });
    }
    process.exit();
});


// Functions for eval (js)

// Hides certain config values to prevent exposing private keys
function sanitizePrivateValues(str) {
    let newString = str.replaceAll(config.DiscordBotToken, config.Language.BotTokenHidden);
    if (config.SteamAPIKey.length > 0) 
        newString = newString.replaceAll(config.SteamAPIKey, config.Language.SteamAPIKeyHidden);
    if (webhookData.Webhook.Token.length > 0) 
        newString = newString.replaceAll(webhookData.Webhook.Token, config.Language.WebhookTokenHidden);
    // Don't need to hide config.ServerIP here since that's publicly known. Anyone who's ever
    // connected to your server already has your ServerIP
    
    return newString;
}

// This is hacky, you probably should not do this. This temporarily overwrites console.log in the eval dev command to allow logging output at stages
let normalConsoleLog = console.log;
let temporaryLogs = [];
function log() {
    temporaryLogs.push(sanitizePrivateValues(Array.from(arguments).join(" ")));
}
function overwriteConsoleLog() {
    temporaryLogs = [];
    console.log = log;
}
function revertConsoleLog() {
    console.log = normalConsoleLog;
}

// Discord stuff
client.on('messageCreate', async message => {
    if (message.author.bot)
        return; // Do nothing for bots

    let ranCommand = false;
    let startsWithPrefix = message.content.trimStart().startsWith(config.ManagerCommandPrefix);
    let isManager = config.Managers.includes(message.author.id);
    if (startsWithPrefix && !isManager) {
        message.react(config.Reactions.NoAccess);
    } else if (isManager && startsWithPrefix) {
        let inputText = message.content.trimStart().slice(config.ManagerCommandPrefix.length);
        let command = inputText.split(' ', 1)[0].toLowerCase();
        inputText = inputText.slice(command.length).trim();

        ranCommand = true;
        switch (command) {
            case "setgmodchannel": {
                webhookData.ChannelID = message.channel.id;
                saveIds();
                message.react('✅');
            } break;

            case "restart":
            case "shutdown": {
                message.react('✅').then(() => process.exit()).catch(() => process.exit());
            } break;

            case "console":
            case "cmd":
            case "concommand":
            case "c":
            case "command": {
                if (relaySocket?.readyState == 1) {
                    let packet = {};
                    packet.type = "concommand";
                    packet.from = message.member.displayName;
                    packet.command = inputText;
                    relaySocket.send(Buffer.from(JSON.stringify(packet)));
                    message.react('✅');
                } else {
                    message.react('❌');
                }
            } break;

            case "eval":
            case "evaluate":
            case "js_run": {
                inputText = inputText.replace(/```(js)?/g, '');
                if (inputText.length === 0) 
                    return message.reply('Invalid input. Please provide JavaScript code to run.');
                
                try {
                    overwriteConsoleLog();
                    let result = eval(inputText);
                    revertConsoleLog();

                    let newMessageObject = {files: []};

                    if (temporaryLogs.length > 0) {
                        newMessageObject.files.push({attachment: Buffer.from(temporaryLogs.join('\n')), name: "console.txt"});
                    }

                    if (result === undefined || result === null) newMessageObject.content = "Evaluated successfully, no output.";
                    else if (result instanceof Object || result instanceof Array) result = JSON.stringify(result, null, 2);
                    else if (typeof result !== "string") result = result !== undefined ? result.toString() : "";

                    if (!newMessageObject.content) {
                        if (result.length > 256) {
                            newMessageObject.content = `Evaluated without error.`;
                            newMessageObject.files.push({attachment: Buffer.from(sanitizePrivateValues(result)), name: "result.txt"});
                        } else {
                            newMessageObject.content = `Evaluated without error.\`\`\`\n${sanitizePrivateValues(result)}\`\`\``;
                        }
                    }

                    message.reply(newMessageObject);
                } catch (error) {
                    let newMessageObject = {
                        content: `An error occured while evaluating that code.\`\`\`\n${sanitizePrivateValues(error.stack)}\`\`\``
                    };
                    if (temporaryLogs.length > 0) {
                        newMessageObject.files = [{attachment: Buffer.from(temporaryLogs.join('\n')), name: "console.txt"}];
                    }
                    message.reply(newMessageObject);
                }
            } break;

            default: {
                ranCommand = false;
            } break;
        }        
    } 

    if (ranCommand) return;
    if (message.channel.id !== webhookData.ChannelID || message.system) return;
    if (relaySocket?.readyState !== 1) {
        // First check for another connection. If another is open, switch the relaySocket variable
        // TODO
        return message.react(config.Reactions.NoConnection); // 1 means open, we can communicate to the server
    }

    if (message.cleanContent.length > config.MaxMessageLength) return message.react(config.Reactions.RefuseToSend);

    let lines = message.content.split('\n');
    if (lines.length > config.LineBreakLimit) return message.react(config.Reactions.RefuseToSend);
    
    let packet = {};
    packet.type = "message";
    packet.color = message.member.displayHexColor;
    packet.author = message.member.displayName;
    packet.content = message.cleanContent || config.Language.Attachment;

    if (message.reference) {
        try {
            let reference = await message.fetchReference();
            if (reference.member) {
                packet.replyingTo = {
                    author: reference.member.displayName,
                    color: reference.member.displayHexColor
                }
            } else if (reference.author) {
                if (reference.author.id === client.user.id || reference.author.id === webhookData.Webhook.ID) {
                    packet.replyingTo = {author: reference.author.username}
                } else {
                    try {
                        let member = await message.guild.members.fetch(reference.author.id);
                        if (member) {
                            packet.replyingTo = {
                                author: member.displayName,
                                color: member.displayHexColor
                            }
                        } else {
                            packet.replyingTo = {author: reference.author.username}
                        }
                    } catch (_) {
                        packet.replyingTo = {author: reference.author.username}
                    }
                }
            }
        } finally {}
    }

    relaySocket.send(Buffer.from(JSON.stringify(packet)));
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    switch (interaction.commandName) {
        case config.Language.StatusCommandCall: {
            if (relaySocket?.readyState !== 1) 
                return interaction.reply(config.Language.NoConnection);

            if (replyInteraction || waitingForReply) 
                return interaction.reply(config.Language.WaitForStatus);

            interaction.reply(config.Language.RequestingStatus).then(() => {
                if (relaySocket?.readyState !== 1) return interaction.editReply(config.Language.NoConnection);

                replyInteraction = interaction;
                waitingForReply = true;

                let packet = {};
                packet.type = "status";
                packet.from = interaction.member.displayName;
                packet.color = interaction.member.displayHexColor;
                packet.timeout = config.StatusTimeoutSeconds;

                relaySocket.send(Buffer.from(JSON.stringify(packet)));

                statusTimeout = setTimeout(() => {
                    replyInteraction?.editReply(config.Language.NoResponse);
                    replyInteraction = undefined;
                    waitingForReply = false;
                }, config.StatusTimeoutSeconds * 1000);
            });
        } break;

        case "top-players":
        case "player-stats": {
            if (relaySocket?.readyState === 1) {
                statsInteraction = interaction;
                waitingForStats = true;
                await interaction.reply('Retreiving player stats from the server...');

                let packet = {};
                packet.type = "plystats";
                packet.from = interaction.member.displayName;
                packet.color = interaction.member.displayHexColor;
                packet.timeout = config.StatusTimeoutSeconds;
                packet.connectedOnly = interaction.commandName == "player-stats";
                packet.sort = interaction.options.get('sort').value;

                relaySocket.send(Buffer.from(JSON.stringify(packet)));

                statsTimeout = setTimeout(() => {
                    statsInteraction?.editReply(config.Language.NoResponse);
                    statsInteraction = undefined;
                    waitingForStats = false;
                }, config.StatusTimeoutSeconds * 1000);
            } else {
                if (interaction.commandName == "player-stats")
                    return interaction.reply(`This command shows the stats of just the connected players. The server is not currently connected to the relay. Please try again later.`);

                if (!existsSync('./playerstats.json'))
                    return interaction.reply('The server is not connected to the relay. Unable to find a saved stats folder. Please run the command when there is a connection.');
                
                let stats = JSON.parse(readFileSync('./playerstats.json'));
            }
        } break;

        default: interaction.reply('Unknown command. Who knows how you got here.');
    }
});

client.on('ready', () => {
    console.log("Bot initialized");

    getWebhook(true);

    client.application.commands.set([{
        name: config.Language.StatusCommandCall,
        description: config.Language.StatusDescription
    }, {
        name: "player-stats",
        description: "Display the stats of all current players on the server.",
        options: [{
            type: 4, // integer
            name: "sort",
            description: "What to sort the player list by? Note that K/D Ratio only includes deaths > 10.",
            required: true,
            choices: [{
                name: "Playtime (actual)",
                value: 0
            }, {
                name: "Playtime (AFK)",
                value: 1
            }, {
                name: "Total playtime",
                value: 2
            }, {
                name: "Kills",
                value: 3
            }, {
                name: "Deaths",
                value: 4
            }, {
                name: "K/D Ratio",
                value: 5
            }]
        }]
    }]);
});

process.on('unhandledRejection', async (reason, promise) => {
    console.error(reason);
    if (client.isReady() && webhook) {
        await webhook.send({
            username: config.Language.NameErrorReporting,
            content: `${config.Language.ErrorUnhandledPromiseRejection}\`\`\`\n${reason.stack}\`\`\``
        });
    }
    process.exit();
});

process.on('uncaughtException', (error, origin) => {
    if (origin !== "uncaughtException") return;
    
    console.error(error);
    writeFileSync('./error.txt', error.stack);
    process.exit();
});

setInterval(pingServer, (config.PingInterval + config.ReplyPingTimeout) * 1000);

client.login(config.DiscordBotToken);