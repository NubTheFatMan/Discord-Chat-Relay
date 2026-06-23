-- Not much to the server end. More stuff is involved in setting up the bot.

ndc = ndc or {}
include("ndc_config.lua")
require("gwsockets")

-- Started tracking stats 1764368445
local statFile = "discord_chat_relay_player_stats.json"
ndc.playerStats = ndc.playerStats or file.Read(statFile)
if isstring(ndc.playerStats) then ndc.playerStats = util.JSONToTable(ndc.playerStats) end
if not istable(ndc.playerStats) then ndc.playerStats = {} end

-- Validates the data is the right format and returns the table
local function getStatTable(steamid)
    local stats = ndc.playerStats[steamid] or {}
    if not isnumber(stats.playtime) then stats.playtime = 0 end
    if not isnumber(stats.afktime)  then stats.afktime  = 0 end
    if not isnumber(stats.kills)    then stats.kills    = 0 end
    if not isnumber(stats.deaths)   then stats.deaths   = 0 end
    if not isnumber(stats.lastplay) then stats.lastplay = 0 end
    if not isstring(stats.lastname) then stats.lastname = "" end
    ndc.playerStats[steamid] = stats
    return stats
end
local function saveStats()
    print("Saving Discord chat relay player stats")
    file.Write(statFile, util.TableToJSON(ndc.playerStats))
end


