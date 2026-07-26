local resourceName = GetCurrentResourceName()
local isOpen = false
local requestSequence = 0
local pendingRequests = {}

local function debugPrint(message)
    if Config.Debug then
        print(('[%s] %s'):format(resourceName, message))
    end
end

local function getBrandingPayload()
    local chromeTitle = BrandingConfig.ChromeTitle
    if not chromeTitle or chromeTitle == '' then
        chromeTitle = ('%s · %s'):format(BrandingConfig.Region or '', BrandingConfig.Department or '')
    end

    return {
        region = BrandingConfig.Region or 'Land Niedersachsen',
        department = BrandingConfig.Department or 'Polizeiinspektion Hannover',
        chromeTitle = chromeTitle,
        logoUrl = BrandingConfig.LogoUrl or 'logo.svg',
        logoAlt = BrandingConfig.LogoAlt or 'Dienststellenlogo',
        appTitle = BrandingConfig.AppTitle or 'Polizei-Eignungsprüfung',
        subtitle = BrandingConfig.Subtitle or 'Auswahlverfahren – digitale Eignungsprüfung',
        certificateTitle = BrandingConfig.CertificateTitle or 'Zertifikat über die bestandene Eignungsprüfung',
        staffLabel = BrandingConfig.StaffLabel or 'Personalwesen',
    }
end

local function sendBranding()
    SendNUIMessage({
        type = 'police_exam:branding',
        branding = getBrandingPayload()
    })
end

local function setVisible(visible)
    isOpen = visible
    SetNuiFocus(visible, visible)
    SetNuiFocusKeepInput(false)
    if visible then
        sendBranding()
    end
    SendNUIMessage({
        type = 'police_exam:visibility',
        visible = visible
    })
end

local function openExam()
    if isOpen then
        return
    end

    setVisible(true)
end

local function closeExam()
    if not isOpen then
        return
    end

    setVisible(false)
end

RegisterCommand(Config.Command, function()
    openExam()
end, false)

if Config.DefaultKey and Config.DefaultKey ~= '' then
    RegisterKeyMapping(Config.Command, 'Polizei-Eignungsprüfung öffnen', 'keyboard', Config.DefaultKey)
end

RegisterNetEvent('police_exam:client:open', function()
    openExam()
end)

exports('OpenExam', openExam)

RegisterNUICallback('close', function(_, cb)
    closeExam()
    cb({ ok = true })
end)

RegisterNUICallback('rpc', function(data, cb)
    if type(data) ~= 'table' or type(data.action) ~= 'string' then
        cb({ ok = false, error = 'Ungültige Anfrage.' })
        return
    end

    requestSequence = requestSequence + 1
    local requestId = ('%s:%s:%s'):format(GetPlayerServerId(PlayerId()), GetGameTimer(), requestSequence)
    pendingRequests[requestId] = cb

    TriggerServerEvent('police_exam:server:rpc', requestId, data.action, data.payload or {})

    SetTimeout(10000, function()
        local pending = pendingRequests[requestId]
        if not pending then
            return
        end

        pendingRequests[requestId] = nil
        pending({ ok = false, error = 'Zeitüberschreitung bei der Serveranfrage.' })
        debugPrint(('RPC timeout: %s'):format(data.action))
    end)
end)

RegisterNetEvent('police_exam:client:rpcResult', function(requestId, result)
    local cb = pendingRequests[requestId]
    if not cb then
        return
    end

    pendingRequests[requestId] = nil
    cb(result or { ok = false, error = 'Leere Serverantwort.' })
end)

RegisterNetEvent('police_exam:client:dataChanged', function(target)
    if not isOpen then
        return
    end

    SendNUIMessage({
        type = 'police_exam:dataChanged',
        target = target
    })
end)


CreateThread(function()
    while true do
        if isOpen then
            DisableControlAction(0, 200, true) -- Pause-Menü / ESC
            DisableControlAction(0, 199, true)
            Wait(0)
        else
            Wait(500)
        end
    end
end)

AddEventHandler('onClientResourceStart', function(startedResource)
    if startedResource ~= resourceName then
        return
    end

    SetNuiFocus(false, false)
    sendBranding()
    SendNUIMessage({
        type = 'police_exam:visibility',
        visible = false
    })
end)

AddEventHandler('onResourceStop', function(stoppedResource)
    if stoppedResource ~= resourceName then
        return
    end

    SetNuiFocus(false, false)
end)
