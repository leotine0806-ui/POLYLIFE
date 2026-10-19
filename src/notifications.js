// Until a shared data store exists, schedule generic reminders only.
const schedule = require('node-schedule');
const { Notification } = require('electron');
let jobs = [];
function notify(title, body) {
  if (!Notification.isSupported()) return false;
  new Notification({ title, body }).show();
  return true;
}
async function briefingMattutino() {
  return notify('Polylife: buongiorno', 'Apri Polylife per controllare la tua giornata.');
}
async function streakCheckSerale() {
  return notify('Polylife: check serale', 'Apri Polylife per registrare le attività della giornata.');
}
async function alertPreVerifica() { return false; }
function stop() {
  jobs.forEach(job => job && job.cancel());
  jobs = [];
}
function start() {
  stop();
  jobs = [schedule.scheduleJob('0 7 * * *', briefingMattutino), schedule.scheduleJob('0 20 * * *', streakCheckSerale)];
  console.log('Promemoria generici attivi alle 07:00 e alle 20:00, solo mentre l’app è aperta.');
}
module.exports = { start, stop, briefingMattutino, streakCheckSerale, alertPreVerifica };
