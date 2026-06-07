const mineflayer = require('mineflayer');
const readline = require('readline');

const botOptions = {
  host: 'mc.play-fast.ru',
  port: 25565,
  username: 'pocohoco3000',
  version: '1.16.5',
  viewDistance: 'tiny',
  colorsEnabled: false
};

const OWNER_NICK = 'SvyatoslavPro123';
let pvpInterval = null, pvpTargetEntity = null, customCycleInterval = null, currentCycleCommand = null, cycleSeconds = 3;
let isEquipping = false, isEating = false, isToggleArmor = false, isDeadNow = false; // 🌟 Добавили флаг смерти

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

function createBot() {
  console.log('[Система] Запуск ПВП-терминатора pocohoco3000...');
  const bot = mineflayer.createBot(botOptions);

  rl.removeAllListeners('line');
  rl.on('line', (line) => {
    let text = line.trim();
    if (text.length > 0) { bot.chat(text); console.log(`[Ты из консоли]: ${text}`); }
  });

  bot.on('spawn', () => {
    console.log(`[Система] Бот ${bot.username} зашел на сервер.`);
    isDeadNow = false; // Бот живой при спавне
    setTimeout(() => { bot.chat('/games'); }, 4000);
    setTimeout(() => {
      if (bot.inventory && bot.inventory.items().length === 0) {
        bot.chat('/anarchy');
        setTimeout(() => bot.chat('/anar'), 2000);
        setTimeout(() => bot.chat('/server anarchy'), 4000);
      }
    }, 10000);
  });

  bot.on('windowOpen', async (w) => {
    await new Promise(r => setTimeout(r, 2000));
    try { await bot.clickWindow(23, 0, 0); } catch (err) { bot.closeWindow(w); }
  });

  // 🌟 УМНОЕ БЕЗОПАСНОЕ ВОЗРОЖДЕНИЕ БЕЗ ТАЙМАУТОВ
  bot.on('death', () => {
    console.log('[Защита] Бот погиб! Ставлю цикл на паузу и возрождаюсь...');
    isDeadNow = true; // Блокируем отправку команд в цикле, пока бот мертв
    bot.respawn();
    
    // Ждем прогрузки на спавне, сбрасываем статус смерти и сразу летим на хом
    setTimeout(() => {
      isDeadNow = false;
      if (currentCycleCommand) {
        bot.chat(currentCycleCommand);
        console.log(`[Бессмертие] Бот успешно встал и прописал: ${currentCycleCommand}`);
      }
    }, 2500);
  });

  setInterval(() => { equipArmor(); }, 2500);
  setInterval(() => { checkTotem(); }, 1500);

  bot.on('physicTick', () => {
    if (pvpTargetEntity?.isValid) bot.lookAt(pvpTargetEntity.position.offset(0, 1.6, 0));
  });

  async function checkTotem() {
    if (!bot.inventory || isEating || isEquipping || isToggleArmor || bot.inventory.items().length === 0 || isDeadNow) return;
    if (bot.inventory.slots?.name === 'totem_of_undying') return;
    let totem = bot.inventory.items().find(i => i && i.name === 'totem_of_undying');
    if (!totem || totem.slot === undefined) return;
    isToggleArmor = true;
    try {
      await bot.clickWindow(totem.slot, 0, 0); await new Promise(r => setTimeout(r, 350));
      await bot.clickWindow(45, 0, 0); await new Promise(r => setTimeout(r, 350));
      if (bot.inventory.selectedItem) await bot.clickWindow(totem.slot, 0, 0);
    } catch (e) {}
    isToggleArmor = false;
  }

  async function equipArmor() {
    if (!bot.inventory || isEquipping || isEating || isToggleArmor || bot.inventory.items().length === 0 || isDeadNow) return;
    const types = ['helmet', 'chestplate', 'leggings', 'boots'];
    for (let index = 0; index < types.length; index++) {
      const type = types[index];
      const items = bot.inventory.items().filter(item => {
        if (!item || !item.name) return false;
        let c = item.name.toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (type === 'helmet') return c.includes('helmet') || c.includes('head');
        if (type === 'chestplate') return c.includes('chestplate') || c.includes('chest');
        if (type === 'leggings') return c.includes('leggings') || c.includes('legs');
        return c.includes('boots') || c.includes('feet');
      });
      if (items.length === 0) continue;
      let best = items;
      if (!best || best.slot === undefined) continue;
      let eq = bot.inventory.slots[5 + index];
      if (!eq || !eq.name) {
        isEquipping = true;
        try {
          await bot.clickWindow(best.slot, 0, 0); await new Promise(r => setTimeout(r, 400));
          await bot.clickWindow(5 + index, 0, 0); await new Promise(r => setTimeout(r, 400));
        } catch (err) {}
        isEquipping = false; return;
      }
    }
  }

  bot.on('messagestr', (msg) => {
    const clean = msg.trim();
    const lowerLine = clean.toLowerCase();
    console.log(`[Чат игры]: ${clean}`);

    if (lowerLine.includes(OWNER_NICK.toLowerCase()) && (lowerLine.includes('телепорт') || lowerLine.includes('tpa') || lowerLine.includes('просит'))) {
      setTimeout(() => bot.chat('/tpaccept'), 1000); 
      return;
    }

    if (!lowerLine.includes(OWNER_NICK.toLowerCase()) || !lowerLine.includes('*')) return;

    if (lowerLine.includes('*tp')) {
      if (pvpInterval) clearInterval(pvpInterval);
      if (customCycleInterval) clearInterval(customCycleInterval);
      pvpInterval = null; customCycleInterval = null; currentCycleCommand = null; pvpTargetEntity = null;
      bot.chat(`/tpa ${OWNER_NICK}`);
      return;
    }

    if (lowerLine.includes('*cycle')) {
      if (customCycleInterval) clearInterval(customCycleInterval);
      
      const match = clean.match(/\*cycle\s+(\d+)\s+(.+)$/i);
      if (!match) {
        bot.chat('Ошибка! Используй: *cycle 3 /home d');
        return;
      }

      cycleSeconds = parseInt(match[1]);
      let targetCmd = match[2].trim(); 

      currentCycleCommand = targetCmd;
      bot.chat(`Цикл "${targetCmd}" каждые ${cycleSeconds} сек.`); 
      bot.chat(targetCmd);
      
      // 🌟 Цикл проверяет флаг isDeadNow: если бот мертв, он пропустит тик спама, защищаясь от вылета
      customCycleInterval = setInterval(() => { 
        if (!isDeadNow) bot.chat(targetCmd); 
      }, cycleSeconds * 1000);
      return;
    }

    if (lowerLine.includes('*kill')) {
      if (pvpInterval) clearInterval(pvpInterval);
      const cmdIndex = lowerLine.indexOf('*kill');
      let raw = clean.substring(cmdIndex + 5).trim(); 
      if (!raw) return;
      let act = Object.keys(bot.players).find(p => p.toLowerCase() === raw.toLowerCase());
      pvpTargetEntity = bot.players[act]?.entity;
      if (!pvpTargetEntity) { bot.chat(`Я не вижу цель ${raw}!`); return; }
      bot.chat(`Атакую игрока ${act} критами!`);
      pvpInterval = setInterval(() => {
        if (!pvpTargetEntity?.isValid || isDeadNow) { clearInterval(pvpInterval); pvpInterval = null; return; }
        if (bot.entity && bot.entity.position.distanceTo(pvpTargetEntity.position) <= 3.8) {
          bot.setControlState('jump', true);
          setTimeout(() => { bot.setControlState('jump', false); bot.attack(pvpTargetEntity); bot.swingArm(); }, 150);
        }
      }, 650);
      return;
    }

    if (lowerLine.includes('*stop')) {
      if (pvpInterval) clearInterval(pvpInterval); 
      if (customCycleInterval) clearInterval(customCycleInterval);
      pvpInterval = null; customCycleInterval = null; currentCycleCommand = null; pvpTargetEntity = null;
      bot.chat('Все действия остановлены.');
    }
  });

  bot.on('kick', () => { if (customCycleInterval) clearInterval(customCycleInterval); setTimeout(createBot, 15000); }); 
  bot.on('end', () => { if (customCycleInterval) clearInterval(customCycleInterval); setTimeout(createBot, 15000); });
  bot.on('error', (e) => console.error(e.message));
}
createBot();
