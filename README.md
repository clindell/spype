# Fork of spype

This is my personal fork of spype, adapted to run on Heroku.
There are some improvements and added features, but please note that some of them relies on my hacky fork of Skyweb as well. :)

## About spype

A nodejs command line app to create a text relay between Discord and Skype. This simple (read work in progress) app allows you to create "pipes" between a specfic Skype chat and a Discord text channel.  

## Instructions (adapted)

* It is assumed you have Node JS, `npm` and `heroku` installed.
* Copy the `.env.example` as `.env` and set up. See "Configuration" below.
* Run locally with `heroku local` to test settings.
    * For additional useful info output in the console, modify Procfile to: `bot: node spype.js debug`.
* Create and configure Heroku App
    * `heroku create`
    * You might as well `heroku ps:scale web=0`
    * Set all the configuration variables from `.env` on Heroku, either with `heroku config:set` or through the webpage.
        * How-to [Heroku: Configuration and Config Vars](https://devcenter.heroku.com/articles/config-vars)
* Deploy with `git push heroku master`
* Use `heroku ps:scale bot=1` to start, `heroku ps:scale bot=0` to stop.

## Configuration

Spype needs some configuration to work, and to maintain Heroku compatability these are set through environment variables.
When running locally with  `heroku local`, these are loaded from a `.env` file in the same directory as `spype.js`.
Clone the `.env.example` as `.env` and set your own values.
For your online Heroku app, you have to set each setting either via the Settings page (Config Variables) or through the CLI `heroku config:set`. [Heroku: Configuration and Config Vars](https://devcenter.heroku.com/articles/config-vars) 

### Enter the Skype and Discord account details

These should not be your personal log in details, but the details of accounts specifically setup to run Spype.

For discord you can use a 'user account' or a 'bot account'. A bot account is the standard way, and you can [create one here](https://discordapp.com/developers/applications/me#top). After converting the application to a bot account you should be able to get a token value to use.

For Skype, spype currently uses a normal user account.

`SKYPE_USERNAME` is used for login. It can be either a username, or an email, depending on your Skype Account.


### Set up your 'pipes' 

Replace the `pipes` in your `.env` with the Discord-to-Skype connections that you want to have.

To find the conversation ID (`skypeId`) for a Skype chat. use the `/get name` command in the Skype client.

The Discord channel ID (`discordId`) can be found as the last part of the URL when using Discord in a browser, or by using the "Copy Link" option when right clicking on a channel in the client (If you have enabled Developer Mode in the settings). 

