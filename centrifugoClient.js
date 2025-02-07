// centrifugoClient.js

const WebSocket = require('ws');
const EventEmitter = require('events');

/**
 * Класс для подключения к Centrifugo, подписки на канал и обработки сообщений.
 * 
 * Опции:
 * - wsUrl: URL подключения (по умолчанию: 'wss://centrifugo.donationalerts.com/connection/websocket')
 * - socketToken: Токен подключения к Centrifugo (выдается DonationAlerts через OAuth или иным способом)
 */
class CentrifugoClient extends EventEmitter {
  constructor(options = {}) {
    super();
    this.wsUrl = options.wsUrl || 'wss://centrifugo.donationalerts.com/connection/websocket';
    this.socketToken = options.socketToken; // токен для подключения (socket_connection_token)
    this.ws = null;
    this.clientId = null;
  }

  connect() {
    this.ws = new WebSocket(this.wsUrl);

    this.ws.on('open', () => {
      console.log('[Centrifugo] WebSocket соединение открыто');
      // Отправляем начальное сообщение с токеном подключения
      if (this.socketToken) {
        const initMessage = {
          params: {
            token: this.socketToken
          },
          id: 1
        };
        this.sendMessage(initMessage);
      } else {
        console.warn('[Centrifugo] Не задан socketToken. Без него соединение может не пройти авторизацию.');
      }
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        console.log('[Centrifugo] Получено сообщение:', message);

        // Если получили clientId – сохраняем его
        if (message.result && message.result.client) {
          this.clientId = message.result.client;
          console.log('[Centrifugo] Получен clientId:', this.clientId);
          this.emit('connected', this.clientId);
        } else if (message.method === 1 && message.result) {
          // Подтверждение подписки или другие ответы
          this.emit('subscribed', message.result);
        } else if (message.result && message.result.data) {
          // Это уведомление из канала (например, донат)
          this.emit('message', message.result.data);
        } else {
          // Любое другое сообщение
          this.emit('message', message);
        }
      } catch (err) {
        console.error('[Centrifugo] Ошибка при разборе сообщения:', err);
      }
    });

    this.ws.on('close', () => {
      console.log('[Centrifugo] Соединение закрыто');
      // Здесь можно добавить логику переподключения
      this.emit('close');
    });

    this.ws.on('error', (err) => {
      console.error('[Centrifugo] Ошибка WebSocket:', err);
      this.emit('error', err);
    });
  }

  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('[Centrifugo] Соединение не открыто. Невозможно отправить сообщение:', message);
    }
  }

  /**
   * Подписка на канал.
   * @param {string} channel - Название канала (например, "$alerts:donation_123456")
   * @param {string} subscriptionToken - Токен подписки, полученный от DonationAlerts через API
   */
  subscribe(channel, subscriptionToken) {
    const subscribeMsg = {
      params: {
        channel: channel,
        token: subscriptionToken
      },
      method: 1,
      id: 2
    };
    this.sendMessage(subscribeMsg);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

module.exports = CentrifugoClient;
