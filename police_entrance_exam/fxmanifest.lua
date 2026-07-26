fx_version 'cerulean'
game 'gta5'
lua54 'yes'

author 'FiveM conversion by OpenAI'
description 'Standalone Polizei-Eignungsprüfung mit NUI und Lua-Persistenz'
version '1.2.0'

ui_page 'web/index.html'

shared_script 'config.lua'
client_script 'client.lua'
server_scripts {
    'server_config.lua',
    'server.lua'
}

files {
    'web/index.html',
    'web/styles.css',
    'web/questions.js',
    'web/app.js',
    'web/logo.svg'
}
