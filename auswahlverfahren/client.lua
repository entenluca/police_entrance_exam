local resourceName = GetCurrentResourceName()
local isOpen = false
local requestSequence = 0
local pendingRequests = {}
local startPointBlips = {}

local function debugPrint(message)
    if Config.Debug then
        print(('[%s] %s'):format(resourceName, message))
    end
end

local function getBrandingConfig()
    return type(Config.Branding) == 'table' and Config.Branding or {}
end

local function notify(message)
    if type(message) ~= 'string' or message == '' then
        return
    end

    local branding = getBrandingConfig()
    if GetResourceState('ox_lib') == 'started' then
        local ok = pcall(function()
            exports.ox_lib:notify({
                title = branding.AppTitle or 'Auswahlverfahren',
                description = message,
                type = 'error'
            })
        end)
        if ok then
            return
        end
    end

    BeginTextCommandThefeedPost('STRING')
    AddTextComponentSubstringPlayerName(message)
    EndTextCommandThefeedPostTicker(false, false)
end

local function getPlayerJob()
    local stateJob = LocalPlayer and LocalPlayer.state and LocalPlayer.state.job
    if type(stateJob) == 'table' and stateJob.name then
        local grade = stateJob.grade
        if type(grade) == 'table' then
            grade = grade.level or grade.grade or grade.rank or 0
        end
        return string.lower(tostring(stateJob.name)), tonumber(grade) or 0
    end

    if GetResourceState('es_extended') == 'started' then
        local ok, ESX = pcall(function()
            return exports['es_extended']:getSharedObject()
        end)
        if ok and ESX and ESX.GetPlayerData then
            local data = ESX.GetPlayerData()
            if type(data) == 'table' and type(data.job) == 'table' and data.job.name then
                return string.lower(tostring(data.job.name)), tonumber(data.job.grade) or 0
            end
        end
    end

    if GetResourceState('qbx_core') == 'started' then
        local ok, playerData = pcall(function()
            return exports.qbx_core:GetPlayerData()
        end)
        if ok and type(playerData) == 'table' and type(playerData.job) == 'table' and playerData.job.name then
            local grade = playerData.job.grade
            if type(grade) == 'table' then
                grade = grade.level or grade.grade or 0
            end
            return string.lower(tostring(playerData.job.name)), tonumber(grade) or 0
        end
    end

    if GetResourceState('qb-core') == 'started' then
        local ok, QBCore = pcall(function()
            return exports['qb-core']:GetCoreObject()
        end)
        if ok and QBCore and QBCore.Functions and QBCore.Functions.GetPlayerData then
            local data = QBCore.Functions.GetPlayerData()
            if type(data) == 'table' and type(data.job) == 'table' and data.job.name then
                local grade = data.job.grade
                if type(grade) == 'table' then
                    grade = grade.level or grade.grade or 0
                end
                return string.lower(tostring(data.job.name)), tonumber(grade) or 0
            end
        end
    end

    return nil, 0
end

local function hasTabletJobAccess()
    local access = type(Config.TabletAccess) == 'table' and Config.TabletAccess or {}
    local jobs = access.Jobs
    if type(jobs) ~= 'table' or #jobs == 0 then
        return true
    end

    local jobName, jobGrade = getPlayerJob()
    if not jobName then
        return false
    end

    for _, entry in ipairs(jobs) do
        if type(entry) == 'table' then
            local allowedName = string.lower(tostring(entry.name or entry.job or ''))
            local minGrade = tonumber(entry.minGrade or entry.grade or 0) or 0
            if allowedName ~= '' and allowedName == jobName and jobGrade >= minGrade then
                return true
            end
        elseif type(entry) == 'string' and string.lower(entry) == jobName then
            return true
        end
    end

    return false
end

