Config = {}

-- Befehl zum Öffnen der Anwendung.
Config.Command = 'policeexam'

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
    -- Mindest-Gesamtquote in Prozent (typisch anspruchsvoll für Polizei-Auswahl)
    PassPercentage = 78,
    -- Mindestquote in JEDEM Prüfungsbereich (kein Bereich darf zu schwach sein)
    CategoryMinimum = 55,
    -- Ab dieser Gesamtquote gilt die Bewertung „sehr geeignet“
    ExcellentPercentage = 88,
}
