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
async function equipBestArmor() {
    if (!bot.inventory || isEquipping || isEating || isToggleArmor || bot.inventory.items().length === 0) return;
    const armorTypes = ['helmet', 'chestplate', 'leggings', 'boots'], destinations = ['head', 'torso', 'legs', 'feet'];
    const materialValues = { netherite: 5, diamond: 4, iron: 3, chainmail: 2, gold: 1, leather: 0 };
    for (let index = 0; index < armorTypes.length; index++) {
        const type = armorTypes[index], dest = destinations[index];
        const items = bot.inventory.items().filter(item => {
            if (!item || !item.name) return false; const cName = item.name.toLowerCase();
            if (type === 'helmet') return cName.includes('helmet') || cName.includes('head');
            if (type === 'chestplate') return cName.includes('chestplate') || cName.includes('chest');
            if (type === 'leggings') return cName.includes('leggings') || cName.includes('legs');
            if (type === 'boots') return cName.includes('boots') || cName.includes('feet');
            return false;
        });
        if (items.length === 0) continue;
        let bestItem = items;
        for (let i = 1; i < items.length; i++) {
            const cMat = Object.keys(materialValues).find(m => bestItem.name.toLowerCase().includes(m)) || 'leather';
            const nMat = Object.keys(materialValues).find(m => items[i].name.toLowerCase().includes(m)) || 'leather';
            if (materialValues[nMat] > materialValues[cMat]) bestItem = items[i];
        }
        const equippedItem = bot.inventory.slots[5 + index];
        let shouldEquip = !equippedItem || !equippedItem.name;
        if (equippedItem && equippedItem.name) {
            const eMat = Object.keys(materialValues).find(m => equippedItem.name.toLowerCase().includes(m)) || 'leather';
            const bMat = Object.keys(materialValues).find(m => bestItem.name.toLowerCase().includes(m)) || 'leather';
            if (materialValues[bMat] > materialValues[eMat]) shouldEquip = true;
        }
        if (shouldEquip) { isEquipping = true; try { await bot.equip(bestItem, dest); } catch (err) {} isEquipping = false; }
    }
}

function equipBestSwordFromHotbar() {
    if (!bot.inventory) return;
    const mats = { netherite: 5, diamond: 4, iron: 3, gold: 2, stone: 1, wood: 0 };
    let bSlot = null, maxVal = -1;
    for (let i = 0; i < 9; i++) {
        const item = bot.inventory.slots[36 + i];
        if (item && item.name && item.name.toLowerCase().includes('sword')) {
            const mat = Object.keys(mats).find(m => item.name.toLowerCase().includes(m)) || 'wood';
            if (mats[mat] > maxVal) { maxVal = mats[mat]; bSlot = i; }
        }
    }
    if (bSlot !== null) bot.setQuickBarSlot(bSlot);
}

async function checkAndEatApple() {
    if (bot.health < 12 && !isEating && bot.inventory && !isEquipping && !isToggleArmor) {
        let slot = null;
        for (let i = 0; i < 9; i++) { if (bot.inventory.slots[36 + i]?.name?.includes('enchanted_golden_apple')) { slot = i; break; } }
        if (slot === null) { for (let i = 0; i < 9; i++) { if (bot.inventory.slots[36 + i]?.name?.includes('golden_apple')) { slot = i; break; } } }
        if (slot !== null) {
            isEating = true;
            try { bot.setQuickBarSlot(slot); await new Promise(r => setTimeout(r, 150)); bot.activateItem(); await new Promise(r => setTimeout(r, 1700)); bot.deactivateItem(); } catch (err) {}
            equipBestSwordFromHotbar(); isEating = false;
        }
    }
}

bot.on('health', () => { checkAndEatApple(); });

