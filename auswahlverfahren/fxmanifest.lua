fx_version 'cerulean'
game 'gta5'
lua54 'yes'

author 'FiveM conversion by OpenAI'
description 'Standalone Auswahlverfahren mit NUI und Lua-Persistenz'
version '1.3.0'

ui_page 'web/index.html'

shared_scripts {
    'config.lua',
}

client_script 'client.lua'
server_scripts {
    'server.lua'
}

files {
    'web/index.html',
    'web/styles.css',
    'web/questions.js',
    'web/dom.js',
    'web/app.js',
    'web/logo.svg'
}
