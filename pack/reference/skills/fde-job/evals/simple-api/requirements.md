# 样例需求：书签 CRUD API（simple-api）

写一个简单的书签 CRUD API，FastAPI + SQLite 存数据。每条书签：id、url、title、created_at。

- POST /bookmarks（创建）
- GET /bookmarks（列表）
- GET /bookmarks/{id}
- DELETE /bookmarks/{id}
- 纯后端，无前端界面。
- 带 pytest 单测（用 FastAPI TestClient）。