-- Function to notify players when a discord message is received
util.AddNetworkString("discord_message_received")
local function notify(...) -- Function copied from the Evolve admin mod and modified to suit this mod
    local arg = {...}
    local strArg = {} -- Used for logging to console

    net.Start("discord_message_received")
    net.WriteUInt(#arg, 16)
    for i, a in ipairs(arg) do 
        if isnumber(a) then 
            a = tostring(a)
        end 

        if isstring(a) then 
            net.WriteBit(false)
            net.WriteString(a)
            table.insert(strArg, a)
        elseif IsColor(a) then 
            net.WriteBit(true)
            net.WriteUInt(a.r, 8)
            net.WriteUInt(a.g, 8)
            net.WriteUInt(a.b, 8)
            net.WriteUInt(a.a, 8)
        end
    end
    net.Broadcast()
    MsgN(table.concat(strArg, ""))
end
ndc.notify = notify

-- Converting a hex string to a color 
local function hexToCol(hex)
    local len = #hex
    if len > 0 and string.sub(hex, 1, 1) == "#" then
        hex = string.sub(hex, 2)
        len = len - 1
    end
    if len >= 6 then
        local r = "0x" .. string.sub(hex, 1, 2)
        local g = "0x" .. string.sub(hex, 3, 4)
        local b = "0x" .. string.sub(hex, 5, 6)
        if len == 6 then return Color(tonumber(r), tonumber(g), tonumber(b))
        elseif len == 8 then
            local a = "0x" .. string.sub(hex, 7, 8)
            return Color(tonumber(r), tonumber(g), tonumber(b), tonumber(a))
        end
    end
end
ndc.hexToCol = hexToCol


ndc.nextStatusAccept = ndc.nextStatusAccept or 0
ndc.nextStatsAccept = ndc.nextStatsAccept or 0

ndc.connectingPlayers = ndc.connectingPlayers or {}
ndc.playerJoinTimestamps = ndc.playerJoinTimestamps or {}

ndc.afkPlayers = ndc.afkPlayers or {}

local function websocketOpened()
    MsgN("Connection established to websocket server.")
    ndc.nextStatus = 0
end
ndc.websocketOpened = websocketOpened

local function websocketMessage(data)
    local packet = util.JSONToTable(data)

    local typeofRequest = packet.type

    if typeofRequest == "ping" then 
        ndc.websocket:write('{"type":"replyPing"}')
    elseif typeofRequest == "status" then 
        if SysTime() < ndc.nextStatusAccept then return end
        ndc.nextStatusAccept = SysTime() + packet.timeout

        local connecting = {}
        for id, data in pairs(ndc.connectingPlayers) do 
            table.insert(connecting, data)
        end

        local spawnedPlayers = {}
        for i, ply in ipairs(player.GetHumans()) do 
            table.insert(spawnedPlayers, {
                name     = ply:Nick(), 
                steamid  = ply:SteamID(), 
                jointime = ply:TimeConnected(), 
                afktime  = ndc.afkPlayers[ply:SteamID()] or false
            })
        end

        local response = {}
        response.type = "status"
        response.map = game.GetMap()
        response.connectingPlayers = connecting
        response.players = spawnedPlayers
        response.playerlimit = game.MaxPlayers()

        ndc.websocket:write(util.TableToJSON(response))
        ndc.nextStatus = os.time() + (ndc.AutomaticStatusInterval * 60)

        local fromColor = hexToCol(packet.color)
        if fromColor.r == 0 and fromColor.g == 0 and fromColor.b == 0 then
            fromColor = Color(255, 255, 255)
        end
        notify(Color(88, 101, 242), "(Discord) ", fromColor, packet.from, Color(255, 255, 255), " has requested server status.")
    elseif typeofRequest == "plystats" then
        if SysTime() < ndc.nextStatsAccept then return end
        ndc.nextStatsAccept = SysTime() + packet.timeout

        local reqType = "top"

        local response = {}
        response.type = "plystats"
        response.stats = ndc.playerStats
        response.sort = packet.sort

        if packet.connectedOnly then 
            reqType = "connected"
            response.connectedPlayers = {}
            for i, ply in ipairs(player.GetHumans()) do table.insert(response.connectedPlayers, ply:SteamID()) end
        end

        ndc.websocket:write(util.TableToJSON(response))

        local fromColor = hexToCol(packet.color)
        if fromColor.r == 0 and fromColor.g == 0 and fromColor.b == 0 then
            fromColor = Color(255, 255, 255)
        end
        notify(Color(88, 101, 242), "(Discord) ", fromColor, packet.from, Color(255, 255, 255), " has requested " .. reqType .. " player stats.")
    elseif typeofRequest == "concommand" then 
        MsgN("Received console command from " .. packet.from .. " on Discord.")
        MsgN("> " .. packet.command)
        game.ConsoleCommand(packet.command .. "\n")
    elseif typeofRequest == "message" then
        local fromColor = hexToCol(packet.color)
        if fromColor.r == 0 and fromColor.g == 0 and fromColor.b == 0 then
            fromColor = Color(255, 255, 255)
        end

        local message = {Color(88, 101, 242), "(Discord) ", fromColor, packet.author, Color(255, 255, 255)}

        if packet.replyingTo then 
            local replyColor
            if packet.replyingTo.color then 
                replyColor = hexToCol(packet.replyingTo.color)
            else 
                for _, player in ipairs(player.GetHumans()) do 
                    if string.Replace(player:Nick(), "```", "") == packet.replyingTo.author then 
                        replyColor = team.GetColor(player:Team())
                        break
                    end
                end
            end
            if not replyColor then 
                replyColor = Color(255, 255, 255)
            else
                if replyColor.r == 0 and replyColor.g == 0 and replyColor.b == 0 then 
                    replyColor = Color(255, 255, 255)
                end
            end

            table.insert(message, " (replying to ")
            table.insert(message, replyColor or Color(255, 255, 255))
            table.insert(message, packet.replyingTo.author)
            table.insert(message, Color(255, 255, 255))
            table.insert(message, ")")
        end
        table.insert(message, ": " .. packet.content)

        notify(unpack(message))
    else 
        MsgN("Received invalid packet from Discord bot.")
    end
end
ndc.websocketMessage = websocketMessage

local function websocketClose()
    MsgN("Websocket connection closed. Attempting to reconnect...")
    connectToWebsocket()
end
ndc.websocketClose = websocketClose

ndc.websocket = ndc.websocket or nil
local function connectToWebsocket()
    ndc.websocket = GWSockets.createWebSocket("ws://" .. ndc.BotIP .. ":" .. ndc.PortNumber, false)

    function ndc.websocket:onConnected() 
        websocketOpened() 
    end

    function ndc.websocket:onMessage(data)
        websocketMessage(data)
    end

    function ndc.websocket:onClose()
        websocketClose()
    end
    
    ndc.websocket:open()
end
ndc.connectToWebsocket = connectToWebsocket

hook.Add("PlayerSay", "nubs_discord_communicator", function(ply, message)
    if string.lower(message) == "!relaystats" then 
        ply:PrintMessage(HUD_PRINTCONSOLE, util.TableToJSON(ndc.playerStats[ply:SteamID()]))
        ply:ChatPrint("Your stats tracked by the discord relay have been printed to your console. Note that this command is for debugging purposes and is not in a friendly format.")
        return
    end

    for i, prefix in ipairs(ndc.HiddenMessageStarts) do 
        if string.StartsWith(message, prefix) then return end
    end

    if not ndc.websocket then return end
    if not ndc.websocket:isConnected() then connectToWebsocket() end

    local packet = {}
    packet.type = "message"
    packet.from = ply:Nick()
    packet.fromSteamID = ply:SteamID64()
    packet.content = message

    ndc.websocket:write(util.TableToJSON(packet))
end)

gameevent.Listen("player_connect")
hook.Add("player_connect", "discord_comms_join", function(ply)
    if not ndc.websocket then return end
    if not ndc.websocket:isConnected() then connectToWebsocket() end
    
    local packet = {}
    packet.type = "join/leave"
    packet.messagetype = 1 -- 1 = join, 2 = first spawn, 3 = leave
    packet.username = ply.name
    packet.usersteamid = ply.networkid

    ndc.websocket:write(util.TableToJSON(packet))

    ndc.connectingPlayers[ply.networkid] = {ply.name, ply.networkid, os.time()}
    ndc.playerJoinTimestamps[ply.networkid] = os.time()
end)

hook.Add("PlayerInitialSpawn", "discord_comms_spawn", function(ply)
    local lastPlayed = 0
    local lastName = ""
    if ply:SteamID() ~= "BOT" then
        local plyStats = getStatTable(ply:SteamID())
        lastPlayed = plyStats.lastplay
        lastName = plyStats.lastname
        plyStats.lastplay = os.time()
        plyStats.lastname = ply:Nick()
        ply.ndc_StatsTable = plyStats
    end

    if not ndc.websocket then return end
    if not ndc.websocket:isConnected() then connectToWebsocket() end
    
    local packet = {}
    packet.type = "join/leave"
    packet.messagetype = 2 -- 1 = join, 2 = first spawn, 3 = leave
    packet.username = ply:Nick()
    packet.usersteamid = ply:SteamID()
    packet.userjointime = ndc.playerJoinTimestamps[ply:SteamID()] or 0
    if lastPlayed > 0 then
        packet.lastplay = lastPlayed
        packet.lastname = lastName
    end

    ndc.websocket:write(util.TableToJSON(packet))

    ndc.connectingPlayers[ply:SteamID()] = nil
end)

gameevent.Listen("player_disconnect")
hook.Add("player_disconnect", "ndc_comms_disconnect", function(ply)
    if not ndc.websocket then return end
    if not ndc.websocket:isConnected() then connectToWebsocket() end
    
    local packet = {}
    packet.type = "join/leave"
    packet.messagetype = 3 -- 1 = join, 2 = first spawn, 3 = leave
    packet.username = ply.name
    packet.usersteamid = ply.networkid
    packet.reason = ply.reason

    ndc.websocket:write(util.TableToJSON(packet))

    ndc.connectingPlayers[ply.networkid] = nil -- This is already done in PlayerInitialSpawn, however not if they disconnect before they spawn. This ensures they get removed from connecting.
    ndc.playerJoinTimestamps[ply.networkid] = nil
    ndc.afkPlayers[ply.networkid] = nil
end)

hook.Add("Initialize", "discord_comms_init", function()
    MsgN("Attempting to establish connection to websocket server...")
    connectToWebsocket()
end)

hook.Add("ShutDown", "discord_comms_disconnect", function()
    saveStats()
    if ndc.websocket ~= nil and ndc.websocket:isConnected() then 
        ndc.websocket:closeNow()
    end
end)

local lastCheckedAFK = 0
ndc.nextStatus = ndc.nextStatus or 0
ndc.nextStatSave = ndc.nextStatSave or 0
hook.Add("Think", "ndc_afk_detection", function()
    local now = os.time()
    if now - lastCheckedAFK >= ndc.AFKCheckInterval then 
        lastCheckedAFK = now
        for i, ply in ipairs(player.GetHumans()) do
            local eyeAngles = ply:EyeAngles()
            if eyeAngles ~= ply.ndc_EyeAngleCached then 
                ply.ndc_EyeAngleCached = eyeAngles
                ply.ndc_LastCached = now

                ndc.afkPlayers[ply:SteamID()] = nil
            end

            if (not ndc.afkPlayers[ply:SteamID()]) and now - ply.ndc_LastCached >= ndc.AFKTimeout then
                ndc.afkPlayers[ply:SteamID()] = now - ndc.AFKTimeout
            end
        end
    end

    for i, ply in ipairs(player.GetHumans()) do
        if not istable(ply.ndc_StatsTable) then
            ply.ndc_StatsTable = getStatTable(ply:SteamID())
        end
        local stats = ply.ndc_StatsTable
        stats.lastplay = os.time()
        stats.lastname = ply:Nick()
        if isnumber(ply.ndc_LastThinkSysTime) then
            local elapsedTime = SysTime() - ply.ndc_LastThinkSysTime
            if ndc.afkPlayers[ply:SteamID()] ~= nil then
                stats.afktime = stats.afktime + elapsedTime
            else
                stats.playtime = stats.playtime + elapsedTime
            end
        end
        ply.ndc_LastThinkSysTime = SysTime()
    end

    if ndc.nextStatSave == 0 then
        ndc.nextStatSave = now + (ndc.StatsSaveInterval * 60)
    end
    if now >= ndc.nextStatSave then 
        saveStats()
        ndc.nextStatSave = now + (ndc.StatsSaveInterval * 60)
    end

    if not ndc.websocket then return end
    if not ndc.websocket:isConnected() then return end

    if ndc.nextStatus == 0 then 
        ndc.nextStatus = now + (ndc.AutomaticStatusInterval * 60)
    end

    if now >= ndc.nextStatus then 
        local connecting = {}
        for id, data in pairs(ndc.connectingPlayers) do 
            table.insert(connecting, data)
        end

        local spawnedPlayers = {}
        for i, ply in ipairs(player.GetHumans()) do 
            table.insert(spawnedPlayers, {
                name     = ply:Nick(), 
                steamid  = ply:SteamID(), 
                jointime = ply:TimeConnected(), 
                afktime  = ndc.afkPlayers[ply:SteamID()] or false
            })
        end
        
        if #connecting == 0 and #spawnedPlayers == 0 then 
            MsgN("Nobody is on the server, skipping automatic status report")
        else 
            local response = {}
            response.type = "autostatus"
            response.map = game.GetMap()
            response.connectingPlayers = connecting
            response.players = spawnedPlayers
            response.playerlimit = game.MaxPlayers()
    
            ndc.websocket:write(util.TableToJSON(response))
        end

        ndc.nextStatus = now + (ndc.AutomaticStatusInterval * 60)
    end
end)

-- Stats tracking
hook.Add("PlayerDeath", "ndc_KD_tracking", function(victim, inflictor, attacker)
    if victim:SteamID() == "BOT" then return end
    local victimStats = getStatTable(victim:SteamID())
    victimStats.deaths = victimStats.deaths + 1

    if attacker:IsPlayer() and victim ~= attacker and attacker:SteamID() ~= "BOT" then 
        local attackerStats = getStatTable(attacker:SteamID())
        attackerStats.kills = attackerStats.kills + 1
    end
end)