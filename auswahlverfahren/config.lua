--[[
  Auswahlverfahren – zentrale Konfiguration
  Nach Änderungen in der Serverkonsole ausführen:
    refresh
    restart auswahlverfahren
]]

Config = {}

-- Befehl zum Öffnen der Anwendung.
Config.Command = 'auswahlverfahren'

-- Optionales Standard-Keybind. Auf false setzen, um kein Keybind anzulegen.
Config.DefaultKey = false -- Beispiel: 'F7'

-- Maximale Anzahl gespeicherter Prüfungsakten.
Config.MaxRecords = 500

-- Gültigkeitsdauer einer gestarteten Bewerbersitzung in Sekunden.
Config.CandidateSessionTimeout = 3600

-- Konsolenmeldungen für Speicher- und RPC-Fehler.
Config.Debug = false

-- Realistische Bestehensregeln für das Auswahlverfahren
Config.Exam = {
    PassPercentage = 78,
    CategoryMinimum = 55,
    ExcellentPercentage = 88,
}

-- Police-Job für Rangprüfung (ESX/QBCore). Framework: auto | esx | qbcore | none
Config.Police = {
    JobName = 'police',
    Framework = 'auto',
}

-- Berechtigungen: nur die aufgelisteten Police-Rang-IDs sind erlaubt (kein Mindestrang).
Config.Permissions = {
    -- z.B. nur Rang 5 darf ändern, Rang 7 nicht
    ChangePasswordRankIds = { 5 },
    -- z.B. nur Rang 8 und 9 dürfen andere Konten zurücksetzen
    ResetStaffPasswordRankIds = { 8 },
}

-- Personal-Zugangsdaten (werden beim ersten Start nach data/staff_accounts.json übernommen)
Config.StaffAccounts = {
    {
        username = 'admin',
        password = 'PoliceExam2026!',
        displayName = 'Personalwesen',
        rankId = 8,
    },
}

-- Branding / Dienststellenangaben
Config.Branding = {
    Region = 'Land Niedersachsen',
    Department = 'Polizeiinspektion Hannover',
    ChromeTitle = '',
    LogoUrl = 'logo.svg',
    LogoAlt = 'Dienststellenlogo',
    AppTitle = 'Auswahlverfahren',
    Subtitle = 'Digitale Eignungsprüfung',
    CertificateTitle = 'Zertifikat über die bestandene Eignungsprüfung',
    StaffLabel = 'Personalwesen',
    CandidateIdPrefix = 'PIH-EAV',
    CertificatePrefix = 'PIH-ZERT',
}

-- Serverseitiger Lösungsschlüssel (wird nicht an Clients ausgeliefert)
Config.ExamQuestions = {
    ['L1'] = { category = 'LOGIC', correct = 'B', weight = 2 },
    ['L2'] = { category = 'LOGIC', correct = 'C', weight = 2 },
    ['L3'] = { category = 'LOGIC', correct = 'A', weight = 2 },
    ['L4'] = { category = 'LOGIC', correct = 'B', weight = 2 },
    ['L5'] = { category = 'LOGIC', correct = 'A', weight = 2 },
    ['V1'] = { category = 'VERBAL', correct = 'B', weight = 2 },
    ['V2'] = { category = 'VERBAL', correct = 'C', weight = 2 },
    ['V3'] = { category = 'VERBAL', correct = 'D', weight = 1 },
    ['V4'] = { category = 'VERBAL', correct = 'C', weight = 2 },
    ['V5'] = { category = 'VERBAL', correct = 'C', weight = 2 },
    ['J1'] = { category = 'JUDGMENT', correct = 'B', weight = 2 },
    ['J2'] = { category = 'JUDGMENT', correct = 'C', weight = 2 },
    ['J3'] = { category = 'JUDGMENT', correct = 'B', weight = 2 },
    ['J4'] = { category = 'JUDGMENT', correct = 'C', weight = 2 },
    ['J5'] = { category = 'JUDGMENT', correct = 'B', weight = 2 },
    ['C1'] = { category = 'CONCENTRATION', correct = 'B', weight = 2 },
    ['C2'] = { category = 'CONCENTRATION', correct = 'A', weight = 2 },
    ['C3'] = { category = 'CONCENTRATION', correct = 'D', weight = 1 },
    ['C4'] = { category = 'CONCENTRATION', correct = 'C', weight = 2 },
    ['C5'] = { category = 'CONCENTRATION', correct = 'C', weight = 1 },
}
