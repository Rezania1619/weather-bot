var express = require('express');
var app = express();
var request = require('request')
var moment = require('moment')
moment.locale('fa');
app.set('port', (process.env.PORT || 5000));

const MongoClient = require('mongodb').MongoClient
const TB = require('node-telegram-bot-api');

/*var kue = require('kue')
  , queue = kue.createQueue();*/

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

var emojis = [
    ['Rain', '🌧'],
    ['Clear', '☀️'],
    ['Clouds', '☁️'],
    ['Snow', '❄️']
];
var descriptionToFa = [
    ['light rain', 'باران خفیف'],
    ['light snow', 'برف خفیف'],
    ['sky is clear', 'آفتابی'],
    ['snow', 'بارش برف'],
    ['moderate rain', 'باران نیمه شدید'],
    ['few clouds', 'کمی ابری'],
    ['heavy intensity rain', 'باران بسیار شدید'],
    ['broken clouds', 'ابرهای تکه تکه'],
    ['overcast clouds', 'کاملا ابری'],
    ['scattered clouds', 'ابرهای پراکنده']
]

MongoClient.connect('mongodb://alireza1619:rrr161920@ds147920.mlab.com:47920/weather_bot', function (err, database) {
    if (err) return console.log(err)
    db = database;

    bot.on('message', msg => {
        if (['/emruz', '/farda', '/6ruz'].some(t => t == msg.text)) {
            return;
        }
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
            case '6 روز آینده':
                handle5daysForecastWeather(msg.from.id, msg.chat.id);
                break;
            case 'تنظیمات':
                handleSettings(msg.from.id, msg.chat.id);
                break;
            case 'بازگشت':
                handleBack(msg.from.id, msg.chat.id);
                break;
            case 'تغییر شهر':
                getCity(msg.chat.id, true);
                break;
            case 'ارسال خودکار (به زودی)':
                autoSend(msg.chat.id, 'showOpts');
            default:
                //handle5daysForecastWeather(msg.from.id, msg.chat.id, msg.text)
                break;
        }

    })
})

function autoSend(chatId, type) {
    db.collection('users').find({
        chatId: chatId
    }).toArray((err, users) => {
        if (err) return console.log(err)
        switch (type) {
            case 'showOpts':
                bot.sendMessage(chatId, 'چه ساعتی از روز پیام بفرستم؟', {
                    reply_markup: JSON.stringify({
                        keyboard: [
                            ['6', '7', '8', '9', '10', '11'],
                            ['12', '13', '14', '15', '16', '17'],
                            ['18', '19', '20', '21', '22', '23'],
                            ['24', '1', '2', '3', '4', '5'],
                            ['بازگشت']
                        ]
                    })
                })
                break;
        }
    })
}

function handleStart(telegramId, chatId) {
    db.collection('users').insert({
        telegramId: telegramId,
        chatId: chatId,
        city: ''
    }, (err) => {
        if (err) return console.log(err);
        bot.sendMessage(chatId, 'سلام');
        getCity(chatId, false);
    });
}

function getCity(chatId, withBack) {
    const GetCityOpts = {
        reply_markup: JSON.stringify({
            keyboard: withBack ? [
                ['بازگشت']
            ] : [],
            force_reply: !withBack
        })
    };

    bot.sendMessage(chatId, 'نام شهرتو ( با حروف لاتین ) بنویس', GetCityOpts).then(sent => {
        bot.onReplyToMessage(chatId, sent.message_id, onReplyToCityGet.bind(this, sent, chatId))
    })
}

function onReplyToCityGet(sent, chatId, reply) {
    const opts = {
        reply_markup: JSON.stringify({
            keyboard: [
                ['هوای امروز', 'هوای فردا'],
                ['6 روز آینده', 'تنظیمات']
            ]
        })
    };
    checkIfCityExists(reply.text, (err, cityName, coord) => {
        if (err) return bot.sendMessage(chatId, 'متاسفانه این شهر پیدا نشد. دوباره امتحان کنید', {
            reply_markup: {
                force_reply: true
            }
        }).then(sended => {
            bot.onReplyToMessage(chatId, sended.message_id, onReplyToCityGet.bind(this, sended, chatId))
        });

        db.collection('users').update({
            chatId: chatId
        }, {
            $set: {
                city: cityName
            }
        }, (err) => {
            if (err) return console.log(err)
            bot.sendLocation(chatId, coord.lat, coord.lon)
            bot.sendMessage(chatId, ' عالی! شهر تنظیم شد به ' + cityName, opts);
            bot.onReplyToMessage(chatId, sent.message_id, onReplyToCityGet.bind(this, sent, chatId))
        })
    });
}

