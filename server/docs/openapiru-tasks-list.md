# Список задач: openapiru.json и документация Aspro.Cloud API

Официальная документация: **[aspro.cloud/api](https://aspro.cloud/api)** — работа с полями и списками, фильтрация.

Полезные разделы справки:
- [Работа с фильтрами](https://aspro.cloud/help/articles/3052-3079--rabota-s-filtrami/) — логика фильтров (И/ИЛИ), даты, поля.
- [Настройка представления списка](https://aspro.cloud/help/articles/3052-3056-3065--nastrojka-predstavleniya-spiska/) — колонки, вид списка.
- [Пользовательские поля и списки](https://aspro.cloud/help/articles/3360--polzovatelskie-polya-i-spiski/) — свои поля и таблицы.

---

## Эндпоинт списка задач (API, с api_key)

- **Путь в spec:** `/task/tasks/list` → `GET https://{company}.aspro.cloud/api/v1/module/task/tasks/list`
- **Авторизация:** в каждом запросе обязателен `api_key` в query ([aspro.cloud/api](https://aspro.cloud/api)).
- **Параметры в openapiru.json:** у метода массив `parameters` пустой; в описании API указано:
  - **filter** — параметры фильтрации получаемого списка записей;
  - **search** — поисковый запрос.
- **Формат фильтров в query:** `filter[имя_поля]=значение` (разные поля объединяются по И, несколько значений по одному полю — по ИЛИ, см. [Работа с фильтрами](https://aspro.cloud/help/articles/3052-3079--rabota-s-filtrami/)).

### Что используем в коде (tasks.js, asproService)

| Параметр | Значение | Назначение |
|----------|----------|------------|
| `api_key` | из .env | обязателен |
| `filter[user_id]` | aspro_id пользователя | задачи, где пользователь участвует/ответственный |
| `filter[archive_status]` | `0` | не в архиве |
| `limit` | `100` | пагинация |
| `page` | `1` | пагинация |

### Возможные поля для фильтра (по openapiru и справке)

По схеме ответа задач и документации можно пробовать, при необходимости, дополнительные фильтры (если API их поддерживает для списка задач):

- `filter[closed_date]` — дата закрытия (в т.ч. пустая для незакрытых);
- `filter[status]` — статус (1 — новая, 3 — в работе, 4 — на проверке и т.д.);
- `filter[workflow_stage_id]` — этап workflow;
- `filter[responsible_id]` — ответственный;
- `filter[owner_id]` — постановщик.

Точный набор поддерживаемых полей для `filter[...]` в списке задач см. в [aspro.cloud/api](https://aspro.cloud/api).

### Ответ

`application/json` вида `{ "response": { "total", "page", "count", "items": [ ... ] } }`. Поля элементов в spec: `id`, `name`, `description`, `status`, `responsible_id`, `owner_id`, `closed_date`, `workflow_stage_id`, `workflow_id`, `type`, `public_template`, `template_id`, `archive_status`, `is_hidden`, `is_archive`, `created_date`, `updated_date` и др.

---

## Другие пути из openapiru

- `/task/tasks/get/{id}` — одна задача
- `/task/tasks/update/{id}` — обновление
- `/task/stages/list` — этапы workflow (маппинг «В работе» и т.д.)
- `/task/taskslists/list` — список «списков задач» (представлений); в spec параметры не описаны. Отдельного параметра **view_id** / **list_id** для выбора представления в `/task/tasks/list` в openapiru **нет**.

### Создание задачи (POST)

В openapiru может быть путь вида `/task/tasks/add` или `/task/tasks/create`. В коде перебираются пути из списка; если ни один не вернул ID задачи, задайте точный путь в **.env**:

```env
ASPRO_TASKS_ADD_PATH=/module/task/tasks/add
```

Точный эндпоинт и формат тела (JSON или form-urlencoded) см. в [aspro.cloud/api](https://aspro.cloud/api/). Запрос отправляется с полями `name`, `owner_id`, `responsible_id`, `project_id` (опционально).

---

## REST list2_list (в спецификации не описан)

- **URL:** `https://{company}.aspro.cloud/_module/task/rest/task/list2_list/{viewId}`
- Рассчитан на сессию в браузере. При авторизации только по `api_key` (query или заголовок `X-Api-Key`) возвращается **401**. В приложении при пустом/ошибке list2_list используется только API `module/task/tasks/list`.

---

## Итог

- Список задач в приложении берётся из **GET** `.../api/v1/module/task/tasks/list` с `api_key` и при необходимости с `filter[user_id]`, `filter[archive_status]`, `limit`, `page`.
- Полное описание полей и списков — в [aspro.cloud/api](https://aspro.cloud/api); логика фильтров и представлений — в справке по ссылкам выше.
