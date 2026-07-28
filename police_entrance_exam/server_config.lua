-- Diese Datei wird ausschließlich serverseitig geladen.
-- DIE STANDARD-ZUGANGSDATEN VOR PRODUKTIVBETRIEB ÄNDERN.
-- jobGrade steuert den Zugriff auf erweiterte Einstellungen
-- (siehe Config.SettingsAccessFromGrade in config.lua).
Config.StaffAccounts = {
    {
        username = 'admin',
        password = 'PoliceExam2026!',
        displayName = 'Personalwesen',
        rank = 'Polizeioberrat',
        jobGrade = 10
    }
}

-- Serverseitiger Lösungsschlüssel. Wird nicht an Clients ausgeliefert.
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
