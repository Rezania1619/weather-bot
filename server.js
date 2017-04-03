var express = require('express');
var app = express();
var request = require('request')

app.set('port', (process.env.PORT || 5000));

const MongoClient = require('mongodb').MongoClient
const TB = require('node-telegram-bot-api');

const url = process.env.APP_URL || 'https://ar-weather-bot.herokuapp.com:443';
const token = '345786334:AAHvSLQT7UfKp6pzUwqkfWyuxu1WztuugbY';

const options = {
    webHook: {
        port: process.env.PORT
    }
};

const bot = new TB(token, options);
bot.setWebHook(`${url}/bot${token}`);

var db

MongoClient.connect('mongodb://alireza1619:rrr161920@ds147920.mlab.com:47920/weather_bot', function (err, database) {
    if (err) return console.log(err)
    db = database;

    bot.on('message', msg => {
        switch (msg.text) {
            case '/start':
                handleStart(msg.from.id, msg.chat.id);
                break;
            case 'هوای امروز':
                handleTodayWeather(msg.from.id, msg.chat.id);
                break;
            case 'هوای فردا':
                handleTomorrowWeather(msg.from.id, msg.chat.id);
                break;
            case '5 روز آینده':
                handle5daysForecastWeather(msg.from.id, msg.chat.id);
                break;
            case 'تنظیمات':
                handleSettings(msg.from.id, msg.chat.id);
                break;
            case 'بازگشت':
                handleBack(msg.from.id, msg.chat.id);
                break;
            case 'تغییر شهر':
                getCity(msg.from.id, msg.chat.id, true);
                break;
            default:
                break;
        }
    })
})

function handleStart(telegramId, chatId) {
    db.collection('users').insert({
        telegramId: telegramId,
        city: ''
    }, (err) => {
        if (err) return console.log(err);
        bot.sendMessage(chatId, 'سلام');
        getCity(telegramId, chatId, false);
    });
}

function getCity(telegramId, chatId, withBack) {
    const GetCityOpts = {
        reply_markup: JSON.stringify({
            keyboard: withBack ? [
                ['بازگشت']
            ] : [],
            force_reply: !withBack
        })
    };
    const opts = {
        reply_markup: JSON.stringify({
            keyboard: [
                ['هوای امروز', 'هوای فردا'],
                ['5 روز آینده', 'تنظیمات']
            ]
        })
    };
    bot.sendMessage(chatId, 'نام شهرتو بنویس', GetCityOpts).then(sent => {
        bot.onReplyToMessage(chatId, sent.message_id, reply => {
            db.collection('users').update({
                telegramId: telegramId
            }, {
                $set: {
                    city: reply.text
                }
            }, (err) => {
                if (err) return console.log(err)
                bot.sendMessage(chatId, 'عالی! شهر برا شما تنظیم شد', opts);
            })
        })
    })
}

function handleTodayWeather(telegramId, chatId) {
    db.collection('users').find({
        telegramId: telegramId
    }).toArray((err, users) => {
        request(`http://api.openweathermap.org/data/2.5/weather?q=${users[0].city}&APPID=f311a0682747102619138c028ec41c0e`, function (error, response, body) {
            console.log('error:', error); // Print the error if one occurred
            console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
            console.log('body:', body); // Print the HTML for the Google homepage.
            bot.sendMessage(chatId, `هوای امروز ${users[0].city}\nوضعیت کلی: ` + JSON.parse(body).weather[0].main);
        });
    })
}


function handleTomorrowWeather(telegramId, chatId) {
    db.collection('users').find({
        telegramId: telegramId
    }).toArray((err, users) => {
        request(`http://api.openweathermap.org/data/2.5/forecast?q=${users[0].city}&APPID=f311a0682747102619138c028ec41c0e`, function (error, response, body) {
            console.log('error:', error); // Print the error if one occurred
            console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
            console.log('body:', body); // Print the HTML for the Google homepage.
            bot.sendMessage(chatId, `هوای فردای ${users[0].city}\nوضعیت کلی: ` + JSON.parse(body).list[0].weather[0].main);
        });
    })
}

function handle5daysForecastWeather(telegramId, chatId) {
    var emojis = [
        ['Rain', '🌧'],
        ['Clear', '☀️'],
        ['Clouds', '☁️']
    ];
    db.collection('users').find({
        telegramId: telegramId
    }).toArray((err, users) => {
        request(`http://api.openweathermap.org/data/2.5/forecast?q=${users[0].city}&APPID=f311a0682747102619138c028ec41c0e`, function (error, response, body) {
            console.log('error:', error); // Print the error if one occurred
            console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
            console.log('body:', body); // Print the HTML for the Google homepage.
            bot.sendMessage(chatId, `هوای فردای ${users[0].city}\nوضعیت کلی: ` + JSON.parse(body).list.map((l, i) => `${i}. ${emojis.find(emoji => emoji[0] == l.weather[0].main)[1]} ${l.weather[0].main}`).join("\n"));
        });
    })
}
//یس
function handleSettings(telegramId, chatId) {
    const opts = {
        reply_markup: JSON.stringify({
            keyboard: [
                ['تغییر شهر', 'بازگشت']
            ]
        })
    };
    bot.sendMessage(chatId, 'تنظمیات خدمت شما: ', opts);
}

function handleBack(telegramId, chatId) {
    const opts = {
        reply_markup: JSON.stringify({
            keyboard: [
                ['هوای امروز', 'هوای فردا'],
                ['5 روز آینده', 'تنظیمات']
            ]
        })
    };
    bot.sendMessage(chatId, 'بازگشت', opts);
}
/*{
    "coord": {
        "lon": 58.68,
        "lat": 34.35
    },
    "weather": [{
        "id": 803,
        "main": "Clouds",
        "description": "broken clouds",
        "icon": "04d"
    }],
    "base": "stations",
    "main": {
        "temp": 291.15,
        "pressure": 1011,
        "humidity": 48,
        "temp_min": 291.15,
        "temp_max": 291.15
    },
    "visibility": 10000,
    "wind": {
        "speed": 3.1,
        "deg": 70
    },
    "clouds": {
        "all": 75
    },
    "dt": 1491206400,
    "sys": {
        "type": 1,
        "id": 7077,
        "message": 0.004,
        "country": "IR",
        "sunrise": 1491184166,
        "sunset": 1491229677
    },
    "id": 132961,
    "name": "Gonabad",
    "cod": 200
}*/