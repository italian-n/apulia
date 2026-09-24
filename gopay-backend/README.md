# GoPay backend for apuliaoliveoil.cz

Маленький бекенд (3 serverless-функції), який спілкується з GoPay API від
імені сайту apuliaoliveoil.cz. Потрібен тому, що сайт — статичний
GitHub Pages без сервера, а GoPay's Client Secret не можна тримати в
браузері.

## Що тут є

- `api/create-payment.js` — створює платіж в GoPay, повертає `gw_url`
  (посилання на сторінку оплати), куди сайт перенаправляє покупця.
- `api/payment-status.js` — перевіряє статус платежу (сайт викликає це,
  коли покупець повертається з GoPay, щоб підтвердити оплату).
- `api/gopay-notify.js` — просто відповідає 200 OK на серверні
  повідомлення від GoPay (webhook).
- `lib/gopay.js` — обгортка над GoPay REST API (OAuth + створення/перевірка
  платежу).

## Деплой на Vercel (безкоштовно, ~5 хвилин)

1. Створити акаунт на **vercel.com** (можна через GitHub-логін).
2. Залити цю папку (`gopay-backend`) в окремий GitHub-репозиторій
   (наприклад `apulia-gopay-backend`).
3. На vercel.com → **Add New → Project** → вибрати цей репозиторій →
   **Deploy**.
4. Після першого деплою Vercel дасть URL типу
   `https://apulia-gopay-backend.vercel.app` — це і є `BACKEND_URL`.
5. У Vercel → Project → **Settings → Environment Variables** додати:

   | Name | Value |
   |---|---|
   | `GOPAY_ENV` | `sandbox` (поки тестуємо; пізніше змінити на `production`) |
   | `GOPAY_GOID` | `8343232161` |
   | `GOPAY_CLIENT_ID` | `1280752671` |
   | `GOPAY_CLIENT_SECRET` | `cs_GaTrxM6z` |
   | `ALLOWED_ORIGIN` | `https://apuliaoliveoil.cz` |
   | `BACKEND_URL` | `https://apulia-gopay-backend.vercel.app` (з кроку 4) |

6. **Redeploy** проект (Vercel → Deployments → "..." → Redeploy), щоб нові
   змінні середовища підхопились.

## Підключення до сайту

У `index.html` знайти рядок:

```js
const GOPAY_BACKEND_URL = '';
```

і вписати туди URL з кроку 4:

```js
const GOPAY_BACKEND_URL = 'https://apulia-gopay-backend.vercel.app';
```

Після цього завантажити оновлений `index.html` на GitHub Pages — оплата
карткою (варіант "Platební karta" в чекауті) почне працювати через GoPay.

## Перехід з тесту на бойовий режим (production)

Коли GoPay після тестових платежів підтвердить інтеграцію і видасть
**production**-ключі (новий ClientID/ClientSecret/GoID):

1. У Vercel → Environment Variables — замінити `GOPAY_ENV` на
   `production`, і оновити `GOPAY_GOID`, `GOPAY_CLIENT_ID`,
   `GOPAY_CLIENT_SECRET` на нові (production) значення.
2. Redeploy.

`index.html` при цьому міняти не треба — він звертається до того самого
бекенду, просто бекенд почне ходити в бойовий GoPay замість тестового.

## Тестові картки

Список тестових номерів карток для sandbox-середовища — в кабінеті GoPay,
розділ Integration → "Making payments in the test environment" →
"Show instructions".
