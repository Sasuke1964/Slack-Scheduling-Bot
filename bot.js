import { RtmClient, WebClient, CLIENT_EVENTS, RTM_EVENTS } from '@slack/client';
import axios from 'axios';
import express from 'express';
import { messageConfirmation, getQueryParams } from './constants';
import { User } from './models';

let router = express.Router();
let bot_token = process.env.SLACK_BOT_TOKEN || '';
let rtm = new RtmClient(bot_token);
let web = new WebClient(bot_token);

let channel = 'T6AVBE3GX';

// The client will emit an RTM.AUTHENTICATED event on successful connection, with the `rtm.start` payload
rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (rtmStartData) => {
    for (const c of rtmStartData.channels) {
        if (c.is_member && c.name === 'general') { channel = c.id }
    }
    console.log(`Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name}, but not yet connected to a channel`);
});

// you need to wait for the client to fully connect before you can send messages
rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function () {
    // things to do when the bot connects to slack
});

rtm.on(RTM_EVENTS.MESSAGE, function (msg) {
    var dm = rtm.dataStore.getDMByUserId(msg.user);
    if (!dm || dm.id !== msg.channel || msg.type !== 'message') {
        return;
    }

    User.findOne({slackId: msg.user})
    .then(function(user){
      if (!user) {
        return new User(
          {
            slackId: msg.user,
            slackDmId: msg.channel,
            google: {}
          }).save();
      } else {
        return user;
      }
    })
    .then(function(user){
      //console.log('USER is',user);
      if(!user.google){
        rtm.sendMessage(`Hello this is scheduler bot. I need to schedule reminders. Please visit http://localhost:3000/connect?user=${user._id} to setup Google Calendar`,msg.channel);
      } else{
        getQuery(msg.text, msg.user)
            .then(function ({ data }) {
                switch (data.result.action) {
                    case 'meeting.add':
                        console.log(data);
                        if (data.result.actionIncomplete) {
                            rtm.sendMessage(data.result.fulfillment.speech, msg.channel);
                        } else {
                            web.chat.postMessage(msg.channel, data.result.fulfillment.speech, messageConfirmation(data.result.fulfillment.speech, "remember to add code to actaully cancel the meeting/not schedule one"));
                        }
                        break;
                    case 'reminder.add':
                        console.log(data);
                        if (data.result.actionIncomplete) {
                            rtm.sendMessage(data.result.fulfillment.speech, msg.channel);
                        } else {
                            web.chat.postMessage(msg.channel, data.result.fulfillment.speech, messageConfirmation(data.result.fulfillment.speech, "remember to add code to actaully cancel the meeting/not schedule one"));
                        }
                        break;
                    default:
                        console.log('default statement');
                        console.log(data.result.action);
                        if (data.result.action === 'bestbot.reply' || data.result.action.startsWith('smalltalk.')) {
                            rtm.sendMessage(data.result.fulfillment.speech, msg.channel);
                        }
                        return;
                }
            })
            .catch(function (err) {
                console.log('error is ', err);
            });
      }
    })

    // getQuery(msg.text, msg.user)
    //     .then(function ({ data }) {
    //         switch (data.result.action) {
    //             case 'meeting.add':
    //                 console.log(data);
    //                 if (data.result.actionIncomplete) {
    //                     rtm.sendMessage(data.result.fulfillment.speech, msg.channel);
    //                 } else {
    //                     web.chat.postMessage(msg.channel, data.result.fulfillment.speech, messageConfirmation(data.result.fulfillment.speech, "remember to add code to actaully cancel the meeting/not schedule one"));
    //                 }
    //                 break;
    //             default:
    //                 if (data.result.action === 'bestbot.reply' || data.result.action.startsWith('smalltalk.')) {
    //                     rtm.sendMessage(data.result.fulfillment.speech, msg.channel);
    //                 }
    //                 return;
    //         }
    //     })
    //     .catch(function (err) {
    //         console.log('error is ', err);
    //     });
});

function getQuery(msg, sessionId) {
    return axios.get('https://api.api.ai/api/query', {
        params: getQueryParams(msg, sessionId),
        headers: {
            Authorization: `Bearer ${process.env.API_AI_TOKEN}`
        }
    })
}

export { web, rtm };