bot.on('messagestr', (msg) => {
    const cLine = msg.trim(), lLine = cLine.toLowerCase();
    console.log(`[Чат игры]: ${cLine}`);
    const sOwner = owners.find(o => lLine.includes(o.toLowerCase()));
    if (!sOwner) return;

    if (lLine.includes('телепорт') || lLine.includes('tpa') || lLine.includes('просит')) { setTimeout(() => { if (bot.entity) bot.chat('/tpaccept'); }, 1000); return; }
    const oPos = lLine.indexOf(sOwner.toLowerCase()), cmdZone = cLine.substring(oPos).toLowerCase();

    if (cmdZone.includes('*follow')) {
        resetAllTimers(); const idx = cmdZone.indexOf('*follow'), tNick = cmdZone.substring(idx + 8).trim(); if (!tNick) return;
        const actName = Object.keys(bot.players).find(p => p.toLowerCase() === tNick.toLowerCase());
        const tEnt = bot.players[actName]?.entity; if (!tEnt) { bot.chat(`Не вижу ${tNick}!`); return; }
        
        const defaultMove = new Movements(bot, require('minecraft-data')('1.16.5'));
        defaultMove.canDig = false; defaultMove.allowParkour = true;
        bot.pathfinder.setMovements(defaultMove); bot.pathfinder.setGoal(new GoalFollow(tEnt, 1), true);
        lookTargetEntity = tEnt; bot.chat(`Иду за ${actName}!`);
    }
    if (cmdZone.includes('*tp')) { resetAllTimers(); bot.pathfinder.setGoal(null); bot.chat(`/tpa ${sOwner}`); }
    if (cmdZone.includes('*kill')) {
        resetAllTimers(); bot.pathfinder.setGoal(null); const idx = cmdZone.indexOf('*kill'), tNick = cmdZone.substring(idx + 5).trim(); if (!tNick) return;
        const actName = Object.keys(bot.players).find(p => p.toLowerCase() === tNick.toLowerCase());
        pvpTargetEntity = bot.players[actName]?.entity; if (!pvpTargetEntity) { bot.chat(`Не вижу ${tNick}!`); return; }
        equipBestSwordFromHotbar(); bot.chat(`Атакую ${actName}!`);
        
        const defaultMove = new Movements(bot, require('minecraft-data')('1.16.5'));
        bot.pathfinder.setMovements(defaultMove); bot.pathfinder.setGoal(new GoalFollow(pvpTargetEntity, 2), true);
        pvpInterval = setInterval(handlePvpTick, 600);
    }
    if (cmdZone.includes('*stop')) { resetAllTimers(); bot.pathfinder.setGoal(null); bot.chat('Остановлено.'); }
});

bot.on('kick', (r) => { console.log('\n[Кик]:', JSON.stringify(r)); resetAllTimers(); isBotActive = false; if (rlInterface) rlInterface.close(); setTimeout(showMenu, 5000); });
bot.on('end', (reason) => { console.log('\n[Разрыв]:', reason); resetAllTimers(); isBotActive = false; if (rlInterface) rlInterface.close(); setTimeout(showMenu, 5000); });
bot.on('error', (err) => console.error('\n[Ошибка]:', err.message));

function stopBotJumping() { if (globalBotInstance && globalBotInstance.entity) globalBotInstance.setControlState('jump', false); }

function handlePvpTick() {
    const bot = globalBotInstance; if (!bot || !isBotActive || isEating || isEquipping || isToggleArmor) return;
    if (!pvpTargetEntity || !pvpTargetEntity.isValid) { bot.chat('Цель потеряна.'); bot.pathfinder.setGoal(null); if (pvpInterval) clearInterval(pvpInterval); pvpInterval = null; pvpTargetEntity = null; return; }
    if (bot.entity.position.distanceTo(pvpTargetEntity.position) <= 3.8) { if (bot.entity.onGround) { bot.setControlState('jump', true); setTimeout(stopBotJumping, 50); } bot.attack(pvpTargetEntity); bot.swingArm(); }
}

showMenu();
