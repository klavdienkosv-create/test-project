const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const GoalFollow = goals.GoalFollow;
const readline = require('readline');

// Стартовые настройки по умолчанию
let botOptions = {
  host: 'mc.play-fast.ru', 
  port: 25565,
  username: 'pocohoco3000',
  version: '1.16.5',
  viewDistance: 'tiny', 
  colorsEnabled: false, 
  concurrency: 1        
};

const OWNER_NICK = 'SvyatoslavPro123'; 

let lookTargetEntity = null;
let pvpInterval = null; 
let pvpTargetEntity = null; 
let isEquipping = false; 
let isEating = false; 
let isToggleArmor = false; 
let rlInterface = null;
let globalBotInstance = null;
let isBotActive = false; // Флаг: запущен ли игровой цикл бота

// ФУНКЦИЯ ОТРИСОВКИ МЕНЮ ИНТЕРФЕЙСА
function showMenu() {
  console.clear();
  console.log('===================================================');
  console.log('       ТЕРМИНАЛ НАСТРОЕК ПВП-ТЕРМИНАТОРА           ');
  console.log('===================================================');
  console.log(` Текущий Сервер (IP): \x1b[36m${botOptions.host}\x1b[0m`);
  console.log(` Текущий Ник бота:   \x1b[32m${botOptions.username}\x1b[0m`);
  console.log('---------------------------------------------------');
  console.log(' [1] Запустить бота на сервер');
  console.log(' [2] Изменить НИК бота');
  console.log(' [3] Изменить СЕРВЕР (IP-адрес)');
  console.log(' [4] Выйти из программы');
  console.log('===================================================');
  process.stdout.write('Выберите действие: ');

  if (rlInterface) rlInterface.close();
  
  rlInterface = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rlInterface.on('line', (line) => {
    const choice = line.trim();
    if (choice === '1') {
      rlInterface.close();
      isBotActive = true;
      createBot(); // Запуск игрового бота
    } else if (choice === '2') {
      askParameter('Введите новый НИК бота: ', (newUsername) => {
        botOptions.username = newUsername;
        showMenu();
      });
    } else if (choice === '3') {
      askParameter('Введите новый IP сервера: ', (newHost) => {
        botOptions.host = newHost;
        showMenu();
      });
    } else if (choice === '4') {
      console.log('Выход из программы...');
      process.exit(0);
    } else {
      process.stdout.write('Неверный выбор. Выберите действие: ');
    }
  });
}

// Вспомогательная функция для ввода строки
function askParameter(questionText, callback) {
  rlInterface.close();
  rlInterface = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rlInterface.question(questionText, (answer) => {
    const value = answer.trim();
    if (value) {
      callback(value);
    } else {
      console.log('Поле не может быть пустым!');
      setTimeout(showMenu, 1500);
    }
  });
}

