local resourceName = GetCurrentResourceName()
local recordsFile = 'data/records.json'
local codesFile = 'data/access_codes.json'

local staffSessions = {}
local candidateSessions = {}
local records = {}
local accessCodes = {}

local function debugPrint(message)
    if Config.Debug then
        print(('[%s] %s'):format(resourceName, message))
    end
end

local function trim(value)
    if type(value) ~= 'string' then
        return ''
    end

    return value:match('^%s*(.-)%s*$') or ''
end

local function normalizeName(value)
    return string.lower(trim(value))
end

local function normalizeCode(value)
    return string.upper(trim(value)):gsub('[^A-Z0-9]', '')
end

local function isValidBirthDate(value)
    return type(value) == 'string' and value:match('^%d%d%d%d%-%d%d%-%d%d$') ~= nil
end

local function decodeArray(raw)
    if not raw or raw == '' then
        return nil
    end

    local ok, decoded = pcall(json.decode, raw)
    if not ok or type(decoded) ~= 'table' then
        return nil
    end

    return decoded
end

local function loadArray(filename)
    local decoded = decodeArray(LoadResourceFile(resourceName, filename))
    if decoded then
        return decoded
    end

    print(('[%s] Konnte %s nicht lesen. Datei wird als leere Liste initialisiert.'):format(resourceName, filename))
    SaveResourceFile(resourceName, filename, '[]', -1)
    return {}
end

local function saveArray(filename, data)
    local okEncode, encoded = pcall(json.encode, data)
    if not okEncode or type(encoded) ~= 'string' then
        print(('[%s] JSON-Fehler beim Speichern von %s'):format(resourceName, filename))
        return false
    end

    local okWrite, writeResult = pcall(SaveResourceFile, resourceName, filename, encoded, -1)
    if not okWrite or writeResult == false then
        print(('[%s] Schreibfehler bei %s. Prüfe die Schreibrechte des Resource-Ordners.'):format(resourceName, filename))
        return false
    end

    local verified = decodeArray(LoadResourceFile(resourceName, filename))
    if not verified then
        print(('[%s] Speicherprüfung für %s ist fehlgeschlagen.'):format(resourceName, filename))
        return false
    end

    return true
end

local function isStaff(playerSource)
    return staffSessions[playerSource] ~= nil
end

local function deny(message)
    return { ok = false, error = message or 'Keine Berechtigung.' }
end

local function findRecordIndex(recordId)
    local wanted = trim(recordId)
    if wanted == '' then
        return nil
    end

    for index, record in ipairs(records) do
        if type(record) == 'table' and trim(record.recordId) == wanted then
            return index
        end
    end

    return nil
end

local function findCodeIndex(codeValue)
    local normalized = normalizeCode(codeValue)
    if normalized == '' then
        return nil
    end

    for index, codeData in ipairs(accessCodes) do
        if type(codeData) == 'table' and normalizeCode(codeData.code) == normalized then
            return index
        end
    end

    return nil
end

local function broadcastDataChanged(target)
    TriggerClientEvent('police_exam:client:dataChanged', -1, target)
end

local function getEvaluationText(percentage)
    if percentage >= 85 then return 'sehr stark' end
    if percentage >= 70 then return 'stabil' end
    if percentage >= 50 then return 'ausbaufähig' end
    return 'kritisch'
end

local function getGradeNote(percentage)
    if percentage >= 95 then
        return { note = '1', label = 'Sehr gut' }
    elseif percentage >= 85 then
        return { note = '2', label = 'Gut' }
    elseif percentage >= 75 then
        return { note = '3', label = 'Befriedigend' }
    elseif percentage >= 68 then
        return { note = '4', label = 'Ausreichend' }
    elseif percentage >= 50 then
        return { note = '5', label = 'Mangelhaft' }
    end

    return { note = '6', label = 'Ungenügend' }
end

local function getExamRules()
    local exam = type(Config.Exam) == 'table' and Config.Exam or {}
    return {
        passPercentage = tonumber(exam.PassPercentage) or 78,
        categoryMinimum = tonumber(exam.CategoryMinimum) or 55,
        excellentPercentage = tonumber(exam.ExcellentPercentage) or 88,
    }
