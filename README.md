# Nubs Discord Chat Relay
Relays messages sent in Discord to a Garry's Mod server, and vice versa. It works by you hosting a Discord bot. This is needed to read messages and send player messages as webhooks. We can't use the Garry's Mod server to post to a webhook because Discord blocks post requests from Garry's Mod for some reason. The bot and server connect by the bot hosting a websocker server.

# Latest update 7/23/23
- On gmod server:
  - Messages on the server that start with `!`, `@`, or `/` are hidden
- On Discord
  - If a message has more than 4 lines, the bot won't relay it to the server, and will instead react with :x:
  - If a message is over 512 characters in length, it won't be sent to the server. Instead it'll react with :x:
  - If the bot is online but the gmod server is not connected to the relay, all messages will be reacted with :warning:

# Reuploaded 6/27/23
I've updated this code to function with modern versions of the dependencies.
This is a reupload because I accidentally included personal information in a previous upload. I deleted that repo and fixed it here.

### Discord bot setup (Windows):
1. Put `Bot - Nubs Discord Chat Relay` anywhere in your computer.
2. Install [Node.js](https://nodejs.org/en/).
    1. You only need the LTS version, recommended for most users.
    2. At the time of writing this, I'm running version `v18.14.1`.
3. Open `Command Prompt` and navigate to where you put the bot files.
4. If you have `package.json`, which is already included, you can just run `npm install` and skip the next 3 steps (#5, #6, #7).
4. Install [Discord.js](https://discord.js.org/#/docs/main/stable/general/welcome) with `npm install discord.js`.
    1. We need this to interact with the Discord API :^)
    2. At the time of writing this, I'm running version `14.11.0`.
5. Install [Websockets](https://github.com/websockets/ws) with `npm install ws`.
    1. We need this to host a websocket server for the gmod server to connect to.
    2. At the time of writing this, I'm running version `8.5.0`.
6. Install [Axios](https://github.com/axios/axios) with `npm install axios`.
    1. We need this to fetch Steam avatars. 
    2. At the time of writing this, I'm running version `1.4.0`.
7. Open file explorer and go to where you put your bot, and find `config.js`. The file will have comments also walking you through filling out what you need to fill out. The next few steps (up to #17) also walk you through filling out the config.
8. Go to [Discord Developer Portal](https://discord.com/developers/applications) and create a new application.
9. Go to the bot section and create a new bot account.
10. Copy the bot's token into `config.js` to the variable `DiscordBotToken`.
11. Head down to `Privileged Gateway Intents` and check `Message Content Intent`.
14. Set `ServerIP` to the IP of the gmod server. You may need to port forward or figure out your IP. These notes should help you determine what to do:
    1. *Note:* If you're hosting the bot and gmod server on the same system, leave it as `localhost`.
    2. *Note:* If you're hosting on the same network but different computer, you will need to use internal network IPs
        1. To get your internal IP address, open the Command Prompt and run command `ipconfig`. Copy your ipv4 address. \
        *Example:* `IPv4 Address. . . . . . . . . . . : 10.0.0.127` -> `exports.ServerIP = "10.0.0.127";`
    3. *Note:* If you're hosting on separate networks, you will need to use public IPs and port forward `PortNumber` on the device hosting the Discord bot. Every ISP is different in how to port forward, so I cannot help you with this.
        1. If you change the `PortNumber` variable, keep in mind that the range is limited to 1024-65535. See [IBM](https://www.ibm.com/docs/en/ztpf/2020?topic=overview-port-numbers) for details.
11. Head to [Steams Web API Key](https://steamcommunity.com/dev/apikey) and create an API key for the bot. 
    1. The domain can be anything. This will be used to get Steam avatars. 
    2. If you don't want to use them, skip this step and the next step.
12. Copy your API key into `config.js` to the variable `SteamAPIKey`. 
13. The `SteamAvatarRefreshTime` variable is how many minutes until a Steam avatar is refreshed.
15. The `LogConnections` variable will log any attempted connections to a text file `connection_log.txt`. Make it false if you don't want them to be logged.
16. With this link, replace \[Client ID] with your bot's ID (found in General Information of the Discord developer applications), and use it to invite your bot. 
    1. `https://discord.com/api/oauth2/authorize?client_id=[Client ID]&permissions=536872000&scope=bot`
    2. This link will only have permissions checked that the bot needs.
17. Start the bot with `start.bat`.
    1. This batch file has a very basic auto restart in the event the bot crashes for whatever reason. Otherwise this is unnecessary if you don't want it or want something better. \
    To just start it without automatic restarting, do `node bot.js`
18. Find the channel you want to be used as the communication relay, and type `--setgmodchannel`. If succesful, the bot will react with ✅. From there, you should be good to go.

# Installation:
### Garry's Mod server setup:
1. [gm_bromsock](https://github.com/Bromvlieg/gm_bromsock) - Installation:
    1. Find the [Builds](https://github.com/Bromvlieg/gm_bromsock/tree/master/Builds) directory, and find an appropriate dll file for the operating system your server runs on.
    2. In your server files, navigate to `garrysmod/lua/bin`. The `bin` folder likely doesn't exist, so create it and drop the dll file in there.
2. [Gmod Websockets](https://github.com/HunterNL/Gmod-Websockets) - Installation
    1. Download the zip file and extract it to `garrysmod/addons`. 
    2. **Note: If you're on a linux based server, you will need to make every folder name lowercase.**
3. Drop `gmod_nubs_discord_chat_relay` into `garrysmod/addons`.
4. Navigate to `garrysmod/addons/gmod_nubs_discord_chat_relay/lua/ndc_config.lua` and change the `BotIP` and `PortNumber` variables to the IP address and port number of the Discord bot. The port number will have to be the same on both the gmod server and discord bot.
5. There are comments to help you fill out the rest of the server config.
5. Restart the server.
    - If you've installed this onto the server first, it will get lua errors from Websockets until you set up the bot.