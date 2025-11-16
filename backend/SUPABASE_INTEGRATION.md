# Supabase 用户管理集成指南

## 概述

本系统使用 Supabase 作为用户认证服务，后端与 Supabase 同步用户数据，实现统一的状态管理。

## 认证流程

### 方案一：前端直接通过 Supabase 登录（推荐）

1. **前端使用 Supabase JS SDK 登录**
2. **登录成功后调用后端同步接口**
3. **后续 API 调用使用 Supabase access token**

```javascript
// 1. 前端登录
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
})

if (error) {
  console.error('Login error:', error)
  return
}

// 2. 获取用户信息和 access token
const { user, session } = data

// 3. 调用后端同步接口，在本地创建用户记录
const syncResponse = await fetch('http://duptest.0.af/auth/sync-user', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    access_token: session.access_token,
    user_id: user.id,
    email: user.email,
    display_name: user.user_metadata?.display_name || user.email.split('@')[0]
  })
})

if (syncResponse.ok) {
  const { user: backendUser } = await syncResponse.json()
  console.log('Backend user created:', backendUser)
}

// 4. 后续 API 调用都带上 Authorization header
const apiCall = await fetch('http://duptest.0.af/projects', {
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  }
})
```

### 方案二：通过后端认证接口

直接使用后端的认证端点：

```javascript
// 注册
const signUpResponse = await fetch('http://duptest.0.af/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password',
    display_name: 'John Doe'
  })
})

// 登录
const signInResponse = await fetch('http://duptest.0.af/auth/signin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password'
  })
})
```

## API 端点

### 认证相关

- `POST /auth/signup` - 用户注册
- `POST /auth/signin` - 用户登录
- `POST /auth/signout` - 用户登出
- `GET /auth/me` - 获取当前用户信息
- `GET /auth/verify` - 验证 token 有效性
- `POST /auth/sync-user` - 同步 Supabase 用户到后端

### 受保护的路由

所有需要认证的接口都在请求头中需要：
```
Authorization: Bearer <supabase_access_token>
```

受保护的路由包括：
- `GET /projects` - 获取项目列表
- `POST /projects` - 创建项目
- `GET /projects/{id}` - 获取项目详情
- `DELETE /projects/{id}` - 删除项目
- `POST /upload/batch` - 批量上传文件
- `POST /analysis/start` - 开始分析

## 前端集成示例

### React + Supabase

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://emorprdwdukhmrgeclyg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
)

class AuthService {
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email, password
    })

    if (error) throw error

    // 同步到后端
    await this.syncWithBackend(data.user, data.session)

    return data
  }

  async syncWithBackend(user, session) {
    const response = await fetch('http://duptest.0.af/auth/sync-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: session.access_token,
        user_id: user.id,
        email: user.email,
        display_name: user.user_metadata?.display_name
      })
    })

    if (!response.ok) {
      throw new Error('Failed to sync with backend')
    }

    return response.json()
  }

  async getAccessToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  // 自动添加认证头到 API 请求
  async authenticatedFetch(url, options = {}) {
    const token = await this.getAccessToken()

    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }

    return fetch(url, {
      ...options,
      headers
    })
  }
}

export const authService = new AuthService()
```

### 使用示例

```javascript
// 登录
try {
  await authService.login('user@example.com', 'password')
  console.log('登录成功')
} catch (error) {
  console.error('登录失败:', error.message)
}

// 调用受保护的 API
const projects = await authService.authenticatedFetch('http://duptest.0.af/projects')
const projectsData = await projects.json()

// 创建项目
const newProject = await authService.authenticatedFetch('http://duptest.0.af/projects', {
  method: 'POST',
  body: JSON.stringify({
    name: 'My Project',
    description: 'Project description'
  })
})
```

## Token 管理

### 获取 Token

```javascript
const { data: { session } } = await supabase.auth.getSession()
const accessToken = session?.access_token
```

### 监听 Token 变化

```javascript
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    // Token 已刷新，更新全局状态
    updateGlobalToken(session.access_token)
  }

  if (event === 'SIGNED_OUT') {
    // 用户登出，清理状态
    clearUserState()
  }
})
```

## 错误处理

常见错误及处理：

1. **401 Unauthorized** - Token 无效或过期
   - 重新登录获取新 token

2. **403 Forbidden** - 权限不足
   - 检查用户权限

3. **网络错误** - 检查后端服务状态

```javascript
async function handleApiCall(apiCall) {
  try {
    const response = await apiCall

    if (response.status === 401) {
      // Token 无效，重新登录
      await authService.relogin()
      // 重试请求
      return await apiCall
    }

    return response
  } catch (error) {
    console.error('API call failed:', error)
    throw error
  }
}
```

## 安全注意事项

1. **Token 存储**：使用安全的方式存储 access token
2. **HTTPS**：生产环境必须使用 HTTPS
3. **Token 过期**：监听 token 刷新事件
4. **权限验证**：后端始终验证 token 有效性