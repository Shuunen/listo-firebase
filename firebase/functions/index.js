'use strict';

const functionVersion = '0.0.4'
const functions = require('firebase-functions'); // Cloud Functions for Firebase library
const DialogflowApp = require('actions-on-google').DialogflowApp;
// Google Assistant helper library
exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
    console.log(`Dialogflow Request headers: ${JSON.stringify(request.headers)}`);
    console.log(`Dialogflow Request body: ${JSON.stringify(request.body)}`);
    if (request.body.queryResult) {
        return processV2Request(request, response);
    } else {
        console.log('Invalid Request');
        return response.status(400).end('Invalid Webhook Request (expecting v2 webhook request)');
    }
});

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

/*
* Function to handle v1 webhook requests from Dialogflow
*/
function processV1Request(request, response) {
    let { action, parameters, fulfillment } = request.body.result; // https://dialogflow.com/docs/actions-and-parameters
    // Create handlers for Dialogflow actions as well as a 'default' handler
    const actionHandlers = {
        // The default welcome intent has been matched, welcome the user (https://dialogflow.com/docs/events#default_welcome_intent)
        'input.welcome': () => {
            // Use the Actions on Google lib to respond to Google requests; for other requests use JSON
            sendResponse('Hello, Welcome to my Dialogflow agent!'); // Send simple response to user
        },
        // The default fallback intent has been matched, try to recover (https://dialogflow.com/docs/intents#fallback_intents)
        'input.unknown': () => {
            // Use the Actions on Google lib to respond to Google requests; for other requests use JSON
            sendResponse('I\'m having trouble, can you try that again?'); // Send simple response to user
        },
        // Default handler for unknown or undefined actions
        default: () => {
            // Use the Actions on Google lib to respond to Google requests; for other requests use JSON
            let response = fulfillment.speech;
            let type = parameters['type-of-thing'];
            type = type.replace('movie', 'ce film').replace('serie', 'cette série').replace('music', 'cette musique');
            response = response.replace('{type}', type);
            response = response.replace('{thing}', parameters['thing-to-watch'])
            response = capitalizeFirstLetter(response);
            response += ` ${functionVersion}`
            /*
             "thing-to-watch": "Black Mirror",
             "type-of-thing": "serie"
            */
            const responseToUser = {
                // data: richResponsesV1, // Optional, uncomment to enable
                // outputContexts: [{'name': 'weather', 'lifespan': 2, 'parameters': {'city': 'Rome'}}], // Optional, uncomment to enable
                speech: response, // spoken response
                text: response, // displayed response
            };
            sendResponse(responseToUser);
        },
    };

    // If undefined or unknown action use the default handler
    if (!actionHandlers[action]) {
        action = 'default';
    }

    // Run the proper handler function to handle the request from Dialogflow
    actionHandlers[action]();

    // Function to send correctly formatted responses to Dialogflow which are then sent to the user
    function sendResponse(responseToUser) {
        // if the response is a string send it as a response to the user
        if (typeof responseToUser === 'string') {
            const responseJson = {};
            responseJson.speech = responseToUser; // spoken response
            responseJson.displayText = responseToUser; // displayed response
            response.json(responseJson); // Send response to Dialogflow
        } else {
            // If the response to the user includes rich responses or contexts send them to Dialogflow
            const responseJson = {};
            // If speech or displayText is defined, use it to respond (if one isn't defined use the other's value)
            responseJson.speech = responseToUser.speech || responseToUser.displayText;
            responseJson.displayText = responseToUser.displayText || responseToUser.speech;
            // Optional: add rich messages for integrations (https://dialogflow.com/docs/rich-messages)
            responseJson.data = responseToUser.data;
            // Optional: add contexts (https://dialogflow.com/docs/contexts)
            responseJson.contextOut = responseToUser.outputContexts;
            console.log(`Response to Dialogflow: ${JSON.stringify(responseJson)}`);
            response.json(responseJson); // Send response to Dialogflow
        }
    }
}

/*
Ok je vais ajouter {{type}} à la liste 👍
C'est noté ! J'ai ajouté {{type}} à la liste 😊
J'ai ajouté {{type}} à la liste 😉
{{type}} a bien été ajouté à la liste 👌
Ok je vais ajouter "{{thing}}" à la liste 👌
"{{thing}}" a bien été ajouté à la liste 👌
J'ajoute "{{thing}}" à la liste 👍
*/