function checkIfCityExists(cityName, cb) {
    request(`http://api.openweathermap.org/data/2.5/weather?q=${cityName}&APPID=f311a0682747102619138c028ec41c0e`, function (error, response, body) {
        if (error) return console.log(err);
        var data = JSON.parse(body);
        if (data.cod == "404") {
            return cb('404');
        }
        cb('', data.name, data.coord)
    });
}

function handleTodayWeather(telegramId, chatId, editMessageId) {
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [{
                    text: 'نمایش جزییات کامل',
                    // we shall check for this value when we listen
                    // for "callback_query"
                    callback_data: 'details-today'
                }]
            ]
        }
    };
    db.collection('users').find({
        chatId: chatId
    }).toArray((err, users) => {
        if (users.length === 0) {
            return getCity(chatId, false)
        }
        request(`http://api.openweathermap.org/data/2.5/forecast/daily?q=${users[0].city}&APPID=f311a0682747102619138c028ec41c0e`, function (error, response, body) {
            console.log('error:', error); // Print the error if one occurred
            console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
            console.log('body:', body); // Print the HTML for the Google homepage.\
            var data = JSON.parse(body)
            var text = `هوای امروز ${users[0].city}\n\nوضعیت کلی: ` +
                emojis.find(emoji => emoji[0] == data.list[0].weather[0].main)[1] + ' ' +
                descriptionToFa.find(description => description[0] == data.list[0].weather[0].description)[1] + '\n' +
                `\nحداکثر دما ⬆️ : ${(data.list[0].temp.max - 273.15).toFixed(1)} درجه\nحداقل دما ⬇️ : ${(data.list[0].temp.min - 273.15).toFixed(1)} درجه\n\n` +
                `سرعت باد 💨 : ${data.list[0].speed} کیلومتر بر ساعت\n\n`;
            if (!editMessageId) {
                bot.sendMessage(chatId, text);
            } else {
                const editOpts = {
                    chat_id: chatId,
                    message_id: editMessageId,
                    reply_markup: {
                        inline_keyboard: [
                            [{
                                text: 'نمایش جزییات کامل',
                                // we shall check for this value when we listen
                                // for "callback_query"
                                callback_data: 'details-today'
                            }]
                        ]
                    }
                };
                bot.editMessageText(text, editOpts);
            }

        });
    })
}


function handleTomorrowWeather(telegramId, chatId, editMessageId) {
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [{
                    text: 'نمایش جزییات کامل',
                    // we shall check for this value when we listen
                    // for "callback_query"
                    callback_data: 'details-tomorrow'
                }]
            ]
        }
    };
    db.collection('users').find({
        chatId: chatId
    }).toArray((err, users) => {
        if (users.length === 0) {
            return getCity(chatId, false)
        }
        request(`http://api.openweathermap.org/data/2.5/forecast/daily?q=${users[0].city}&APPID=f311a0682747102619138c028ec41c0e`, function (error, response, body) {
            console.log('error:', error); // Print the error if one occurred
            console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
            console.log('body:', body); // Print the HTML for the Google homepage.
            var data = JSON.parse(body)
            var text = `هوای فردای ${users[0].city}\n\nوضعیت کلی: ` +
                emojis.find(emoji => emoji[0] == data.list[1].weather[0].main)[1] + ' ' +
                descriptionToFa.find(description => description[0] == data.list[1].weather[0].description)[1] + '\n' +
                `\nحداکثر دما ⬆️ : ${(data.list[1].temp.max - 273.15).toFixed(1)} درجه\nحداقل دما ⬇️ : ${(data.list[1].temp.min - 273.15).toFixed(1)} درجه\n\n` +
                `سرعت باد 💨 : ${data.list[1].speed} کیلومتر بر ساعت\n\n`;
            if (!editMessageId) {
                bot.sendMessage(chatId, text);
            } else {
                const editOpts = {
                    chat_id: chatId,
                    message_id: editMessageId,
                    reply_markup: {
                        inline_keyboard: [
                            [{
                                text: 'نمایش جزییات کامل',
                                // we shall check for this value when we listen
                                // for "callback_query"
                                callback_data: 'details-today'
                            }]
                        ]
                    }
                };
                bot.editMessageText(text, editOpts);
            }

        });
    })
}

