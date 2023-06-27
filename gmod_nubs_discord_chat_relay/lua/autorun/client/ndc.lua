-- Only thing for the client is receiving messages

net.Receive("discord_message_received", function()
    local argc = net.ReadUInt(16)
    local args = {}
    for i = 1, argc do 
        if net.ReadBit() == 1 then 
            table.insert(args, Color(net.ReadUInt(8), net.ReadUInt(8), net.ReadUInt(8), net.ReadUInt(8)))
        else 
            table.insert(args, net.ReadString())
        end
    end

    chat.AddText(unpack(args))
end)