/*
* Function to handle v2 webhook requests from Dialogflow
*/
function processV2Request(request, response) {
    // An action is a string used to identify what needs to be done in fulfillment
    let action = (request.body.queryResult.action) ? request.body.queryResult.action : 'default';
    // the fulfillment text from DialogFlow
    // let fulfillmentText = request.body.queryResult.fulfillmentText;
    // Parameters are any entities that Dialogflow has extracted from the request.
    let parameters = request.body.queryResult.parameters || {}; // https://dialogflow.com/docs/actions-and-parameters
    // if all params has been given
    // let allRequiredParamsPresent = request.body.queryResult.allRequiredParamsPresent;
    // Contexts are objects used to track and store conversation state
    let inputContexts = request.body.queryResult.contexts; // https://dialogflow.com/docs/contexts
    let outputContexts = request.body.queryResult.outputContexts; // https://dialogflow.com/docs/contexts
    // Get the request source (Google Assistant, Slack, API, etc)
    let requestSource = (request.body.originalDetectIntentRequest) ? request.body.originalDetectIntentRequest.source : undefined;
    // Get the session ID to differentiate calls from different users
    let session = (request.body.session) ? request.body.session : undefined;

    // Create handlers for Dialogflow actions as well as a 'default' handler
    const actionHandlers = {
        // The default welcome intent has been matched, welcome the user (https://dialogflow.com/docs/events#default_welcome_intent)
        'input.welcome': () => {
            sendResponse('Réponse à input.welcome'); // Send simple response to user
        },
        // The default fallback intent has been matched, try to recover (https://dialogflow.com/docs/intents#fallback_intents)
        'input.unknown': () => {
            // Use the Actions on Google lib to respond to Google requests; for other requests use JSON
            sendResponse('Réponse à input.unknown'); // Send simple response to user
        },
        // Default handler for unknown or undefined actions
        'default': () => {
            let thing = parameters['thing-to-watch'];
            if (!thing && outputContexts && outputContexts.length) {
                outputContexts.forEach(outputContext => {
                    if (!thing && outputContext.parameters && outputContext.parameters['thing-to-watch']) {
                        thing = outputContext.parameters['thing-to-watch'];
                    }
                })
                console.log('thing was not given in parameters')
                console.log((thing.length ? 'but thing was found' : 'and also not found') + ' in output context')
            }
            let type = parameters['type-of-thing'];
            type = type.replace('movie', 'ce film').replace('serie', 'cette série').replace('music', 'cette musique');
            let fulfillmentText = '';
            let response = {};
            let addRichResponse = false;
            if (thing.length && type.length) {
                // Case 1 : we have thing & type
                fulfillmentText = 'Ok je vais ajouter {type} "{thing}" à la liste 👍';
            } else if (thing.length) {
                // Case 2 : we have only thing
                fulfillmentText = '"{thing}" ? C\'est un film, une série, une musique ?';
                // ask for type
                addRichResponse = true;
            } else {
                // Case 3 : we miss thing
                fulfillmentText = 'Je n\'ai pas saisi votre demande, quelle oeuvre essayez-vous d\'ajouter ?';
            }
            fulfillmentText = fulfillmentText.replace('{type}', type);
            fulfillmentText = fulfillmentText.replace('{thing}', thing)
            fulfillmentText = capitalizeFirstLetter(fulfillmentText);
            fulfillmentText += ' ' + functionVersion;
            response.fulfillmentText = fulfillmentText;
            if (addRichResponse) {
                response.fulfillmentMessages = buildRichResponseV2(fulfillmentText);
            }
            sendResponse(response);
        }
    };

    // If undefined or unknown action use the default handler
    if (!actionHandlers[action]) {
        action = 'default';
    }

    // Run the proper handler function to handle the request from Dialogflow
    actionHandlers[action]();

    // Function to send correctly formatted responses to Dialogflow which are then sent to the user
    function sendResponse(responseToUser) {
        // if the response is a string send it as a response to the user
        if (typeof responseToUser === 'string') {
            let responseJson = { fulfillmentText: responseToUser }; // displayed response
            response.json(responseJson); // Send response to Dialogflow
        } else {
            // If the response to the user includes rich responses or contexts send them to Dialogflow
            let responseJson = {};

            // Define the text response
            responseJson.fulfillmentText = responseToUser.fulfillmentText;
            // Optional: add rich messages for integrations (https://dialogflow.com/docs/rich-messages)
            if (responseToUser.fulfillmentMessages) {
                responseJson.fulfillmentMessages = responseToUser.fulfillmentMessages;
            }
            // Optional: add contexts (https://dialogflow.com/docs/contexts)
            if (responseToUser.outputContexts) {
                responseJson.outputContexts = responseToUser.outputContexts;
            }

            // Send the response to Dialogflow
            console.log('Response to Dialogflow: ' + JSON.stringify(responseJson));
            response.json(responseJson);
        }
    }
}

function buildRichResponseV2(title) {
    return [
        { // this first object is mandatory
            'platform': 'ACTIONS_ON_GOOGLE',
            'simple_responses': {
                'simple_responses': [
                    {
                        'text_to_speech': title,
                        'display_text': title
                    }
                ]
            }
        },
        {
            'platform': 'ACTIONS_ON_GOOGLE',
            'suggestions': { // dont forget to put suggestions into a suggestions object -_-'''''''
                suggestions: [
                    { "title": "Film" },
                    { "title": "Série" },
                    { "title": "Musique" }
                ]
            }
        }
        /* THIS DOES NOT WORKS
        // it return an intent.action.OPTION instead of actions.intent.TEXT like suggestions does above
        // and break the response from user and is not catched by addathingtowatchlist-followup
        // -_-''''
        {
            'platform': 'ACTIONS_ON_GOOGLE',
            'listSelect': {
                'items': [
                    {
                        "info": { "key": 'movie' },
                        "title": "Film",
                    },
                    {
                        "info": { "key": 'serie' },
                        "title": "Série",
                    },
                    {
                        "info": { "key": 'music' },
                        "title": "Musique",
                    },
                ]
            }
        },
        */
    ]
}
