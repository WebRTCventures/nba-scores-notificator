const axios = require('axios');
const parameters = require('./parameters');
const variables = require('./variables');
const schedule = require('node-schedule');


function getTeam(teamId) {
    return parameters.teams.find(team => team.id === teamId);
}


function generateTeamUrl(team, date) {
  let { url, teamEndpoint, season, seasonType, } = parameters
  return `${url}${teamEndpoint}/?TeamID=${team.apiId}&Season=${season}&SeasonType=${seasonType.regular}&DateFrom=${date}&DateTo=${date}`;
}


function generateGameUrl(gameId) {
    let { url, gameEndpoint } = parameters;
    return `${url}${gameEndpoint}/?GameId=${gameId}&StartPeriod=1&EndPeriod=4&StartRange=0&EndRange=10&RangeType=1`;
}


function generateScoreMessage(gameData, team, win) {
    const pos = { city: 5, name: 6, points: 22 };
    let userTeamIndex = gameData.rowSet[0][3].toString() === team.apiId ? 0 : 1;
    let userTeamData = gameData.rowSet[userTeamIndex];
    let otherTeamData = gameData.rowSet[1 - userTeamIndex];
    let teamName = (t) => `${t[pos.city]} ${t[pos.name]}`;
    return (
        `${teamName(userTeamData)} ` +
        (win ? 'won' : 'lost') + ' against the ' +
        `${teamName(otherTeamData)} ` +
        `${userTeamData[pos.points]} to ${otherTeamData[pos.points]}`
    );
}


async function getTeamData(team, queryDate) {
    let teamData;
    await axios.get(generateTeamUrl(team, queryDate))
        .then(function (response) {
            let data = response.data.resultSets[0];
            if (data && data.rowSet && data.rowSet.length > 0) {
                teamData = data;
            }    
            else {
                console.log("The team didn't play on the date");
            }
        })
        .catch(function (error) {
            console.log('Error getting the team data', error.message);
        });
    return teamData;
}


async function getGameData(gameId) {
    let gameData;
    await axios.get(generateGameUrl(gameId))
        .then(function (response) {
            let data = response.data.resultSets[5]; // This is the one with the scores
            if (data && data.rowSet && data.rowSet.length > 0) {
                gameData = data;
            }    
            else {
                console.log("The team didn't play on the date");
            }
        })
        .catch(function (error) {
            console.log('Error getting the game data', error.message);
        });
    return gameData;
}


async function sendMessage(message) {
    let number = variables.phoneNumber;

    axios({
      method: 'post',
      url: 'https://api.nexmo.com/v0.1/messages',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      auth: {
        username: variables.nexmoAPIkey,
        password: variables.nexmoSecret
      },
      data: {
        "from": { "type": "sms", "number": number },
        "to": { "type": "sms", "number": number },
        "message": {
          "content": {
            "type": "text",
            "text": message
          }
        }
      }
    })
      .then((response) => {
        console.log('Message sent successfully');
      })
      .catch((err) => {
        console.log(err);
      });
  }


async function getData (teamId) {
    let date = new Date();
    date.setDate(date.getDate()-1);
    let queryDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;    
    let team = getTeam(teamId);
    let teamData = await getTeamData(team, queryDate);
    if (teamData) {
        let gameData = await getGameData(teamData.rowSet[0][1], queryDate);
        let message = generateScoreMessage(gameData, team, teamData[4] === 'W');
        console.log(message);
        sendMessage(message);
    }    
}

function scheduleNotifications() {
    let time = variables.notificationTime.split(":");

    if (time.length === 2 && !isNaN(time[0]) && !isNaN(time[1]) ) {
        let hour = time[0];
        let minutes = time[1];

        console.log(`Scheduling notifications everyday at ${hour}:${minutes}`)
        schedule.scheduleJob({hour: hour, minute: minutes}, () => {
            getData(variables.teamToFollowId);
        });
    }
    else {
        console.log("please enter the date on HH:mm format");
    } 
}

scheduleNotifications();
