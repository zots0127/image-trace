# 中文文件名编码修复

## 问题描述

当文件名包含**中文字符**或**空格**时（如`微信图片_20251117160803_328 55.png`），前端无法正确加载图片。

错误表现：
```
Failed to load image: http://127.0.0.1:8000/projects/.../images/.../file
```

## 根本原因

HTTP响应头中的`Content-Disposition`字段没有正确编码文件名，导致浏览器无法正确解析包含非ASCII字符的文件名。

原代码：
```python
headers={
    "Content-Disposition": f"inline; filename={image.filename}"
}
```

问题：
- 中文字符未编码
- 空格未转义
- 不符合RFC 2231标准

## 修复方案

使用RFC 2231标准的文件名编码格式：

```python
from urllib.parse import quote

# 正确编码文件名以支持中文和特殊字符
encoded_filename = quote(image.filename)

headers={
    "Content-Disposition": f"inline; filename*=UTF-8''{encoded_filename}"
}
```

**关键点**：
- 使用`filename*=UTF-8''`格式（注意是两个单引号）
- 用`urllib.parse.quote()`对文件名进行URL编码
- 符合RFC 2231标准，所有现代浏览器都支持

## 修改文件

`backend/app/routers_projects.py` - 第355-369行

## 测试方法

### 1. 上传包含中文的文件

```bash
curl -X POST "http://localhost:8000/upload/batch?project_id=YOUR_PROJECT_ID" \
  -H "Content-Type: multipart/form-data" \
  -F "files=@微信图片_20251117160803_328\ 55.png"
```

### 2. 在前端查看图片

访问项目详情页，应该能看到所有图片正常显示，包括中文文件名的图片。

### 3. 检查响应头

```bash
curl -I "http://localhost:8000/projects/{project_id}/images/{image_id}/file"
```

应该看到类似的响应头：
```
Content-Disposition: inline; filename*=UTF-8''%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20251117160803_328%2055.png
```

## 支持的文件名格式

修复后支持：
- ✅ 中文字符：`图片.png`
- ✅ 空格：`file name.jpg`
- ✅ 特殊字符：`文件@#$%.png`
- ✅ 混合：`微信图片_20251117160803_328 55.png`
- ✅ 日文/韩文：`画像.jpg`, `이미지.png`

## 注意事项

1. **后端自动重载**：由于使用`--reload`模式，代码已自动生效
2. **前端缓存**：如果仍有问题，刷新浏览器（Ctrl+Shift+R 或 Cmd+Shift+R）
3. **已上传文件**：此修复对已上传的文件也有效，无需重新上传

## 技术细节

### RFC 2231标准

```
Content-Disposition: inline; filename*=charset'lang'encoded-filename
```

- `charset`: 字符集（UTF-8）
- `lang`: 语言标签（可选，留空）
- `encoded-filename`: URL编码的文件名

### URL编码示例

```python
from urllib.parse import quote

# 中文文件名
filename = "微信图片.png"
encoded = quote(filename)
# 结果: %E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87.png

# 带空格的文件名
filename = "file name.jpg"
encoded = quote(filename)
# 结果: file%20name.jpg
```

## 相关标准

- [RFC 2231](https://tools.ietf.org/html/rfc2231) - MIME参数值和编码词扩展
- [RFC 6266](https://tools.ietf.org/html/rfc6266) - HTTP Content-Disposition头字段

## 浏览器兼容性

| 浏览器 | 支持情况 |
|--------|---------|
| Chrome | ✅ 完全支持 |
| Firefox | ✅ 完全支持 |
| Safari | ✅ 完全支持 |
| Edge | ✅ 完全支持 |
| IE11 | ⚠️ 部分支持 |

## 修复日期

2025年11月17日

---

**立即测试**：刷新前端页面，中文文件名的图片应该能正常显示了！

