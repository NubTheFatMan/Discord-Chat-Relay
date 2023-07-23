// As of updating this code, I'm using discord.js v14.11.0
// This version of discord.js doesn't support the new Discord username system
// Setting this to true injects my own code into discord.js to make names display properly.
// If you're running a version newer than v14.11.0, you can likely set this to false
exports.DiscordUsernameFix = true;

// This is your Discord bot token, obtained from https://discord.com/developers/applications
// To get your token, do the following:
//     1. Follow the link and sign into Discord if not already signed in.
//     2. Go to the "Bot" section and create a new bot account.
//     3. You should see a button to copy the token. If not, click the regenerate button.
exports.DiscordBotToken = "your_discord_bot_token";

// This is the IP of the gmod server. You can get it by running `status` in the console.
// Should be in format 0.0.0.0, you do not need :27145
exports.ServerIP = "localhost";

// This is the port number that the bot will listen on. Used to default to the common port of 8080,
// however with extensive testing, I was getting a lot of random requests from multiple people trying 
// to get into my network. Using an obscure port should lower any random requests you get.
exports.PortNumber = 42069;

//-- VALUES BELOW THIS ARE OPTIONAL --//

// If you would like Steam profile pictures to show up in Discord, get a Steam Web API key from https://steamcommunity.com/dev/apikey
// Otherwise you can leave this empty.
//     1. Sign into steam if not already.
//     2. The domain can be anything. Fill that out and you can generate a key
exports.SteamAPIKey = "";

// If you're using a Steam API Key, how often should avatars be refreshed, in minutes? 
// The lower the number, the more often you will actually be sending requests to Steam, which could get ratelimited and cause issues
exports.SteamAvatarRefreshTime = 30;

// Should connection requests to your server be logged? If true, every accepted and denied connection
// request will be appended to connection_log.txt (generated once the server connects for the first time)
exports.LogConnections = true;

// This is the prefix for dev commands, see end of file
exports.ManagerCommandPrefix = "--";

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

/*
This bot also has a slash command, /status. This command will collect a list of all players on the server, connecting, in game, or AFK.

----- Profile Pictures -----
If you'd like the bot to have an icon on the member list or when someone uses /status, 
set one to the bot profile on the Discord developer portal.

If you'd like startup/connection message to have an icon, head to your relay channel settings with the ⚙️ icon,
head to Integrations > Webhooks > Dickord Communcation Relay
Why is the webhook called Dickord? Discord has blocked webhooks from having the name "Discord"


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