// This is your Discord bot token, obtained from https://discord.com/developers/applications
// To get your token, do the following:
//     1. Follow the link and sign into Discord if not already signed in.
//     2. Go to the "Bot" section and create a new bot account.
//     3. You should see a button to copy the token. If not, click the regenerate button.
exports.DiscordBotToken = "your_discord_bot_token";

// This is the IP of the gmod server. You can get it by running `status` in the console.
// Should be in format 0.0.0.0, do not include the port number
exports.ServerIP = "localhost";

// This is the port number that the bot will listen on. Used to default to the common port of 8080,
// however with extensive testing, I was getting a lot of random requests from multiple people trying 
// to get into my network. Using an obscure port should lower any random requests you get.
// Note: This number is 16 bits and must be between 0-65535
exports.PortNumber = 42069;

//-- VALUES BELOW THIS ARE OPTIONAL --//

// If you would like Steam profile pictures to show up in Discord, get a Steam Web API key from https://steamcommunity.com/dev/apikey
// Otherwise you can leave this empty.
//     1. Sign into steam if not already.
//     2. The domain can be anything. Fill that out and you can generate a key
exports.SteamAPIKey = "";

// If you're using a Steam API Key, how often should avatars be refreshed, in minutes? 
// The lower the number, the more often you will actually be sending requests to Steam, which could get ratelimited and cause issues
exports.SteamAvatarRefreshTime = 120;

// Should connection requests to your server be logged? If true, every accepted and denied connection
// request will be appended to connection_log.txt (generated once the server connects for the first time)
exports.LogConnections = true;

// How many lines should be allowed in a message before the relay decides to not send the message to the server?
exports.LineBreakLimit = 4;

// What is the maximum length of the message before it won't be sent to the server?
exports.MaxMessageLength = 512;

// This is the prefix for dev commands, see end of file
exports.ManagerCommandPrefix = "--";

// Seconds between /status usage. This prevents it being spammed and breaking the bot.
exports.StatusDelayInterval = 10;

// Seconds that the /status command waits for a response from the server before displaying a timeout message
exports.StatusTimeoutSeconds = 5;

// How many seconds until the bot pings the server if there is an active connection.
// If the bot doesn't receive a ping back, see PingTimeout
exports.PingInterval = 10;


// How many seconds the bot gives the gmod server to reply to a ping.
exports.ReplyPingTimeout = 0.5;

// How many reply pings can be missed before the bot terminates the connection to the server. 
// After (PingInterval + ReplyPingTimeout) * PingTimeout, the bot will close the connection.
// Using default values, that's (3 + 0.5) * 3 = 10.5 seconds until termination
exports.PingTimeout = 3;

// Fill this with strings of Discord user IDs that you want to be people who can run developer 
// commands on the bot. A string is a sequence of text wrapped in quotes, "like this." These values
// should be separated by a comma. Example:
// exports.Managers = [
//     "292447249672175618",
//     "168848904886943744"
// ];
// You will need to put your Discord ID into here in order to set up the bot.
exports.Managers = [
    
];

exports.Reactions = {
    NoConnection: "⚠️", // Default "⚠️", relay reacts to a message that can't be sent to server due to not being connected.
    RefuseToSend: "❌", // Default "❌", relay reacts to a message that can't be sent to server because it's too long or too many line breaks. 
    NoAccess:     "☠️", // Default "☠️", relay reacts to user attempts to run manager commands but don't have access.
}

/*
This bot also has a slash command, /status (which can be changed below). This command will collect a list of all players on the server, connecting, in game, or AFK.

----- Profile Pictures -----
If you'd like the bot to have an icon on the member list or when someone uses /status, 
set one to the bot profile on the Discord developer portal.

If you'd like startup/connection message to have an icon, head to your relay channel settings with the ⚙️ icon,
head to Integrations > Webhooks > Gmod Communcation Relay


----- DEVELOPER COMMANDS -----

For all of these commands listed, you will start them with ManagerCommandPrefix (default "--")

    setgmodchannel 
        - Sets the relay channel. Messages sent in the gmod server will appear in this channel and vice versa.
        > Example: --setgmodchannel

    restart
    shutdown 
        - These two are aliases. Both will exit the node process. It'll only actually restart if you're running the .bat file or something else.
        - The bot will react with ✅ if it received your request.
        > Example: --restart

    console    [gmod console command]
    cmd        [gmod console command]
    c          [gmod console command]
    concommand [gmod console command]
    command    [gmod console command]
        - Sends a console command to the gmod server and executes it.
        - The bot will react with ✅ if successful.
        > Example: --console ulx adduser nub superadmin
        > Example: --cmd map gm_construct

    eval     [javascript code]
    evaluate [javascript code]
    js_run   [javascript code]
        - Runs javascript code on the bot. Returns whatever the return value of your code was
        > Example: --eval console.log('Hello World!');
            - output: 'Hello World!'

        > Example: 
        --js_run ```js
        for (let i = 0; i < 100; i++) {
            console.log('Hello #' + (i + 1));
        }
        ```
            - output: 'Hello #1'
                      'Hello #2'
                      ...
                      'Hello #100'

*/