local function getBrandingPayload()
    local branding = getBrandingConfig()
    local chromeTitle = branding.ChromeTitle
    if not chromeTitle or chromeTitle == '' then
        chromeTitle = ('%s · %s'):format(branding.Region or '', branding.Department or '')
    end

    return {
        region = branding.Region or 'Land Niedersachsen',
        department = branding.Department or 'Polizeiinspektion Hannover',
        chromeTitle = chromeTitle,
        logoUrl = branding.LogoUrl or 'logo.svg',
        logoAlt = branding.LogoAlt or 'Dienststellenlogo',
        appTitle = branding.AppTitle or 'Auswahlverfahren',
        subtitle = branding.Subtitle or 'Digitale Eignungsprüfung',
        certificateTitle = branding.CertificateTitle or 'Zertifikat über die bestandene Eignungsprüfung',
        staffLabel = branding.StaffLabel or 'Personalwesen',
        examRules = {
            passPercentage = Config.Exam and Config.Exam.PassPercentage or 78,
            categoryMinimum = Config.Exam and Config.Exam.CategoryMinimum or 55,
            excellentPercentage = Config.Exam and Config.Exam.ExcellentPercentage or 88,
        },
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

--- @param opts table|nil { requireJob = boolean, startPoint = table|nil }
local function openExam(opts)
    if isOpen then
        return
    end

    opts = type(opts) == 'table' and opts or {}
    local requireJob = opts.requireJob ~= false

    if requireJob and not hasTabletJobAccess() then
        local access = type(Config.TabletAccess) == 'table' and Config.TabletAccess or {}
        notify(access.DenyMessage or 'Du hast nicht den erforderlichen Job, um das Tablet zu öffnen.')
        debugPrint('Tablet-Öffnung abgelehnt: Job fehlt')
        return
    end

    local startPoint = opts.startPoint
    if type(startPoint) == 'table' and startPoint.placePlayer ~= false and startPoint.coords then
        local ped = PlayerPedId()
        local c = startPoint.coords
        SetEntityCoordsNoOffset(ped, c.x, c.y, c.z, false, false, false)
        if c.w then
            SetEntityHeading(ped, c.w)
        end
    end

    setVisible(true)
end

local function closeExam()
    if not isOpen then
        return
    end

    setVisible(false)
end

local function clearStartPointBlips()
    for _, blip in ipairs(startPointBlips) do
        if DoesBlipExist(blip) then
            RemoveBlip(blip)
        end
    end
    startPointBlips = {}
end

local function createStartPointBlips()
    clearStartPointBlips()

    for _, point in ipairs(Config.ExamStartPoints or {}) do
        if type(point) == 'table' and point.coords and type(point.blip) == 'table' and point.blip.enabled then
            local c = point.coords
            local blip = AddBlipForCoord(c.x, c.y, c.z)
            SetBlipSprite(blip, tonumber(point.blip.sprite) or 498)
            SetBlipDisplay(blip, 4)
            SetBlipScale(blip, tonumber(point.blip.scale) or 0.75)
            SetBlipColour(blip, tonumber(point.blip.color) or 3)
            SetBlipAsShortRange(blip, true)
            BeginTextCommandSetBlipName('STRING')
            AddTextComponentSubstringPlayerName(point.blip.label or point.label or 'Eignungsprüfung')
            EndTextCommandSetBlipName(blip)
            startPointBlips[#startPointBlips + 1] = blip
        end
    end
end

local function drawHelpText(text)
    BeginTextCommandDisplayHelp('STRING')
    AddTextComponentSubstringPlayerName(text)
    EndTextCommandDisplayHelp(0, false, true, -1)
end

RegisterCommand(Config.Command, function()
    openExam({ requireJob = true })
end, false)

if Config.DefaultKey and Config.DefaultKey ~= '' then
    RegisterKeyMapping(Config.Command, 'Auswahlverfahren öffnen', 'keyboard', Config.DefaultKey)
end

RegisterNetEvent('police_exam:client:open', function()
    openExam({ requireJob = true })
end)

exports('OpenExam', function()
    openExam({ requireJob = true })
end)

exports('OpenExamAtStartPoint', function()
    openExam({ requireJob = false })
end)

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

CreateThread(function()
    createStartPointBlips()

    while true do
        local points = Config.ExamStartPoints
        if type(points) ~= 'table' or #points == 0 then
            Wait(1500)
        else
            local ped = PlayerPedId()
            local coords = GetEntityCoords(ped)
            local sleep = 1000
            local nearest = nil
            local nearestDist = nil

            for _, point in ipairs(points) do
                if type(point) == 'table' and point.coords then
                    local c = point.coords
                    local dist = #(coords - vector3(c.x, c.y, c.z))
                    local drawDistance = tonumber(point.drawDistance) or 25.0
                    local radius = tonumber(point.radius) or 2.0

                    if dist <= drawDistance then
                        sleep = 0
                        local marker = point.marker
                        if type(marker) ~= 'table' or marker.enabled ~= false then
                            local size = (marker and marker.size) or vector3(1.4, 1.4, 0.55)
                            local color = (marker and marker.color) or { r = 10, g = 77, b = 143, a = 140 }
                            DrawMarker(
                                tonumber(marker and marker.type) or 1,
                                c.x, c.y, c.z - 1.0,
                                0.0, 0.0, 0.0,
                                0.0, 0.0, 0.0,
                                size.x, size.y, size.z,
                                color.r or 10, color.g or 77, color.b or 143, color.a or 140,
                                false, false, 2, false, nil, nil, false
                            )
                        end

                        if dist <= radius and (not nearestDist or dist < nearestDist) then
                            nearest = point
                            nearestDist = dist
                        end
                    end
                end
            end

            if nearest and not isOpen then
                drawHelpText(('~INPUT_CONTEXT~ %s'):format(nearest.label or 'Eignungsprüfung starten'))
                if IsControlJustReleased(0, 38) then -- E
                    openExam({ requireJob = false, startPoint = nearest })
                end
            end

            Wait(sleep)
        end
    end
end)

AddEventHandler('onClientResourceStart', function(startedResource)
    if startedResource ~= resourceName then
        return
    end

    SetNuiFocus(false, false)
    sendBranding()
    createStartPointBlips()
    SendNUIMessage({
        type = 'police_exam:visibility',
        visible = false
    })
end)

AddEventHandler('onResourceStop', function(stoppedResource)
    if stoppedResource ~= resourceName then
        return
    end

    clearStartPointBlips()
    SetNuiFocus(false, false)
end)