// ИГРОВОЙ ДВИЖОК БОТА
function createBot() {
  console.log(`\n[Система] Запуск pocohoco3000 на ${botOptions.host} под ником ${botOptions.username}...`);
  const bot = mineflayer.createBot(botOptions);
  globalBotInstance = bot;

  bot.loadPlugin(pathfinder);

  bot.on('spawn', () => {
    console.log(`[Система] Бот ${bot.username} успешно зашел на сервер.`);
    resetAllTimers();
    initTerminalInput(bot); // Активируем чат через консоль

    setTimeout(() => {
      if (bot.entity) bot.chat('/games');
    }, 4000);

    setTimeout(() => {
      if (bot.inventory && bot.inventory.items().length === 0) {
        console.log('[Система] Меню лагает. Пробую зайти через текстовые команды...');
        bot.chat('/anarchy');
        setTimeout(() => bot.chat('/anar'), 2000);
        setTimeout(() => bot.chat('/server anarchy'), 4000);
      }
    }, 10000);
  });

  bot.on('windowOpen', async (window) => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    try {
      await bot.clickWindow(23, 0, 0);
      console.log('[Система] Прожали розовый куб Анархии.');
    } catch (err) {
      try { bot.closeWindow(window); } catch(e){}
    }
  });

  setInterval(() => {
    if (isBotActive) equipBestArmor();
  }, 4000);
  
  setInterval(() => {
    if (isBotActive) checkAndEquipTotem();
  }, 2000);

  bot.on('physicTick', () => {
    if (pvpTargetEntity && pvpTargetEntity.isValid) {
      bot.lookAt(pvpTargetEntity.position.offset(0, 1.6, 0));
    } else if (lookTargetEntity) {
      bot.lookAt(lookTargetEntity.position.offset(0, 1.6, 0));
    } else {
      const ownerName = Object.keys(bot.players).find(p => p.toLowerCase() === OWNER_NICK.toLowerCase());
      const playerEntity = bot.players[ownerName]?.entity;
      if (playerEntity) {
        bot.lookAt(playerEntity.position.offset(0, 1.6, 0));
      }
    }
  });

  function resetAllTimers() {
    if (pvpInterval) clearInterval(pvpInterval);
    pvpInterval = null;
    pvpTargetEntity = null;
    lookTargetEntity = null;
    isEquipping = false;
    isEating = false;
    isToggleArmor = false;
    try { bot.setControlState('jump', false); } catch(e){}
  }

  // РАБОТА КОНСОЛИ КАК ИГРОВОГО ЧАТА (Включается после спавна)
  function initTerminalInput(currentBot) {
    if (rlInterface) {
      rlInterface.close();
    }

    rlInterface = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rlInterface.on('line', (line) => {
      const text = line.trim();
      if (!text) return;

      if (currentBot && currentBot.entity) {
        currentBot.chat(text);
        console.log(`[Вы из терминала]: ${text}`);
      } else {
        console.log('[Система] Ошибка: Бот сейчас не на сервере.');
      }
    });
  }

  async function checkAndEquipTotem() {
    if (!bot.inventory || isEating || isEquipping || isToggleArmor) return;
    if (bot.inventory.items().length === 0) return; 

    const offhandItem = bot.inventory.slots[45];
    if (offhandItem && offhandItem.name === 'totem_of_undying') return;

    const totem = bot.inventory.items().find(item => item && item.name === 'totem_of_undying');
    if (!totem) return;

    isToggleArmor = true;
    try {
      await bot.equip(totem, 'off-hand');
    } catch (err) {}
    isToggleArmor = false;
  }

  async function equipBestArmor() {
    if (!bot.inventory || isEquipping || isEating || isToggleArmor) return;
    if (bot.inventory.items().length === 0) return; 

    const armorTypes = ['helmet', 'chestplate', 'leggings', 'boots'];
    const destinations = ['head', 'torso', 'legs', 'feet'];
    const materialValues = { netherite: 5, diamond: 4, iron: 3, chainmail: 2, gold: 1, leather: 0 };

    for (let index = 0; index < armorTypes.length; index++) {
      const type = armorTypes[index];
      const dest = destinations[index];
      
      const items = bot.inventory.items().filter(item => {
        if (!item || !item.name) return false;
        const cleanName = item.name.toLowerCase();
        if (type === 'helmet') return cleanName.includes('helmet') || cleanName.includes('head');
        if (type === 'chestplate') return cleanName.includes('chestplate') || cleanName.includes('chest');
        if (type === 'leggings') return cleanName.includes('leggings') || cleanName.includes('legs');
        if (type === 'boots') return cleanName.includes('boots') || cleanName.includes('feet');
        return false;
      });

      if (items.length === 0) continue;

      let bestItem = items[0]; 
      for (let i = 1; i < items.length; i++) {
        const currentMat = Object.keys(materialValues).find(mat => bestItem.name.toLowerCase().includes(mat)) || 'leather';
        const newMat = Object.keys(materialValues).find(mat => items[i].name.toLowerCase().includes(mat)) || 'leather';
        if (materialValues[newMat] > materialValues[currentMat]) {
          bestItem = items[i];
        }
      }

      const armorSlotId = 5 + index;
      const equippedItem = bot.inventory.slots[armorSlotId];
      
      let shouldEquip = false;
      if (!equippedItem || !equippedItem.name) {
        shouldEquip = true; 
      } else {
        const equippedMat = Object.keys(materialValues).find(mat => equippedItem.name.toLowerCase().includes(mat)) || 'leather';
        const bestMat = Object.keys(materialValues).find(mat => bestItem.name.toLowerCase().includes(mat)) || 'leather';
        if (materialValues[bestMat] > materialValues[equippedMat]) {
          shouldEquip = true;
        }
      }

      if (shouldEquip) {
        isEquipping = true;
        try {
          console.log(`[Авто-броня] Надеваю: ${bestItem.name}`);
          await bot.equip(bestItem, dest);
        } catch (err) {
          console.log(`[Авто-броня] Ошибка: ${err.message}`);
        }
        isEquipping = false;
      }
    }
  }

  function equipBestSwordFromHotbar() {
    if (!bot.inventory) return;
    const swordMaterials = { netherite: 5, diamond: 4, iron: 3, gold: 2, stone: 1, wood: 0 };
    let bestSwordSlot = null;
    let maxVal = -1;

    for (let i = 0; i < 9; i++) {
      const item = bot.inventory.slots[36 + i];
      if (item && item.name) {
        const cleanName = item.name.toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (cleanName.includes('sword')) {
          const mat = Object.keys(swordMaterials).find(mat => cleanName.includes(mat)) || 'wood';
          const val = swordMaterials[mat];
          if (val > maxVal) {
            maxVal = val;
            bestSwordSlot = i;
          }
        }
      }
    }

    if (bestSwordSlot !== null) {
      bot.setQuickBarSlot(bestSwordSlot);
    }
  }

  async function checkAndEatApple() {
    if (bot.health < 12 && !isEating && bot.inventory && !isEquipping && !isToggleArmor) {
      let appleHotbarIndex = null;

      for (let i = 0; i < 9; i++) {
        const item = bot.inventory.slots[36 + i];
        if (item && item.name && item.name.toLowerCase().includes('enchanted_golden_apple')) {
          appleHotbarIndex = i;
          break; 
        }
      }
      if (appleHotbarIndex === null) {
        for (let i = 0; i < 9; i++) {
          const item = bot.inventory.slots[36 + i];
          if (item && item.name && item.name.toLowerCase().includes('golden_apple')) {
            appleHotbarIndex = i;
            break;
          }
        }
      }
      
      if (appleHotbarIndex !== null) {
        isEating = true;
        try {
          bot.setQuickBarSlot(appleHotbarIndex);
          await new Promise(resolve => setTimeout(resolve, 150));
          bot.activateItem(); 
          await new Promise(resolve => setTimeout(resolve, 1700));
          bot.deactivateItem(); 
        } catch (err) {}
        equipBestSwordFromHotbar(); 
        isEating = false;
      }
    }
  }

  bot.on('health', () => {
    checkAndEatApple();
  });

  bot.on('messagestr', (messageString) => {
    const cleanLine = messageString.trim();
    const lowerLine = cleanLine.toLowerCase();

    console.log(`[Чат игры]: ${cleanLine}`);

    if (cleanLine.includes(OWNER_NICK) && (lowerLine.includes('телепорт') || lowerLine.includes('tpa') || lowerLine.includes('просит'))) {
      setTimeout(() => { if(bot.entity) bot.chat('/tpaccept'); }, 1000); 
      return; 
    }

    const ownerPos = cleanLine.indexOf(OWNER_NICK);
    if (ownerPos === -1) return; 

    const commandZone = cleanLine.substring(ownerPos).toLowerCase();

    if (commandZone.includes('*follow')) {
      resetAllTimers();
      const index = commandZone.indexOf('*follow');
      const targetNickRaw = commandZone.substring(index + 8).trim();
      if (!targetNickRaw) return;

      const actualName = Object.keys(bot.players).find(p => p.toLowerCase() === targetNickRaw.toLowerCase());
      const targetEntity = bot.players[actualName]?.entity;
      
      if (!targetEntity) {
        bot.chat(`Я не вижу игрока ${targetNickRaw}! Подойди ближе.`);
        return;
      }

      const mcData = require('minecraft-data')(bot.version);
      const defaultMove = new Movements(bot, mcData);
      defaultMove.canDig = false;       
      defaultMove.allowParkour = true;  
      defaultMove.swimInWater = true;   

      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new GoalFollow(targetEntity, 1), true); 
      lookTargetEntity = targetEntity; 
      bot.chat(`Иду за игроком ${actualName}!`);
    }

    if (commandZone.includes('*tp')) {
      resetAllTimers();
      bot.pathfinder.setGoal(null);
      bot.chat(`/tpa ${OWNER_NICK}`);
    }

    if (commandZone.includes('*kill')) {
      resetAllTimers();
      bot.pathfinder.setGoal(null);
      const index = commandZone.indexOf('*kill');
      const targetNickRaw = commandZone.substring(index + 5).trim();
      if (!targetNickRaw) return;

      const actualName = Object.keys(bot.players).find(p => p.toLowerCase() === targetNickRaw.toLowerCase());
      pvpTargetEntity = bot.players[actualName]?.entity;

      if (!pvpTargetEntity) {
        bot.chat(`Я не вижу цель ${targetNickRaw}!`);
        return;
      }

      equipBestSwordFromHotbar();
      bot.chat(`Атакую игрока ${actualName}!`);

      const mcData = require('minecraft-data')(bot.version);
      const defaultMove = new Movements(bot, mcData);
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new GoalFollow(pvpTargetEntity, 2), true); 

      pvpInterval = setInterval(handlePvpTick, 600); 
    }

    if (commandZone.includes('*stop')) {
      resetAllTimers();
      bot.pathfinder.setGoal(null);
      bot.chat('Все действия остановлены.');
    }

    if (commandZone.includes('*666')) {
      bot.chat('Через _-_ дней я приду');
    }
  });

  bot.on('time', () => {
    if (bot.entity && bot.entity.isInWater && !pvpTargetEntity) {
      bot.setControlState('jump', true);
    }
  });

  setInterval(() => {
    if (bot.entity && !pvpInterval && isBotActive) bot.swingArm(); 
  }, 15000);

  bot.on('kick', (reason) => {
    resetAllTimers();
    isBotActive = false;
    if (rlInterface) rlInterface.close(); 
    console.log(`[Кик] Причина: ${reason}. Возврат в меню через 5 сек...`);
    setTimeout(showMenu, 5000);
  });
  
  bot.on('end', () => {
    resetAllTimers();
    isBotActive = false;
    if (rlInterface) rlInterface.close(); 
    console.log('[Система] Соединение закрыто. Возврат в меню...');
    setTimeout(showMenu, 5000);
  });
  
  bot.on('error', (err) => console.error('[Ошибка сети]:', err.message));
}

function stopBotJumping() {
  if (globalBotInstance && globalBotInstance.entity) {
    globalBotInstance.setControlState('jump', false);
  }
}

function handlePvpTick() {
  const bot = globalBotInstance;
  if (!bot || !isBotActive) return;
  if (isEating || isEquipping || isToggleArmor) return; 
  
  if (!pvpTargetEntity || !pvpTargetEntity.isValid) {
    bot.chat('Цель уничтожена или потеряна.');
    bot.pathfinder.setGoal(null);
    if (pvpInterval) clearInterval(pvpInterval);
    pvpInterval = null;
    pvpTargetEntity = null;
    return;
  }

  const distance = bot.entity.position.distanceTo(pvpTargetEntity.position);
  if (distance <= 3.8) {
    if (bot.entity.onGround) {
      bot.setControlState('jump', true);
      setTimeout(stopBotJumping, 50);
    }
    
    bot.attack(pvpTargetEntity); 
    bot.swingArm();
  }
}

// ПЕРВЫЙ ЗАПУСК ПРОГРАММЫ НАЧИНАЕТСЯ С МЕНЮ
showMenu();
