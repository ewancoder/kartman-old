import { config } from './config.js';

const element = document.getElementById('main');

const params = new URLSearchParams(window.location.search);

let isTop10 = false;
let response = undefined;
let json = undefined;

document.getElementById('top10-btn').addEventListener('click', openTop10);
document.getElementById('today-btn').addEventListener('click', openToday);
await openToday();

async function openTop10() {
    isTop10 = true;
    response = await fetch(`${config.historyApiUrl}/top10`);
    json = await response.json();
    reload();
}

async function openToday() {
    isTop10 = false;
    let date = params.get('date');
    if (!date) date = 'today';

    response = await fetch(`${config.historyApiUrl}/${date}`);
    json = await response.json();

    reload();
}

function reload() {
    element.innerHTML = '';
    let session = undefined;
    let kart = undefined;
    let fastest = undefined;
    for (const e of json) {
        if (session != e.session) {
            session = e.session;
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
            element.appendChild(sessionHeader);
        }

        if (kart != e.kart) {
            kart = e.kart;
            if (fastest) fastest.lapLine.classList.add('fastest');
            fastest = undefined;
            const kartHeader = document.createElement('h3');
            kartHeader.innerHTML = `Kart ${kart}`;
            kartHeader.classList.add('kart-header');
            element.appendChild(kartHeader);
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
        element.appendChild(lapLine);
    }

    if (fastest) fastest.lapLine.classList.add('fastest');
}
