var util = require("util");
var fs = require('fs');
var toMarkdown = require('to-markdown');

var config = require("./EnvConfig");
var output = require("./Output");
var pipes = require("./PipesHelper");
var SkywebClient = require('skyweb');

var SkypeHelper = 
{
	skyweb : new SkywebClient(),
	isConnected : false,
	debug : false,
	botAccountUsername : '',

	additionalMessageContentQueue : new Array(), // Holds URIs while we run converters
	registerAdditionalMessageContent : function(uri, fileName) { // Adds URIs as object to queue, used by converters
		var contentData = {uri:uri, fileName: fileName, fetched:false};
		SkypeHelper.additionalMessageContentQueue.push(contentData);
	},
	checkAdditionalMessageContent : function() { // True if we got additional content
		return (SkypeHelper.additionalMessageContentQueue.length > 0);
	},
	fetchAdditionalMessageContent : function(pipe, message, user) { // Parse content queue, add reference data and request
		// Prep data storage
		var messageData = {pipe:pipe, message:message, user:user};

		// Get additional content to fetch
		messageData.additionalContent = SkypeHelper.additionalMessageContentQueue;
		SkypeHelper.additionalMessageContentQueue = new Array(); // Reset content queue
		messageData.additionalContent.forEach(function(contentData, index) {
			contentData.referenceId = user+index; // Add Reference for when we later recieve the data
		});

		// Store message
		SkypeHelper.registerWaitingMessage(messageData);

		// Fetch additional content
		messageData.additionalContent.forEach(function(contentData, index) {
			SkypeHelper.skyweb.fetchURIObject(contentData.uri, contentData.referenceId, SkypeHelper.skyWebAdditionalContentRecieved);
		});
	},
	waitingMessages : new Array(), // Holds messages for which we are fetching additional content
	registerWaitingMessage : function(messageData) { // Store waiting message
		SkypeHelper.waitingMessages.push(messageData);
	},
	removeWaitingMessage : function(element) {
	    const index = SkypeHelper.waitingMessages.indexOf(element);
	    
	    if (index !== -1) {
	        SkypeHelper.waitingMessages.splice(index, 1);
	    }
	},


	converters : 
	[
		{
			filter: ['a', 'ss', 'quote', 'legacyquote'],
			replacement: function(content) { return content; }
		},
		{
			filter: "pre",
			replacement: function(content) { return "`" + content + "`"; }
		},
		{
			filter: "uriobject",
			replacement: function(content, node)
			{ 
				//console.log(content);
				var uri = node.getAttribute("uri"); // Get URI

				var fileName = "unknown";

				var originalName = node.getElementsByTagName("originalname")[0];
				if(originalName) {
					fileName = originalName.getAttribute("v");
				} else {
					var meta = node.getElementsByTagName("meta")[0];
					if(meta) {
						var metaName = meta.getAttribute("originalname");
						if(metaName) fileName = metaName;
					}
				}

				SkypeHelper.registerAdditionalMessageContent(uri, fileName); // Register as additional content
				return util.format("`File: %s \nURI: %s `", fileName, uri); 
			}
		},
		{
			filter: "topicupdate",
			replacement : function(content, node)
			{
				var initiatorTag = node.getElementsByTagName("initiator")[0];
				var valueTag = node.getElementsByTagName("value")[0];
				
				var initiator = initiatorTag.innerHTML.replace("8:", "");
				var value = valueTag.innerHTML;
				
				if(initiatorTag && valueTag)
					return util.format("Skype topic changed to \"%s\" by \"%s\".", value, initiator);
				else
					return "Someone changed the skype topic.";
			}
		},
		{
			filter: "deletemember",
			replacement : function(content, node)
			{
				var initiatorTag = node.getElementsByTagName("initiator")[0];
				var targetTag = node.getElementsByTagName("target")[0];
				
				var initiator = initiatorTag.innerHTML.replace("8:", "");
				var target = targetTag.innerHTML.replace("8:", "");
				
				if(initiatorTag && targetTag)
				{
					if(initiator != target)
						return util.format("\"%s\" was removed from the skype group by \"%s\".", target, initiator);
					else
						return util.format("\"%s\" left the skype group.", target);
				}
				else
					return "Someone left the skype group.";
			}
		},
		{
			filter: "addmember",
			replacement : function(content, node)
			{
				var initiatorTag = node.getElementsByTagName("initiator")[0];
				var targetTag = node.getElementsByTagName("target")[0];
				
				var initiator = initiatorTag.innerHTML.replace("8:", "");
				var target = targetTag.innerHTML.replace("8:", "");
				
				if(initiatorTag && targetTag)
				{
					if(initiator != target)
						return util.format("\"%s\" was added to the skype group by \"%s\".", target, initiator);
					else
						return util.format("\"%s\" joined the skype group.", target);
				}	
				else
					return "Someone joined the skype group.";
			}
		}
	],
	Connect : function()
	{
		output.write("Connecting Skype...\n");
		try
		{
			this.skyweb.login(config.skype_username, config.skype_password).then((skypeAccount) => 
			{    
				output.write(" * Skype connected.\n")
				SkypeHelper.skyweb.setStatus('Online');
				SkypeHelper.isConnected = true;
				SkypeHelper.botUsername = SkypeHelper.skyweb.skypeAccount.selfInfo.username;

				pipes.each(function(pipe)
				{
					if(pipe.announceConnection)
						SkypeHelper.SendMessage(pipe, "Reconnected", "SPYPE");
				});
			});	
			this.skyweb.messagesCallback = SkypeHelper.skypeMessagesReceived;
		}
		catch(err)
		{
			output.write("SkypeHelper.Connect() error: \n");
			output.write(err);
			output.write("\n");
			this.isConnected = false;
		}
		this.skyweb.on("error", this.errorListener);
	},
	errorListener : function(eventName, error)
	{
		console.log("!! Error occured in SkypeHelper: " + error);
		process.exit();
	},
	SendMessage : function(pipe, message, sender)
	{
		var skypeMessage = "";

		//if(pipe.lastSkypeSender != null)
			//skypeMessage += "\n";

		if(sender != null && sender != pipe.lastSkypeSender)
			skypeMessage += util.format("[%s]\n", sender);
		
		skypeMessage += message;
		
		output.write("SKYPE: (" + pipe.name + ") " + skypeMessage);
		
		if(SkypeHelper.isConnected)
		{
			try
			{
				SkypeHelper.skyweb.sendMessage(pipe.skypeId, skypeMessage);
				pipe.lastSkypeSender = sender;	
				output.write("SENT!\n");
			}
			catch(err)
			{
				output.write("FAILED! Error:\n");
				output.write(err);
				output.write("\n");
			}
		}
		else
		{
			output.write("FAILED! Skype is not connected.\n");
		}
	},
	Callbacks : [],
	MessageCallback : function(callback)
	{
		this.Callbacks.push(callback);
	},

	skyWebAdditionalContentRecieved : function(referenceId, success, recievedData) {
		output.write("DING DING DING skyWebAdditionalContentRecieved\n");
		output.write("referenceId: " + referenceId + "\n");
		output.write("success: " + success + "\n");
		if(success) {
			output.write("recievedData.type: " + recievedData.type + "\n");
			//output.write("recievedData.buffer: " + recievedData.buffer + "\n");
		} else {
			output.write("!!! Failed to retrieve some additional content");
		}

		var messageData = null
		var contentData = null
		SkypeHelper.waitingMessages.forEach(function(waitingMessageData, index) {
			waitingMessageData.additionalContent.forEach(function(waitingContentData, index) {
				if(waitingContentData.referenceId == referenceId) {
					messageData = waitingMessageData;
					contentData = waitingContentData
				}
			});
		});

		if(messageData === null || contentData == null) {
			output.write("Failed to get message or content data :<");
			output.write("messageData: " + messageData);
			output.write("contentData: " + contentData);
			return;
		}

		contentData.content = recievedData;
		contentData.success = success;
		contentData.fetched = true;

		// Check if all content complete
		var isComplete = true;
		messageData.additionalContent.forEach(function(contentData, index) {
			if(contentData.fetched == false) {
				isComplete = false;
				output.write("Not complete: " + contentData);
				//break;
			}
		});

		// Send message and data if complete
		if(isComplete) {
			output.write("All content complete, pushing message");
			output.write("Removing messageData from waitingMessage");
			SkypeHelper.removeWaitingMessage(messageData);

			// Send to callbacks
			for(var i = 0; i < SkypeHelper.Callbacks.length; i++)
			{
				console.log("final forEach additionalContent");
				messageData.additionalContent.forEach(function(contentData, index) {
					console.log("URI " + contentData.uri);
					//console.log("Buffer " + contentData.content.buffer);
					console.log("Type " + contentData.content.type);
					console.log("ReferenceId " + contentData.referenceId);
					console.log("FileName " + contentData.fileName);
				});


				SkypeHelper.Callbacks[i](messageData.pipe, messageData.message, messageData.user, messageData.additionalContent);
			}		
		}
	},

	skypeMessagesReceived : function(messages)
	{
		messages.forEach(function (message) 
		{

			// Ensure message not sent by us
			var acceptMessage = (message.resource.from.indexOf(SkypeHelper.botUsername) === -1);

			// Acceptable message?
			if(acceptMessage && message.resource.messagetype !== 'Control/Typing' && message.resource.messagetype !== 'Control/ClearTyping')
			{
				// Get conversation link
				var conversationLink = message.resource.conversationLink;
				var conversationId = conversationLink.substring(conversationLink.lastIndexOf('/') + 1);
				var pipe = pipes.getPipe({ skypeId: conversationId });
				if(pipe != null)
				{
					// Skype message received, clear lastSkypeSender
					pipe.lastSkypeSender = null;
					// Output received object (testing)
					if(SkypeHelper.debug)
					{
						output.write("RECEIVED IN SKYPE\n");
						output.write(message);
						output.write("\n");
					}
					// Clean up message from skype (remove code etc)
					var cleanMessage = toMarkdown(message.resource.content, { converters: SkypeHelper.converters });

					// Get username
					var userName = message.resource.imdisplayname;

					// Check for additional content
					if(SkypeHelper.checkAdditionalMessageContent()) {
						output.write("ADDITIONAL CONTENT DETECTED");
						SkypeHelper.fetchAdditionalMessageContent(pipe, cleanMessage, userName);
					}
					else {
						// Send to callbacks
						for(var i = 0; i < SkypeHelper.Callbacks.length; i++)
						{
							SkypeHelper.Callbacks[i](pipe, cleanMessage, userName, false);
						}
					}

					
				}
			}
		});
	}
}

module.exports = SkypeHelper;