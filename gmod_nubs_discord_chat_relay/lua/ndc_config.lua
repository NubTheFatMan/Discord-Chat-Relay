-- This is the config for the chat relay.
-- Pretty self explanatory


-- The IP of the bot hosting the websocket server we use to communicate with Discord.
-- There are three things to keep in mind if you edit this:
--     1. If the bot and gmod server are hosted on the same system, this can be left as "localhost"
--     2. If the bot and gmod server are hosted on the same network but not the same system, you'll need to use internal IP addresses.
--            (?) If the bot is on a Windows pc, you can get its internal IP from the Command Prompt with the command "ipconfig". Copy the IPv4 address you get.
--     3. If the bot and gmod server are hosted on different networks, you will need to use public IPs. 
--        You will need to port forward the PortNumber below (default 42069) on the network hosting the bot.
ndc.BotIP = "localhost" 

-- This is the PortNumber the bot's websocket server is listening on. This will need to be port forwarded if your bot and server are on different networks.
-- Used to default to 8080, however through extensive testing, my network had many unknown requests. Using an obscure port stopped them.
ndc.PortNumber = 42069


-- This is the number of seconds before a player is marked AFK for the /status discord bot command.
ndc.AFKTimeout = 90

-- How how many seconds should pass before the server checks who's afk again?
-- Set it to 0 to check every tick.
ndc.AFKCheckInterval = 3