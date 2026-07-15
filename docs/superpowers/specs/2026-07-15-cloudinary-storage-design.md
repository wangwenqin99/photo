# Cloudinary 图片存储改造设计

## 背景与目标

当前相册已使用 React、Cloudflare Workers 和 D1 实现完整浏览与管理功能。Cloudflare R2 要求绑定付款方式，而项目需要在不绑定银行卡的前提下公开部署，因此将图片文件存储改为 Cloudinary 免费计划。

本次改造只替换图片存储层。相册页面、移动端与桌面端翻页、管理员登录、相册管理、图片排序和封面逻辑保持不变。

## 方案选择

采用服务端签名的 Cloudinary Upload API：

- Cloudflare Workers 继续运行页面和 API。
- Cloudflare D1 继续保存相册、图片元数据和管理员会话。
- Cloudinary 保存图片文件并通过其 CDN 提供读取。
- 管理员上传请求先经过现有会话校验，再由 Worker 使用 Cloudinary API Secret 生成签名。
- 浏览器和 Git 仓库永远不能获得 API Secret。

不采用无签名前端上传，因为它会扩大公开上传和配额滥用风险；不改用 Supabase，因为这会同时引入第二套数据库与权限模型，超出本次最小改造范围。

## 配置与密钥

运行环境增加三个变量：

- `CLOUDINARY_CLOUD_NAME`：Cloudinary 产品环境名称，可作为普通环境变量。
- `CLOUDINARY_API_KEY`：Cloudinary API Key，作为 Secret 保存。
- `CLOUDINARY_API_SECRET`：Cloudinary API Secret，作为 Secret 保存。

管理员邮箱、密码哈希和密码盐继续使用现有 Secret。Cloudinary Secret 只通过本机忽略文件和 `wrangler secret put` 配置，不写入源码、Git 历史、日志或聊天消息。

项目不再声明 R2 的 `PHOTOS` 绑定；D1 的 `DB` 绑定保持不变。

## 存储接口

`lib/storage.ts` 对路由提供以下能力：

- `putPhoto(config, albumId, file)`：校验相册标识，创建 `albums/<albumId>/<uuid>` 形式的 Cloudinary public ID，签名并上传图片，返回 public ID。
- `photoDeliveryUrl(config, publicId)`：生成 Cloudinary HTTPS CDN 地址。
- `deletePhoto(config, publicId)`：签名调用 destroy 接口删除图片。

签名使用 Cloudinary 要求的有序参数字符串和 SHA-1 摘要。上传与删除都设置明确超时，并把第三方错误转换成应用内部错误，响应中不暴露 Cloudinary 密钥或原始错误正文。

D1 的 `photos.object_key` 字段继续复用，但其含义从 R2 object key 改为 Cloudinary public ID；不需要修改数据库结构。

## 上传流程

1. 管理员会话校验通过。
2. 校验相册存在。
3. 校验文件类型和大小。
4. 免费计划下单张图片最大调整为 10 MB；支持 JPG、PNG、WebP 和 GIF。
5. Worker 生成签名，将文件上传至 Cloudinary。
6. 上传成功后将 public ID 和现有图片元数据写入 D1。
7. 如果 D1 写入失败，立即删除刚上传的 Cloudinary 图片。
8. 批量上传继续保持最多 3 张并发，单张失败不阻断其他文件。

前端与服务端使用同一个 10 MB 限制，避免用户在 Cloudinary 拒绝后才看到错误。

## 图片读取

公开图片 API 根据 D1 中的 public ID 生成 Cloudinary CDN 地址，并返回临时重定向。浏览器仍然使用现有 `/api/photos/<photoId>` 地址，因此页面组件和数据库返回结构无需改变。

重定向响应允许公共缓存。Cloudinary 负责图片内容类型、范围请求和 CDN 分发。

## 删除与一致性

- 删除单张图片：先更新 D1，使访客不再看到该图片，再调用 Cloudinary 删除；第三方清理失败时记录服务端错误，但不恢复已删除的公开记录。
- 删除相册：删除 D1 中的相册和图片记录，再逐个清理对应 Cloudinary public ID。
- 删除封面图片后继续沿用现有封面回退规则。
- Cloudinary public ID 使用 UUID，避免删除后缓存与新图片冲突。

## 本地开发

本地 `.dev.vars` 增加 Cloudinary 三项配置，并继续被 Git 忽略。开发服务器直接调用 Cloudinary 测试账号，因此本地上传会消耗 Cloudinary 免费额度；单元测试使用注入的 fetch 替身，不访问真实 Cloudinary。

## 测试与验收

测试优先覆盖：

- Cloudinary 参数排序和 SHA-1 签名。
- 上传请求包含正确的文件、public ID、时间戳、API Key 和签名。
- 上传失败、响应缺少 public ID、D1 写入失败时的清理。
- 删除请求签名和第三方失败处理。
- CDN 地址对 public ID 路径段进行安全编码。
- 上传大小限制从 20 MB 调整为 10 MB，前后端保持一致。
- 所有现有管理员权限、相册 API、翻页和界面测试继续通过。

发布验收包括：生产构建成功、D1 远程迁移成功、Cloudinary Secret 已配置、匿名访问首页成功、管理员登录成功，以及上传一张测试图片后能够公开浏览和删除。

## 范围边界

本次不迁移本地 R2 模拟存储中的 5 张图片。公网部署完成后由管理员从原始图片重新上传。本次不加入视频、图片编辑、自动压缩设置、Cloudinary 上传组件或多管理员体系。
