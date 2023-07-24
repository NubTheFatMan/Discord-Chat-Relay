-- Not much to the server end. More stuff is involved in setting up the bot.

ndc = ndc or {}
include("ndc_config.lua")


-- Function to notify players when a discord message is received
util.AddNetworkString("discord_message_received")
function notify(...) -- Function copied from the Evolve admin mod and modified to suit this mod
    local arg = {...}
    local strArg = {} -- Used for logging to 

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

-- Converting a hex string to a color 
function hexToCol(hex)
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


-- In case connection to the websocket server has been lost, we are going to resort to a queue to send any new message when reconnected.
ndc.queue = ndc.queue or {} 

ndc.connectingPlayers = ndc.connectingPlayers or {}
ndc.playerJoinTimestamps = ndc.playerJoinTimestamps or {}

ndc.afkPlayers = ndc.afkPlayers or {}

ndc.websocket = ndc.websocket
function connectToWebsocket()
    if WS ~= nil then 
        ndc.websocket = WS.Client("ws://" .. ndc.BotIP, ndc.PortNumber)
        ndc.websocket:Connect()

        ndc.websocket:on("open", function()
            ndc.websocket.connected = true

            if #ndc.queue > 0 then 
                ndc.websocket:Send(util.TableToJSON(ndc.queue))
                ndc.queue = {}
            end

            MsgN("Connection established to websocket server.")
        end)

        ndc.websocket:on("message", function(data)
            local packet = util.JSONToTable(data)

            local typeofRequest = packet.type

            if typeofRequest == "status" then 
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

                ndc.websocket:Send(util.TableToJSON(response))
                notify(Color(88, 101, 242), "(Discord) ", hexToCol(packet.color), packet.from, Color(255, 255, 255), " has requested server status.")
            elseif typeofRequest == "concommand" then 
                MsgN("Received console command from " .. packet.from .. " on Discord...")
                MsgN("> " .. packet.command)
                game.ConsoleCommand(packet.command .. "\n")
            elseif typeofRequest == "message" then
                local message = {Color(88, 101, 242), "(Discord) ", hexToCol(packet.color), packet.author, Color(255, 255, 255)}

                if packet.replyingTo then 
                    local replyColor
                    if packet.replyingTo.color then 
                        replyColor = hexToCol(packet.replyingTo.color)
                    else 
                        for _, player in ipairs(player.GetHumans()) do 
                            if player:Nick() == packet.replyingTo.author then 
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
                -- notify(Color(88, 101, 242), "(Discord) ", hexToCol(packet.color), packet.author, Color(255, 255, 255), ": " .. packet.content)
            else 
                MsgN("Received invalid packet from Discord bot.")
            end
        end)

        ndc.websocket:on("close", function()
            MsgN("Websocket connection closed. Attempting to reconnect...")
            if ndc.websocket.connected then 
                connectToWebsocket()
            end
        end)
    end
end

hook.Add("PlayerSay", "nubs_discord_communicator", function(ply, message)
    for i, prefix in ipairs(ndc.HiddenMessageStarts) do 
        if string.StartsWith(message, prefix) then return end
    end

    if WS ~= nil then 
        local packet = {}
        packet.type = "message"
        packet.from = ply:Nick()
        packet.fromSteamID = ply:SteamID64()
        packet.content = message

        if ndc.websocket == nil or (ndc.websocket ~= nil and not ndc.websocket:IsActive()) then 
            connectToWebsocket()
            table.insert(ndc.queue, packet)
        elseif ndc.websocket ~= nil and ndc.websocket:IsActive() then 
            ndc.websocket:Send(util.TableToJSON(packet))
        end
    else 
        MsgN("Discord communication inactive - missing required mod Gmod Websockets.")
    end
end)

gameevent.Listen("player_connect")
hook.Add("player_connect", "discord_comms_join", function(ply)
    if WS ~= nil then 
        local packet = {}
        packet.type = "join/leave"
        packet.messagetype = 1 -- 1 = join, 2 = first spawn, 3 = leave
        packet.username = ply.name
        packet.usersteamid = ply.networkid

        if ndc.websocket == nil or (ndc.websocket ~= nil and not ndc.websocket:IsActive()) then 
            connectToWebsocket()
            table.insert(ndc.queue, packet)
        elseif ndc.websocket ~= nil and ndc.websocket:IsActive() then 
            ndc.websocket:Send(util.TableToJSON(packet))
        end

        ndc.connectingPlayers[ply.networkid] = {ply.name, ply.networkid, os.time()}
        ndc.playerJoinTimestamps[ply.networkid] = os.time()
    else 
        MsgN("Discord communication inactive - missing required mod Gmod Websockets.")
    end
end)

hook.Add("PlayerInitialSpawn", "discord_comms_spawn", function(ply)
    if WS ~= nil then 
        local packet = {}
        packet.type = "join/leave"
        packet.messagetype = 2 -- 1 = join, 2 = first spawn, 3 = leave
        packet.username = ply:Nick()
        packet.usersteamid = ply:SteamID()
        packet.userjointime = ndc.playerJoinTimestamps[ply:SteamID()] or 0

        if ndc.websocket == nil or (ndc.websocket ~= nil and not ndc.websocket:IsActive()) then 
            connectToWebsocket()
            table.insert(ndc.queue, packet)
        elseif ndc.websocket ~= nil and ndc.websocket:IsActive() then 
            ndc.websocket:Send(util.TableToJSON(packet))
        end

        ndc.connectingPlayers[ply:SteamID()] = nil
    else 
        MsgN("Discord communication inactive - missing required mod Gmod Websockets.")
    end
end)

gameevent.Listen("player_disconnect")
hook.Add("player_disconnect", "ndc_comms_disconnect", function(ply)
    if WS ~= nil then 
        local packet = {}
        packet.type = "join/leave"
        packet.messagetype = 3 -- 1 = join, 2 = first spawn, 3 = leave
        packet.username = ply.name
        packet.usersteamid = ply.networkid
        packet.reason = ply.reason

        if ndc.websocket == nil or (ndc.websocket ~= nil and not ndc.websocket:IsActive()) then 
            connectToWebsocket()
            table.insert(ndc.queue, packet)
        elseif ndc.websocket ~= nil and ndc.websocket:IsActive() then 
            ndc.websocket:Send(util.TableToJSON(packet))
        end

        ndc.connectingPlayers[ply.networkid] = nil -- This is already done in PlayerInitialSpawn, however not if they disconnect before they spawn. This ensures they get removed from connecting.
        ndc.playerJoinTimestamps[ply.networkid] = nil
        ndc.afkPlayers[ply.networkid] = nil
    else 
        MsgN("Discord communication inactive - missing required mod Gmod Websockets.")
    end
end)

hook.Add("Initialize", "discord_comms_init", function()
    MsgN("Attempting to establish connection to websocket server...")
    connectToWebsocket()
end)

hook.Add("ShutDown", "discord_comms_disconnect", function() 
    if WS ~= nil and ndc.websocket ~= nil and ndc.websocket:IsActive() then 
        ndc.websocket:Close()
    end
end)

local lastCheckedAFK = 0
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
end)