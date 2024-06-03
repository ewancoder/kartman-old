import { config } from './config.js';

const element = document.getElementById('main');

const params = new URLSearchParams(window.location.search);

let isTop10 = false;
let response = undefined;
let json = undefined;

//document.getElementById('top10-btn').addEventListener('click', openTop10);
//document.getElementById('today-btn').addEventListener('click', openToday);
await openToday();

async function openTop10() {
    isTop10 = true;
    response = await fetch(`${config.historyApiUrl}/top10`);
    json = await response.json();
    await reload();
}

async function openToday() {
    isTop10 = false;
    let date = params.get('date');
    if (!date) date = 'today';

    response = await fetch(`${config.historyApiUrl}/${date}`);
    json = await response.json();

    await reload();
}

function getWeather(weather) {
    if (weather == 1) return icon('weather-dry');
    if (weather == 2) return icon('weather-damp');
    if (weather == 3) return icon('weather-wet');
    if (weather == 4) return icon('weather-extra-wet');

    return '?';
}

function icon(type) {
    if (type == 'track-config-short') return 'Short';
    if (type == 'track-config-long') return 'Long';
    if (type == 'track-config-short-reverse') return 'Short Reverse';
    if (type == 'track-config-long-reverse') return 'Long Reverse';

    return `<img class="status" src="img/${type}.png"/>`;
}

function getSky(sky) {
    if (sky == 1) return icon('sky-clear');
    if (sky == 2) return icon('sky-cloudy');
    if (sky == 3) return icon('sky-overcast');

    return '?';
}

function getWind(wind) {
    if (wind == 1) return icon('wind-no');
    if (wind == 2) return icon('wind-yes');

    return '?';
}

function getAirTemp(airTemp) {
    if (!airTemp) return '?';

    return `${airTemp} C`;
}

function getTrackTemp(trackTemp) {
    if (!trackTemp) return '?';

    return `${trackTemp} C`;
}

function getSubjectiveTrackTemp(subjectiveTrackTemp) {
    if (subjectiveTrackTemp == 1) return icon('track-cold');
    if (subjectiveTrackTemp == 2) return icon('track-normal');
    if (subjectiveTrackTemp == 3) return icon('track-warm');
    if (subjectiveTrackTemp == 4) return icon('track-hot');

    return '?';
}

function getTrackConfig(subjectiveTrackTemp) {
    if (subjectiveTrackTemp == 1) return icon('track-config-short');
    if (subjectiveTrackTemp == 2) return icon('track-config-long');
    if (subjectiveTrackTemp == 3) return icon('track-config-short-reverse');
    if (subjectiveTrackTemp == 4) return icon('track-config-long-reverse');

    return '?';
}

