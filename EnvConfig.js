var EnvConfig = {
    skype_username : process.env.SKYPE_USERNAME,
    skype_password : process.env.SKYPE_PASSWORD,
    discord_token : process.env.DISCORD_TOKEN,
    pipes : JSON.parse(process.env.PIPES),
}

module.exports = EnvConfig;