function handle5daysForecastWeather(telegramId, chatId, city, editingMsgId) {
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [{
                    text: 'نمایش جزییات کامل',
                    // we shall check for this value when we listen
                    // for "callback_query"
                    callback_data: 'details'
                }]
            ]
        }
    };
    if (city) {
        request(`http://api.openweathermap.org/data/2.5/forecast/daily?q=${city}&APPID=f311a0682747102619138c028ec41c0e`, function (error, response, body) {
            console.log('error:', error); // Print the error if one occurred
            console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
            console.log('body:', body); // Print the HTML for the Google homepage.
            var data = JSON.parse(body)
            bot.sendLocation(chatId, data.city.coord.lat, data.city.coord.lon)
            bot.sendMessage(chatId, `هوای 6 روز آینده ${data.city.name}\n\n` + JSON.parse(body).list.map((l, i) => `${i == 0? 'امروز': i == 1? 'فردا' : '' } ${moment.unix(l.dt).format("dddd")} : ${emojis.find(emoji => emoji[0] == l.weather[0].main)[1]} ${descriptionToFa.find(description => description[0] == l.weather[0].description)[1]}`).join("\n") + '\n', opts);
        });
        return;
    }
    db.collection('users').find({
        chatId: chatId
    }).toArray((err, users) => {
        if (users.length === 0) {
            return getCity(chatId, false)
        }
        request(`http://api.openweathermap.org/data/2.5/forecast/daily?q=${users[0].city}&APPID=f311a0682747102619138c028ec41c0e`, function (error, response, body) {
            console.log('error:', error); // Print the error if one occurred
            console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
            console.log('body:', body); // Print the HTML for the Google homepage.
            var text = `هوای 6 روز آینده ${users[0].city}\n\n` + JSON.parse(body).list.map((l, i) => `${i == 0? 'امروز': i == 1? 'فردا' : '' } ${moment.unix(l.dt).format("dddd")} : ${emojis.find(emoji => emoji[0] == l.weather[0].main)[1]} ${descriptionToFa.find(description => description[0] == l.weather[0].description)[1]}`).join("\n") + '\n'
            if (!editingMsgId) {
                bot.sendMessage(chatId, text, opts);
            } else {
                const editOpts = {
                    chat_id: chatId,
                    message_id: editingMsgId,
                    reply_markup: {
                        inline_keyboard: [
                            [{
                                text: 'نمایش جزییات کامل',
                                // we shall check for this value when we listen
                                // for "callback_query"
                                callback_data: 'details'
                            }]
                        ]
                    }
                };
                bot.editMessageText(text, editOpts);
            }

        });
    })
}

function handleSettings(telegramId, chatId) {
    const opts = {
        reply_markup: JSON.stringify({
            keyboard: [
                ['تغییر شهر', 'ارسال خودکار (به زودی)'],
                ['بازگشت']
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
                ['6 روز آینده', 'تنظیمات']
            ]
        })
    };
    bot.sendMessage(chatId, 'بازگشت', opts);
}

bot.on('callback_query', function onCallbackQuery(callbackQuery) {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const opts = {
        chat_id: msg.chat.id,
        message_id: msg.message_id,
        reply_markup: {
            inline_keyboard: [
                [{
                    text: 'نمایش کلی',
                    // we shall check for this value when we listen
                    // for "callback_query"
                    callback_data: action.replace('summary', 'details').replace('details', 'summary')
                }]
            ]
        }
    };
    let text;

    if (action === 'details' || action === 'details-today' || action === 'details-tomorrow') {
        text = 'جزییات کامل هواشناسی به زودی....';
    }
    if (action === 'summary') {
        return handle5daysForecastWeather(undefined, msg.chat.id, undefined, msg.message_id)
    }
    if (action === 'summary-today') {
        return handleTodayWeather(undefined, msg.chat.id, msg.message_id)
    }
    if (action === 'summary-tomorrow') {
        return handleTomorrowWeather(undefined, msg.chat.id, msg.message_id)
    }
    bot.editMessageText(text, opts);
});

bot.onText(/\/emruz/, function onPhotoText(msg) {
    handleTodayWeather(msg.from.id, msg.chat.id);
});
bot.onText(/\/farda/, function onPhotoText(msg) {
    handleTomorrowWeather(msg.from.id, msg.chat.id);
});
bot.onText(/\/6ruz/, function onPhotoText(msg) {
    handle5daysForecastWeather(msg.from.id, msg.chat.id);
});
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