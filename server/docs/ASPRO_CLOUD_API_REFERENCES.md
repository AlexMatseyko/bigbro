# Подключение Aspro.Cloud API к приложениям — сводка по ресурсам

Собрано из открытых источников для интеграции Team Tracker с Aspro.Cloud.

---

## 1. Официальная документация

| Ресурс | Описание |
|--------|----------|
| **[aspro.cloud/api](https://aspro.cloud/api/)** | Основная инструкция по API (иногда недоступна по таймауту). |
| **[aspro.cloud/help/articles/10282-10286](https://aspro.cloud/help/articles/10282-10286--marketplace-faq/)** | FAQ маркетплейса: аутентификация, OAuth 2.0, скоупы. |
| **[aspro.cloud/help/articles/3167](https://aspro.cloud/help/articles/3167--integracii/)** | Интеграции в Aspro.Cloud, ссылка на документацию по API. |
| **[aspro.finance/integrations/api](https://aspro.finance/integrations/api/)** | Краткое описание API для интеграции с внешними системами. |

---

## 2. Два способа работы с API

### Приложения маркетплейса (OAuth 2.0)

- **Аутентификация:** только через **access-токен**, полученный по **OAuth 2.0**.
- **Передача токена:** в **заголовке** запроса (не в query).  
  Обычно: `Authorization: Bearer <access_token>`.
- **Токен привязан** к пользователю и приложению, не к аккаунту.
- **Скоупы** задаются в манифесте приложения (users, user.me, crm, task и т.д.).

### Интеграции по API-ключу (аккаунт)

- **Где взять ключ:** в портале **Settings → Portal Settings → API Settings → Create**.
- **Домен:** адрес портала из браузера, например `alexligear1.aspro.cloud`.
- Внешние сервисы (например, Albato) подключаются по **домену + API ключ**.
- API-ключ выдаётся на **один аккаунт**, не привязан к пользователю.

Источник: [Как подключить Aspro.Cloud к Albato](https://blog.albato.ru/kak-podklyuchit-aspro-cloud-k-albato/).

---

## 3. Настройки портала (администратор)

- **Настройки системы:** аватар в правом верхнем углу → Настройки портала.
- **API Settings:** Settings → Portal Settings → API Settings — создание и управление API-ключами.
- **Webhooks:** Settings → Portal Settings → Webhooks — для событий (триггеры).
- Домен портала по умолчанию: `https://<код-аккаунта>.aspro.cloud`.

Источники: [Настройки портала](https://aspro.cloud/help/articles/3052-3056--nastrojki-portala/), [Albato](https://blog.albato.ru/kak-podklyuchit-aspro-cloud-k-albato/).

---

## 4. Интеграции и примеры

- **Albato:** подключение по домену и API-ключу из Portal Settings; настройка вебхуков.
- **Готовые интеграции:** Calendly, Slack, Google Calendar/Drive, Notion, Confluence, Worksection, 1С, email, соцсети и др. — через модули в разделе «Интеграции».
- **Собственные интеграции:** по [документации API](https://aspro.cloud/api/).

---

## 5. Что важно для нашего приложения (Team Tracker)

1. **Эндпоинт для получения OAuth-токена** в публичной документации явно не указан (нет точного URL типа `.../oauth/token` или `.../oauth2/token`). Имеет смысл уточнить в поддержке Aspro.Cloud или в личном кабинете разработчика.
2. **При использовании API-ключа** (Portal Settings → API Settings) интеграции типа Albato передают **домен + ключ**. Возможно, для запросов к API нужен заголовок с доменом или ключ в определённом формате — в описании API это не детализируется.
3. **Запросы к API** по документации выполняются с передачей **access-токена в заголовке**. Для приложений маркетплейса подразумевается именно OAuth access_token.

---

## 6. Полезные ссылки (кратко)

- Документация API: https://aspro.cloud/api/
- FAQ маркетплейса: https://aspro.cloud/help/articles/10282-10286--marketplace-faq/
- Интеграции: https://aspro.cloud/help/articles/3167--integracii/
- Подключение через Albato (домен + API ключ): https://blog.albato.ru/kak-podklyuchit-aspro-cloud-k-albato/
- Настройки портала: https://aspro.cloud/help/articles/3052-3056--nastrojki-portala/