// Language of the bot. Replace all the strings (wrapped in quotes, "") to change the language.
// NOTE: Dev commands don't support the language system and are hardcoded in English.
exports.Language = {
    // DoNotEditMe: "Edit me instead!",

    // Tips for strings:
    //    - If you want to add a newline, use backslash n (\n). Pressing enter to create a new line will create a syntax error and will break the bot.
    //    - If you want to add a quote to anything, you will need to add a backslash before it. Example: "To make a quote, wrap it \"like this\"" will appear as -> To make a quote, wrap it "like this"


    // Display names for the webhook
    NameErrorReporting: "Error Reporting",
    NamePlayerConnectionStatus: "Player Connection Status",
    NameWebsocketStatus: "Websocket Status",

    // Used with NameErrorReporting, appends a code block with an error stack trace in the message.
    ErrorUnhandledPromiseRejection: "Unhandled promise rejection:",
    ErrorRestartedFromCrash: "Bot has just restarted from a crash:",
    ErrorRelaySocket: "Error occured in the relay socket:",
    ErrorWebsocketServer: "Error occured in websocket server:",
    ErrorWebsocketServerClosed: "Websocket server closed for an unknown reason. Restarting...",

    // Used for protection of the eval command
    BotTokenHidden: "[Bot Token Hidden]",
    SteamAPIKeyHidden: "[Steam API Key Hidden]",
    WebhookTokenHidden: "[Webhook Token Hidden]",

    // Used when the bot starts. If it crashed the last time it shut down, ErrorRestartedFromCrash is appended after this.
    BotStarted: "Bot started. Awaiting server connection...",

    ConnectionEstablished: "Connection to server established.",
    ConnectionClosed: "Connection to server closed. Awaiting reconnect...",

    // Used when the only player on the server leaves and no one is connecting. Closes the relay socket
    Hybernating: "Server has entered hybernation.",

    // Used in /status when the bot is not connected with the server.
    NoConnection: "There is currently no connection to the server. Unable to request status.\nThe server automatically reconnects when an event happens, such as a player joining/leaving, or sending a message on the server.",

    // Used in /status when the bot is currently waiting for a response from the server.
    WaitForStatus: "Please wait for the previous status command to finish.",

    // Starting message of /status when waiting for the server to respond
    RequestingStatus: "Requesting server status...",

    // Used in /status when the status command times out
    NoResponse: "No response received from the server, however it is connected. The server may be hibernating, which occurs when no players are on the server.\nThe server could also not be responding, too much lag may be timing out the server.",

    // Used in the the top line of the output of /status. Should have 4 strings
    // Example with the current array of values:
    // | Name         | Steam ID    | Time Connected | Status        |
    // |--------------|-------------|----------------|---------------|
    // | NubTheFatMan | STEAM_0:0:0 | 1:24:37        | AFK for 24:05 |
    StatusTable: ["Name", "Steam ID", "Time Connected", "Status"],

    // Used in the /status output
    // Variables and their replacers:
    //    - $time: The time in hours:minutes:seconds (example 3:01:26, 0:48)
    StatusAFK: "AFK for $time",

    // Used in /status output
    StatusActive: "Active", 

    // Used in /status when the Time Connected attribute of a player is unknown (should never happen, but just in case)
    StatusUnknownTime: "Unknown", 

    // Used in /status when a player is connecting.
    StatusConnecting: "Connecting",

    // The top line before the player table in /status
    // Variables and their replacers:
    //    - $connectingPlayers: The number of players actively connecting to the server.
    //    - $spawnedPlayers: The number of players that are actually in the server and can do stuff.
    //    - $allPlayers: The sum of $connectingPlayers and $spawnedPlayers.
    //    - $playerLimit: The maximum number of players that can be on the server.
    //    - $map: The current map.
    StatusResponse: "**$spawnedPlayers** player(s) are playing on map **$map**.",

    // Editing /status command
    // WARNING: Should be all lower case, no spaces, 1-32 characters
    StatusCommandCall: "status", 

    // WARNING: Should be 1-100 characters long.
    StatusDescription: "View how many players are on the server along with the map.",

    // This is the contents of any message with empty text, such as an upload with only a file, a sticker, a voice message, etc.
    Attachment: "[attachment]",

    // Used when a player connects to the gmod server.
    // Variables and their replacers:
    //    - $name: The player's Steam name.
    //    - $steamid: The player's Steam ID.
    // Example: "$name ($steamid) has connected." -> "NubTheFatMan (STEAM_0:0:0) has connected."
    PlayerConnected: "$name ($steamid) has connected to the server.",

    // Used when a player spawns into the server.
    // Variables and their replacers:
    //    - $name: The player's Steam name.
    //    - $steamid: The player's Steam ID.
    //    - $TimeTaken: The TimeTaken variable listed below, if the time is known (only unknown on map changes).
    // Example: "$name ($steamid) has spawned$TimeTaken." -> "NubTheFatMan (STEAM_0:0:0) has spawned (took 0:58)." OR "NubTheFatMan (STEAM_0:0:0) has spawned."
    PlayerSpawned: "$name ($steamid) has spawned into the server$TimeTaken.",

    // Used for PlayerSpawned. Variables and their replacers:
    //    - $time: The time in minutes:seconds (example 1:02, 0:48)
    TimeTaken: " (took $time)",

    // Used when a player leaves to the gmod server.
    // Variables and their replacers:
    //    - $name: The player's Steam name.
    //    - $steamid: The player's Steam ID.
    //    - $reason: The reason the player left.
    // Example: "$name ($steamid) has left ($reason)." -> "NubTheFatMan (STEAM_0:0:0) has left (Disconnect by user.)."
    PlayerLeft: "$name ($steamid) has disconnected ($reason).",
}