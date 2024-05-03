import { initializeTypingState } from './typing.js';

const element = document.getElementById('welcomeElement');
const typer = initializeTypingState(element, undefined, true);
let resolveContinue = undefined;
document.addEventListener('keydown', handleContinue);

const tips = [
    'Recorded telemetry has data of you pressing and depressing every key including recording Shift key separately, delays between keystrokes, and all your errors and corrections consequently.',
    'When generating a text, you can specify a theme in the text input field if you want a text on specific subject. Our smart AI will generate it for you.',
    'You can see all your previous texts in the table below, as well as replay them, race against them, or delete them.'
];

export async function processWelcomeScreen() {
    if (localStorage.getItem('tips')) {
        stopListening();
        return;
    }

    await play('Welcome to Typing Realm! Press ENTER to continue...');
    await play('This is a typing training tool. You are gonna need a physical keyboard for it.');
    localStorage.setItem('tips', 1);
    stopListening();
}

export async function play(text, requiredTips) {
    if (requiredTips && localStorage.getItem('tips') > requiredTips) {
        playNextTip();
        return;
    }

    typer.prepareText(text);
    await type(text);
    await waitForReturn();
}

export async function playCountdown() {
    typer.prepareText('3.. 2.. 1.. GO!');

    await type('3.. ');
    await new Promise(resolve => setTimeout(resolve, 1000));

    await type('2.. ');
    await new Promise(resolve => setTimeout(resolve, 1000));

    await type('1.. ');
    await new Promise(resolve => setTimeout(resolve, 1000));

    await type('GO!');
}

async function type(text) {
    for (let character of text) {
        typer.pressKey(character);
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}

export async function hide() {
    typer.reset();
    stopListening();
}

function stopListening() {
    document.removeEventListener('keydown', handleContinue);
}

async function playNextTip() {
    const index = localStorage.getItem('tips');
    if (index >= 2) {
        // Start showing random tips.
        const index = randomIntFromInterval(0, tips.length - 1);
        await play(tips[index]);
    }
}

function randomIntFromInterval(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function handleContinue(event) {
    if (!resolveContinue) return;
    if (event.key === 'Enter' && resolveContinue) {
        resolveContinue();
        resolveContinue = undefined;
    }
}

async function waitForReturn() {
    await new Promise(r => resolveContinue = r);
}