async function update(sessionId, key, promptText) {
    let pr = prompt(promptText);
    if (!pr) return;
    const value = Number(pr);
    var object = {};
    object[key] = value;
    await fetch(`${config.sessionsApiUrl}/${sessionId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(object)
    });

    return value;
}

async function updateWeather(sessionId) {
    const response = await update(sessionId, 'weather', 'Weather: 1 - dry, 2 - damp, 3 - wet, 4 - extra wet');
    if (!response) return null;

    return getWeather(response);
}

async function updateSky(sessionId) {
    const response = await update(sessionId, 'sky', '1 - clear, 2 - cloudy, 3 - overcast');
    if (!response) return null;

    return getSky(response);
}
async function updateWind(sessionId) {
    const response = await update(sessionId, 'wind', '1 - no wind, 2 - yes');
    if (!response) return null;

    return getWind(response);
}
async function updateAirTemp(sessionId) {
    const response = await update(sessionId, 'airTempC', 'Air temperature in C, for example: 25.7');
    if (!response) return null;

    return getAirTemp(response);
}
async function updateTrackTemp(sessionId) {
    const response = await update(sessionId, 'trackTempC', 'Track temperature in C, for example: 50.7');
    if (!response) return null;

    return getTrackTemp(response);
}
async function updateSubjectiveTrackTemp(sessionId) {
    const response = await update(sessionId, 'trackTempApproximation', '1 - Cold, 2 - Cool, 3 - Warm, 4 - Hot');
    if (!response) return null;

    return getSubjectiveTrackTemp(response);
}
async function updateTrackConfig(sessionId) {
    const response = await update(sessionId, 'trackConfig', '1 - Short, 2 - Long, 3 - Short Reverse, 4 - Long Reverse');
    if (!response) return null;

    return getTrackConfig(response);
}



async function reload() {
    element.innerHTML = '';
    let session = undefined;
    let kart = undefined;
    let fastest = undefined;
    console.log(json);

    const shadowDom = document.createElement('div');
    for (const e of json) {
        const groupElement = document.createElement('div');
        if (session != e.session) {
            session = e.session;

            // Processing new session. Get its info and populate it.
            let sessionData = await (await fetch(`${config.sessionsApiUrl}/${e.sessionId}`)).json();

            if (!sessionData) {
                sessionData = {};
            }

            const dataElement = document.createElement('table');
            dataElement.classList.add('session-info');

            function createInfoRow(sessionId, keyHtml, valueHtml, firstCallback, secondValue, secondCallback) {
                const row = document.createElement('tr');
                const key = document.createElement('td');
                const value = document.createElement('td');
                value.addEventListener('click', async function (e) {
                    if (firstCallback) {
                        let newHtml = await firstCallback(sessionId);
                        if (newHtml) value.innerHTML = newHtml;
                    }
                });
                value.classList.add('interactive');
                row.appendChild(key);
                row.appendChild(value);
                dataElement.appendChild(row);
                key.innerHTML = keyHtml;
                value.innerHTML = valueHtml;

                if (secondValue) {
                    const secondValueElement = document.createElement('td');
                    row.appendChild(secondValueElement);
                    secondValueElement.classList.add('interactive');
                    secondValueElement.innerHTML = secondValue;
                    secondValueElement.addEventListener('click', async function (e) {
                        if (secondCallback) {
                            let newHtml = await secondCallback(sessionId);
                            if (newHtml) secondValueElement.innerHTML = newHtml;
                        }
                    });
                }
            }

            createInfoRow(e.sessionId, 'Track Config', getTrackConfig(sessionData.trackConfig), updateTrackConfig);
            createInfoRow(e.sessionId, 'Weather', getWeather(sessionData.weather), updateWeather);
            createInfoRow(e.sessionId, 'Sky', getSky(sessionData.sky), updateSky);
            createInfoRow(e.sessionId, 'Wind', getWind(sessionData.wind), updateWind);
            createInfoRow(e.sessionId, 'Air Temp', getAirTemp(sessionData.airTempC), updateAirTemp);
            createInfoRow(e.sessionId, 'Track Temp', getTrackTemp(sessionData.trackTempC), updateTrackTemp, getSubjectiveTrackTemp(sessionData.trackTempApproximation), updateSubjectiveTrackTemp);

            kart = undefined;
            if (fastest) fastest.lapLine.classList.add('fastest');
            fastest = undefined;
            const sessionHeader = document.createElement('h2');
            if (isTop10) {
                sessionHeader.innerHTML = `${new Date(e.recordedAtUtc+"Z").toLocaleDateString()} - Session ${session} - ${e.totalLength}`;
            } else {
                sessionHeader.innerHTML = `Session ${session} - ${new Date(e.recordedAtUtc+"Z").toLocaleTimeString()} - ${e.totalLength}`;
            }
            sessionHeader.classList.add('session-header');

            const headerArea = document.createElement('div');
            headerArea.classList.add('header-area');

            headerArea.appendChild(sessionHeader);
            headerArea.appendChild(dataElement);
            groupElement.appendChild(headerArea);
        }

        if (kart != e.kart) {
            kart = e.kart;
            if (fastest) fastest.lapLine.classList.add('fastest');
            fastest = undefined;
            const kartHeader = document.createElement('h3');
            kartHeader.innerHTML = `Kart ${kart}`;
            kartHeader.classList.add('kart-header');
            groupElement.appendChild(kartHeader);
        }

        const lapLine = document.createElement('p');
        if (!fastest) {
            fastest = { lapLine: lapLine, time: e.time };
        }
        if (e.time < fastest.time) {
            fastest = { lapLine: lapLine, time: e.time };
        }
        lapLine.innerHTML = `${e.lap} - ${e.time}`;
        lapLine.classList.add('lap-line');
        groupElement.appendChild(lapLine);

        shadowDom.appendChild(groupElement);
    }

    if (fastest) fastest.lapLine.classList.add('fastest');

    // Super mega hack to make it work.
    element.appendChild(shadowDom);
    document.getElementById('main').classList.add('hidden');
    await new Promise(resolve => setTimeout(resolve, 1000));
    document.getElementById('main').classList.remove('hidden');
}
