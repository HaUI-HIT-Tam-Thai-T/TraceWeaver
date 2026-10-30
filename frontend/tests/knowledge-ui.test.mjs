import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'
import { initialKnowledgeState } from '../src/features/knowledge/state/controller.ts'
import { WID } from './event-fixtures.mjs'
test('knowledge read-only UI renders search, escaped body/URI, version, empty/loading/error and cursor controls',async()=>{
 const server=await createServer({configFile:false,cacheDir:'node_modules/.tmp/ssr-knowledge',server:{middlewareMode:true,hmr:false,ws:false}})
 try{
 const {KnowledgeSearchForm,KnowledgeResults}=await server.ssrLoadModule('/src/features/knowledge/components/KnowledgeView.tsx')
 const render=state=>renderToString(createElement(KnowledgeResults,{state,refresh(){},previous(){},next(){},signIn(){}})).replace(/<!--.*?-->/g,'')
 const form=renderToString(createElement(KnowledgeSearchForm,{filters:{q:'abc',limit:25},apply(){}}));assert.match(form,/Tìm kiếm/);assert.match(form,/name="q"/);assert.match(form,/không phân biệt hoa/)
 const initial=initialKnowledgeState(),ready={...initial,status:'ready'}
 assert.match(render(ready),/Chưa có bài hướng dẫn/);assert.match(render({...initial,status:'loading'}),/Đang tải bài hướng dẫn/)
 const html=render({...ready,nextCursor:'next',items:[{id:'a',workspace_id:WID,title:'<script>x</script>',body:'<img src=x onerror=bad()>',version:7,source_ref:'urn:knowledge:one',author_subject:'user',created_at:'2026-10-27T00:00:00.000001Z'}]})
 assert.match(html,/Version: 7/);assert.match(html,/Nguồn tham khảo: urn:knowledge:one/);assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<a href=|<textarea|contenteditable|Xóa|Tạo bài|Chỉnh sửa/);assert.match(html,/Phiên bản và thông tin bài viết/)
 const error=render({...initial,status:'error',error:{code:'INVALID_CURSOR',message:'safe',requestId:'req-1'}});assert.match(error,/Bắt đầu lại từ trang đầu/);assert.match(error,/req-1/)
 assert.match(render({...initial,status:'reauth'}),/Đăng nhập lại/)
 }finally{await server.close()}
})