end

local function evaluateAnswers(answers, completedAt)
    answers = type(answers) == 'table' and answers or {}
    local categories = { 'LOGIC', 'VERBAL', 'JUDGMENT', 'CONCENTRATION' }
    local categoryScores = {}

    for _, category in ipairs(categories) do
        categoryScores[category] = {
            category = category,
            score = 0,
            maxScore = 0,
            percentage = 0,
            evaluation = 'kritisch'
        }
    end

    for questionId, question in pairs(Config.ExamQuestions or {}) do
        local weight = tonumber(question.weight) or 1
        local category = question.category
        if categoryScores[category] then
            categoryScores[category].maxScore = categoryScores[category].maxScore + weight
            if tostring(answers[questionId] or '') == tostring(question.correct or '') then
                categoryScores[category].score = categoryScores[category].score + weight
            end
        end
    end

    local totalScore = 0
    local totalMaxScore = 0
    for _, category in ipairs(categories) do
        local score = categoryScores[category]
        score.percentage = score.maxScore > 0 and (score.score / score.maxScore) * 100 or 0
        score.evaluation = getEvaluationText(score.percentage)
        totalScore = totalScore + score.score
        totalMaxScore = totalMaxScore + score.maxScore
    end

    local totalPercentage = totalMaxScore > 0 and (totalScore / totalMaxScore) * 100 or 0
    local grade = getGradeNote(totalPercentage)
    local rules = getExamRules()
    local overallRating = 'NICHT_AUSREICHEND'
    local finalDecision = 'NICHT_BESTANDEN'
    local decisionLabel = 'Nicht bestanden'
    local decisionReason = 'Die im Auswahlverfahren geforderte Mindestleistung wurde nicht erreicht.'

    local weakCategories = {}
    for _, category in ipairs(categories) do
        local score = categoryScores[category]
        if score.percentage < rules.categoryMinimum then
            weakCategories[#weakCategories + 1] = category
        end
    end

    local categoriesPassed = #weakCategories == 0
    local totalPassed = totalPercentage >= rules.passPercentage

    if totalPassed and categoriesPassed then
        if totalPercentage >= rules.excellentPercentage then
            overallRating = 'SEHR_GEEIGNET'
            decisionReason = 'Die geforderte Gesamtleistung wurde deutlich übertroffen.'
        else
            overallRating = 'GEEIGNET'
            decisionReason = 'Die geforderte Mindestleistung wurde in allen Bereichen erreicht.'
        end
        finalDecision = 'BESTANDEN'
        decisionLabel = 'Bestanden'
    elseif totalPassed and not categoriesPassed then
        overallRating = 'TEILWEISE_GEEIGNET'
        decisionReason = ('Die Gesamtquote wurde erreicht, jedoch nicht in allen Bereichen die Mindestanforderung von %d%%.'):format(rules.categoryMinimum)
    elseif totalPercentage >= 50 then
        overallRating = 'TEILWEISE_GEEIGNET'
        decisionReason = ('Die Gesamtleistung blieb unter der Bestehensgrenze von %d%%.'):format(rules.passPercentage)
    end

    return {
        totalScore = totalScore,
        totalMaxScore = totalMaxScore,
        totalPercentage = totalPercentage,
        overallRating = overallRating,
        gradeNote = grade.note,
        gradeLabel = grade.label,
        categoryScores = categoryScores,
        completedAt = completedAt,
        finalDecision = finalDecision,
        decisionLabel = decisionLabel,
        decisionReason = decisionReason,
        passed = finalDecision == 'BESTANDEN',
        passPercentage = rules.passPercentage,
        categoryMinimum = rules.categoryMinimum,
        categoriesPassed = categoriesPassed,
        weakCategories = weakCategories,
    }
end

local function generateAccessCode()
    local alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

    for _ = 1, 100 do
        local compact = ''
        for _ = 1, 8 do
            local index = math.random(1, #alphabet)
            compact = compact .. alphabet:sub(index, index)
        end

        local formatted = compact:sub(1, 4) .. '-' .. compact:sub(5, 8)
        if not findCodeIndex(formatted) then
            return formatted
        end
    end

    return nil
end

local function generateRecordId(playerSource)
    for _ = 1, 100 do
        local recordId = ('REC-%d-%d-%06d'):format(os.time(), tonumber(playerSource) or 0, math.random(0, 999999))
        if not findRecordIndex(recordId) then
            return recordId
        end
    end

    return ('REC-%d-%d'):format(os.time(), tonumber(playerSource) or 0)
end

local function generateCandidateId()
    local year = os.date('!%y')
    local date = os.date('!%d%m')
    local sequence = math.random(1000, 9999)
    local digits = date .. tostring(sequence)
    local checksum = 0

    for index = 1, #digits do
        checksum = checksum + (tonumber(digits:sub(index, index)) or 0) * (index + 1)
    end

    return ('%s-%s-%s-%d-%d'):format(
        BrandingConfig.CandidateIdPrefix or 'PIH-EAV',
        year,
        date,
        sequence,
        checksum % 10
    )
end

local function certificateNumberExists(certificateNumber)
    local wanted = trim(certificateNumber)
    if wanted == '' then
        return false
    end

    for _, record in ipairs(records) do
        if type(record) == 'table' and trim(record.certificateNumber) == wanted then
            return true
        end
    end

    return false
end

local function generateCertificateNumber(record)
    local completedYear = tostring(record.completedAt or ''):match('^(%d%d%d%d)') or os.date('!%Y')
    local compactId = tostring(record.candidateId or ''):upper():gsub('[^A-Z0-9]', '')
    compactId = compactId:sub(math.max(1, #compactId - 7))
    if compactId == '' then
        compactId = tostring(math.random(10000000, 99999999))
    end

    local prefix = BrandingConfig.CertificatePrefix or 'PIH-ZERT'
    local base = ('%s-%s-%s'):format(prefix, completedYear, compactId)
    if not certificateNumberExists(base) then
        return base
    end

    for suffix = 2, 99 do
        local candidate = ('%s-%02d'):format(base, suffix)
        if not certificateNumberExists(candidate) then
            return candidate
        end
    end

    return ('%s-%06d'):format(base, math.random(0, 999999))
end

local function candidateReceipt(record)
    return {
        recordId = record.recordId,
        candidateId = record.candidateId,
        candidateName = record.candidateName,
        completedAt = record.completedAt,
        status = 'EINGEREICHT'
    }
end

local function sanitizeIncidents(value)
    if type(value) ~= 'table' then
        return {}
    end

    local result = {}
    local maxIncidents = math.min(#value, 100)
    for index = 1, maxIncidents do
        local item = value[index]
        if type(item) == 'table' then
            result[#result + 1] = {
                type = trim(tostring(item.type or 'UNKNOWN')):sub(1, 64),
                message = trim(tostring(item.message or '')):sub(1, 300),
                timestamp = trim(tostring(item.timestamp or '')):sub(1, 64)
            }
        end
    end

    return result
end

local function saveNewRecord(record)
    table.insert(records, 1, record)

    while #records > (Config.MaxRecords or 500) do
        table.remove(records)
    end

    if not saveArray(recordsFile, records) then
        local index = findRecordIndex(record.recordId)
        if index then
            table.remove(records, index)
        end
        return false
    end

    broadcastDataChanged('records')
    return true
end

local function submitCandidateExam(playerSource, payload)
    local session = candidateSessions[playerSource]
    local timeoutSeconds = tonumber(Config.CandidateSessionTimeout) or 3600

    if not session or (os.time() - (session.validatedAt or 0)) > timeoutSeconds then
        return deny('Die Bewerbersitzung ist nicht gültig oder abgelaufen.')
    end

    if session.submittedRecordId then
        local existingIndex = findRecordIndex(session.submittedRecordId)
        if existingIndex then
            return { ok = true, receipt = candidateReceipt(records[existingIndex]), alreadySaved = true }
        end
    end

    if trim(payload.attemptId) ~= '' and trim(payload.attemptId) ~= trim(session.attemptId) then
        return deny('Die Prüfungsanfrage gehört nicht zur aktiven Bewerbersitzung.')
    end

    local answers = type(payload.answers) == 'table' and payload.answers or {}
    local completedAt = os.date('!%Y-%m-%dT%H:%M:%SZ')
    local record = {
        recordId = generateRecordId(playerSource),
        candidateId = session.candidateId,
        candidateName = session.displayName,
        candidateBirthDate = session.birthDate,
        startedAt = session.startedAt,
        completedAt = completedAt,
        accessCode = session.code,
        answers = answers,
        securityIncidents = sanitizeIncidents(payload.securityIncidents),
        evaluation = evaluateAnswers(answers, completedAt),
        reviewStatus = 'AUSSTEHEND'
    }

    if not saveNewRecord(record) then
        return deny('Prüfungsakte konnte nicht gespeichert werden. Prüfe die Schreibrechte des Resource-Ordners.')
    end

    session.submittedRecordId = record.recordId
    session.submittedAt = os.time()
    candidateSessions[playerSource] = session

    return { ok = true, receipt = candidateReceipt(record) }
end

local function handleRpc(playerSource, action, payload)
    payload = type(payload) == 'table' and payload or {}

    if action == 'auth:login' then
        local username = string.lower(trim(payload.username))
        local password = trim(payload.password)

        for _, account in ipairs(Config.StaffAccounts or {}) do
            if string.lower(trim(account.username)) == username and tostring(account.password or '') == password then
                staffSessions[playerSource] = {
                    displayName = account.displayName or account.username,
                    rank = account.rank or 'Personalwesen'
                }

                return {
                    ok = true,
                    success = true,
                    displayName = staffSessions[playerSource].displayName,
                    rank = staffSessions[playerSource].rank
                }
            end
        end

        staffSessions[playerSource] = nil
        return { ok = true, success = false }
    end

    if action == 'auth:logout' then
        staffSessions[playerSource] = nil
        return { ok = true }
    end

    if action == 'records:get' then
        if not isStaff(playerSource) then
            return deny('Prüfungsakten sind nur für angemeldetes Personal verfügbar.')
        end
        return records
    end

    if action == 'exam:submit' then
        return submitCandidateExam(playerSource, payload)
    end

    -- Rückwärtskompatibilität für ältere NUI-Versionen.
    if action == 'record:save' and not isStaff(playerSource) then
        local record = type(payload.record) == 'table' and payload.record or {}
        return submitCandidateExam(playerSource, {
            answers = record.answers,
            securityIncidents = record.securityIncidents,
            attemptId = record.attemptId
        })
    end

    if action == 'record:issueCertificate' then
        if not isStaff(playerSource) then
            return deny()
        end

        local index = findRecordIndex(payload.recordId)
        if not index then
            return deny('Die Prüfungsakte wurde nicht gefunden.')
        end

        local record = records[index]
        if type(record.evaluation) ~= 'table' or record.evaluation.finalDecision ~= 'BESTANDEN' then
            return deny('Ein Zertifikat kann nur für eine bestandene Prüfung ausgestellt werden.')
        end

        if trim(record.certificateNumber) ~= '' then
            return { ok = true, record = record, alreadyIssued = true }
        end

        local previousCertificate = {
            certificateNumber = record.certificateNumber,
            certificateIssuedAt = record.certificateIssuedAt,
            certificateIssuedBy = record.certificateIssuedBy,
            certificateSignatureName = record.certificateSignatureName,
            reviewStatus = record.reviewStatus,
            reviewedAt = record.reviewedAt,
            reviewedBy = record.reviewedBy
        }

        local staff = staffSessions[playerSource]
        record.certificateNumber = generateCertificateNumber(record)
        record.certificateIssuedAt = os.date('!%Y-%m-%dT%H:%M:%SZ')
        record.certificateIssuedBy = staff.displayName
        record.certificateSignatureName = staff.displayName
        record.reviewStatus = 'FREIGEGEBEN'
        record.reviewedAt = record.certificateIssuedAt
        record.reviewedBy = staff.displayName

        if not saveArray(recordsFile, records) then
            record.certificateNumber = previousCertificate.certificateNumber
            record.certificateIssuedAt = previousCertificate.certificateIssuedAt
            record.certificateIssuedBy = previousCertificate.certificateIssuedBy
            record.certificateSignatureName = previousCertificate.certificateSignatureName
            record.reviewStatus = previousCertificate.reviewStatus
            record.reviewedAt = previousCertificate.reviewedAt
            record.reviewedBy = previousCertificate.reviewedBy
            return deny('Das Zertifikat konnte nicht gespeichert werden.')
        end

        broadcastDataChanged('records')
        return { ok = true, record = record }
    end

    if action == 'record:save' then
        if not isStaff(playerSource) then
            return deny()
        end

        local record = payload.record
        if type(record) ~= 'table' or trim(record.recordId) == '' then
            return deny('Ungültige Prüfungsakte.')
        end

        local index = findRecordIndex(record.recordId)
        if not index then
            return deny('Die Prüfungsakte wurde nicht gefunden.')
        end

        local previousRecord = records[index]
        records[index] = record
        if not saveArray(recordsFile, records) then
            records[index] = previousRecord
            return deny('Prüfungsakte konnte nicht gespeichert werden.')
        end

        broadcastDataChanged('records')
        return { ok = true, record = record }
    end

    if action == 'record:delete' then
        if not isStaff(playerSource) then
            return deny()
        end

        local index = findRecordIndex(payload.recordId)
        if not index then
            return deny('Die Prüfungsakte wurde nicht gefunden oder bereits gelöscht.')
        end

        local removed = table.remove(records, index)
        if not saveArray(recordsFile, records) then
            table.insert(records, index, removed)
            return deny('Prüfungsakte konnte nicht gelöscht werden. Prüfe die Schreibrechte des Resource-Ordners.')
        end

        broadcastDataChanged('records')
        debugPrint(('Prüfungsakte gelöscht: %s durch %s'):format(trim(removed.recordId), staffSessions[playerSource].displayName))
        return { ok = true, deletedRecordId = removed.recordId }
    end

    if action == 'records:clear' then
        if not isStaff(playerSource) then
            return deny()
        end

        local previousRecords = records
        records = {}
        if not saveArray(recordsFile, records) then
            records = previousRecords
            return deny('Prüfungsakten konnten nicht gelöscht werden.')
        end

        broadcastDataChanged('records')
        return { ok = true }
    end

    if action == 'codes:get' then
        if not isStaff(playerSource) then
            return deny('Zugangscodes sind nur für angemeldetes Personal verfügbar.')
        end
        return accessCodes
    end

    if action == 'code:create' then
        if not isStaff(playerSource) then
            return deny()
        end

        local candidateName = trim(payload.candidateName)
        local candidateBirthDate = trim(payload.candidateBirthDate)
        if #candidateName < 3 then
            return deny('Bitte einen vollständigen Bewerbernamen eintragen.')
        end
        if not isValidBirthDate(candidateBirthDate) then
            return deny('Bitte ein gültiges Geburtsdatum eintragen.')
        end

        local generatedCode = generateAccessCode()
        if not generatedCode then
            return deny('Es konnte kein eindeutiger Zugangscode erzeugt werden.')
        end

        local codeData = {
            code = generatedCode,
            createdAt = os.date('!%Y-%m-%dT%H:%M:%SZ'),
            createdBy = staffSessions[playerSource].displayName,
            candidateName = candidateName,
            candidateBirthDate = candidateBirthDate,
            used = false
        }

        table.insert(accessCodes, 1, codeData)
        if not saveArray(codesFile, accessCodes) then
            table.remove(accessCodes, 1)
            return deny('Zugangscode konnte nicht gespeichert werden. Prüfe die Schreibrechte des Resource-Ordners.')
        end

        broadcastDataChanged('codes')
        return { ok = true, code = codeData }
    end

    -- Rückwärtskompatibilität für ältere Admin-Oberflächen.
    if action == 'code:save' then
        if not isStaff(playerSource) then
            return deny()
        end

        local incoming = type(payload.code) == 'table' and payload.code or {}
        return handleRpc(playerSource, 'code:create', {
            candidateName = incoming.candidateName,
            candidateBirthDate = incoming.candidateBirthDate
        })
    end

    if action == 'code:validate' then
        local normalized = normalizeCode(payload.code)
        local candidateName = normalizeName(payload.candidateName)
        local displayName = trim(payload.candidateName)
        local candidateBirthDate = trim(payload.candidateBirthDate)

        if normalized == '' or #displayName < 3 or not isValidBirthDate(candidateBirthDate) then
            return { ok = true, valid = false }
        end

        for index, codeData in ipairs(accessCodes) do
            if type(codeData) == 'table'
                and normalizeCode(codeData.code) == normalized
                and codeData.used ~= true
                and (trim(codeData.candidateName) == '' or normalizeName(codeData.candidateName) == candidateName)
                and (trim(codeData.candidateBirthDate) == '' or trim(codeData.candidateBirthDate) == candidateBirthDate) then

                local previousCodeData = {}
                for key, value in pairs(codeData) do
                    previousCodeData[key] = value
                end

                local nowIso = os.date('!%Y-%m-%dT%H:%M:%SZ')
                codeData.used = true
                codeData.usedBy = displayName
                codeData.usedAt = nowIso
                accessCodes[index] = codeData

                if not saveArray(codesFile, accessCodes) then
                    accessCodes[index] = previousCodeData
                    return deny('Der Zugangscode konnte nicht aktiviert werden. Prüfe die Schreibrechte des Resource-Ordners.')
                end

                local attemptId = ('ATT-%d-%d-%06d'):format(os.time(), tonumber(playerSource) or 0, math.random(0, 999999))
                local candidateId = generateCandidateId()
                candidateSessions[playerSource] = {
                    name = candidateName,
                    displayName = displayName,
                    birthDate = candidateBirthDate,
                    code = codeData.code,
                    candidateId = candidateId,
                    attemptId = attemptId,
                    startedAt = nowIso,
                    validatedAt = os.time()
                }

                broadcastDataChanged('codes')
                return {
                    ok = true,
                    valid = true,
                    candidateId = candidateId,
                    attemptId = attemptId,
                    startedAt = nowIso
                }
            end
        end

        return { ok = true, valid = false }
    end

    if action == 'code:delete' then
        if not isStaff(playerSource) then
            return deny()
        end

        local index = findCodeIndex(payload.code)
        if index then
            local removed = table.remove(accessCodes, index)
            if not saveArray(codesFile, accessCodes) then
                table.insert(accessCodes, index, removed)
                return deny('Zugangscode konnte nicht gelöscht werden.')
            end
            broadcastDataChanged('codes')
        end
        return { ok = true }
    end

    debugPrint(('Unbekannte RPC-Aktion von %s: %s'):format(playerSource, tostring(action)))
    return deny('Unbekannte Serveraktion.')
end

RegisterNetEvent('police_exam:server:rpc', function(requestId, action, payload)
    local playerSource = source
    if type(requestId) ~= 'string' or type(action) ~= 'string' then
        return
    end

    local ok, result = pcall(handleRpc, playerSource, action, payload)
    if not ok then
        print(('[%s] RPC-Fehler (%s): %s'):format(resourceName, action, result))
        result = { ok = false, error = 'Interner Serverfehler.' }
    end

    TriggerClientEvent('police_exam:client:rpcResult', playerSource, requestId, result)
end)

AddEventHandler('playerDropped', function()
    local playerSource = source
    staffSessions[playerSource] = nil
    candidateSessions[playerSource] = nil
end)

AddEventHandler('onResourceStart', function(startedResource)
    if startedResource ~= resourceName then
        return
    end

    math.randomseed(os.time() + GetGameTimer())
    math.random()
    math.random()
    math.random()

    records = loadArray(recordsFile)
    accessCodes = loadArray(codesFile)
    print(('[%s] Gestartet: %d Akten, %d Zugangscodes geladen.'):format(resourceName, #records, #accessCodes))
end)

AddEventHandler('onResourceStop', function(stoppedResource)
    if stoppedResource ~= resourceName then
        return
    end

    saveArray(recordsFile, records)
    saveArray(codesFile, accessCodes)
end)
