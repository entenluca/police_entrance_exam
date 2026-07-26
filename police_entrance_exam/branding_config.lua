--[[
  Branding-Konfiguration für die Polizei-Eignungsprüfung
  Hier können Dienststellenname, Region und Logo zentral angepasst werden.
]]

BrandingConfig = {}

-- Region / Land / Behörde (oberer Titel, Eyebrow)
BrandingConfig.Region = 'Land Niedersachsen'

-- Name der Dienststelle (Hauptüberschrift)
BrandingConfig.Department = 'Polizeiinspektion Hannover'

-- Text in der Tablet-Leiste oben (leer = Region .. ' · ' .. Department)
BrandingConfig.ChromeTitle = ''

-- Logo: relativer Pfad in web/ ODER externer Bild-Link (https://...)
-- Beispiele:
--   'logo.svg'
--   'https://example.com/polizei-logo.png'
--   'nui://police_entrance_exam/web/logo.svg'
BrandingConfig.LogoUrl = 'logo.svg'

-- Alt-Text für das Logo
BrandingConfig.LogoAlt = 'Dienststellenlogo'

-- App-Titel (Browser-Tab, Barrierefreiheit)
BrandingConfig.AppTitle = 'Polizei-Eignungsprüfung'

-- Standard-Untertitel unter dem Dienststellennamen
BrandingConfig.Subtitle = 'Auswahlverfahren – digitale Eignungsprüfung'

-- Überschrift auf dem Zertifikat
BrandingConfig.CertificateTitle = 'Zertifikat über die bestandene Eignungsprüfung'

-- Bezeichnung für den internen Personalbereich
BrandingConfig.StaffLabel = 'Personalwesen'

-- Präfixe für automatische Nummern
BrandingConfig.CandidateIdPrefix = 'PIH-EAV'
BrandingConfig.CertificatePrefix = 'PIH-ZERT'
