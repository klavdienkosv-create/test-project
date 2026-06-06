const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const GoalFollow = goals.GoalFollow;
const readline = require('readline');

let botOptions = { host: 'mc.play-fast.ru', port: 25565, username: 'pocohoco3000', version: '1.16.5', viewDistance: 'tiny', colorsEnabled: false, concurrency: 1, brand: 'vanilla' };
let owners = ['SvyatoslavPro123'];
let lookTargetEntity = null, pvpInterval = null, pvpTargetEntity = null;
let isEquipping = false, isEating = false, isToggleArmor = false;
let rlInterface = null, globalBotInstance = null, isBotActive = false;

function showMenu() {
    console.clear();
    console.log('===================================================');
    console.log('          ТЕРМИНАЛ НАСТРОЕК ПВП-ТЕРМИНАТОРА        ');
    console.log('===================================================');
    console.log(` Текущий Сервер (IP): \x1b[36m${botOptions.host}\x1b[0m`);
    console.log(` Текущий Ник бота:   \x1b[32m${botOptions.username}\x1b[0m`);
    console.log(` Владельцы бота:     \x1b[35m${owners.join(', ')}\x1b[0m`);
    console.log('---------------------------------------------------');
    console.log(' Запустить бота на server');
    console.log(' Изменить НИК бота');
    console.log(' Изменить СЕРВЕР (IP-адрес)');
    console.log(' Добавить владельца');
    console.log(' Удалить владельца');
    console.log(' Выйти из программы');
    console.log('===================================================');
    process.stdout.write('Выберите действие: ');
    if (rlInterface) rlInterface.close();
    rlInterface = readline.createInterface({ input: process.stdin, output: process.stdout });
    rlInterface.on('line', (line) => {
        const choice = line.trim();
        if (choice === '1') { rlInterface.close(); isBotActive = true; createBot(); }
        else if (choice === '2') { askParameter('Введите новый НИК бота: ', (n) => { botOptions.username = n; showMenu(); }); }
        else if (choice === '3') { askParameter('Введите новый IP сервера: ', (h) => { botOptions.host = h; showMenu(); }); }
        else if (choice === '4') { askParameter('Введите ник НОВОГО владельца: ', (o) => { if (!owners.map(e => e.toLowerCase()).includes(o.toLowerCase())) owners.push(o); showMenu(); }); }
        else if (choice === '5') { askParameter('Введите ник для УДАЛЕНИЯ: ', (o) => { owners = owners.filter(e => e.toLowerCase() !== o.toLowerCase()); if (owners.length === 0) owners.push('SvyatoslavPro123'); showMenu(); }); }
        else if (choice === '6') { console.log('Выход...'); process.exit(0); }
        else { process.stdout.write('Неверный выбор. Действие: '); }
    });
}

function askParameter(q, cb) {
    rlInterface.close();
    rlInterface = readline.createInterface({ input: process.stdin, output: process.stdout });
    rlInterface.question(q, (a) => { const v = a.trim(); if (v) { cb(v); } else { console.log('Пусто!'); setTimeout(showMenu, 1500); } });
}
function createBot() {
    console.log(`\n[Система] Попытка подключения к ${botOptions.host}...`);
    const bot = mineflayer.createBot(botOptions);
    globalBotInstance = bot;
    bot.loadPlugin(pathfinder);

    bot.on('spawn', () => {
        console.log(`[Система] Бот ${bot.username} успешно зашел.`);
        resetAllTimers(); initTerminalInput(bot);
        setTimeout(() => { if (bot.entity) bot.chat('/games'); }, 4000);
        setTimeout(() => { if (bot.inventory && bot.inventory.items().length === 0) { bot.chat('/anarchy'); setTimeout(() => bot.chat('/anar'), 2000); setTimeout(() => bot.chat('/server anarchy'), 4000); } }, 10000);
    });

    bot.on('windowOpen', async (w) => {
        await new Promise(r => setTimeout(r, 2000));
        try { await bot.clickWindow(23, 0, 0); console.log('[Система] Прожали Анархию.'); } catch (err) { try { bot.closeWindow(w); } catch (e) {} }
    });

    setInterval(() => { if (isBotActive) equipBestArmor(); }, 4000);
    setInterval(() => { if (isBotActive) checkAndEquipTotem(); }, 2000);

    bot.on('physicTick', () => {
        if (pvpTargetEntity && pvpTargetEntity.isValid) { bot.lookAt(pvpTargetEntity.position.offset(0, 1.6, 0)); }
        else if (lookTargetEntity) { bot.lookAt(lookTargetEntity.position.offset(0, 1.6, 0)); }
        else {
            const ownerName = Object.keys(bot.players).find(p => owners.map(o => o.toLowerCase()).includes(p.toLowerCase()));
            const playerEntity = bot.players[ownerName]?.entity;
            if (playerEntity) bot.lookAt(playerEntity.position.offset(0, 1.6, 0));
        }
    });

    function resetAllTimers() { if (pvpInterval) clearInterval(pvpInterval); pvpInterval = null; pvpTargetEntity = null; lookTargetEntity = null; isEquipping = false; isEating = false; isToggleArmor = false; try { bot.setControlState('jump', false); } catch (e) {} }

    function initTerminalInput(cBot) {
        if (rlInterface) rlInterface.close();
        rlInterface = readline.createInterface({ input: process.stdin, output: process.stdout });
        rlInterface.on('line', (l) => { const t = l.trim(); if (!t) return; if (cBot && cBot.entity) { cBot.chat(t); console.log(`[Вы]: ${t}`); } else { console.log('Бот не на сервере.'); } });
    }

    async function checkAndEquipTotem() {
        if (!bot.inventory || isEating || isEquipping || isToggleArmor || bot.inventory.items().length === 0) return;
        if (bot.inventory.slots && bot.inventory.slots.name === 'totem_of_undying') return;
        const totem = bot.inventory.items().find(i => i && i.name === 'totem_of_undying');
        if (!totem) return;
        isToggleArmor = true; try { await bot.equip(totem, 'off-hand'); } catch (err) {} isToggleArmor = false;
    }
}
